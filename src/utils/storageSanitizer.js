/**
 * Storage & Data Sanitization Utility
 * 
 * Provides robust transformation of complex data structures into Plain Old JavaScript Objects (POJOs)
 * to safely store in localStorage, sessionStorage, and IndexedDB without encountering circular reference errors
 * or serializing minified Firestore internal transport instances (like Y2, Ka).
 */

/**
 * Recursively sanitizes any JavaScript object or array into a plain JSON-compatible structure.
 * Strips circular references, non-plain class instances, functions, and internal framework fields.
 * Converts Dates and Firestore Timestamps to ISO strings.
 */
export const sanitizeToPOJO = (data, seen = new WeakSet()) => {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return data;
  if (typeof data === 'function' || typeof data === 'symbol') return undefined;

  // Standard Date
  if (data instanceof Date) {
    return isNaN(data.getTime()) ? null : data.toISOString();
  }

  // Firestore Timestamp (has .toDate or seconds/nanoseconds)
  if (typeof data === 'object' && typeof data.toDate === 'function') {
    try {
      return data.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && typeof data.seconds === 'number' && typeof data.nanoseconds === 'number') {
    try {
      return new Date(data.seconds * 1000).toISOString();
    } catch {
      return null;
    }
  }

  // Handle circular references
  if (typeof data === 'object') {
    if (seen.has(data)) return undefined;
    seen.add(data);
  }

  // Arrays
  if (Array.isArray(data)) {
    return data
      .map(item => sanitizeToPOJO(item, seen))
      .filter(item => item !== undefined);
  }

  // Check prototype to exclude non-plain objects (like Firestore internal classes Y2, Ka, etc.)
  const proto = Object.getPrototypeOf(data);
  const isPlain = proto === null || proto === Object.prototype;

  if (!isPlain) {
    // If it is a Firestore DocumentReference
    if (typeof data.id === 'string' && typeof data.path === 'string') {
      return { id: data.id, path: data.path };
    }
    // Omit other internal runtime instances
    return undefined;
  }

  // Plain object
  const cleaned = {};
  for (const [key, val] of Object.entries(data)) {
    // Exclude internal framework/private references
    if (
      key.startsWith('_') ||
      key === 'firestore' ||
      key === 'db' ||
      key === 'auth' ||
      key === 'app' ||
      key === 'internalTransport'
    ) {
      continue;
    }
    const sanitizedVal = sanitizeToPOJO(val, seen);
    if (sanitizedVal !== undefined) {
      cleaned[key] = sanitizedVal;
    }
  }
  return cleaned;
};

/**
 * Bulletproof wrapper around JSON.stringify with circular reference detection and deep POJO sanitization.
 */
export const safeStringify = (data, defaultValue = '[]') => {
  try {
    const pojo = sanitizeToPOJO(data);
    return JSON.stringify(pojo);
  } catch (err) {
    console.warn('safeStringify pojo serialization fallback:', err);
    try {
      const seen = new WeakSet();
      return JSON.stringify(data, (key, value) => {
        if (typeof value === 'function' || typeof value === 'symbol') return undefined;
        if (key && (key.startsWith('_') || key === 'firestore' || key === 'db' || key === 'auth' || key === 'app')) {
          return undefined;
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      });
    } catch {
      return defaultValue;
    }
  }
};

/**
 * Safe JSON.parse helper that will not throw on invalid or corrupted storage strings.
 */
export const safeParse = (str, fallback = null) => {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('safeParse failed, returning fallback:', e);
    return fallback;
  }
};
