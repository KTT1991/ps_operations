import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, setDoc, query, where, orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { employeesService } from './firebaseService';
import {
  sampleCourses,
  sampleTrainingMatrix,
  sampleTrainingEmployees,
  sampleTrainingLogs
} from '../data/trainingSampleData';
import { sampleProjects } from '../data/sampleData';
import { differenceInDays, parseISO, format, addMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { sanitizeToPOJO, safeStringify, safeParse } from '../utils/storageSanitizer';

/**
 * Normalizes date strings from Excel (handles Date objects, YYYY-MM-DD, DD/MM/YYYY, etc.)
 */
function normalizeDateString(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) {
    return format(val, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  if (!s) return '';
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, 'yyyy-MM-dd');
    }
  } catch (e) {
    console.debug('Failed to parse date:', e);
  }
  return s;
}

/**
 * Duplicate check logic:
 * 1. Same employee + same course (ID or Code) + same completion date
 * 2. Non-empty Certificate No already exists for the same employee or course
 */
export function checkDuplicateLog(candidate, existingLogs = []) {
  const norm = (v) => (v || '').toString().trim().toLowerCase();
  const candEmpId = norm(candidate.employeeId);
  const candCourseCode = norm(candidate.courseCode);
  const candCourseId = norm(candidate.courseId);
  const candDate = norm(candidate.completionDate);
  const candCert = norm(candidate.certNo);

  for (const log of existingLogs) {
    if (log.cancelled) continue;

    const logEmpId = norm(log.employeeId);
    const logCourseCode = norm(log.courseCode);
    const logCourseId = norm(log.courseId);
    const logDate = norm(log.completionDate);
    const logCert = norm(log.certNo);

    // Rule 1: Same employee, same course, same completion date
    const sameEmp = candEmpId && logEmpId === candEmpId;
    const sameCourse = (candCourseCode && logCourseCode === candCourseCode) ||
                       (candCourseId && logCourseId === candCourseId) ||
                       (candCourseCode && logCourseId === candCourseCode);
    const sameDate = candDate && logDate === candDate;

    if (sameEmp && sameCourse && sameDate) {
      return {
        isDuplicate: true,
        reason: `Record already exists: ${log.employeeName || candidate.employeeName || 'Employee'} already completed ${candidate.courseCode || candidate.courseName} on ${candidate.completionDate}`,
        matchedLogId: log.id,
      };
    }

    // Rule 2: Non-empty Certificate # already exists for the same employee or course
    if (candCert && logCert && candCert === logCert && (sameEmp || sameCourse)) {
      return {
        isDuplicate: true,
        reason: `Duplicate Certificate #: Certificate "${candidate.certNo}" already recorded for ${log.employeeName || log.employeeId}`,
        matchedLogId: log.id,
      };
    }
  }

  return { isDuplicate: false };
}

// Normalizer utilities for reliable data matching across forms, excels, and manpower
export const normKey = (v) => (v || '').toString().trim().toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/gi, '');
export const cleanNum = (v) => normKey(v).replace(/^(ogs|emp|staff|crs|log)+/g, '').replace(/^0+/, '');

// Common course code aliases so "BOSIET" matches "BONST-FONT" / "CRS-001", "H2S" matches "H2S-SAF" / "CRS-002", etc.
export const COURSE_ALIASES = {
  'bosiet': ['CRS-001', 'BONST-FONT'],
  'bonst-font': ['CRS-001', 'BOSIET'],
  'foet': ['CRS-001', 'BONST-FONT'],
  'huet': ['CRS-001', 'BONST-FONT'],
  'h2s': ['CRS-002', 'H2S-SAF'],
  'h2s-saf': ['CRS-002', 'H2S'],
  'compex': ['CRS-003', 'COMPEX-01'],
  'compex-01': ['CRS-003', 'COMPEX'],
  'conf-sp': ['CRS-004', 'CONFINED SPACE'],
  'confined space': ['CRS-004', 'CONF-SP'],
  'wah': ['CRS-005', 'WAH-L2'],
  'wah-l2': ['CRS-005', 'WAH'],
  'rig-sling': ['CRS-006', 'RIGGING'],
  'rigging': ['CRS-006', 'RIG-SLING'],
  'med-off': ['CRS-007', 'OGUK', 'MEDICAL'],
  'oguk': ['CRS-007', 'MED-OFF'],
  'medical': ['CRS-007', 'MED-OFF'],
  'ptw': ['CRS-008', 'PTW-PTTEP'],
  'ptw-pttep': ['CRS-008', 'PTW'],
  'first-aid': ['CRS-010', 'CPR', 'AED'],
  'cpr': ['CRS-010', 'FIRST-AID'],
  'so-sup': ['CRS-011', 'SAFETY OFFICER'],
  'safety officer': ['CRS-011', 'SO-SUP'],
  'fire-bas': ['CRS-012', 'BASIC FIRE', 'FIRE FIGHTING'],
  'pttep-el-haz': ['CRS-013', 'HAZARDOUS CHEMICALS'],
  'pttep-el-jsa': ['CRS-014', 'JSA'],
  'pttep-el-hazcom': ['CRS-015', 'HAZCOM'],
};

// Robust matcher for training logs to employees
export const matchEmployeeLog = (emp, log) => {
  if (!emp || !log) return false;
  if (log.employeeId && emp.id && log.employeeId === emp.id) return true;
  if (log.employeeId && emp.empNo && log.employeeId === emp.empNo) return true;

  const logEmpIdNorm = normKey(log.employeeId);
  const empIdNorm = normKey(emp.id);
  const empNoNorm = normKey(emp.empNo);

  if (logEmpIdNorm && (logEmpIdNorm === empIdNorm || logEmpIdNorm === empNoNorm)) return true;

  const logNum = cleanNum(log.employeeId);
  const empNum = cleanNum(emp.id);
  const empNoNum = cleanNum(emp.empNo);
  if (logNum && (logNum === empNum || logNum === empNoNum)) return true;

  if (log.employeeName && emp.name) {
    const lName = normKey(log.employeeName);
    const eName = normKey(emp.name);
    const eNameEn = normKey(emp.nameEn);
    if (lName && (lName === eName || (eNameEn && lName === eNameEn))) return true;
  }

  return false;
};

// Robust matcher for training logs to courses
export const matchCourseLog = (course, log) => {
  if (!course || !log) return false;
  if (log.courseId && course.id && log.courseId === course.id) return true;
  if (log.courseCode && course.code && log.courseCode.toLowerCase().trim() === course.code.toLowerCase().trim()) return true;
  if (log.courseCode && course.id && log.courseCode.toLowerCase().trim() === course.id.toLowerCase().trim()) return true;
  if (log.courseId && course.code && log.courseId.toLowerCase().trim() === course.code.toLowerCase().trim()) return true;

  const cIdNorm = normKey(course.id);
  const cCodeNorm = normKey(course.code);
  const lIdNorm = normKey(log.courseId);
  const lCodeNorm = normKey(log.courseCode);

  if (lIdNorm && (lIdNorm === cIdNorm || lIdNorm === cCodeNorm)) return true;
  if (lCodeNorm && (lCodeNorm === cIdNorm || lCodeNorm === cCodeNorm)) return true;

  const courseAliases = COURSE_ALIASES[cCodeNorm] || COURSE_ALIASES[cIdNorm] || [];
  if (courseAliases.some(a => normKey(a) === lCodeNorm || normKey(a) === lIdNorm)) return true;

  if (log.courseName && course.name) {
    const lNameNorm = normKey(log.courseName);
    const cNameNorm = normKey(course.name);
    if (lNameNorm === cNameNorm) return true;
    if (lNameNorm.length > 5 && (cNameNorm.includes(lNameNorm) || lNameNorm.includes(cNameNorm))) return true;
  }

  return false;
};

// Demo identification sets and predicates
export const DEMO_EMPLOYEE_IDS = new Set([
  'EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-006', 'EMP-007', 'EMP-008',
  'OGS-EMP-001', 'OGS-EMP-002', 'OGS-EMP-003', 'OGS-EMP-004', 'OGS-EMP-005', 'OGS-EMP-006', 'OGS-EMP-007', 'OGS-EMP-008'
]);

export const DEMO_SAMPLE_FULL_NAMES = [
  'somchai wiriyaporn',
  'wanchai phongphaew',
  'nattaporn srisuk',
  'kitti rattanaphan',
  'kittisak sukjai',
  'nattha saetang',
  'prasert suksamran',
  'anan chokdee',
  'teera kongkaew',
  'paitoon chanthara',
  'somchai jaidee',
];

export const isDemoEmployee = (emp) => {
  if (!emp) return false;
  const idStr = String(emp.id || '').toUpperCase().trim();
  const noStr = String(emp.empNo || '').toUpperCase().trim();
  if (DEMO_EMPLOYEE_IDS.has(idStr) || DEMO_EMPLOYEE_IDS.has(noStr)) return true;
  if (/^(OGS-)?EMP-00[1-8]$/i.test(idStr) || /^(OGS-)?EMP-00[1-8]$/i.test(noStr)) return true;
  const nameLower = (emp.name || '').toLowerCase().trim();
  const nameEnLower = (emp.nameEn || '').toLowerCase().trim();
  return DEMO_SAMPLE_FULL_NAMES.some(fn => nameLower === fn || nameEnLower === fn);
};

