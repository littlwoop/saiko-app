/**
 * Notification utility for managing completion challenge reminders
 */

const NOTIFICATION_PERMISSION_KEY = 'notification-permission-requested';
const REMINDER_TIME = 18; // 18:00 (6 PM)

/**
 * Detect if running on iOS
 */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detect if running on Android
 */
function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/**
 * Check if app is installed as PWA (standalone mode)
 */
function isInstalledPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS Safari specific property
    (window.navigator as any).standalone === true;
}

/**
 * Check if device/browser supports background notifications well
 */
function supportsBackgroundNotifications(): boolean {
  // Android generally supports background notifications better
  if (isAndroid()) return true;
  
  // iOS 16.4+ supports web push for installed PWAs
  if (isIOS() && isInstalledPWA()) {
    // Check iOS version (rough check via user agent)
    const iosVersion = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    if (iosVersion) {
      const major = parseInt(iosVersion[1], 10);
      const minor = parseInt(iosVersion[2], 10);
      // iOS 16.4 = 16_4
      return major > 16 || (major === 16 && minor >= 4);
    }
  }
  
  return false;
}

export interface NotificationSchedule {
  id: string;
  scheduledTime: number;
  userId: string;
  date: string; // YYYY-MM-DD
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  // Special handling for iOS - notifications only work for installed PWAs
  if (isIOS() && !isInstalledPWA()) {
    console.warn('iOS requires the app to be installed as a PWA for notifications');
    // Could show a message to the user here
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission has been denied');
    return false;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
  return permission === 'granted';
}

/**
 * Get mobile-specific notification support info
 */
export function getMobileNotificationInfo(): {
  isIOS: boolean;
  isAndroid: boolean;
  isInstalledPWA: boolean;
  supportsBackground: boolean;
  requiresInstall: boolean;
} {
  const ios = isIOS();
  const android = isAndroid();
  const installed = isInstalledPWA();
  const background = supportsBackgroundNotifications();
  
  return {
    isIOS: ios,
    isAndroid: android,
    isInstalledPWA: installed,
    supportsBackground: background,
    requiresInstall: ios && !installed, // iOS requires installation for notifications
  };
}

/**
 * Check if notification permission has been requested before
 */
export function hasRequestedNotificationPermission(): boolean {
  return localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === 'true';
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Calculate the next 18:00 time (today if before 18:00, tomorrow if after)
 */
export function getNextReminderTime(): Date {
  const now = new Date();
  const reminder = new Date();
  reminder.setHours(REMINDER_TIME, 0, 0, 0);

  // If it's already past 18:00 today, schedule for tomorrow
  if (now >= reminder) {
    reminder.setDate(reminder.getDate() + 1);
  }

  return reminder;
}

/**
 * Register background sync for notifications (better mobile support)
 */
async function registerBackgroundSync(userId: string, date: string): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Background Sync API - available in Chrome/Edge (including Android)
      // @ts-expect-error - Background Sync API (experimental)
      if (registration.sync) {
        // @ts-expect-error - Background Sync API
        await registration.sync.register(`check-completion-challenge-${userId}-${date}`);
        console.log('Background sync registered for notifications');
      }
    } catch (error) {
      // Background sync not available (not all browsers support it)
      console.debug('Background sync not available (this is normal on some browsers):', error);
    }
  }
}

/**
 * Schedule a notification for the completion challenge reminder
 */
export async function scheduleDailyChallengeReminder(userId: string, date: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return;
  }

  try {
    // Register service worker if not already registered
    const registration = await navigator.serviceWorker.ready;
    
    const reminderTime = getNextReminderTime();
    const delay = reminderTime.getTime() - Date.now();

    // Only schedule if it's in the future and less than 24 hours away
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      // Store the schedule
      const scheduleId = `reminder-${userId}-${date}`;
      const schedule: NotificationSchedule = {
        id: scheduleId,
        scheduledTime: reminderTime.getTime(),
        userId,
        date,
      };

      // Store in localStorage for persistence
      const schedules = getStoredSchedules();
      // Avoid duplicates
      if (!schedules.find(s => s.id === scheduleId)) {
        schedules.push(schedule);
        localStorage.setItem('notification-schedules', JSON.stringify(schedules));
      }

      // Try to register background sync for better mobile support
      await registerBackgroundSync(userId, date);

      // Use setTimeout as a fallback (works when tab is open)
      // For mobile, this is less reliable when app is closed
      setTimeout(() => {
        checkAndShowReminder(userId, date);
      }, delay);

      console.log(`Scheduled reminder for ${reminderTime.toLocaleString()}`);
      
      // On mobile, log helpful info
      const mobileInfo = getMobileNotificationInfo();
      if (mobileInfo.requiresInstall) {
        console.info('💡 Tip: Install the app to your home screen for better notification support on iOS');
      }
    }
  } catch (error) {
    console.error('Error scheduling notification:', error);
  }
}

/**
 * Check if user has completed a completion challenge for a specific date
 */
