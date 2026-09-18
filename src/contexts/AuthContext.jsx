
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here' &&
  !import.meta.env.VITE_FIREBASE_API_KEY.startsWith('your_')
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      try {
        const saved = sessionStorage.getItem('ogs_demo_user') || localStorage.getItem('ogs_demo_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          const savedRole = parsed.userRole === 'user' ? 'admin' : (parsed.userRole || 'admin');
          setUser(parsed.user);
          setRole(savedRole);
        }
      } catch (e) {
        console.warn('Could not restore demo session', e);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(userDocRef);
          const userData = docSnap.exists() ? docSnap.data() : {};
          
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: userData.name || fbUser.email,
          });

          // Set user role based on Firestore data, default to 'admin' in prototype
          setRole(userData.role || 'admin');
        } catch (err) {
          console.error('Auth context error:', err);
          // Fallback for safety
          setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.email });
          setRole('admin');
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    if (!isFirebaseConfigured) {
      let role = 'admin';
      let displayName = email.split('@')[0] || 'Admin';
      const lower = email.toLowerCase();
      if (lower.includes('admin')) {
        role = 'admin';
        displayName = 'Admin User';
      } else if (lower.includes('safety')) {
        role = 'safety';
        displayName = 'Safety Officer';
      } else if (lower.includes('storeman') || lower.includes('store')) {
        role = 'storeman';
        displayName = 'Storeman';
      } else if (lower.includes('manager')) {
        role = 'base_manager';
        displayName = 'Operations Manager';
      } else {
        role = 'admin';
        displayName = email.split('@')[0] || 'Administrator';
      }

      const demoUser = {
        uid: 'demo-' + Date.now(),
        email,
        displayName,
      };

      try {
        sessionStorage.setItem('ogs_demo_user', JSON.stringify({ user: demoUser, userRole: role }));
      } catch (e) {
        console.warn('Could not persist demo session', e);
      }

      setUser(demoUser);
      setRole(role);
      return demoUser;
    }

    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!isFirebaseConfigured) {
      try {
        sessionStorage.removeItem('ogs_demo_user');
        localStorage.removeItem('ogs_demo_user');
      } catch (e) {
        console.warn('Could not clear demo session', e);
      }
      setUser(null);
      setRole(null);
      return;
    }

    await signOut(auth);
  };

  const value = {
    user,
    userRole,
    loading,
    login,
    logout,
    isAdmin: userRole === 'admin',
    isSafety: userRole === 'safety',
    isStoreman: userRole === 'storeman',
    isBaseManager: userRole === 'base_manager' || userRole === 'operations_manager',
    isUser: userRole === 'user',
    // Action permissions
    canManageTraining: !isFirebaseConfigured || userRole === 'admin' || userRole === 'safety' || userRole === 'base_manager',
    canManageProjects: !isFirebaseConfigured || userRole === 'admin' || userRole === 'base_manager' || userRole === 'operations_manager',
    canManageMovement: !isFirebaseConfigured || userRole === 'admin' || userRole === 'base_manager' || userRole === 'operations_manager' || userRole === 'storeman',
    isDemoMode: !isFirebaseConfigured,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