export const isLongFirestoreId = (str) => {
  if (!str) return false;
  const s = String(str).trim();
  return s.length >= 18 && /^[A-Za-z0-9_-]{18,}$/.test(s);
};

export const cleanHrEmployeeId = (val) => {
  if (!val) return '';
  const s = String(val).trim();
  if (isLongFirestoreId(s)) return '';
  return s;
};

export const normalizeEmployeeName = (name) => {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/^(mr\.|mrs\.|ms\.|miss|นาย|นาง|นางสาว|ว่าที่ร\.ต\.|ดร\.|ช่าง|วิศวกร)\s*/i, '')
    .replace(/[\s\-_.]+/g, ' ');
};

export const formatDisplayEmployeeId = (emp, fallbackIndex) => {
  if (!emp) return '';
  // 1. Explicit user/HR-provided empNo or employeeId (filter out long firestore hashes)
  const rawNo = cleanHrEmployeeId(emp.empNo || emp.employeeId || emp.badgeNo);
  if (rawNo) {
    return rawNo;
  }
  // 2. Explicit ID that is not an auto-generated Firestore hash
  const rawId = cleanHrEmployeeId(emp.id);
  if (rawId) {
    return rawId;
  }
  // 3. Fallback index only when explicitly provided (e.g. table sequence)
  if (typeof fallbackIndex === 'number' && !isNaN(fallbackIndex) && fallbackIndex > 0) {
    return `PS-SKL-${String(fallbackIndex).padStart(3, '0')}`;
  }
  // 4. Return clean empty string if no HR ID is assigned yet
  return '';
};

export const compareEmployeeId = (empA, empB, sortDirection = 'asc') => {
  if (!empA && !empB) return 0;
  if (!empA) return 1;
  if (!empB) return -1;
  const idA = cleanHrEmployeeId(empA.empNo || empA.employeeId || (!isLongFirestoreId(empA.id) ? empA.id : ''));
  const idB = cleanHrEmployeeId(empB.empNo || empB.employeeId || (!isLongFirestoreId(empB.id) ? empB.id : ''));
  
  if (idA && !idB) return sortDirection === 'asc' ? -1 : 1;
  if (!idA && idB) return sortDirection === 'asc' ? 1 : -1;
  
  if (idA && idB && idA !== idB) {
    const res = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? res : -res;
  }
  // If IDs are not available or identical, sort cleanly by Name
  const nameA = (empA.name || empA.nameEn || '').trim();
  const nameB = (empB.name || empB.nameEn || '').trim();
  return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
};

export const sortEmployees = (employees = [], sortBy = 'empId', direction = 'asc') => {
  const list = [...employees];
  return list.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'empId') {
      const idA = cleanHrEmployeeId(a?.empNo || a?.employeeId || (!isLongFirestoreId(a?.id) ? a?.id : ''));
      const idB = cleanHrEmployeeId(b?.empNo || b?.employeeId || (!isLongFirestoreId(b?.id) ? b?.id : ''));
      if (idA && !idB) cmp = -1;
      else if (!idA && idB) cmp = 1;
      else if (idA && idB) cmp = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
      else cmp = (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' });
    } else if (sortBy === 'name') {
      cmp = (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' });
    } else if (sortBy === 'dept') {
      const deptA = (a?.department || '') + ' ' + (a?.position || '');
      const deptB = (b?.department || '') + ' ' + (b?.position || '');
      cmp = deptA.localeCompare(deptB, undefined, { sensitivity: 'base' });
    } else if (sortBy === 'no') {
      return 0; // Maintain natural original sequence
    }
    return direction === 'desc' ? -cmp : cmp;
  });
};

export const getNextEmployeeId = (employees = []) => {
  let maxNum = 0;
  employees.forEach(e => {
    const candidates = [e.empNo, e.id, e.employeeId];
    candidates.forEach(c => {
      if (!c) return;
      const m = String(c).match(/PS-SKL-(\d+)/i) || String(c).match(/\d+/);
      if (m) {
        const n = parseInt(m[1] || m[0], 10);
        if (!isNaN(n) && n > maxNum && n < 100000) {
          maxNum = n;
        }
      }
    });
  });
  const next = (maxNum || employees.length || 0) + 1;
  return `PS-SKL-${String(next).padStart(3, '0')}`;
};

export const DEMO_COURSE_IDS = new Set(sampleCourses.map(c => c.id));

export const isDemoCourse = (course) => {
  if (!course) return false;
  if (DEMO_COURSE_IDS.has(course.id)) return true;
  if (/^CRS-0\d\d$/.test(course.id)) return true;
  return false;
};

export const DEMO_MATRIX_IDS = new Set([
  'TMX-001', 'TMX-002', 'TMX-003', 'TMX-004', 'TMX-005', 'TMX-006', 'TMX-007'
]);

export const isDemoMatrixRule = (rule) => {
  if (!rule) return false;
  if (DEMO_MATRIX_IDS.has(rule.id)) return true;
  if (/^TMX-00[1-7]$/.test(rule.id)) return true;
  return false;
};

export const isDemoLog = (log) => {
  if (!log) return false;
  if (/^LOG-0\d\d$/.test(log.id)) return true;
  if (log.id && log.id.startsWith('LOG-0')) return true;
  if (log.employeeId && isDemoEmployee({ id: log.employeeId })) return true;
  const demoLogIds = new Set(sampleTrainingLogs.map(l => l.id));
  return demoLogIds.has(log.id);
};

const initialDataMap = {
  courses: sampleCourses,
  trainingMatrix: sampleTrainingMatrix,
  trainingEmployees: sampleTrainingEmployees,
  trainingLog: sampleTrainingLogs,
  auditLog: [],
  latestTraining: [],
};

const listenersMap = {};

