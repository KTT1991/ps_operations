import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email:'admin@demo.com',   pass:'demo123', role:'Admin',        color:'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { email:'manager@demo.com', pass:'demo123', role:'Ops Manager',  color:'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  { email:'tech@demo.com',    pass:'demo123', role:'Technician',   color:'bg-green-500/20 text-green-400 border-green-500/40' },
  { email:'exec@demo.com',    pass:'demo123', role:'Executive',    color:'bg-purple-500/20 text-purple-400 border-purple-500/40' },
];

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
  e.preventDefault();
  if (!email || !password) return;
  setLoading(true);
  try {
    await login(email, password);
    toast.success('Welcome to OGS OpsCenter');
    // ✅ ไม่มี navigate() — ให้ ProtectedRoute จัดการเอง
  } catch (err) {
    toast.error(err.message || 'Login failed');
  } finally {
    setLoading(false);
  }
};

const quickLogin = async (acc) => {
  setLoading(true);
  try {
    await login(acc.email, acc.pass);
    // ✅ ไม่มี navigate()
  } catch {
    toast.error('Quick login failed');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'#0a0f1a'}}>
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(#f97316 1px,transparent 1px),linear-gradient(90deg,#f97316 1px,transparent 1px)',backgroundSize:'40px 40px'}}/>

      <div className="relative w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30">
            <Zap className="w-8 h-8 text-white" strokeWidth={2.5}/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">OGS OPSCENTER</h1>
            <p className="text-[var(--t-text3)] text-sm mt-1">Operations & Asset Management</p>
          </div>
        </div>

        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="rounded-xl border border-blue-700/40 bg-blue-900/20 p-4 space-y-3">
            <div className="text-blue-400 text-xs font-semibold flex items-center gap-2">
              <Zap className="w-3.5 h-3.5"/>Demo Mode — กด login ด่วนได้เลย
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map(acc=>(
                <button key={acc.role} onClick={()=>quickLogin(acc)} disabled={loading}
                  className={`px-3 py-2 text-xs rounded-lg border text-left transition-colors hover:opacity-80 ${acc.color}`}>
                  <div className="font-semibold">{acc.role}</div>
                  <div className="opacity-70 mt-0.5 font-mono">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Login form */}
        <div className="rounded-xl border border-[var(--t-border)] bg-slate-900/80 backdrop-blur p-6 space-y-4">
          <h2 className="text-[var(--t-text)] font-semibold">Sign in</h2>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder={isDemoMode?'admin@demo.com':'your@email.com'}
                className="input-field" required autoFocus/>
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Password</label>
              <div className="relative">
                <input type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder={isDemoMode?'demo123':'••••••••'} className="input-field pr-10" required/>
                <button type="button" onClick={()=>setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--t-text3)] hover:text-[var(--t-text2)]">
                  {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-2.5">
              {loading?<div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700">OGS OpsCenter v3.0 — Enterprise Oil & Gas Operations</p>
      </div>
    </div>
  );
}
