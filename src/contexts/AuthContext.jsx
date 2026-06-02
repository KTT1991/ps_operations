import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]   = useState(null);
  const [userRole,setRole]   = useState(null);
  const [loading, setLoading]= useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {

      console.log('AUTH CHANGED', fbUser?.email);
      
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          const data = snap.exists() ? snap.data() : {};
          setUser({
            uid:         fbUser.uid,
            email:       fbUser.email,
            displayName: data.name || fbUser.email,
          });
          setRole(data.role || 'technician');
        } catch (err) {
          console.error('Role fetch error:', err);
          setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.email });
          setRole('technician');
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
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, isDemoMode: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}