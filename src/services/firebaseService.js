import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { sampleProjects, sampleEmployees, sampleMaintenanceRecords, sampleInventory } from '../data/sampleData';
import { realAssets } from '../data/assetData';

const isFirebaseConfigured = () =>
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo';

// Deep clone demo data so mutations don't persist across hot reloads
const cloneData = (data) => JSON.parse(JSON.stringify(data));

const createService = (collectionName, demoData) => {
  let _demoCache = null;
  const getCache = () => { if (!_demoCache) _demoCache = cloneData(demoData); return _demoCache; };

  return {
    async getAll() {
      if (!isFirebaseConfigured()) return getCache();
      try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch { return getCache(); }
    },
    async getById(id) {
      if (!isFirebaseConfigured()) return getCache().find(i => i.id === id) || null;
      try {
        const snap = await getDoc(doc(db, collectionName, id));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
      } catch { return getCache().find(i => i.id === id) || null; }
    },
    async create(data) {
      if (!isFirebaseConfigured()) {
        const item = { ...data, id: data.id || `${collectionName}-${Date.now()}`, createdAt: new Date().toISOString() };
        getCache().push(item);
        return item;
      }
      const ref = await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { id: ref.id, ...data };
    },
    async update(id, data) {
      if (!isFirebaseConfigured()) {
        const idx = getCache().findIndex(i => i.id === id);
        if (idx >= 0) getCache()[idx] = { ...getCache()[idx], ...data };
        return { id, ...data };
      }
      await updateDoc(doc(db, collectionName, id), { ...data, updatedAt: serverTimestamp() });
      return { id, ...data };
    },
    async delete(id) {
      if (!isFirebaseConfigured()) {
        _demoCache = getCache().filter(i => i.id !== id);
        return true;
      }
      await deleteDoc(doc(db, collectionName, id));
      return true;
    },
    subscribe(callback) {
      if (!isFirebaseConfigured()) { callback(getCache()); return () => {}; }
      return onSnapshot(collection(db, collectionName), snap => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    },
  };
};

// Use real asset data from uploaded Excel
export const assetsService    = createService('assets',      realAssets);
export const projectsService  = createService('projects',    sampleProjects);
export const employeesService = createService('employees',   sampleEmployees);
export const maintenanceService = createService('maintenance', sampleMaintenanceRecords);
export const inventoryService = createService('inventory',   sampleInventory);

export const seedDatabase = async () => {
  if (!isFirebaseConfigured()) return;
  const batch = writeBatch(db);
  const collections = [
    { name:'assets',      data: realAssets.slice(0,50) }, // seed first 50 to avoid quota
    { name:'projects',    data: sampleProjects },
    { name:'employees',   data: sampleEmployees },
    { name:'maintenance', data: sampleMaintenanceRecords },
  ];
  for (const { name, data } of collections) {
    for (const item of data) {
      batch.set(doc(db, name, item.id), { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  }
  await batch.commit();
};

export const getSystemAlerts = (assets, employees) => {
  const alerts = [];
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const in7  = new Date(today.getTime() + 7  * 86400000);

  // Asset maintenance alerts
  assets.forEach(a => {
    if (a.maintenanceDue) {
      const d = new Date(a.maintenanceDue);
      if (d < today) alerts.push({ type:'danger', category:'Maintenance', message:`${a.name} maintenance OVERDUE`, assetId:a.id, date:a.maintenanceDue });
      else if (d < in30) alerts.push({ type:'warning', category:'Maintenance', message:`${a.name} maintenance due ${a.maintenanceDue}`, assetId:a.id, date:a.maintenanceDue });
    }
    if (a.certificationExpiry) {
      const d = new Date(a.certificationExpiry);
      if (d < today) alerts.push({ type:'danger', category:'Certification', message:`${a.name} certification EXPIRED`, assetId:a.id, date:a.certificationExpiry });
      else if (d < in30) alerts.push({ type:'warning', category:'Certification', message:`${a.name} cert expires ${a.certificationExpiry}`, assetId:a.id, date:a.certificationExpiry });
    }
  });

  // Employee cert alerts (flexible certFields)
  employees.forEach(emp => {
    const certs = emp.certFields || [];
    certs.forEach(c => {
      if (!c.expiry) return;
      const d = new Date(c.expiry);
      if (d < today) alerts.push({ type:'danger', category:'Personnel', message:`${emp.name} — ${c.label} EXPIRED`, empId:emp.id, date:c.expiry });
      else if (d < in30) alerts.push({ type:'warning', category:'Personnel', message:`${emp.name} — ${c.label} expires in ${Math.ceil((d-today)/86400000)}d`, empId:emp.id, date:c.expiry });
    });
  });

  return alerts.sort((a,b) => { const o={danger:0,warning:1,info:2}; return o[a.type]-o[b.type]; });
};
