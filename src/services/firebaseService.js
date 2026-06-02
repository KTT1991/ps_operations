import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, writeBatch, setDoc
} from 'firebase/firestore';
import { db } from '../firebase';

// ✅ แก้ bug — function ถูกต้องแล้ว
const isFirebaseConfigured = () =>
  Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key'
  );

const createService = (collectionName) => ({
  async getAll() {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },
  // ✅ รองรับ Custom ID (ถ้าส่ง id มาด้วย ใช้ setDoc, ไม่ส่งใช้ addDoc)
  async create(data) {
    if (data.id) {
      await setDoc(doc(db, collectionName, data.id), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { ...data };
    }
    const ref = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  },
  async update(id, data) {
    await updateDoc(doc(db, collectionName, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { id, ...data };
  },
  async delete(id) {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  },
  subscribe(callback) {
    return onSnapshot(collection(db, collectionName), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  },
});

export const assetsService      = createService('assets');
export const projectsService    = createService('projects');
export const employeesService   = createService('employees');
export const maintenanceService = createService('maintenance');
export const inventoryService   = createService('inventory');

// alerts ยังคงคำนวณ real-time จาก data ที่ดึงมา
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