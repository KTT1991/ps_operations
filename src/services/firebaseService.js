import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  sampleAssets,
  sampleEmployees,
  sampleProjects,
  sampleMaintenanceRecords as sampleMaintenance,
  sampleInventory,
} from '../data/sampleData';
import { sanitizeToPOJO, safeStringify, safeParse } from '../utils/storageSanitizer';

const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here' &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith('your_')
);

const initialDataMap = {
  assets: sampleAssets,
  employees: sampleEmployees,
  projects: sampleProjects,
  maintenance: sampleMaintenance,
  inventory: sampleInventory,
  equipmentHistory: [],
  manpowerHistory: [],
};

const listenersMap = {};

const getLocalStore = (collectionName) => {
  const key = `ogs_data_${collectionName}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = safeParse(raw, null);
      if (parsed) {
        if (collectionName === 'projects' && Array.isArray(parsed)) {
          return parsed.map(p => ({
            ...p,
            projectNo: p.projectNo || p.id || '',
          }));
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e);
  }
  const defaults = initialDataMap[collectionName] || [];
  try {
    const cleanDefaults = sanitizeToPOJO(defaults) || [];
    localStorage.setItem(key, safeStringify(cleanDefaults));
  } catch (e) {
    console.warn('Failed to initialize localStorage:', e);
  }
  return [...defaults];
};

const saveLocalStore = (collectionName, data) => {
  const key = `ogs_data_${collectionName}`;
  try {
    const cleanData = sanitizeToPOJO(data) || [];
    localStorage.setItem(key, safeStringify(cleanData));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
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

const createService = (collectionName) => ({
  async getAll() {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs.map(d => sanitizeToPOJO({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`Firestore getAll(${collectionName}) failed, using local fallback`, err);
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
        console.warn(`Firestore getById(${collectionName}, ${id}) failed, using local fallback`, err);
      }
    }
    const list = getLocalStore(collectionName);
    return list.find(d => d.id === id) || null;
  },
  async create(data) {
    const sanitized = cleanPayload(data);
    if (isFirebaseConfigured) {
      try {
        if (sanitized.id) {
          await setDoc(doc(db, collectionName, sanitized.id), {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const list = getLocalStore(collectionName);
          const updated = [sanitized, ...list.filter(d => d.id !== sanitized.id)];
          saveLocalStore(collectionName, updated);
          return { ...sanitized };
        }
        const ref = await addDoc(collection(db, collectionName), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const created = { id: ref.id, ...sanitized };
        const list = getLocalStore(collectionName);
        saveLocalStore(collectionName, [created, ...list]);
        return created;
      } catch (err) {
        console.warn(`Firestore create(${collectionName}) failed, using local fallback`, err);
      }
    }
    const list = getLocalStore(collectionName);
    const newId = sanitized.id || `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}`;
    const newItem = {
      ...sanitized,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...list.filter(d => d.id !== newId)];
    saveLocalStore(collectionName, updated);
    return newItem;
  },
  async update(id, data) {
    const sanitized = cleanPayload(data);
    if (isFirebaseConfigured) {
      try {
        // remove id property before updateDoc if present
        const { id: _, ...updateFields } = sanitized;
        await updateDoc(doc(db, collectionName, id), {
          ...updateFields,
          updatedAt: serverTimestamp(),
        });
        const list = getLocalStore(collectionName);
        const updated = list.map(item => item.id === id ? { ...item, ...sanitized, updatedAt: new Date().toISOString() } : item);
        saveLocalStore(collectionName, updated);
        return { id, ...sanitized };
      } catch (err) {
        console.warn(`Firestore update(${collectionName}, ${id}) failed, using local fallback`, err);
      }
    }
    const list = getLocalStore(collectionName);
    const updated = list.map(item => item.id === id ? { ...item, ...sanitized, updatedAt: new Date().toISOString() } : item);
    saveLocalStore(collectionName, updated);
    return { id, ...sanitized };
  },
  async delete(id) {
    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, collectionName, id));
        return true;
      } catch (err) {
        console.warn(`Firestore delete(${collectionName}, ${id}) failed, using local fallback`, err);
      }
    }
    const list = getLocalStore(collectionName);
    const updated = list.filter(item => item.id !== id);
    saveLocalStore(collectionName, updated);
    return true;
  },
  async clearAll() {
    if (isFirebaseConfigured) {
      try {
        const snap = await getDocs(collection(db, collectionName));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, collectionName, d.id))));
      } catch (err) {
        console.warn(`Firestore clearAll(${collectionName}) failed:`, err);
      }
    }
    saveLocalStore(collectionName, []);
    return { success: true };
  },
  subscribe(callback) {
    if (isFirebaseConfigured) {
      try {
        return onSnapshot(collection(db, collectionName), snap => {
          callback(snap.docs.map(d => sanitizeToPOJO({ id: d.id, ...d.data() })));
        });
      } catch (err) {
        console.warn(`Firestore subscribe(${collectionName}) failed, using local fallback`, err);
      }
    }
    if (!listenersMap[collectionName]) {
      listenersMap[collectionName] = new Set();
    }
    listenersMap[collectionName].add(callback);
    callback(getLocalStore(collectionName));
    return () => {
      if (listenersMap[collectionName]) {
        listenersMap[collectionName].delete(callback);
      }
    };
  },
});

export const assetsService = createService('assets');
export const employeesService = createService('employees');
export const maintenanceService = createService('maintenance');
export const inventoryService = createService('inventory');

// Custom Project Service to handle specific logic
const genericProjectsService = createService('projects');
export const projectsService = {
  ...genericProjectsService,
  
  async create(data) {
    const projectData = { ...data };
    if (projectData.projectNumber) {
      projectData.projectNo = projectData.projectNumber;
      delete projectData.projectNumber;
    }
    const cleanProjectNo = (projectData.projectNo || '').toString().trim();
    if (!cleanProjectNo) {
      throw new Error('Please specify a Project Number (projectNo). It cannot be empty.');
    }
    projectData.projectNo = cleanProjectNo;
    const newId = projectData.id || cleanProjectNo;
    return genericProjectsService.create({ ...projectData, id: newId });
  },

  async update(id, data) {
    const projectData = { ...data };
    if (projectData.projectNumber) {
      projectData.projectNo = projectData.projectNumber;
      delete projectData.projectNumber;
    }
    if (projectData.projectNo !== undefined) {
      const cleanProjectNo = (projectData.projectNo || '').toString().trim();
      if (!cleanProjectNo) {
        throw new Error('Please specify a Project Number (projectNo). It cannot be empty.');
      }
      projectData.projectNo = cleanProjectNo;
    }
    return genericProjectsService.update(id, projectData);
  },
};

// New History Services
export const equipmentHistoryService = createService('equipmentHistory');
export const manpowerHistoryService = createService('manpowerHistory');

// alerts and other functions remain the same
export const getSystemAlerts = (assets = [], employees = []) => {
  const alerts = [];
  const today = new Date();
  const in30  = new Date(today.getTime() + 30 * 86400000);

  assets.forEach(a => {
    if (a.maintenanceDue) {
      const d = new Date(a.maintenanceDue);
      if (d < today) alerts.push({ type:'danger',  category:'Maintenance',   message:`${a.name} maintenance OVERDUE` });
      else if (d < in30) alerts.push({ type:'warning', category:'Maintenance', message:`${a.name} due ${a.maintenanceDue}` });
    }
    if (a.certificationExpiry) {
      const d = new Date(a.certificationExpiry);
      if (d < today) alerts.push({ type:'danger',  category:'Certification', message:`${a.name} cert EXPIRED` });
      else if (d < in30) alerts.push({ type:'warning', category:'Certification', message:`${a.name} cert expires ${a.certificationExpiry}` });
    }
  });

  employees.forEach(emp => {
    (emp.certFields || []).forEach(c => {
      if (!c.expiry) return;
      const d = new Date(c.expiry);
      const days = Math.ceil((d - today) / 86400000);
      if (d < today) alerts.push({ type:'danger',  category:'Personnel', message:`${emp.name} — ${c.label} EXPIRED` });
      else if (d < in30) alerts.push({ type:'warning', category:'Personnel', message:`${emp.name} — ${c.label} expires in ${days}d` });
    });
  });

  return alerts.sort((a, b) => ({ danger:0, warning:1, info:2 })[a.type] - ({ danger:0, warning:1, info:2 })[b.type]);
};
