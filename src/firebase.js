import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyASzXkawm1UVW3iOzOi6m9m6nlPpWzU5XI',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'ps-songkhla.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'ps-songkhla',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'ps-songkhla.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '604763141998',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:604763141998:web:e6c8b7623c1cb6a484f37f',
  measurementId:     'G-MH0ED1HZGK',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'demo-key' &&
  firebaseConfig.projectId !== 'demo-project'
);

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export default app;