const getLocalStore = (collectionName) => {
  const key = `ogs_training_${collectionName}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = safeParse(raw, null);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn(`Failed to read ${collectionName} from localStorage:`, e);
  }
  const defaults = initialDataMap[collectionName] || [];
  try {
    const cleanDefaults = sanitizeToPOJO(defaults) || [];
    localStorage.setItem(key, safeStringify(cleanDefaults));
  } catch (e) {
    console.warn(`Failed to init ${collectionName} in localStorage:`, e);
  }
  return [...defaults];
};

const saveLocalStore = (collectionName, data) => {
  const key = `ogs_training_${collectionName}`;
  try {
    const cleanData = sanitizeToPOJO(data) || [];
    localStorage.setItem(key, safeStringify(cleanData));
  } catch (e) {
    console.warn(`Failed to save ${collectionName} to localStorage:`, e);
  }
  if (listenersMap[collectionName]) {
    listenersMap[collectionName].forEach(cb => {
      try { cb(Array.isArray(data) ? [...data] : data); } catch (err) { console.error(err); }
    });
  }
};

const cleanPayload = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  return sanitizeToPOJO(obj) || {};
};

// Generic store service
const clearFirestoreCollection = async (collectionName) => {
  if (!isFirebaseConfigured) return;
  try {
    const snap = await getDocs(collection(db, collectionName));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, collectionName, d.id))));
  } catch (err) {
    console.warn(`Failed to clear Firestore collection ${collectionName}:`, err);
  }
};

const createTrainingStoreService = (collectionName) => ({
  async getAll() {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs.map(d => sanitizeToPOJO({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`Firestore getAll(${collectionName}) fallback to local`, err);
      }
    }
    return getLocalStore(collectionName);
  },

  async getById(id) {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDoc(doc(db, collectionName, id));
        return snap.exists() ? sanitizeToPOJO({ id: snap.id, ...snap.data() }) : null;
      } catch (err) {
        console.warn(`Firestore getById(${collectionName}, ${id}) fallback to local`, err);
      }
    }
    const list = getLocalStore(collectionName);
    return list.find(d => d.id === id) || null;
  },

  async create(data) {
    const sanitized = cleanPayload(data);
    const newId = sanitized.id || `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}`;
    const payload = { ...sanitized, id: newId };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, collectionName, newId), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn(`Firestore create(${collectionName}) fallback to local`, err);
      }
    }

    const list = getLocalStore(collectionName);
    const updated = [payload, ...list.filter(d => d.id !== newId)];
    saveLocalStore(collectionName, updated);
    return payload;
  },

  async update(id, data) {
    const sanitized = cleanPayload(data);
    if (isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, collectionName, id), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn(`Firestore update(${collectionName}, ${id}) fallback to local`, err);
      }
    }
    const list = getLocalStore(collectionName);
    const index = list.findIndex(d => d.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...sanitized };
      saveLocalStore(collectionName, list);
      return list[index];
    }
    return null;
  },

  async delete(id) {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        console.warn(`Firestore delete(${collectionName}, ${id}) fallback to local`, err);
      }
    }
    const list = getLocalStore(collectionName);
    const filtered = list.filter(d => d.id !== id);
    saveLocalStore(collectionName, filtered);
    return true;
  },

  subscribe(callback) {
    if (!listenersMap[collectionName]) listenersMap[collectionName] = [];
    listenersMap[collectionName].push(callback);
    callback(getLocalStore(collectionName));
    return () => {
      listenersMap[collectionName] = listenersMap[collectionName].filter(cb => cb !== callback);
    };
  }
});

// Services exports
export const coursesService = {
  ...createTrainingStoreService('courses'),

  async clearDemoCourses(user) {
    const list = getLocalStore('courses') || [];
    const remaining = list.filter(c => !isDemoCourse(c));
    const removedCount = list.length - remaining.length;
    saveLocalStore('courses', remaining);

    if (listenersMap['courses']) {
      listenersMap['courses'].forEach(cb => {
        try { cb([...remaining]); } catch (e) {
          console.debug('clearDemoCourses listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'courses',
      entityId: 'ALL_DEMO',
      action: 'CLEAR_DEMO_COURSES',
      changes: { removedCount, remainingCount: remaining.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount, remainingCount: remaining.length };
  },

  async clearAllCourses(user) {
    const list = getLocalStore('courses') || [];
    saveLocalStore('courses', []);
    await clearFirestoreCollection('courses');

    if (listenersMap['courses']) {
      listenersMap['courses'].forEach(cb => {
        try { cb([]); } catch (e) {
          console.debug('clearAllCourses listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'courses',
      entityId: 'ALL_COURSES',
      action: 'CLEAR_ALL_COURSES',
      changes: { removedCount: list.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount: list.length };
  },

  async resetToDemo(user) {
    saveLocalStore('courses', [...sampleCourses]);
    if (listenersMap['courses']) {
      listenersMap['courses'].forEach(cb => {
        try { cb([...sampleCourses]); } catch (e) {
          console.debug('resetToDemo courses listener error:', e);
        }
      });
    }
    await auditLogService.create({
      entity: 'courses',
      entityId: 'DEMO_RESTORE',
      action: 'RESTORE_DEMO_COURSES',
      changes: { restoredCount: sampleCourses.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return true;
  }
};

export const trainingMatrixService = {
  ...createTrainingStoreService('trainingMatrix'),

  async clearDemoMatrix(user) {
    const list = getLocalStore('trainingMatrix') || [];
    const remaining = list.filter(m => !isDemoMatrixRule(m));
    const removedCount = list.length - remaining.length;
    saveLocalStore('trainingMatrix', remaining);

    if (listenersMap['trainingMatrix']) {
      listenersMap['trainingMatrix'].forEach(cb => {
        try { cb([...remaining]); } catch (e) {
          console.debug('clearDemoMatrix listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'trainingMatrix',
      entityId: 'ALL_DEMO',
      action: 'CLEAR_DEMO_MATRIX_RULES',
      changes: { removedCount, remainingCount: remaining.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount, remainingCount: remaining.length };
  },

  async clearAllMatrix(user) {
    const list = getLocalStore('trainingMatrix') || [];
    saveLocalStore('trainingMatrix', []);
    await clearFirestoreCollection('trainingMatrix');

    if (listenersMap['trainingMatrix']) {
      listenersMap['trainingMatrix'].forEach(cb => {
        try { cb([]); } catch (e) {
          console.debug('clearAllMatrix listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'trainingMatrix',
      entityId: 'ALL_MATRIX',
      action: 'CLEAR_ALL_MATRIX_RULES',
      changes: { removedCount: list.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount: list.length };
  },

  async resetToDemo(user) {
    saveLocalStore('trainingMatrix', [...sampleTrainingMatrix]);
    if (listenersMap['trainingMatrix']) {
      listenersMap['trainingMatrix'].forEach(cb => {
        try { cb([...sampleTrainingMatrix]); } catch (e) {
          console.debug('resetToDemo listener error:', e);
        }
      });
    }
    await auditLogService.create({
      entity: 'trainingMatrix',
      entityId: 'DEMO_RESTORE',
      action: 'RESTORE_DEMO_MATRIX',
      changes: { restoredCount: sampleTrainingMatrix.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return true;
  },

  async autoGenerateRulesForPositions(positions = [], user) {
    const current = getLocalStore('trainingMatrix') || [];
    const newRules = [];

    positions.forEach((pos, idx) => {
      if (!pos || !pos.trim()) return;
      const cleanPos = pos.trim();
      const existing = current.some(m => (m.position || '').trim().toLowerCase() === cleanPos.toLowerCase());
      if (!existing) {
        // Standard baseline required courses for any offshore/field role
        const defaultCourses = ['CRS-001', 'CRS-002', 'CRS-007'];
        if (/engineer|supervisor|lead|officer|manager/i.test(cleanPos)) {
          defaultCourses.push('CRS-011'); // SO-SUP
          defaultCourses.push('CRS-008'); // PTW
        } else {
          defaultCourses.push('CRS-005'); // WAH
          defaultCourses.push('CRS-006'); // RIG-SLING
        }

        const newRule = {
          id: `TMX-GEN-${Date.now()}-${idx}`,
          projectId: 'GLOBAL-DEFAULT',
          projectName: 'Standard Base Operations (All Projects)',
          position: cleanPos,
          requiredCourseIds: defaultCourses,
          notes: 'Auto-generated standard requirements rule',
          updatedAt: new Date().toISOString(),
        };
        newRules.push(newRule);
      }
    });

    if (newRules.length > 0) {
      const updated = [...current, ...newRules];
      saveLocalStore('trainingMatrix', updated);
      if (listenersMap['trainingMatrix']) {
        listenersMap['trainingMatrix'].forEach(cb => {
          try { cb([...updated]); } catch (e) {
            console.debug('autoGenerateRules listener error:', e);
          }
        });
      }
    }

    return newRules;
  }
};

// Unified Employee Service (Synchronized with Manpower & Training)
export const trainingEmployeesService = {
  ...createTrainingStoreService('trainingEmployees'),

  async clearDemoEmployees(user) {
    const list = getLocalStore('trainingEmployees') || [];
    const remaining = list.filter(e => !isDemoEmployee(e));
    const removedCount = list.length - remaining.length;
    saveLocalStore('trainingEmployees', remaining);

    // Also clean from Manpower employees store (key: ogs_data_employees)
    try {
      const manpowerRaw = localStorage.getItem('ogs_data_employees');
      const manpowerList = manpowerRaw ? safeParse(manpowerRaw, []) : [...sampleTrainingEmployees];
      if (Array.isArray(manpowerList)) {
        const remainingManpower = sanitizeToPOJO(manpowerList.filter(e => !isDemoEmployee(e))) || [];
        localStorage.setItem('ogs_data_employees', safeStringify(remainingManpower));
      }
    } catch (e) {
      console.warn('Error clearing demo employees from manpower store:', e);
    }

    if (listenersMap['trainingEmployees']) {
      listenersMap['trainingEmployees'].forEach(cb => {
        try { cb([...remaining]); } catch (e) {
          console.debug('clearDemoEmployees listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'trainingEmployees',
      entityId: 'ALL_DEMO',
      action: 'CLEAR_DEMO_EMPLOYEES',
      changes: { removedCount, remainingCount: remaining.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount, remainingCount: remaining.length };
  },

  async clearAllEmployees(user) {
    const list = getLocalStore('trainingEmployees') || [];
    saveLocalStore('trainingEmployees', []);
    await clearFirestoreCollection('trainingEmployees');

    try {
      localStorage.setItem('ogs_data_employees', safeStringify([]));
      if (employeesService && typeof employeesService.clearAll === 'function') {
        await employeesService.clearAll();
      }
    } catch (e) {
      console.warn('Error clearing ogs_data_employees:', e);
    }

    if (listenersMap['trainingEmployees']) {
      listenersMap['trainingEmployees'].forEach(cb => {
        try { cb([]); } catch (e) {
          console.debug('clearAllEmployees listener error:', e);
        }
      });
    }

    await auditLogService.create({
      entity: 'trainingEmployees',
      entityId: 'ALL_EMPLOYEES',
      action: 'CLEAR_ALL_EMPLOYEES',
      changes: { removedCount: list.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return { removedCount: list.length };
  },

  async resetToDemo(user) {
    saveLocalStore('trainingEmployees', [...sampleTrainingEmployees]);
    try {
      const cleanList = sanitizeToPOJO([...sampleTrainingEmployees]) || [];
      localStorage.setItem('ogs_data_employees', safeStringify(cleanList));
    } catch (e) {
      console.warn('Error resetting manpower demo employees:', e);
    }
    if (listenersMap['trainingEmployees']) {
      listenersMap['trainingEmployees'].forEach(cb => {
        try { cb([...sampleTrainingEmployees]); } catch (e) {
          console.debug('resetToDemo listener error:', e);
        }
      });
    }
    return true;
  },

  async getAll() {
    let manpowerList = [];
    try {
      manpowerList = await employeesService.getAll();
    } catch (e) {
      console.warn('Failed to load from employeesService (Manpower):', e);
    }

    const trainingList = getLocalStore('trainingEmployees') || [];

    // Helper to extract searchable name keys for an employee (Name-first linking)
    const getEmployeeNameKeys = (emp) => {
      const keys = [];
      if (emp?.name) {
        keys.push(normalizeEmployeeName(emp.name));
        keys.push(emp.name.trim().toLowerCase());
      }
      if (emp?.nameEn) {
        keys.push(normalizeEmployeeName(emp.nameEn));
        keys.push(emp.nameEn.trim().toLowerCase());
      }
      return keys.filter(Boolean);
    };

    // 1. Build lookup index for existing Training employees
    const trainingByName = new Map();
    const trainingById = new Map();

    trainingList.forEach(emp => {
      if (!emp) return;
      if (emp.id) trainingById.set(emp.id, emp);
      getEmployeeNameKeys(emp).forEach(k => {
        if (!trainingByName.has(k)) trainingByName.set(k, emp);
      });
    });

    // 2. Merge Manpower employees, prioritizing NAME matching as primary
    const mergedList = [];
    const matchedTrainingIds = new Set();

    manpowerList.forEach(mEmp => {
      if (!mEmp) return;

      // Primary: Match by Employee Name
      let matched = null;
      for (const k of getEmployeeNameKeys(mEmp)) {
        if (trainingByName.has(k)) {
          matched = trainingByName.get(k);
          break;
        }
      }

      // Secondary fallback: Match by ID
      if (!matched && mEmp.id && trainingById.has(mEmp.id)) {
        matched = trainingById.get(mEmp.id);
      }

      if (matched) {
        matchedTrainingIds.add(matched.id);
        // Merge records: preserve HR Employee ID as priority, clean out long firestore hashes
        const rawEffectiveEmpNo = (mEmp.empNo || matched.empNo || mEmp.employeeId || matched.employeeId || '').trim();
        const effectiveEmpNo = cleanHrEmployeeId(rawEffectiveEmpNo);
        mergedList.push({
          ...matched,
          ...mEmp,
          id: mEmp.id || matched.id,
          empNo: effectiveEmpNo,
          name: mEmp.name || matched.name,
          nameEn: mEmp.nameEn || matched.nameEn || mEmp.name,
          position: mEmp.position || matched.position || 'Instrumentation Technician',
          department: mEmp.department || matched.department || 'Operations',
          currentProject: mEmp.currentProject || matched.currentProject || '',
          status: mEmp.status || matched.status || 'Active',
          phone: mEmp.phone || matched.phone || '',
          email: mEmp.email || matched.email || '',
          joinDate: mEmp.joinDate || matched.joinDate || '2024-01-01',
        });
      } else {
        // Manpower employee not previously in training storage
        mergedList.push({
          id: mEmp.id,
          empNo: cleanHrEmployeeId(mEmp.empNo),
          name: mEmp.name || 'Unnamed Employee',
          nameEn: mEmp.nameEn || mEmp.name,
          position: mEmp.position || 'Instrumentation Technician',
          department: mEmp.department || 'Operations',
          currentProject: mEmp.currentProject || '',
          status: mEmp.status || 'Active',
          joinDate: mEmp.joinDate || '2024-01-01',
          email: mEmp.email || '',
          phone: mEmp.phone || '',
        });
      }
    });

    // 3. Include training-only employees that were not in Manpower
    trainingList.forEach(tEmp => {
      if (tEmp && tEmp.id && !matchedTrainingIds.has(tEmp.id)) {
        const keys = getEmployeeNameKeys(tEmp);
        const alreadyMerged = mergedList.some(m => {
          const mKeys = getEmployeeNameKeys(m);
          return keys.some(k => mKeys.includes(k));
        });
        if (!alreadyMerged) {
          mergedList.push({
            ...tEmp,
            empNo: cleanHrEmployeeId(tEmp.empNo),
          });
        }
      }
    });

    const merged = mergedList.sort(compareEmployeeId);
    saveLocalStore('trainingEmployees', merged);
    return merged;
  },

  async create(data) {
    const sanitized = cleanPayload(data);
    const id = sanitized.id || (sanitized.empNo && !isLongFirestoreId(sanitized.empNo) ? sanitized.empNo : `EMP-${Date.now()}`);
    const payload = {
      ...sanitized,
      id,
      empNo: cleanHrEmployeeId(sanitized.empNo),
      status: sanitized.status || 'Active',
      joinDate: sanitized.joinDate || format(new Date(), 'yyyy-MM-dd'),
    };

    // Save to local Training Store
    const list = getLocalStore('trainingEmployees');
    const updated = [payload, ...list.filter(d => d.id !== id)];
    saveLocalStore('trainingEmployees', updated);

    // Sync to Manpower (employeesService)
    try {
      await employeesService.create(payload);
    } catch (err) {
      console.warn('Sync create to employeesService fallback:', err);
    }

    if (listenersMap['trainingEmployees']) {
      listenersMap['trainingEmployees'].forEach(cb => {
        try { cb([...updated]); } catch (err) {
          console.debug('trainingEmployees listener error:', err);
        }
      });
    }

    return payload;
  },

  async update(id, data) {
    const sanitized = cleanPayload(data);
    if (sanitized.empNo !== undefined) {
      sanitized.empNo = cleanHrEmployeeId(sanitized.empNo);
    }
    const list = getLocalStore('trainingEmployees');
    const index = list.findIndex(d => d.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...sanitized };
      saveLocalStore('trainingEmployees', list);
    }

    // Sync to Manpower (employeesService)
    try {
      await employeesService.update(id, sanitized);
    } catch (err) {
      console.warn('Sync update to employeesService fallback:', err);
    }

    if (listenersMap['trainingEmployees']) {
      listenersMap['trainingEmployees'].forEach(cb => {
        try { cb([...list]); } catch (err) {
          console.debug('trainingEmployees listener error:', err);
        }
      });
    }

    return list[index] || null;
  },

  subscribe(callback) {
    if (!listenersMap['trainingEmployees']) listenersMap['trainingEmployees'] = [];
    listenersMap['trainingEmployees'].push(callback);

    this.getAll().then(list => {
      try { callback(list); } catch (e) {
        console.debug('subscribe initial callback error:', e);
      }
    });

    const unsubManpower = employeesService.subscribe(async () => {
      try {
        const merged = await this.getAll();
        callback(merged);
      } catch (e) {
        console.debug('subscribe manpower sync error:', e);
      }
    });

    return () => {
      listenersMap['trainingEmployees'] = listenersMap['trainingEmployees'].filter(cb => cb !== callback);
      unsubManpower();
    };
  }
};

export const auditLogService = createTrainingStoreService('auditLog');

// Special Append-Only Training Log Service
export const trainingLogService = {
  ...createTrainingStoreService('trainingLog'),

  // Append-only: create is allowed
  async addLog(logData, user) {
    const sanitized = cleanPayload(logData);
    const id = `LOG-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const newRecord = {
      ...sanitized,
      id,
      recordedBy: user?.displayName || user?.email || 'System Admin',
      recordedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      cancelled: false,
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'trainingLog', id), {
          ...newRecord,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore addLog fallback to local', err);
      }
    }

    const list = getLocalStore('trainingLog');
    const updated = [newRecord, ...list];
    saveLocalStore('trainingLog', updated);

    // Record audit log
    await auditLogService.create({
      entity: 'trainingLog',
      entityId: id,
      action: 'CREATE',
      changes: { courseId: newRecord.courseId, employeeId: newRecord.employeeId, certNo: newRecord.certNo },
      performedBy: user?.displayName || user?.email || 'System',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return newRecord;
  },

  // Soft-cancel (Undo) only: never delete or alter log fields
  async cancelLog(logId, reason = 'Operator requested undo', user) {
    const list = getLocalStore('trainingLog');
    const target = list.find(l => l.id === logId);
    if (!target) throw new Error('Training log not found');

    const updateData = {
      cancelled: true,
      cancelledAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      cancelledBy: user?.displayName || user?.email || 'Authorized User',
      cancelReason: reason,
    };

    if (isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'trainingLog', logId), {
          ...updateData,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore cancelLog fallback to local', err);
      }
    }

    const updatedList = list.map(l => l.id === logId ? { ...l, ...updateData } : l);
    saveLocalStore('trainingLog', updatedList);

    await auditLogService.create({
      entity: 'trainingLog',
      entityId: logId,
      action: 'CANCEL_SOFT_UNDO',
      changes: { reason },
      performedBy: user?.displayName || user?.email || 'Authorized User',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });

    return true;
  },

  // Batch import multiple training records with strict duplicate prevention
  async batchAddLogs(records, user) {
    const currentLogs = getLocalStore('trainingLog');
    const accepted = [];
    const duplicates = [];

    const existingAndBatchLogs = [...currentLogs];

    for (const item of records) {
      const dupCheck = checkDuplicateLog(item, existingAndBatchLogs);
      if (dupCheck.isDuplicate) {
        duplicates.push({ ...item, duplicateReason: dupCheck.reason });
      } else {
        const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}-${accepted.length}`;
        const newRecord = {
          ...cleanPayload(item),
          id,
          recordedBy: user?.displayName || user?.email || 'Excel Batch Import',
          recordedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
          cancelled: false,
        };
        accepted.push(newRecord);
        existingAndBatchLogs.push(newRecord);
      }
    }

    if (accepted.length > 0) {
      if (isFirebaseConfigured) {
        try {
          const writePromises = accepted.map(rec =>
            setDoc(doc(db, 'trainingLog', rec.id), {
              ...rec,
              createdAt: serverTimestamp(),
            })
          );
          await Promise.all(writePromises);
        } catch (err) {
          console.warn('Firestore batchAddLogs fallback to local', err);
        }
      }

      const updated = [...accepted, ...currentLogs];
      saveLocalStore('trainingLog', updated);

      await auditLogService.create({
        entity: 'trainingLog',
        entityId: `BATCH-${Date.now()}`,
        action: 'BATCH_IMPORT',
        changes: {
          importedCount: accepted.length,
          skippedDuplicatesCount: duplicates.length,
          sampleIds: accepted.slice(0, 5).map(r => r.id),
        },
        performedBy: user?.displayName || user?.email || 'Excel Import Operator',
        timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      });
    }

    return {
      accepted,
      duplicates,
      total: records.length,
    };
  },

  // HARD DELETE IS FORBIDDEN BY POLICY
  async delete() {
    throw new Error('Policy Violation: trainingLog is append-only. Hard deletion is strictly forbidden. Please use cancelLog() to soft-cancel.');
  },

  // Clear only demo sample logs (keeps user-created logs)
  async clearDemoLogs(user) {
    const demoIds = new Set(sampleTrainingLogs.map(l => l.id));
    const current = getLocalStore('trainingLog');
    const remaining = current.filter(l => !demoIds.has(l.id) && !isDemoLog(l));
    saveLocalStore('trainingLog', remaining);
    await auditLogService.create({
      entity: 'trainingLog',
      entityId: 'ALL_DEMO',
      action: 'CLEAR_DEMO_RECORDS',
      changes: { removedCount: current.length - remaining.length, remainingCount: remaining.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return { removedCount: current.length - remaining.length, remainingCount: remaining.length };
  },

  // Clear all logs completely to start clean
  async clearAllLogs(user) {
    const current = getLocalStore('trainingLog');
    saveLocalStore('trainingLog', []);
    await clearFirestoreCollection('trainingLog');
    await auditLogService.create({
      entity: 'trainingLog',
      entityId: 'ALL',
      action: 'CLEAR_ALL_RECORDS',
      changes: { removedCount: current.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return { removedCount: current.length };
  },

  // Reset back to default demo data
  async resetToDemo(user) {
    saveLocalStore('trainingLog', [...sampleTrainingLogs]);
    await auditLogService.create({
      entity: 'trainingLog',
      entityId: 'DEMO_RESTORE',
      action: 'RESTORE_DEMO_DATA',
      changes: { restoredCount: sampleTrainingLogs.length },
      performedBy: user?.displayName || user?.email || 'System Admin',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    });
    return true;
  }
};

/**
 * Global training demo data clear and reset helpers
 */
export async function clearAllDemoTrainingData(user, { clearCourses = false } = {}) {
  const logResult = await trainingLogService.clearDemoLogs(user);
  const empResult = await trainingEmployeesService.clearDemoEmployees(user);
  const matrixResult = await trainingMatrixService.clearDemoMatrix(user);
  let courseCount = 0;
  if (clearCourses) {
    const courseResult = await coursesService.clearDemoCourses(user);
    courseCount = courseResult.removedCount;
  }

  return {
    clearedLogs: logResult.removedCount,
    clearedEmployees: empResult.removedCount,
    clearedRules: matrixResult.removedCount,
    clearedCourses: courseCount,
  };
}

export async function clearAllTrainingData(arg1, arg2) {
  let user = null;
  let options = { clearEmployees: true, clearRules: true, clearLogs: true, clearCourses: false };

  if (arg1 && typeof arg1 === 'object') {
    if ('clearEmployees' in arg1 || 'clearRules' in arg1 || 'clearLogs' in arg1 || 'clearCourses' in arg1) {
      options = { ...options, ...arg1 };
      user = arg2 || null;
    } else {
      user = arg1;
      if (arg2 && typeof arg2 === 'object') {
        options = { ...options, ...arg2 };
      }
    }
  }

  const { clearEmployees = true, clearRules = true, clearLogs = true, clearCourses = false } = options;

  let clearedLogs = 0;
  let clearedRules = 0;
  let clearedEmployees = 0;
  let clearedCourses = 0;

  if (clearLogs) {
    const res = await trainingLogService.clearAllLogs(user);
    clearedLogs = res.removedCount;
  }
  if (clearRules) {
    const res = await trainingMatrixService.clearAllMatrix(user);
    clearedRules = res.removedCount;
  }
  if (clearEmployees) {
    const res = await trainingEmployeesService.clearAllEmployees(user);
    clearedEmployees = res.removedCount;
  }
  if (clearCourses) {
    const res = await coursesService.clearAllCourses(user);
    clearedCourses = res.removedCount;
  }

  return {
    clearedLogs,
    clearedRules,
    clearedEmployees,
    clearedCourses,
  };
}

export async function resetAllDemoTrainingData(user) {
  await trainingLogService.resetToDemo(user);
  await trainingEmployeesService.resetToDemo(user);
  await trainingMatrixService.resetToDemo(user);
  await coursesService.resetToDemo(user);
  return true;
}

/**
 * Computes live latestTraining status for each (Employee, Required Course)
 * Status:
 *  - AVB: Available / Valid (expiry > 90 days away, or non-expiring/e-learning course)
 *  - REM: Reminder / Due Soon (expiry <= 90 days away and >= today)
 *  - EXP: Expired (expiry < today)
 *  - NOT_TRAINED: Required by Matrix but no valid completion log exists
 */
export function computeComplianceMatrix({ employees = [], courses = [], matrix = [], logs = [] }) {
  const activeEmployees = employees.filter(e => e.status !== 'Resigned');
  const validLogs = logs.filter(l => !l.cancelled);

  const courseMap = new Map(courses.map(c => [c.id, c]));

  const records = [];

  activeEmployees.forEach(emp => {
    // Determine required courses from matrix matching currentProject + position
    // Or fallback to position matching any project / global default
    const matchingMatrixEntries = matrix.filter(m => {
      const mPos = (m.position || '').toLowerCase().trim();
      const empPos = (emp.position || '').toLowerCase().trim();
      const posMatch = mPos === empPos || (empPos && mPos.includes(empPos)) || (mPos && empPos.includes(mPos));
      const projMatch = m.projectId === emp.currentProject || m.projectId === 'GLOBAL-DEFAULT' || !m.projectId;
      return posMatch && projMatch;
    });

    // Unique required course IDs
    const requiredCourseIds = new Set();
    matchingMatrixEntries.forEach(m => {
      (m.requiredCourseIds || []).forEach(cid => requiredCourseIds.add(cid));
    });

    // If no specific matrix found, check global default matrix rules
    if (requiredCourseIds.size === 0) {
      const globalEntries = matrix.filter(m => m.projectId === 'GLOBAL-DEFAULT');
      globalEntries.forEach(m => {
        (m.requiredCourseIds || []).forEach(cid => requiredCourseIds.add(cid));
      });
    }

    requiredCourseIds.forEach(courseId => {
      const course = courseMap.get(courseId);
      if (!course) return;

      // Smart match all valid logs for this employee and course
      const empLogs = validLogs
        .filter(l => matchEmployeeLog(emp, l) && matchCourseLog(course, l))
        .sort((a, b) => new Date(b.completionDate || b.recordedAt || 0) - new Date(a.completionDate || a.recordedAt || 0));

      const latest = empLogs[0];
      const today = new Date();

      let status = 'NOT_TRAINED';
      let daysRemaining = null;

      const isELearning = course.validityMonths === 0 || course.category === 'E-Learning' || (course.code && course.code.includes('EL'));

      if (latest) {
        if (isELearning || !latest.expiryDate || course.validityMonths === 0) {
          status = 'AVB';
          daysRemaining = null;
        } else {
          try {
            const expDate = parseISO(latest.expiryDate);
            daysRemaining = differenceInDays(expDate, today);

            if (daysRemaining < 0) {
              status = 'EXP';
            } else if (daysRemaining <= 90) {
              status = 'REM';
            } else {
              status = 'AVB';
            }
          } catch (e) {
            status = 'AVB';
          }
        }
      }

      records.push({
        id: `${emp.id}_${course.id}`,
        employeeId: formatDisplayEmployeeId(emp),
        employeeName: emp.name,
        employeePosition: emp.position,
        employeeDepartment: emp.department,
        employeeStatus: emp.status || 'Active',
        projectId: emp.currentProject || 'Unassigned',
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        courseCategory: course.category,
        status,
        daysRemaining,
        completionDate: latest?.completionDate || null,
        expiryDate: latest?.expiryDate || null,
        certNo: latest?.certNo || null,
        institute: latest?.institute || null,
        logId: latest?.id || null,
      });
    });
  });

  return records;
}

/**
 * Calculates Project Readiness & Completion metrics
 */
export function calculateProjectMetrics({ projects = [], employees = [], complianceRecords = [] }) {
  const result = [];

  projects.forEach(proj => {
    const projEmployees = employees.filter(e => e.currentProject === proj.id && e.status !== 'Resigned');
    const projRecords = complianceRecords.filter(r => r.projectId === proj.id);

    const totalRequired = projRecords.length;
    const compliant = projRecords.filter(r => r.status === 'AVB').length;
    const expiringSoon = projRecords.filter(r => r.status === 'REM').length;
    const expired = projRecords.filter(r => r.status === 'EXP').length;
    const notTrained = projRecords.filter(r => r.status === 'NOT_TRAINED').length;

    const readinessPct = totalRequired > 0 ? Math.round((compliant / totalRequired) * 100) : 100;

    result.push({
      projectId: proj.id,
      projectNo: proj.projectNo || proj.id,
      projectName: proj.name,
      clientName: proj.clientName,
      status: proj.status,
      employeeCount: projEmployees.length,
      totalRequired,
      compliant,
      expiringSoon,
      expired,
      notTrained,
      readinessPct,
    });
  });

  return result;
}

/**
 * Export full Training Matrix to Excel (.xlsx)
 */
export function exportTrainingMatrixExcel({ employees = [], courses = [], complianceRecords = [], selectedProject = 'ALL' }) {
  const wb = XLSX.utils.book_new();

  // Filter records if project selected
  const filteredRecords = selectedProject === 'ALL'
    ? complianceRecords
    : complianceRecords.filter(r => r.projectId === selectedProject);

  // Sheet 1: Matrix View
  const matrixData = filteredRecords.map(r => ({
    'Employee ID': r.employeeId,
    'Employee Name': r.employeeName,
    'Position': r.employeePosition,
    'Department': r.employeeDepartment,
    'Project ID': r.projectId,
    'Course Code': r.courseCode,
    'Course Title': r.courseName,
    'Category': r.courseCategory,
    'Status': r.status, // AVB, REM, EXP, NOT_TRAINED
    'Days Remaining': r.daysRemaining !== null ? r.daysRemaining : 'N/A',
    'Completion Date': r.completionDate || '—',
    'Expiry Date': r.expiryDate || '—',
    'Certificate No': r.certNo || '—',
    'Training Provider': r.institute || '—',
  }));

  const ws1 = XLSX.utils.json_to_sheet(matrixData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Training Matrix');

  // Sheet 2: Urgent Alerts (EXP + REM)
  const alertsData = filteredRecords
    .filter(r => r.status === 'EXP' || r.status === 'REM' || r.status === 'NOT_TRAINED')
    .sort((a, b) => {
      const order = { EXP: 0, NOT_TRAINED: 1, REM: 2 };
      return (order[a.status] || 3) - (order[b.status] || 3);
    })
    .map(r => ({
      'Priority': r.status === 'EXP' ? 'CRITICAL - EXPIRED' : r.status === 'NOT_TRAINED' ? 'HIGH - NOT TRAINED' : 'WARNING - EXPIRING SOON',
      'Employee': r.employeeName,
      'Position': r.employeePosition,
      'Project': r.projectId,
      'Course': `${r.courseCode} - ${r.courseName}`,
      'Status': r.status,
      'Days Remaining': r.daysRemaining !== null ? r.daysRemaining : 'Missing',
      'Expiry Date': r.expiryDate || 'N/A',
      'Certificate No': r.certNo || 'N/A',
    }));

  const ws2 = XLSX.utils.json_to_sheet(alertsData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Action Items & Alerts');

  const fileName = `PS_Songkhla_Training_Matrix_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generates an official Employee Training Record / Transcript as a PDF
 */
export function exportEmployeePDF({ employee, complianceRecords = [], allLogs = [], courses = [] }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const todayStr = format(new Date(), 'dd MMMM yyyy');

  // Colors
  const primaryColor = [234, 88, 12]; // Orange 600 #ea580c
  const slateDark = [30, 41, 59];
  const slateMuted = [100, 116, 139];

  // Header Banner
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setFillColor(...primaryColor);
  doc.rect(14, 12, 4, 20, 'F');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateDark);
  doc.text('PS SONGKHLA OPERATIONS PLATFORM', 22, 19);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateMuted);
  doc.text('OFFSHORE & INDUSTRIAL WORKFORCE TRAINING TRANSCRIPT', 22, 26);
  doc.text(`Issue Date: ${todayStr} | Confidential Quality & Safety Record`, 22, 32);

  // Employee Profile Card
  let startY = 48;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, startY, 182, 36, 3, 3, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(employee.name || 'Unknown Employee', 19, startY + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateDark);
  doc.text(`Employee ID: ${employee.empNo || employee.id}`, 19, startY + 16);
  doc.text(`Position: ${employee.position || '—'}`, 19, startY + 23);
  doc.text(`Department: ${employee.department || '—'}`, 19, startY + 30);

  doc.text(`Current Project: ${employee.currentProject || 'Unassigned'}`, 105, startY + 16);
  doc.text(`Status: ${employee.status || 'Active'}`, 105, startY + 23);
  doc.text(`Contact: ${employee.email || '—'}`, 105, startY + 30);

  // Section 1: Required Compliance Status
  const empRecords = complianceRecords.filter(r => r.employeeId === employee.id);
  const compliantCount = empRecords.filter(r => r.status === 'AVB').length;
  const complianceRate = empRecords.length > 0 ? Math.round((compliantCount / empRecords.length) * 100) : 100;

  startY = 92;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateDark);
  doc.text('1. Required Matrix Competency & Compliance Status', 14, startY);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateMuted);
  doc.text(`Overall Role Compliance: ${complianceRate}% (${compliantCount}/${empRecords.length} courses valid)`, 14, startY + 6);

  const complianceRows = empRecords.map(r => {
    let statusLabel = 'NOT TRAINED';
    if (r.status === 'AVB') statusLabel = 'VALID (AVB)';
    else if (r.status === 'REM') statusLabel = `EXPIRING (${r.daysRemaining}d)`;
    else if (r.status === 'EXP') statusLabel = `EXPIRED (${Math.abs(r.daysRemaining)}d ago)`;

    return [
      r.courseCode,
      r.courseName,
      r.completionDate || '—',
      r.expiryDate || '—',
      statusLabel,
      r.certNo || '—',
    ];
  });

  doc.autoTable({
    startY: startY + 10,
    head: [['Code', 'Course Title', 'Completed', 'Expiry', 'Status', 'Certificate No.']],
    body: complianceRows.length > 0 ? complianceRows : [['—', 'No matrix courses specified for this role', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 65 },
      2: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 25, fontStyle: 'bold' },
      5: { cellWidth: 24 },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text.includes('VALID')) data.cell.styles.textColor = [16, 149, 193]; // emerald
        else if (text.includes('EXPIRING')) data.cell.styles.textColor = [217, 119, 6]; // amber
        else if (text.includes('EXPIRED')) data.cell.styles.textColor = [225, 29, 72]; // rose
        else data.cell.styles.textColor = [100, 116, 139];
      }
    }
  });

  // Section 2: Historical Training Log (Append-Only Records)
  const lastY = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slateDark);
  doc.text('2. Historical Training & Certification Logs', 14, lastY);

  const empLogs = allLogs
    .filter(l => l.employeeId === employee.id)
    .sort((a, b) => new Date(b.completionDate || b.recordedAt) - new Date(a.completionDate || a.recordedAt));

  const logRows = empLogs.map(l => [
    l.completionDate || '—',
    l.courseCode || l.courseName,
    l.certNo || '—',
    l.institute || '—',
    l.cancelled ? 'CANCELLED / VOID' : (l.expiryDate ? `Expires: ${l.expiryDate}` : 'No Expiry'),
    l.remarks || '—',
  ]);

  doc.autoTable({
    startY: lastY + 6,
    head: [['Trained Date', 'Course / Qualification', 'Certificate #', 'Provider / Institute', 'Validity', 'Remarks']],
    body: logRows.length > 0 ? logRows : [['—', 'No historical training records found', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 50 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 26 },
      5: { cellWidth: 22 },
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw);
        if (text.includes('CANCELLED')) {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'italic';
        }
      }
    }
  });

  // Footer / Sign-off
  const footerY = doc.lastAutoTable.finalY + 18;
  if (footerY < 260) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slateMuted);

    doc.line(14, footerY + 12, 70, footerY + 12);
    doc.text('Employee Signature', 14, footerY + 16);

    doc.line(126, footerY + 12, 182, footerY + 12);
    doc.text('Authorized Operations / HR Training Stamp', 126, footerY + 16);
  }

  const fileName = `Training_Record_${employee.empNo || employee.id}_${employee.name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

/**
 * Downloads a structured, friendly Excel Template for batch training imports
 */
export function downloadTrainingLogTemplate({ courses = [], employees = [] }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template
  const templateHeaders = [
    {
      'No.': 1,
      'Employee ID': 'PS-SKL-001',
      'Employee Name *': 'Somchai Prasert (Example - replace with real employee)',
      'Position': 'Technician',
      'Department': 'Operations',
      'Course Code *': 'CRS-001',
      'Course Name': 'BOSIET - Basic Offshore Safety (Optional)',
      'Course Category': 'Offshore Safety',
      'Validity (Months)': 24,
      'Completion Date *': '2025-06-15',
      'Expiry Date': '2027-06-14',
      'Certificate No': 'OPITO-TH-2025-0182',
      'Training Provider': 'TSTC Songkhla',
      'Remarks': 'Sample note (replace or delete this row)',
    },
  ];

  const wsTemplate = XLSX.utils.json_to_sheet(templateHeaders);
  wsTemplate['!cols'] = [
    { wch: 8 },  // No.
    { wch: 18 }, // Employee ID
    { wch: 34 }, // Employee Name
    { wch: 24 }, // Position
    { wch: 20 }, // Department
    { wch: 16 }, // Course Code
    { wch: 38 }, // Course Name
    { wch: 20 }, // Course Category
    { wch: 18 }, // Validity (Months)
    { wch: 18 }, // Completion Date
    { wch: 18 }, // Expiry Date
    { wch: 24 }, // Certificate No
    { wch: 26 }, // Training Provider
    { wch: 35 }, // Remarks
  ];
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Training_Import_Template');

  // Sheet 2: Employee Reference (No more long Firestore IDs, No more confusing Employee No)
  const activeEmployees = employees.filter(e => e.status !== 'Resigned');
  const employeeData = activeEmployees.map((e, idx) => {
    const cleanEmpId = cleanHrEmployeeId(e.empNo || e.employeeId);
    return {
      'No.': idx + 1,
      'Employee ID': cleanEmpId, // Clean HR Employee ID (or blank if not assigned yet)
      'Name': e.name,
      'Position': e.position || '—',
      'Department': e.department || '—',
      'Current Project': e.currentProject || 'Unassigned',
    };
  });
  const wsEmployees = XLSX.utils.json_to_sheet(employeeData.length > 0 ? employeeData : [{ 'Note': 'No employees found' }]);
  wsEmployees['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 28 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employee_Reference');

  // Sheet 3: Course Reference
  const courseData = courses.map(c => ({
    'Course Code': c.code,
    'Course ID': c.id,
    'Course Name': c.name,
    'Category': c.category || 'Safety',
    'Validity (Months)': c.validityMonths || 'No Expiry',
    'Recommended Provider': c.provider || '—',
  }));
  const wsCourses = XLSX.utils.json_to_sheet(courseData.length > 0 ? courseData : [{ 'Note': 'No courses found' }]);
  wsCourses['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsCourses, 'Course_Reference');

  XLSX.writeFile(wb, `Training_Records_Upload_Template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