async function isCompletionChallengeCompleted(
  userId: string,
  challengeId: number,
  date: string
): Promise<boolean> {
  const { supabase } = await import('./supabase');
  const { getLocalDateFromString, localDateToUTCStart, localDateToUTCEnd, utcTimestampToLocalDateString } = await import('./date-utils');
  
  try {
    // Get the challenge to check its objectives
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('objectives, start_date, end_date')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      console.error('Error fetching challenge:', challengeError);
      return true; // Assume completed if we can't check
    }

    // Check if challenge is active on this date
    const checkDate = getLocalDateFromString(date);
    const startDate = getLocalDateFromString(challenge.start_date);
    const endDate = challenge.end_date ? getLocalDateFromString(challenge.end_date) : null;

    // If date is before start or after end (if end exists), don't send notification
    if (checkDate < startDate || (endDate && checkDate > endDate)) {
      return true; // Not active on this date, consider "completed"
    }

    // Parse objectives if it's a JSON string, otherwise use directly
    let objectives: Array<{ id: string | number }>;
    if (typeof challenge.objectives === 'string') {
      try {
        objectives = JSON.parse(challenge.objectives);
      } catch {
        console.error('Error parsing objectives JSON');
        return true; // Assume completed if we can't parse
      }
    } else if (Array.isArray(challenge.objectives)) {
      objectives = challenge.objectives;
    } else {
      console.error('Objectives is not an array');
      return true; // Assume completed if invalid format
    }

    if (!objectives || objectives.length === 0) {
      return true; // No objectives, consider completed
    }

    // Get all objective IDs as strings for comparison
    const objectiveIds = new Set<string>(
      objectives.map(obj => String(obj.id || obj))
    );

    // Get UTC date range for the specific date
    const dateStartUTC = localDateToUTCStart(date);
    const dateEndUTC = localDateToUTCEnd(date);

    // Get all entries for this challenge and user on this date
    const { data: entries, error: entriesError } = await supabase
      .from('entries')
      .select('objective_id, created_at')
      .eq('user_id', userId)
      .eq('challenge_id', challengeId)
      .gte('created_at', dateStartUTC)
      .lte('created_at', dateEndUTC);

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return true; // Assume completed if we can't check
    }

    if (!entries || entries.length === 0) {
      return false; // No entries for this date
    }

    // Convert entries to local dates and collect objective IDs that have entries for this date
    const objectivesWithEntries = new Set<string>();
    entries.forEach(entry => {
      const entryDate = utcTimestampToLocalDateString(entry.created_at);
      if (entryDate === date) {
        objectivesWithEntries.add(String(entry.objective_id));
      }
    });

    // Check if all objectives have entries for this date
    for (const objectiveId of objectiveIds) {
      if (!objectivesWithEntries.has(objectiveId)) {
        return false; // Missing entry for this objective
      }
    }

    return true; // All objectives have entries for this date
  } catch (error) {
    console.error('Error checking completion challenge:', error);
    return true; // Assume completed on error
  }
}

/**
 * Get all active completion challenges the user has joined
 */
async function getActiveCompletionChallenges(userId: string): Promise<Array<{ id: number; title: string }>> {
  const { supabase } = await import('./supabase');
  const { normalizeToLocalDate } = await import('./date-utils');

  try {
    const today = new Date();
    const todayNormalized = normalizeToLocalDate(today);

    // Get all challenges the user has joined that are completion type
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('id, title, challenge_type, start_date, end_date, participants')
      .eq('challenge_type', 'completion')
      .contains('participants', JSON.stringify([userId]));

    if (error) {
      console.error('Error fetching completion challenges:', error);
      return [];
    }

    if (!challenges) return [];

    // Filter for active challenges (started but not ended)
    return challenges
      .filter(challenge => {
        const startDate = normalizeToLocalDate(challenge.start_date);
        const endDate = challenge.end_date ? normalizeToLocalDate(challenge.end_date) : null;
        
        // Challenge is active if today is >= start and (no end date or today <= end)
        return todayNormalized >= startDate && (!endDate || todayNormalized <= endDate);
      })
      .map(challenge => ({
        id: challenge.id,
        title: challenge.title,
      }));
  } catch (error) {
    console.error('Error getting active completion challenges:', error);
    return [];
  }
}

/**
 * Check if completion challenges are completed and show reminder if not
 */
