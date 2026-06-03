import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Activity, AlertTriangle, TrendingUp, TrendingDown, Wrench, Clock, CheckCircle, XCircle, Zap, BarChart3, Users, Briefcase } from 'lucide-react';
import { assetsService, projectsService, employeesService, getSystemAlerts } from '../../services/firebaseService';
import { format } from 'date-fns';
import clsx from 'clsx';

const T = {
  text:  'var(--t-text)',
  text2: 'var(--t-text2)',
  text3: 'var(--t-text3)',
  bg2:   'var(--t-bg2)',
  bg3:   'var(--t-bg3)',
  border:'var(--t-border)',
};

const ALERT_STYLES = {
  danger:  { bg:'rgba(239,68,68,.1)',  border:'rgba(239,68,68,.3)',  color:'#ef4444',  Icon: XCircle },
  warning: { bg:'rgba(245,158,11,.1)', border:'rgba(245,158,11,.3)', color:'#f59e0b',  Icon: AlertTriangle },
  info:    { bg:'rgba(59,130,246,.1)', border:'rgba(59,130,246,.3)', color:'#3b82f6',  Icon: Clock },
};

function KPICard({ icon: Icon, label, value, unit, color='#f97316', pulse }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg" style={{background:`${color}18`}}>
          <Icon className="w-5 h-5" style={{color}} />
        </div>
        {pulse && <div className="alert-dot" style={{background:'#ef4444',marginTop:4}} />}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{color:T.text}}>{value}</span>
          {unit && <span className="text-sm" style={{color:T.text3}}>{unit}</span>}
        </div>
        <div className="text-sm mt-0.5" style={{color:T.text3}}>{label}</div>
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
    Active: '#22c55e',
    Preparing: '#3b82f6',
    Mobilizing: '#06b6d4',
    Planned: '#a855f7',
    Delayed: '#ef4444',
    Completed: '#6b7280',
  };

  const projectByStatus = Object.entries(projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value, color: statusColors[name] || '#6b7280' }));

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
      const [a, p, e] = await Promise.all([assetsService.getAll(), projectsService.getAll(), employeesService.getAll()]);
      setAssets(a);
      setProjects(p);
      setEmployees(e);
      setAlerts(getSystemAlerts(a, e));
      setLoading(false);
    }
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
    { name:'Available',  value: assets.filter(a=>a.status==='Available').length,         color:'#22c55e' },
    { name:'In Use',     value: assets.filter(a=>a.status==='In Use').length,            color:'#3b82f6' },
    { name:'Maintenance',value: assets.filter(a=>a.status==='Under Maintenance').length, color:'#f59e0b' },
    { name:'Reserved',   value: assets.filter(a=>a.status==='Reserved').length,          color:'#06b6d4' },
    { name:'Damaged',    value: assets.filter(a=>a.status==='Damaged').length,           color:'#ef4444' },
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
         <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
          style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.text3}}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>Live Data
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
        <KPICard icon={Briefcase}   label="Active Projects"    value={activeProjects} color="#22c55e"/>
        <KPICard icon={Users}       label="Personnel Deployed" value={personnelDeployed} color="#3b82f6"/>
        <KPICard icon={Activity}    label="Asset Utilization"  value={utilizationRate} unit="%" color="#f97316"/>
        <KPICard icon={AlertTriangle} label="Delayed Projects"   value={delayedProjects} color="#ef4444" pulse={delayedProjects > 0}/>
        <KPICard icon={Package}     label="Total Assets"       value={assets.length} color="#06b6d4" />
        <KPICard icon={CheckCircle} label="Available Assets"   value={availableAssets} color="#22c55e"/>
        <KPICard icon={Clock}       label="Projects Preparing" value={projectsInPreparation} color="#a855f7"/>
        <KPICard icon={Wrench}      label="Upcoming PM"        value={upcomingMaintenance} color="#f59e0b" pulse={upcomingMaintenance > 0}/>
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
                <div className="px-2 py-0.5 rounded text-xs font-medium" style={{
                    background: proj.status==='Active'?'rgba(34,197,94,.15)':proj.status==='Preparing'?'rgba(59,130,246,.15)':'rgba(168,85,247,.15)',
                    color:      proj.status==='Active'?'#22c55e':proj.status==='Preparing'?'#3b82f6':'#a855f7',
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
