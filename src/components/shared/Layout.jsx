
import { useState, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Package, FolderKanban, Wrench, Users,
  Radio, FileBarChart, LogOut, Zap, Bell, Menu,
  ChevronRight, UserCircle, CalendarDays, Sun, Moon,
  ArrowLeftRight, Upload, CalendarCheck, Search, BookOpen
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { path:'/dashboard',   icon:LayoutDashboard, label:'Executive Dashboard' },
  { path:'/operations',  icon:Radio,           label:'Operations Center' },
  { path:'/planning',    icon:CalendarCheck,   label:'Resource Planning',   hot:true },
  { path:'/timeline',    icon:CalendarDays,    label:'Project Timeline' },
  { path:'/assets',      icon:Package,         label:'Asset Management' },
  { path:'/projects',    icon:FolderKanban,    label:'Projects' },
  { path:'/maintenance', icon:Wrench,          label:'Maintenance' },
  { path:'/manpower',    icon:Users,           label:'Manpower' },
  { path:'/movement',    icon:ArrowLeftRight,  label:'Equipment Movement' },
  { path:'/import',      icon:Upload,          label:'Bulk Import', adminOnly: true }, // Mark as admin-only
  { path:'/reports',     icon:FileBarChart,    label:'Reports & Export' },
  { path:'/history',     icon:Search,          label:'Resource Explorer' },
  { path:'/help',        icon:BookOpen,        label:'User Guide' },
];

const ROLE_INFO = {
  admin:        { label:'Admin',         bg:'rgba(239, 68, 68, 0.1)', color:'#ef4444', border:'rgba(239, 68, 68, 0.4)' },
  base_manager: { label:'Base Manager',  bg:'rgba(59, 130, 246, 0.1)', color:'#3b82f6', border:'rgba(59, 130, 246, 0.4)' },
  user:         { label:'User',          bg:'rgba(34, 197, 94, 0.1)',  color:'#22c55e', border:'rgba(34, 197, 94, 0.4)'  },
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
    <div className="flex flex-col h-full" style={{background:'var(--t-bg2)'}}>
      {/* Logo */}
      <div className="p-4 flex items-center gap-3" style={{borderBottom:'1px solid var(--t-border)'}}>
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5}/>
        </div>
        {open && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold tracking-wider whitespace-nowrap" style={{color:'var(--t-text)'}}>OGS OPSCENTER</div>
            <div className="text-[10px] tracking-widest uppercase whitespace-nowrap" style={{color:'var(--t-text3)'}}>Operations Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map(({ path, icon:Icon, label, hot }) => (
          <NavLink key={path} to={path} onClick={onClose}
            className={({ isActive }) => clsx('sidebar-item', isActive && 'active')}>
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0"/>
                {open && (
                  <>
                    <span className="flex-1 whitespace-nowrap text-sm">{label}</span>
                    {hot && !isActive && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{background:'#ea580c',color:'white'}}>NEW</span>
                    )}
                    {isActive && <ChevronRight className="w-3 h-3 opacity-40"/>}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 space-y-1" style={{borderTop:'1px solid var(--t-border)'}}>
        {open ? (
          <>
            <div className="px-3 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{background:'var(--t-bg3)',border:'1px solid var(--t-border2)'}}>
                <UserCircle className="w-5 h-5" style={{color:'var(--t-text3)'}}/>
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-sm font-medium truncate" style={{color:'var(--t-text)'}}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs font-semibold" style={{color:role.color}}>{role.label}</div>
              </div>
            </div>
            <button onClick={onLogout} className="sidebar-item w-full" style={{color:'#ef4444'}}>
              <LogOut className="w-4 h-4"/><span>Sign Out</span>
            </button>
          </>
        ) : (
          <button onClick={onLogout} className="sidebar-item w-full" style={{color:'#ef4444'}}>
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
  const { theme, toggle: toggleTheme } = useTheme();
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
      <aside className={clsx('hidden lg:flex flex-col transition-all duration-300 flex-shrink-0',
        sidebarOpen ? 'w-64' : 'w-16')}
        style={{borderRight:'1px solid var(--t-border)'}}>
        <SidebarContent open={sidebarOpen} user={user} userRole={userRole} onClose={()=>{}} onLogout={handleLogout}/>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setMobileOpen(false)}/>
          <div className="relative w-64 flex flex-col" style={{borderRight:'1px solid var(--t-border)'}}>
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
          <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{color:'var(--t-text3)'}}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"/>System Online
          </div>
          {/* Dark/Light Toggle */}
          <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg"
            title={theme==='dark'?'Switch to Light':'Switch to Dark'}>
            {theme==='dark'
              ? <Sun className="w-4 h-4 text-amber-400"/>
              : <Moon className="w-4 h-4" style={{color:'var(--t-text3)'}}/>}
          </button>
          {/* Role badge */}
          <div className="text-xs px-2.5 py-1 rounded-md font-semibold flex-shrink-0"
            style={{background:role.bg,color:role.color,border:`1px solid ${role.border}`}}>
            {role.label}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{background:'var(--t-bg)'}}>
          <Outlet/>
        </main>
      </div>
    </div>
  );
}
