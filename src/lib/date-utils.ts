/**
 * Date utility functions for handling local timezone dates
 * All dates should be treated as local time, not UTC
 */

/**
 * Get today's date as YYYY-MM-DD in local timezone
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD date string and create a Date object at local midnight
 */
export function getLocalDateFromString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at local midnight (00:00:00 in local timezone)
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Normalize any date (Date object or ISO string) to a local date at midnight
 * Returns a Date object representing the start of that day in local timezone
 */
export function normalizeToLocalDate(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Convert a local date string (YYYY-MM-DD) to UTC start of day for database queries
 * This ensures the query covers the entire day in any timezone
 */
export function localDateToUTCStart(dateString: string): string {
  const localDate = getLocalDateFromString(dateString);
  // Convert local midnight to UTC (this handles timezone offset automatically)
  return localDate.toISOString();
}

/**
 * Convert a local date string (YYYY-MM-DD) to UTC end of day for database queries
 * This ensures the query covers the entire day in any timezone
 */
export function localDateToUTCEnd(dateString: string): string {
  const localDate = getLocalDateFromString(dateString);
  // Set to end of day (23:59:59.999) in local time, then convert to UTC
  localDate.setHours(23, 59, 59, 999);
  return localDate.toISOString();
}

/**
 * Convert a UTC timestamp from database to local date string (YYYY-MM-DD)
 */
export function utcTimestampToLocalDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  return getLocalDateString(date);
}

/**
 * Convert a Date object to local date string (YYYY-MM-DD)
 */
export function formatLocalDate(date: Date): string {
  return getLocalDateString(date);
}

/**
 * Get the start and end UTC timestamps for a date range (for database queries)
 * Input dates can be Date objects, ISO strings, or YYYY-MM-DD strings
 */
export function getDateRangeUTC(
  startDate: Date | string,
  endDate: Date | string
): { startUTC: string; endUTC: string } {
  // Normalize to local dates first
  const start = normalizeToLocalDate(startDate);
  const end = normalizeToLocalDate(endDate);
  
  // Set start to beginning of day
  start.setHours(0, 0, 0, 0);
  
  // Set end to end of day
  end.setHours(23, 59, 59, 999);
  
  return {
    startUTC: start.toISOString(),
    endUTC: end.toISOString(),
  };
}