export async function checkAndShowReminder(userId: string, date: string): Promise<void> {
  if (getNotificationPermission() !== 'granted') {
    return;
  }

  try {
    // Check if we already showed reminder today to avoid duplicates
    const reminderShownKey = `reminder-shown-${userId}-${date}`;
    const reminderShown = localStorage.getItem(reminderShownKey);
    
    if (reminderShown) {
      // Already showed reminder for this date
      return;
    }

    // Get all active completion challenges the user has joined
    const activeChallenges = await getActiveCompletionChallenges(userId);
    
    if (activeChallenges.length === 0) {
      // No active completion challenges
      return;
    }

    // Check each challenge to see if it's completed for today
    const incompleteChallenges: Array<{ id: number; title: string }> = [];
    
    for (const challenge of activeChallenges) {
      const isCompleted = await isCompletionChallengeCompleted(userId, challenge.id, date);
      if (!isCompleted) {
        incompleteChallenges.push(challenge);
      }
    }

    if (incompleteChallenges.length > 0) {
      // Show notification for incomplete challenges
      const registration = await navigator.serviceWorker.ready;
      
      const challengeCount = incompleteChallenges.length;
      const title = challengeCount === 1 
        ? 'Daily Challenge Reminder'
        : `${challengeCount} Daily Challenge Reminders`;
      
      const body = challengeCount === 1
        ? `Don't forget to complete today's challenge: ${incompleteChallenges[0].title}`
        : `Don't forget to complete your ${challengeCount} daily challenge${challengeCount > 1 ? 's' : ''} today`;
      
      await registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `completion-challenge-${date}`,
        requireInteraction: false,
        data: {
          url: '/dashboard',
          challengeIds: incompleteChallenges.map(c => c.id),
        },
      });

      // Mark reminder as shown for today
      localStorage.setItem(reminderShownKey, 'true');
      
      // Remove this schedule since we've shown it
      removeSchedule(userId, date);
    }
  } catch (error) {
    console.error('Error checking and showing reminder:', error);
  }
}

/**
 * Get all stored notification schedules
 */
function getStoredSchedules(): NotificationSchedule[] {
  try {
    const stored = localStorage.getItem('notification-schedules');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a specific schedule
 */
function removeSchedule(userId: string, date: string): void {
  const schedules = getStoredSchedules();
  const filtered = schedules.filter(
    (s) => !(s.userId === userId && s.date === date)
  );
  localStorage.setItem('notification-schedules', JSON.stringify(filtered));
}

/**
 * Remove all schedules for a user
 */
export function clearUserSchedules(userId: string): void {
  const schedules = getStoredSchedules();
  const filtered = schedules.filter((s) => s.userId !== userId);
  localStorage.setItem('notification-schedules', JSON.stringify(filtered));
}

/**
 * Check and process any pending schedules (called on app load)
 */
export async function processPendingSchedules(userId: string): Promise<void> {
  const schedules = getStoredSchedules();
  const now = Date.now();
  const userSchedules = schedules.filter((s) => s.userId === userId);

  for (const schedule of userSchedules) {
    // If the scheduled time has passed (within last hour), check and show
    const timeDiff = now - schedule.scheduledTime;
    if (timeDiff >= 0 && timeDiff < 60 * 60 * 1000) {
      // Scheduled time has passed, check and show reminder
      await checkAndShowReminder(userId, schedule.date);
    } else if (timeDiff >= 60 * 60 * 1000) {
      // More than an hour has passed, remove the schedule
      removeSchedule(userId, schedule.date);
    }
  }
}

// Store interval ID for cleanup
let reminderCheckInterval: number | null = null;

/**
 * Start periodic checking for reminder time (checks every minute around 18:00)
 */
function startPeriodicReminderCheck(userId: string): void {
  // Clear any existing interval
  if (reminderCheckInterval !== null) {
    clearInterval(reminderCheckInterval);
  }

  // Check every minute
  reminderCheckInterval = window.setInterval(async () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if we're at or just past 18:00 (within 1 minute window)
    if (currentHour === REMINDER_TIME && currentMinute === 0) {
      const today = new Date().toISOString().split('T')[0];
      await checkAndShowReminder(userId, today);
    }
  }, 60 * 1000); // Check every minute
}

/**
 * Stop periodic reminder checking
 */
export function stopPeriodicReminderCheck(): void {
  if (reminderCheckInterval !== null) {
    clearInterval(reminderCheckInterval);
    reminderCheckInterval = null;
  }
}

/**
 * Setup completion challenge reminder notifications
 * Should be called when user logs in or dashboard loads
 */
export async function setupDailyChallengeReminders(userId: string): Promise<void> {
  // Request permission if not already requested
  if (!hasRequestedNotificationPermission()) {
    await requestNotificationPermission();
  }

  // If permission granted, schedule reminders
  if (getNotificationPermission() === 'granted') {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if we already scheduled for today
    const schedules = getStoredSchedules();
    const todaySchedule = schedules.find(
      (s) => s.userId === userId && s.date === today
    );

    if (!todaySchedule) {
      // Schedule reminder for today if before 18:00, or for tomorrow if after
      await scheduleDailyChallengeReminder(userId, today);
    }

    // Process any pending schedules that might have been missed
    await processPendingSchedules(userId);

    // Start periodic check for 18:00
    startPeriodicReminderCheck(userId);

    // Also check immediately if we're past 18:00 today and haven't checked yet
    const now = new Date();
    if (now.getHours() >= REMINDER_TIME) {
      // Check if we already showed reminder today
      const reminderShownKey = `reminder-shown-${userId}-${today}`;
      const reminderShown = localStorage.getItem(reminderShownKey);
      
      if (!reminderShown) {
        await checkAndShowReminder(userId, today);
        localStorage.setItem(reminderShownKey, 'true');
      }
    }
  }
}
