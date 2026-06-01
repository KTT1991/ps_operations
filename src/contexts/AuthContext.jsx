import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEMO_USERS = {
  'admin@demo.com':   { password:'demo123', role:'admin', name:'Admin User', uid:'demo-admin' },
  'manager@demo.com': { password:'demo123', role:'operations_manager', name:'Operations Manager', uid:'demo-manager' },
  'tech@demo.com':    { password:'demo123', role:'technician', name:'Field Technician', uid:'demo-tech' },
  'exec@demo.com':    { password:'demo123', role:'executive', name:'Executive Viewer', uid:'demo-exec' },
  'maintenance@demo.com':{ password:'demo123', role:'maintenance', name:'Maintenance Team', uid:'demo-maint' },
};

const isDemoKey = (key) =>
  !key || key === 'demo-key' || key === 'your_api_key_here';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false); // ⭐ ADD

  const isDemoMode = isDemoKey(import.meta.env.VITE_FIREBASE_API_KEY);

  useEffect(() => {
    let unsub;

    const init = async () => {
      if (isDemoMode) {
        try {
          const s = localStorage.getItem('ogs_demo_session');
          if (s) {
            const { user: u, role } = JSON.parse(s);
            setUser(u);
            setRole(role);
          }
        } catch {}

        setAuthReady(true);
        setLoading(false);
        return;
      }

      const { onAuthStateChanged } = await import('firebase/auth');
      const { doc, getDoc } = await import('firebase/firestore');
      const { auth, db } = await import('../firebase');

      unsub = onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setRole(null);
          setAuthReady(true);
          setLoading(false);
          return;
        }

        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          const data = snap.exists() ? snap.data() : {};

          setUser({ ...fbUser, ...data });
          setRole(data.role ?? 'technician');
        } catch {
          setUser(fbUser);
          setRole('technician');
        }

        setAuthReady(true);   // ⭐ สำคัญ
        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const login = async (email, password) => {
    if (isDemoMode) {
      const acc = DEMO_USERS[email.toLowerCase()];
      if (!acc || acc.password !== password)
        throw new Error('Invalid credentials');

      const session = {
        user: { email, uid: acc.uid, displayName: acc.name },
        role: acc.role
      };

      localStorage.setItem('ogs_demo_session', JSON.stringify(session));
      setUser(session.user);
      setRole(session.role);
      setAuthReady(true);

      return session;
    }

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../firebase');

    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (isDemoMode) {
      localStorage.removeItem('ogs_demo_session');
      setUser(null);
      setRole(null);
      setAuthReady(false);
      return;
    }

    const { signOut } = await import('firebase/auth');
    const { auth } = await import('../firebase');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loading,
      authReady,   // ⭐ IMPORTANT
      isDemoMode,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}