/**
 * Downloads Employee Master Template for updating HR Employee IDs
 */
export function downloadEmployeeMasterTemplate(employees = []) {
  const wb = XLSX.utils.book_new();
  const sorted = sortEmployees(employees.filter(e => (e.status || 'Active') !== 'Resigned'), 'empId', 'asc');

  const data = sorted.map((e, idx) => {
    const cleanId = cleanHrEmployeeId(e.empNo || e.employeeId);
    return {
      'No.': idx + 1,
      'Employee ID': cleanId, // Editable column for HR ID
      'Name': e.name,
      'Position': e.position || '',
      'Department': e.department || 'Operations',
      'Current Project': e.currentProject || '',
      'Status': e.status || 'Active',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [
    { 'No.': 1, 'Employee ID': 'PS-SKL-001', 'Name': 'Somchai Prasert', 'Position': 'Technician', 'Department': 'Operations', 'Current Project': '', 'Status': 'Active' }
  ]);
  ws['!cols'] = [
    { wch: 8 },  // No.
    { wch: 18 }, // Employee ID
    { wch: 32 }, // Name
    { wch: 26 }, // Position
    { wch: 20 }, // Department
    { wch: 20 }, // Current Project
    { wch: 14 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Employee_HR_ID_Master');
  XLSX.writeFile(wb, `Employee_ID_Master_Template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

/**
 * Parses uploaded Employee Master Excel and batch updates Employee IDs by matching Name
 */
export async function parseAndBatchUpdateEmployeeIds(file, employees = []) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  if (!ws) throw new Error('No valid sheet found in uploaded Excel file');

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  if (rows.length === 0) throw new Error('Excel file contains no rows');

  // Build name index of existing employees
  const empByName = new Map();
  employees.forEach(emp => {
    if (!emp) return;
    if (emp.name) {
      empByName.set(normalizeEmployeeName(emp.name), emp);
      empByName.set(emp.name.trim().toLowerCase(), emp);
    }
    if (emp.nameEn) {
      empByName.set(normalizeEmployeeName(emp.nameEn), emp);
      empByName.set(emp.nameEn.trim().toLowerCase(), emp);
    }
  });

  let updatedCount = 0;
  let skippedCount = 0;
  const updatedEmployees = [];

  for (const row of rows) {
    // Find name from column variations
    let nameVal = '';
    let rawIdVal = '';

    for (const [k, v] of Object.entries(row)) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
      if (['name', 'employeename', 'ชื่อ', 'ชื่อพนักงาน', 'fullname'].some(p => cleanK.includes(p))) {
        nameVal = String(v || '').trim();
      }
      if (['employeeid', 'empid', 'empno', 'รหัสพนักงาน', 'รหัส', 'id'].some(p => cleanK.includes(p))) {
        rawIdVal = String(v || '').trim();
      }
    }

    const cleanId = cleanHrEmployeeId(rawIdVal);

    if (!nameVal) {
      skippedCount++;
      continue;
    }

    const normName = normalizeEmployeeName(nameVal);
    const targetEmp = empByName.get(normName) || empByName.get(nameVal.trim().toLowerCase());

    if (targetEmp) {
      if (cleanId) {
        await trainingEmployeesService.update(targetEmp.id, { empNo: cleanId });
      }
      updatedCount++;
      updatedEmployees.push({ id: targetEmp.id, name: targetEmp.name, empNo: cleanId || targetEmp.empNo });
    } else {
      // Create new employee if not yet in database
      let posVal = '';
      let deptVal = 'Operations';
      let projVal = '';
      for (const [k, v] of Object.entries(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK.includes('position') || cleanK.includes('role')) posVal = String(v || '').trim();
        if (cleanK.includes('department') || cleanK.includes('dept')) deptVal = String(v || '').trim();
        if (cleanK.includes('project')) projVal = String(v || '').trim();
      }
      const newEmp = await trainingEmployeesService.create({
        name: nameVal,
        nameEn: nameVal,
        empNo: cleanId || '',
        position: posVal || 'Technician',
        department: deptVal || 'Operations',
        currentProject: projVal || '',
        status: 'Active',
      });
      updatedCount++;
      updatedEmployees.push({ id: newEmp.id, name: newEmp.name, empNo: cleanId || '' });
      empByName.set(normName, newEmp);
    }
  }

  return { updatedCount, skippedCount, updatedEmployees };
}

/**
 * Parses and validates an uploaded Excel file for Training Records
 */
export async function parseAndValidateTrainingExcel(file, { courses = [], employees = [], existingLogs = [] }) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', cellDates: true });

  const sheetNames = wb.SheetNames;
  let targetSheetName = sheetNames[0];
  const preferred = sheetNames.find(n => /training|import|template/i.test(n));
  if (preferred) targetSheetName = preferred;

  const ws = wb.Sheets[targetSheetName];
  if (!ws) {
    throw new Error('No readable sheet found in Excel file');
  }

  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  if (rawRows.length === 0) {
    throw new Error('The uploaded Excel file contains no data rows');
  }

  // Smart ID normalizer: strips hyphens, underscores, spaces, and common prefixes
  const cleanKey = (str) => (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
  const cleanIdNum = (str) => {
    const s = cleanKey(str).replace(/^(ogs|emp|staff)+/g, '');
    return s.replace(/^0+/, ''); // '001' -> '1'
  };

  const courseCodeMap = new Map();
  const courseNameMap = new Map();
  courses.forEach(c => {
    if (c.code) {
      courseCodeMap.set(c.code.trim().toLowerCase(), c);
      courseCodeMap.set(cleanKey(c.code), c);
    }
    if (c.id) {
      courseCodeMap.set(c.id.trim().toLowerCase(), c);
      courseCodeMap.set(cleanKey(c.id), c);
    }
    if (c.name) courseNameMap.set(c.name.trim().toLowerCase(), c);
  });

  // Register known aliases (e.g. BOSIET, FOET, H2S, OGUK, PTW, etc.)
  Object.entries(COURSE_ALIASES).forEach(([alias, targets]) => {
    const targetSet = new Set(targets.map(t => t.toLowerCase().trim()));
    const found = courses.find(c => {
      const cCode = (c.code || '').toLowerCase().trim();
      const cId = (c.id || '').toLowerCase().trim();
      return targetSet.has(cCode) || targetSet.has(cId);
    });
    if (found) {
      courseCodeMap.set(alias.toLowerCase(), found);
      courseCodeMap.set(cleanKey(alias), found);
    }
  });

  const empIdMap = new Map();
  const empNameMap = new Map();

  employees.forEach(e => {
    if (e.id) {
      const cId = cleanKey(e.id);
      empIdMap.set(cId, e);
      const num = cleanIdNum(e.id);
      if (num) empIdMap.set(num, e);
    }
    if (e.empNo) {
      const cNo = cleanKey(e.empNo);
      empIdMap.set(cNo, e);
      const num = cleanIdNum(e.empNo);
      if (num) empIdMap.set(num, e);
    }
    if (e.name) {
      empNameMap.set(cleanKey(e.name), e);
      empNameMap.set(e.name.trim().toLowerCase(), e);
      empNameMap.set(normalizeEmployeeName(e.name), e);
    }
    if (e.nameEn) {
      empNameMap.set(cleanKey(e.nameEn), e);
      empNameMap.set(e.nameEn.trim().toLowerCase(), e);
      empNameMap.set(normalizeEmployeeName(e.nameEn), e);
    }
  });

  const validRows = [];
  const duplicateRows = [];
  const invalidRows = [];
  const unmatchedEmployeesMap = new Map();
  const unmatchedCoursesMap = new Map();

  const seenInCurrentFile = [...existingLogs];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;

    const getVal = (patterns) => {
      for (const [k, v] of Object.entries(row)) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
        for (const p of patterns) {
          if (cleanK.includes(p)) return String(v || '').trim();
        }
      }
      return '';
    };

    const rawEmpId = getVal(['employeeid', 'empid', 'empno', 'รหัสพนักงาน', 'พนักงาน']);
    const rawEmpName = getVal(['employeename', 'empname', 'ชื่อพนักงาน', 'ชื่อ']);
    const rawPosition = getVal(['position', 'jobtitle', 'title', 'role', 'ตำแหน่ง', 'ตำแหน่งงาน', 'หน้าที่']);
    const rawDepartment = getVal(['department', 'dept', 'division', 'แผนก', 'ฝ่าย', 'สังกัด']);
    const rawCourseCode = getVal(['coursecode', 'code', 'รหัสหลักสูตร', 'หลักสูตรรหัส', 'courseid', 'รหัสคอร์ส']);
    const rawCourseName = getVal(['coursename', 'ชื่อหลักสูตร', 'หลักสูตร', 'course', 'วิชา']);
    const rawCourseCategory = getVal(['category', 'coursecategory', 'ประเภทหลักสูตร', 'หมวด', 'หมวดหมู่']);
    const rawValidity = getVal(['validity', 'validitymonths', 'months', 'อายุหลักสูตร', 'อายุ', 'อายุใบรับรอง']);
    const rawCompDate = getVal(['completiondate', 'completeddate', 'traineddate', 'date', 'วันที่อบรม', 'วันที่ผ่าน']);
    const rawExpDate = getVal(['expirydate', 'expiredate', 'expdate', 'วันหมดอายุ']);
    const rawCertNo = getVal(['certno', 'certificateno', 'certificate', 'เลขที่ใบประกาศ', 'ใบประกาศ']);
    const rawInstitute = getVal(['provider', 'institute', 'trainingprovider', 'center', 'สถาบัน', 'ผู้จัดอบรม']);
    const rawRemarks = getVal(['remarks', 'remark', 'notes', 'comment', 'หมายเหตุ']);

    // Ignore empty lines
    if (!rawEmpId && !rawEmpName && !rawCourseCode && !rawCourseName && !rawCompDate) {
      return;
    }

    // Ignore placeholder/example rows from the template automatically
    if (
      rawEmpName.toLowerCase().includes('example - replace') ||
      rawEmpName.toLowerCase().includes('optional - for reference') ||
      (rawEmpId.toLowerCase() === 'emp-001' && rawEmpName.toLowerCase().includes('somchai') && rawRemarks.toLowerCase().includes('sample note'))
    ) {
      return;
    }

    // Match employee: prioritize NAME matching as primary
    let matchedEmp = null;
    if (rawEmpName) {
      const cName = cleanKey(rawEmpName);
      const normName = normalizeEmployeeName(rawEmpName);
      matchedEmp = empNameMap.get(normName) || empNameMap.get(cName) || empNameMap.get(rawEmpName.trim().toLowerCase());
    }
    // Secondary fallback: match by Employee ID
    if (!matchedEmp && rawEmpId) {
      const cId = cleanKey(rawEmpId);
      const cNum = cleanIdNum(rawEmpId);
      matchedEmp = empIdMap.get(cId) || empIdMap.get(cNum);
    }

    if (!matchedEmp) {
      const identifier = (rawEmpId || rawEmpName || `Unknown-${rowNum}`).trim();
      if (!unmatchedEmployeesMap.has(identifier)) {
        unmatchedEmployeesMap.set(identifier, {
          identifier,
          rawEmpId: rawEmpId || `PS-SKL-${String(employees.length + unmatchedEmployeesMap.size + 1).padStart(3, '0')}`,
          rawEmpName: rawEmpName || rawEmpId || 'Unnamed Employee',
          suggestedId: rawEmpId || `PS-SKL-${String(employees.length + unmatchedEmployeesMap.size + 1).padStart(3, '0')}`,
          suggestedName: rawEmpName || rawEmpId || 'New Employee',
          position: rawPosition || 'Technician',
          department: rawDepartment || 'Operations',
          count: 0,
          rows: [],
        });
      }
      const uGroup = unmatchedEmployeesMap.get(identifier);
      uGroup.count += 1;
      uGroup.rows.push(rowNum);

      invalidRows.push({
        rowNum,
        raw: row,
        reason: `Employee not found: "${rawEmpId || rawEmpName || 'Missing'}" (Employee ID or Name not found in Manpower/Training database)`,
        isMissingEmployee: true,
        missingEmpId: rawEmpId,
        missingEmpName: rawEmpName,
      });
      return;
    }

    // Match course
    let matchedCourse = null;
    if (rawCourseCode) {
      matchedCourse = courseCodeMap.get(rawCourseCode.toLowerCase());
    }
    if (!matchedCourse && rawCourseName) {
      matchedCourse = courseNameMap.get(rawCourseName.toLowerCase());
    }

    if (!matchedCourse) {
      const courseIdentifier = (rawCourseCode || rawCourseName || `Course-${rowNum}`).trim();
      const normCourseKey = courseIdentifier.toLowerCase();
      if (!unmatchedCoursesMap.has(normCourseKey)) {
        let calcMonths = 24;
        if (rawCompDate && rawExpDate) {
          try {
            const cD = parseISO(normalizeDateString(rawCompDate));
            const eD = parseISO(normalizeDateString(rawExpDate));
            const diff = Math.round((eD - cD) / (1000 * 60 * 60 * 24 * 30.4375));
            if (diff > 0) calcMonths = diff;
          } catch (e) {
            calcMonths = 24;
          }
        }
        const parsedVal = parseInt(rawValidity, 10);
        const validity = (!isNaN(parsedVal) && parsedVal > 0) ? parsedVal : calcMonths;
        const code = (rawCourseCode || `CRS-${String(courses.length + unmatchedCoursesMap.size + 1).padStart(3, '0')}`).trim();
        const name = (rawCourseName || rawCourseCode || 'New Course').trim();

        unmatchedCoursesMap.set(normCourseKey, {
          identifier: courseIdentifier,
          suggestedCode: code,
          suggestedName: name,
          suggestedCategory: rawCourseCategory || 'Offshore Safety',
          suggestedValidity: validity,
          suggestedProvider: rawInstitute || 'Approved Training Center',
          count: 0,
          rows: [],
        });
      }
      const cGroup = unmatchedCoursesMap.get(normCourseKey);
      cGroup.count += 1;
      cGroup.rows.push(rowNum);

      invalidRows.push({
        rowNum,
        raw: row,
        reason: `Course not found: "${rawCourseCode || rawCourseName || 'Missing'}" (Not registered in Courses catalog)`,
        isMissingCourse: true,
        missingCourseCode: rawCourseCode,
        missingCourseName: rawCourseName,
      });
      return;
    }

    // Validate completion date
    const completionDate = normalizeDateString(rawCompDate);
    if (!completionDate || !/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
      invalidRows.push({
        rowNum,
        raw: row,
        reason: `Invalid Completion Date: "${rawCompDate || 'Missing'}". Please use YYYY-MM-DD`,
      });
      return;
    }

    // Calculate or normalize expiry date
    let expiryDate = normalizeDateString(rawExpDate);
    if (!expiryDate && matchedCourse.validityMonths) {
      try {
        const compD = parseISO(completionDate);
        expiryDate = format(addMonths(compD, matchedCourse.validityMonths), 'yyyy-MM-dd');
      } catch (e) {
        expiryDate = '';
      }
    }

    const candidateRecord = {
      rowNum,
      employeeId: matchedEmp.id,
      employeeName: matchedEmp.name,
      courseId: matchedCourse.id,
      courseCode: matchedCourse.code,
      courseName: matchedCourse.name,
      completionDate,
      expiryDate: expiryDate || null,
      certNo: rawCertNo || null,
      institute: rawInstitute || matchedCourse.provider || '',
      remarks: rawRemarks || '',
    };

    // Duplicate Check
    const dupCheck = checkDuplicateLog(candidateRecord, seenInCurrentFile);
    if (dupCheck.isDuplicate) {
      duplicateRows.push({
        ...candidateRecord,
        reason: dupCheck.reason,
      });
    } else {
      validRows.push(candidateRecord);
      seenInCurrentFile.push(candidateRecord);
    }
  });

  return {
    totalRows: rawRows.length,
    validRows,
    duplicateRows,
    invalidRows,
    unmatchedEmployees: Array.from(unmatchedEmployeesMap.values()),
    unmatchedCourses: Array.from(unmatchedCoursesMap.values()),
  };
}
