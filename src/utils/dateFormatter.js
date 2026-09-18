import { format, parseISO } from 'date-fns';

/**
 * Formats any valid date string or Date object into 'dd-MMM-yyyy' (e.g. 09-Mar-2025)
 * If date is missing or invalid, returns fallback string ('-')
 */
export function formatDate(val, fallback = '-') {
  if (!val) return fallback;
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return fallback;
      return format(val, 'dd-MMM-yyyy');
    }
    const s = String(val).trim();
    if (!s || s === '-' || s.toLowerCase() === 'n/a') return val || fallback;

    // Handle standard ISO or YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
      const parsed = parseISO(s);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'dd-MMM-yyyy');
      }
    }

    // Try generic Date parser
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, 'dd-MMM-yyyy');
    }
  } catch (err) {
    console.debug('Failed to format date:', err);
  }
  return String(val) || fallback;
}

/**
 * Formats with time 'dd-MMM-yyyy HH:mm'
 */
export function formatDateTime(val, fallback = '-') {
  if (!val) return fallback;
  try {
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return fallback;
      return format(val, 'dd-MMM-yyyy HH:mm');
    }
    const s = String(val).trim();
    if (!s) return fallback;
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, 'dd-MMM-yyyy HH:mm');
    }
  } catch (err) {
    console.debug('Failed to format dateTime:', err);
  }
  return String(val) || fallback;
}
