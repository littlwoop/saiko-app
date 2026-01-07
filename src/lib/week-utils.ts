/**
 * Utility functions for working with weeks in weekly challenges
 */

/**
 * Get the start of the week (Monday) for a given date
 * Weeks start on Monday (day 1) and end on Sunday (day 0)
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  let diff: number;
  
  if (day === 0) {
    // Sunday: go back 6 days to get to Monday
    diff = -6;
  } else {
    // Monday (1) through Saturday (6): go back (day - 1) days to get to Monday
    diff = -(day - 1);
  }
  
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get the end of the week (Sunday) for a given date
 * Weeks start on Monday and end on Sunday
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to Monday to get Sunday
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Get a unique identifier for a week (YYYY-MM-DD format of week start)
 * This identifies which week a date belongs to by using the Monday of that week
 */
export function getWeekIdentifier(date: Date): string {
  const weekStart = getWeekStart(date);
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, '0');
  const day = String(weekStart.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date range contains only full weeks
 * Both start and end dates must be at the start/end of their respective weeks
 * Start date must be Monday, end date must be Sunday
 */
export function isFullWeeksRange(startDate: Date, endDate: Date): boolean {
  const startWeekStart = getWeekStart(startDate);
  const endWeekEnd = getWeekEnd(endDate);
  
  // Normalize dates for comparison (set to start of day)
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedStartWeekStart = new Date(startWeekStart);
  normalizedStartWeekStart.setHours(0, 0, 0, 0);
  
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(0, 0, 0, 0);
  const normalizedEndWeekEnd = new Date(endWeekEnd);
  normalizedEndWeekEnd.setHours(0, 0, 0, 0);
  
  // Check if start date is Monday (day === 1) and aligns with week start
  const startIsMonday = startDate.getDay() === 1;
  const startAligned = normalizedStart.getTime() === normalizedStartWeekStart.getTime();
  
  // Check if end date is Sunday (day === 0) and aligns with week end
  const endIsSunday = endDate.getDay() === 0;
  const endAligned = normalizedEnd.getTime() === normalizedEndWeekEnd.getTime();
  
  return startIsMonday && startAligned && endIsSunday && endAligned;
}

/**
 * Get the number of full weeks in a date range
 * This counts the number of unique weeks (Monday-Sunday) that the date range spans
 * For date ranges that are exactly 7 days, counts as 1 week (to handle edge cases)
 */
export function getNumberOfWeeks(startDate: Date, endDate: Date): number {
  // Normalize dates to start of day for accurate calculation
  const normalizedStart = new Date(startDate);
  normalizedStart.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate);
  normalizedEnd.setHours(0, 0, 0, 0);
  
  // Calculate the difference in days (inclusive)
  const diffTime = normalizedEnd.getTime() - normalizedStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // If the range is exactly 7 days, count it as 1 week
  // This handles cases where dates might not be perfectly aligned to Monday-Sunday
  // but represent a single week period
  if (diffDays === 7) {
    return 1;
  }
  
  // For other ranges, count unique weeks that the range spans
  const weekIdentifiers = getWeekIdentifiersInRange(startDate, endDate);
  return weekIdentifiers.length;
}

/**
 * Get all week identifiers in a date range
 */
export function getWeekIdentifiersInRange(startDate: Date, endDate: Date): string[] {
  const weeks: string[] = [];
  const current = new Date(getWeekStart(startDate));
  const end = new Date(getWeekEnd(endDate));
  
  while (current <= end) {
    weeks.push(getWeekIdentifier(current));
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
}

/**
 * Check if a date is within a week range
 */
export function isDateInWeekRange(date: Date, weekStart: Date, weekEnd: Date): boolean {
  const weekStartBoundary = getWeekStart(weekStart);
  weekStartBoundary.setHours(0, 0, 0, 0);
  const weekEndBoundary = getWeekEnd(weekEnd);
  weekEndBoundary.setHours(23, 59, 59, 999);
  
  return date >= weekStartBoundary && date <= weekEndBoundary;
}

