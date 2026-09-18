
import { useState, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Package, FolderKanban, Wrench, Users,
  Radio, FileBarChart, LogOut, Zap, Bell, Menu,
  ChevronRight, UserCircle, CalendarDays,
  ArrowLeftRight, Upload, CalendarCheck, Search, BookOpen,
  GraduationCap
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { path:'/dashboard',   icon:LayoutDashboard, label:'Executive Dashboard' },
  { path:'/operations',  icon:Radio,           label:'Operations Center' },
  { path:'/planning',    icon:CalendarCheck,   label:'Resource Planning',   hot:true },
  { path:'/assets',      icon:Package,         label:'Asset Management' },
  { path:'/projects',    icon:FolderKanban,    label:'Projects' },
  { path:'/maintenance', icon:Wrench,          label:'Maintenance' },
  { path:'/manpower',    icon:Users,           label:'Manpower' },
  { path:'/training',    icon:GraduationCap,   label:'Training Records',    hot:true },
  { path:'/movement',    icon:ArrowLeftRight,  label:'Equipment Movement' },
  { path:'/import',      icon:Upload,          label:'Bulk Import', adminOnly: true }, // Mark as admin-only
  { path:'/reports',     icon:FileBarChart,    label:'Reports & Export' },
  { path:'/history',     icon:Search,          label:'Resource Explorer' },
  { path:'/help',        icon:BookOpen,        label:'User Guide' },
];

const ROLE_INFO = {
  admin:        { label:'Admin',          bg:'#ffe4e6', color:'#be123c', border:'#fecdd3' }, /* Soft Rose */
  safety:       { label:'Safety Officer', bg:'#fef3c7', color:'#b45309', border:'#fde68a' }, /* Soft Amber */
  storeman:     { label:'Storeman',       bg:'#e0e7ff', color:'#4338ca', border:'#c7d2fe' }, /* Soft Indigo */
  base_manager: { label:'Base Manager',   bg:'#e0f2fe', color:'#0369a1', border:'#bae6fd' }, /* Soft Sky */
  user:         { label:'User',           bg:'#dcfce7', color:'#15803d', border:'#bbf7d0' }, /* Soft Mint */
};

function SidebarContent({ open, user, userRole, onClose, onLogout }) {
  const role = ROLE_INFO[userRole] || ROLE_INFO.user; // Default to user role info

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.adminOnly) {
        return userRole === 'admin';
      }
      return true;
    });
  }, [userRole]);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-300 select-none border-r border-slate-800/70 backdrop-blur-md">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-900/30">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5}/>
        </div>
        {open && (
          <div className="overflow-hidden">
            <div className="text-xs font-bold tracking-wider whitespace-nowrap text-slate-100">PS SONGKHLA</div>
            <div className="text-[10px] tracking-wider uppercase whitespace-nowrap text-slate-400 font-medium">Operations Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(({ path, icon:Icon, label, hot }) => (
          <NavLink key={path} to={path} onClick={onClose}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
              isActive
                ? 'bg-orange-500/10 text-orange-400 font-semibold border-l-2 border-orange-500 shadow-2xs pl-2.5'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            )}>
            {({ isActive }) => (
              <>
                <Icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-orange-400' : 'text-slate-400')}/>
                {open && (
                  <>
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                    {hot && !isActive && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">NEW</span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-orange-400/50"/>}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="p-2.5 space-y-1.5 border-t border-slate-800/60 bg-slate-950/40">
        {open ? (
          <>
            <div className="px-2.5 py-2 flex items-center gap-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-700/80 text-slate-300 text-xs font-medium">
                {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : <UserCircle className="w-4 h-4"/>}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-medium text-slate-200 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-[10px] font-medium text-slate-400">{role.label}</div>
              </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer">
              <LogOut className="w-3.5 h-3.5"/><span>Sign Out</span>
            </button>
          </>
        ) : (
          <button onClick={onLogout} className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer" title="Sign Out">
            <LogOut className="w-4 h-4"/>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const role = ROLE_INFO[userRole] || ROLE_INFO.user; // Default to user role info

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'var(--t-bg)'}}>
      {/* Desktop sidebar */}
      <aside className={clsx('hidden lg:flex flex-col transition-all duration-300 flex-shrink-0 bg-slate-900 border-r border-slate-800 shadow-xl z-20',
        sidebarOpen ? 'w-64' : 'w-16')}>
        <SidebarContent open={sidebarOpen} user={user} userRole={userRole} onClose={()=>{}} onLogout={handleLogout}/>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={()=>setMobileOpen(false)}/>
          <div className="relative w-64 flex flex-col bg-slate-900 border-r border-slate-800 shadow-2xl">
            <SidebarContent open={true} user={user} userRole={userRole}
              onClose={()=>setMobileOpen(false)} onLogout={handleLogout}/>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0"
          style={{background:'var(--t-bg2)',borderBottom:'1px solid var(--t-border)'}}>
          <button onClick={()=>setSidebarOpen(s=>!s)} className="hidden lg:flex btn-ghost p-1.5">
            <Menu className="w-4 h-4"/>
          </button>
          <button onClick={()=>setMobileOpen(true)} className="lg:hidden btn-ghost p-1.5">
            <Menu className="w-4 h-4"/>
          </button>
          <div className="flex-1"/>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{color:'var(--t-text3)'}}>
            <div className="w-2 h-2 rounded-full bg-emerald-500"/>System Online
          </div>
          {/* Role badge in soft pastel */}
          <div className="text-xs px-2.5 py-1 rounded-md font-semibold flex-shrink-0 shadow-2xs"
            style={{background:role.bg,color:role.color,border:`1px solid ${role.border}`}}>
            {role.label}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6" style={{background:'var(--t-bg)'}}>
          <Outlet/>
        </main>
      </div>
    </div>
  );
}
