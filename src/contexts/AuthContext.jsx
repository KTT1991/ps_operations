
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

          // Set user role based on Firestore data, default to 'user'
          setRole(userData.role || 'user');
        } catch (err) {
          console.error('Auth context error:', err);
          // Fallback for safety
          setUser({ uid: fbUser.uid, email: fbUser.email, displayName: fbUser.email });
          setRole('user');
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

  const value = {
    user,
    userRole,
    loading,
    login,
    logout,
    isAdmin: userRole === 'admin',
    isBaseManager: userRole === 'base_manager',
    isUser: userRole === 'user',
    isDemoMode: false, // Assuming isDemoMode is a constant false for now
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
