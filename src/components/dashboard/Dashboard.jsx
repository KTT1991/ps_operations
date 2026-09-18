import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Activity, AlertTriangle, TrendingUp, TrendingDown, Wrench, Clock, CheckCircle, XCircle, Zap, BarChart3, Users, Briefcase } from 'lucide-react';
import { assetsService, projectsService, employeesService, getSystemAlerts } from '../../services/firebaseService';
import { format } from 'date-fns';
import clsx from 'clsx';
import { safeStringify, safeParse } from '../../utils/storageSanitizer';

const T = {
  text:  'var(--t-text)',
  text2: 'var(--t-text2)',
  text3: 'var(--t-text3)',
  bg2:   'var(--t-bg2)',
  bg3:   'var(--t-bg3)',
  border:'var(--t-border)',
};

const ALERT_STYLES = {
  danger:  { bg:'#fff1f2', border:'#fecdd3', color:'#be123c', Icon: XCircle },
  warning: { bg:'#fffbeb', border:'#fde68a', color:'#b45309', Icon: AlertTriangle },
  info:    { bg:'#f0f9ff', border:'#bae6fd', color:'#0369a1', Icon: Clock },
};

function KPICard({ icon: Icon, label, value, unit, color='#f97316', pulse, badge, badgeStyle, subtext, progress }) {
  return (
    <div
      className="kpi-card group relative"
      style={{
        background: `linear-gradient(145deg, var(--t-bg2) 0%, ${color}0b 100%)`,
        borderLeft: `3.5px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="p-2 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
          style={{ background: `${color}16`, border: `1px solid ${color}26` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={badgeStyle || { background: `${color}14`, color, border: `1px solid ${color}30` }}
            >
              {badge}
            </span>
          )}
          {pulse && <div className="alert-dot flex-shrink-0" style={{ background: '#ef4444' }} />}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>{value}</span>
          {unit && <span className="text-xs font-semibold" style={{ color: T.text3 }}>{unit}</span>}
        </div>
        <div className="text-xs font-medium mt-0.5" style={{ color: T.text2 }}>{label}</div>

        {typeof progress === 'number' && (
          <div className="mt-2.5">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden" style={{ background: 'var(--t-bg3)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, background: color }}
              />
            </div>
          </div>
        )}

        {subtext && !progress && (
          <div className="text-[11px] mt-1 truncate" style={{ color: T.text3 }}>{subtext}</div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs shadow-xl"
      style={{background:T.bg2,border:`1px solid ${T.border}`}}>
      {label && <div className="mb-1.5" style={{color:T.text3}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{background:p.color}}/>
          <span style={{color:T.text2}}>{p.name}:</span>
          <span className="font-medium" style={{color:T.text}}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function ProjectStatusPieChart({ projects }) {
  const statusColors = {
    Active: '#34d399',
    Preparing: '#38bdf8',
    Mobilizing: '#22d3ee',
    Planned: '#c084fc',
    Delayed: '#fb7185',
    Completed: '#94a3b8',
  };

  const projectByStatus = Object.entries(projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value, color: statusColors[name] || '#94a3b8' }));

  if (!projects.length) return <div className="text-center text-sm text-[var(--t-text3)] py-10">No project data</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={projectByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value">
          {projectByStatus.map((e,i) => <Cell key={i} fill={e.color} />)}
        </Pie>
        <Tooltip content={<CustomTooltip/>}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const [assets,    setAssets]    = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cacheKey = 'dashboard_data_cache';
      const cacheDuration = 5 * 60 * 1000; // 5 minutes
      const cachedData = safeParse(sessionStorage.getItem(cacheKey), null);
      const now = new Date().getTime();

      if (cachedData && cachedData.data && (now - cachedData.timestamp < cacheDuration)) {
        // Use cached data
        setAssets(cachedData.data.a || []);
        setProjects(cachedData.data.p || []);
        setEmployees(cachedData.data.e || []);
        setAlerts(getSystemAlerts(cachedData.data.a || [], cachedData.data.e || []));
      } else {
        // Fetch new data
        const [a, p, e] = await Promise.all([assetsService.getAll(), projectsService.getAll(), employeesService.getAll()]);
        setAssets(a);
        setProjects(p);
        setEmployees(e);
        setAlerts(getSystemAlerts(a, e));

        // Store new data in cache safely
        try {
          const dataToCache = {
            timestamp: now,
            data: { a, p, e }
          };
          sessionStorage.setItem(cacheKey, safeStringify(dataToCache));
        } catch (cacheErr) {
          console.warn('Dashboard cache serialization skipped:', cacheErr);
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // --- KPI Calculations ---
  const activeProjects   = projects.filter(p => p.status === 'Active').length;
  const availableAssets  = assets.filter(a => a.status === 'Available').length;
  const delayedProjects = projects.filter(p => p.status === 'Delayed').length;
  const personnelDeployed = employees.filter(e => e.availability === 'Assigned' || e.availability === 'Offshore').length;
  const utilizationRate = assets.length > 0 ? Math.round((assets.filter(a => a.status === 'In Use').length / assets.length) * 100) : 0;
  const upcomingMaintenance = alerts.filter(a => a.category === 'Preventive Maintenance').length;
  const projectsInPreparation = projects.filter(p => p.status === 'Preparing' || p.status === 'Mobilizing').length;
  const totalActivePersonnel = employees.filter(e => e.availability !== 'Archived' && e.availability !== 'Resigned').length;

  const assetStatusBreakdown = [
    { name:'Available',  value: assets.filter(a=>a.status==='Available').length,         color:'#34d399' },
    { name:'In Use',     value: assets.filter(a=>a.status==='In Use').length,            color:'#38bdf8' },
    { name:'Maintenance',value: assets.filter(a=>a.status==='Under Maintenance').length, color:'#fbbf24' },
    { name:'Reserved',   value: assets.filter(a=>a.status==='Reserved').length,          color:'#fb923c' },
    { name:'Damaged',    value: assets.filter(a=>a.status==='Damaged').length,           color:'#fb7185' },
  ].filter(d => d.value > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-500"/>Executive Dashboard</h1>
          <p className="text-sm mt-1" style={{color:T.text3}}>
            Real-time operations overview — {format(new Date(),'EEEE, dd MMMM yyyy')}
          </p>
        </div>
         <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 self-start"
          style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.text3}}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>Live Data
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <KPICard
          icon={Briefcase}
          label="Active Projects"
          value={activeProjects}
          color="#16a34a"
          badge="Live Ops"
          badgeStyle={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}
          subtext={`${activeProjects} of ${projects.length} total projects`}
        />
        <KPICard
          icon={Users}
          label="Personnel Deployed"
          value={personnelDeployed}
          color="#2563eb"
          badge="Field Crew"
          badgeStyle={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}
          subtext="On-site mobilization"
        />
        <KPICard
          icon={Activity}
          label="Asset Utilization"
          value={utilizationRate}
          unit="%"
          color="#ea580c"
          badge="Fleet Rate"
          badgeStyle={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' }}
          progress={utilizationRate}
        />
        <KPICard
          icon={AlertTriangle}
          label="Delayed Projects"
          value={delayedProjects}
          color={delayedProjects > 0 ? "#dc2626" : "#059669"}
          pulse={delayedProjects > 0}
          badge={delayedProjects > 0 ? "Needs Review" : "Zero Delays"}
          badgeStyle={delayedProjects > 0
            ? { background: '#ffe4e6', color: '#be123c', border: '1px solid #fecdd3' }
            : { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
          subtext={delayedProjects > 0 ? "Requires urgent check" : "All schedules on track"}
        />
        <KPICard
          icon={Package}
          label="Total Assets"
          value={assets.length}
          color="#0891b2"
          badge="Inventory"
          badgeStyle={{ background: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' }}
          subtext="Registered equipment"
        />
        <KPICard
          icon={CheckCircle}
          label="Available Assets"
          value={availableAssets}
          color="#16a34a"
          badge="Ready for Ops"
          badgeStyle={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}
          subtext={`${availableAssets} units in base yard`}
        />
        <KPICard
          icon={Clock}
          label="Projects Preparing"
          value={projectsInPreparation}
          color="#9333ea"
          badge="Pre-Ops"
          badgeStyle={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}
          subtext="Mobilization planning"
        />
        <KPICard
          icon={Wrench}
          label="Upcoming PM"
          value={upcomingMaintenance}
          color={upcomingMaintenance > 0 ? "#d97706" : "#64748b"}
          pulse={upcomingMaintenance > 0}
          badge={upcomingMaintenance > 0 ? "Action Due" : "All Clear"}
          badgeStyle={upcomingMaintenance > 0
            ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
            : { background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}
          subtext={upcomingMaintenance > 0 ? "Scheduled within 30 days" : "No pending preventive jobs"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="font-medium text-sm" style={{color:T.text}}>Projects by Status</h3>
          </div>
          <div className="p-4">
            <ProjectStatusPieChart projects={projects} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-medium text-sm" style={{color:T.text}}>Asset Status</h3>
            <p className="text-xs mt-0.5" style={{color:T.text3}}>Current fleet ({assets.length} assets)</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={assetStatusBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                  {assetStatusBreakdown.map((e,i)=> <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {assetStatusBreakdown.map(s=>(
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background:s.color}}/>
                    <span style={{color:T.text3}}>{s.name}</span>
                  </div>
                  <span className="font-medium" style={{color:T.text}}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-medium text-sm" style={{color:T.text}}>Recent Projects</h3>
            <span className="text-xs" style={{color:T.text3}}>{projects.length} total projects</span>
          </div>
          <div className="divide-y" style={{borderColor:T.border}}>
            {projects.slice(0, 5).map(proj=>(
              <div key={proj.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{color:T.text}}>{proj.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-xs" style={{color:T.text3}}>{proj.clientName}</span>
                  </div>
                </div>
                <div className="px-2.5 py-0.5 rounded-md text-xs font-semibold border" style={{
                    background: proj.status==='Active'?'#dcfce7':proj.status==='Preparing'?'#e0f2fe':'#ede9fe',
                    color:      proj.status==='Active'?'#15803d':proj.status==='Preparing'?'#0284c7':'#7c3aed',
                    borderColor:proj.status==='Active'?'#bbf7d0':proj.status==='Preparing'?'#bae6fd':'#ddd6fe',
                  }}>
                    {proj.status}
                  </div>
              </div>
            ))}
             {projects.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{color:T.text3}}>No projects found</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-medium text-sm" style={{color:T.text}}>System Alerts</h3>
             {alerts.filter(a=>a.type==='danger').length>0&&(
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <div className="alert-dot bg-red-500"/>
                {alerts.filter(a=>a.type==='danger').length} critical
              </div>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{color:T.text3}}>
                <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{color:'#22c55e',opacity:.5}}/>
                All systems nominal
              </div>
            ) : alerts.slice(0, 8).map((alert,i)=>{
              const cfg = ALERT_STYLES[alert.type]||ALERT_STYLES.info;
              const Icon = cfg.Icon;
              return (
                <div key={i} className="px-3 py-2 rounded-lg text-xs flex gap-2"
                  style={{background:cfg.bg,border:`1px solid ${cfg.border}`}}>
                  <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{color:cfg.color}}/>
                  <div>
                    <div className="font-medium" style={{color:cfg.color}}>{alert.category}</div>
                    <div className="mt-0.5 opacity-80" style={{color:cfg.color}}>{alert.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
