import { useState, useEffect } from 'react';
import { Radio, Package, Users, AlertTriangle, Clock, CheckCircle, XCircle, Zap, MapPin, ArrowRight, RefreshCw } from 'lucide-react';
import { assetsService, projectsService, employeesService, getSystemAlerts } from '../../services/firebaseService';
import { differenceInDays, parseISO, format } from 'date-fns';
import clsx from 'clsx';

const ALERT_STYLES = {
  danger: { border: 'border-rose-200', bg: 'bg-rose-50/80', text: 'text-rose-800', dot: 'bg-rose-400', Icon: XCircle },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50/80', text: 'text-amber-800', dot: 'bg-amber-400', Icon: AlertTriangle },
  info: { border: 'border-sky-200', bg: 'bg-sky-50/80', text: 'text-sky-800', dot: 'bg-sky-400', Icon: Clock },
};

function PersonnelDeploymentView({ employees, projects }) {
  const deployedPersonnel = employees.filter(
    e => e.availability === 'Assigned' || e.availability === 'Offshore'
  );

  if (deployedPersonnel.length === 0) {
    return (
      <div className="card p-8 text-center text-[var(--t-text3)] text-sm bg-white">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
        No personnel are currently deployed.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {deployedPersonnel.map(emp => {
        const latestSchedule = emp.schedule && emp.schedule.length > 0 ? emp.schedule[0] : null;
        const project = latestSchedule ? projects.find(p => p.id === latestSchedule.projectId) : null;

        return (
          <EmployeeDeploymentCard
            key={emp.id}
            employee={emp}
            project={project}
            schedule={latestSchedule}
          />
        );
      })}
    </div>
  );
}

function EmployeeDeploymentCard({ employee, project, schedule }) {
    const hasCriticalCerts = (employee.certFields || []).some(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) < 30);
    const location = schedule?.location || 'N/A';

    return (
        <div className="rounded-xl p-4 space-y-3 flex flex-col bg-gradient-to-b from-white via-slate-50/50 to-slate-100/70 border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
                <div>
                    <div className="font-semibold text-sm text-slate-800">{employee.name}</div>
                    <div className="text-xs text-[var(--t-text3)]">{employee.position}</div>
                </div>
                <div className={clsx('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md border shadow-2xs', location === 'Offshore' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-sky-50 border-sky-200 text-sky-700')}>
                    <MapPin className="w-3 h-3" />
                    {location}
                </div>
            </div>

            <div className="bg-gradient-to-r from-sky-50/50 to-slate-50 p-3 rounded-lg flex-grow border border-sky-100/70">
                <div className="text-xs font-medium text-slate-500 mb-1">Current Assignment</div>
                {project ? (
                  <>
                    <div className="font-medium text-sm text-slate-800">{project.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{project.projectNo}</div>
                  </>
                ) : (
                    <div className="text-center text-xs text-[var(--t-text3)] py-2">
                       No active assignment data.
                    </div>
                )}
            </div>

            {schedule && (
                 <div>
                    <div className="text-xs font-sans text-slate-500">
                        {format(parseISO(schedule.startDate), 'dd MMM yyyy')}
                        {schedule.endDate ? ` → ${format(parseISO(schedule.endDate), 'dd MMM yyyy')}` : ' → Present'}
                    </div>
                     {schedule.details && <div className="text-xs text-slate-400 mt-1">Role: {schedule.details}</div>}
                 </div>
            )}

            {hasCriticalCerts && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-md mt-auto">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    Certificate expiring soon.
                </div>
            )}
        </div>
    );
}

function EquipmentStatusBadge({ status }) {
  const map = {
    Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'In Use': 'bg-sky-50 text-sky-700 border-sky-200',
    Reserved: 'bg-orange-50 text-orange-700 border-orange-200',
    'Under Maintenance': 'bg-amber-50 text-amber-800 border-amber-200',
    Damaged: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border', map[status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
      {status}
    </span>
  );
}

function ProjectStatusCard({ project, assets, employees }) {
  const statusColors = {
    Active: { border: 'border-l-green-500', indicator: 'bg-green-500', text: 'text-green-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    Preparing: { border: 'border-l-blue-500', indicator: 'bg-blue-500', text: 'text-blue-600', badge: 'bg-blue-50 border-blue-200 text-blue-700' },
    Mobilizing: { border: 'border-l-cyan-500', indicator: 'bg-cyan-500', text: 'text-cyan-600', badge: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
    Planned: { border: 'border-l-purple-500', indicator: 'bg-purple-500', text: 'text-purple-600', badge: 'bg-purple-50 border-purple-200 text-purple-700' },
    Delayed: { border: 'border-l-red-500', indicator: 'bg-red-500 animate-pulse', text: 'text-red-600', badge: 'bg-rose-50 border-rose-200 text-rose-700' },
  };
  const cfg = statusColors[project.status] || statusColors.Planned;
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const reqEquip = (project.requiredEquipment || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
  const reqTechs = (project.requiredTechnicians || []).map(id => employees.find(e => e.id === id)).filter(Boolean);

  return (
    <div className={clsx('rounded-xl border border-slate-200/90 border-l-4 p-4 space-y-3 bg-gradient-to-b from-white via-slate-50/40 to-slate-100/50 shadow-xs hover:shadow-md transition-all', cfg.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={clsx('w-2 h-2 rounded-full', cfg.indicator)} />
            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded border', cfg.badge)}>{project.status}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">{project.type}</span>
          </div>
          <h3 className="font-semibold text-slate-800 text-sm leading-snug">{project.name}</h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            {project.siteLocation}
          </div>
        </div>
        {daysLeft !== null && (
          <div className={clsx('text-right flex-shrink-0 px-2.5 py-1 rounded-lg border shadow-2xs', daysLeft < 0 ? 'bg-rose-50/80 border-rose-200/80 text-rose-700' : daysLeft < 7 ? 'bg-amber-50/80 border-amber-200/80 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600')}>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-base font-bold leading-none">{Math.abs(daysLeft)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-tight opacity-80">{daysLeft < 0 ? 'd over' : 'd left'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Readiness */}
      <div>
        <div className="flex justify-between text-xs mb-1 font-medium">
          <span className="text-slate-500">Mobilization Readiness</span>
          <span className={project.readiness >= 80 ? 'text-emerald-600 font-bold' : project.readiness >= 60 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold'}>{project.readiness}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${project.readiness}%`, background: project.readiness >= 80 ? '#10b981' : project.readiness >= 60 ? '#f59e0b' : '#ef4444' }} />
        </div>
      </div>

      {/* Equipment */}
      {reqEquip.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Package className="w-3 h-3 text-slate-400" />Equipment</div>
          <div className="flex flex-wrap gap-1">
            {reqEquip.map(asset => (
              <div key={asset.id} className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-md px-2 py-0.5 shadow-2xs">
                <div className={clsx('w-1.5 h-1.5 rounded-full',
                  asset.status === 'Available' ? 'bg-emerald-500' : asset.status === 'In Use' ? 'bg-sky-500' : 'bg-amber-500')} />
                <span className="text-xs text-slate-700 truncate max-w-[110px]">{asset.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technicians */}
      {reqTechs.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" />Technicians</div>
          <div className="flex flex-wrap gap-1">
            {reqTechs.map(tech => (
              <span key={tech.id} className="text-xs bg-white border border-slate-200/90 text-slate-700 rounded-md px-2 py-0.5 flex items-center gap-1 shadow-2xs">
                <div className={clsx('w-1.5 h-1.5 rounded-full',
                  tech.availability === 'Available' ? 'bg-emerald-500' : 'bg-sky-500')} />
                {tech.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 font-medium">{project.clientName}</div>
    </div>
  );
}

function EquipmentAllocationBoard({ assets }) {
  const statusGroups = {
    Available: assets.filter(a => a.status === 'Available'),
    'In Use': assets.filter(a => a.status === 'In Use'),
    Reserved: assets.filter(a => a.status === 'Reserved'),
    'Under Maintenance': assets.filter(a => a.status === 'Under Maintenance'),
    'Damaged': assets.filter(a => a.status === 'Damaged'),
  };

  const colors = {
    Available: { bg: 'bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/30', border: 'border border-emerald-300/90', text: 'text-emerald-800', header: 'bg-emerald-100/70 border-b border-emerald-200', dot: 'bg-emerald-500' },
    'In Use': { bg: 'bg-gradient-to-b from-sky-50/70 via-white to-sky-50/30', border: 'border border-sky-300/90', text: 'text-sky-800', header: 'bg-sky-100/70 border-b border-sky-200', dot: 'bg-sky-500' },
    Reserved: { bg: 'bg-gradient-to-b from-orange-50/70 via-white to-orange-50/30', border: 'border border-orange-300/90', text: 'text-orange-800', header: 'bg-orange-100/70 border-b border-orange-200', dot: 'bg-orange-500' },
    'Under Maintenance': { bg: 'bg-gradient-to-b from-amber-50/70 via-white to-amber-50/30', border: 'border border-amber-300/90', text: 'text-amber-800', header: 'bg-amber-100/70 border-b border-amber-200', dot: 'bg-amber-500' },
    'Damaged': { bg: 'bg-gradient-to-b from-rose-50/70 via-white to-rose-50/30', border: 'border border-rose-300/90', text: 'text-rose-800', header: 'bg-rose-100/70 border-b border-rose-200', dot: 'bg-rose-500' },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {Object.entries(statusGroups).map(([status, items]) => {
        const cfg = colors[status];
        return (
          <div key={status} className={clsx('rounded-xl border shadow-xs', cfg.bg, cfg.border)}>
            <div className={clsx('px-3 py-2 rounded-t-xl flex items-center justify-between', cfg.header)}>
              <div className="flex items-center gap-2">
                <div className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
                <span className={clsx('text-xs font-semibold', cfg.text)}>{status}</span>
              </div>
              <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded bg-white/80 shadow-2xs', cfg.text)}>{items.length}</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs font-medium">None</div>
              ) : items.map(asset => (
                <div key={asset.id} className="bg-white/95 border border-slate-200/90 rounded-lg p-2.5 shadow-2xs hover:shadow-xs transition-all">
                  <div className="text-xs font-semibold text-slate-800 leading-snug">{asset.name}</div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">{asset.id}</div>
                  {asset.location && <div className="text-[10px] text-slate-500 truncate mt-0.5">{asset.location}</div>}
                  {asset.availableDate && status !== 'Available' && (
                    <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Avail: {asset.availableDate}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OperationsPage() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  const load = async () => {
    setLoading(true);
    const [a, p, e] = await Promise.all([assetsService.getAll(), projectsService.getAll(), employeesService.getAll()]);
    setAssets(a); setProjects(p); setEmployees(e);
    setAlerts(getSystemAlerts(a, e));
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeProjects = projects.filter(p => ['Active', 'Mobilizing'].includes(p.status));
  const preparingProjects = projects.filter(p => p.status === 'Preparing');

  const returningAssets = assets.filter(a => {
    if (!a.availableDate || a.status === 'Available') return false;
    const days = differenceInDays(parseISO(a.availableDate), new Date());
    return days >= 0 && days <= 14;
  });

  const tabs = [
    { id: 'overview', label: 'Live Overview' },
    { id: 'equipment', label: 'Equipment Board' },
    { id: 'deployment', label: 'Personnel Deployment' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 shadow-2xs">
              <Radio className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              Operations Control Center
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 ml-10">
            Real-time operational visibility — Last updated: {format(lastUpdate, 'HH:mm:ss')}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs flex items-center gap-2 cursor-pointer">
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Live status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Projects', value: activeProjects.length, color: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-200/80', dot: 'bg-emerald-500 animate-pulse' },
          { label: 'Equipment In Field', value: assets.filter(a => a.status === 'In Use').length, color: 'text-sky-700', bg: 'bg-gradient-to-br from-sky-50/70 via-white to-sky-50/30 border-sky-200/80', dot: 'bg-sky-500' },
          { label: 'Personnel Deployed', value: employees.filter(e => e.availability === 'Assigned' || e.availability === 'Offshore').length, color: 'text-cyan-700', bg: 'bg-gradient-to-br from-cyan-50/70 via-white to-cyan-50/30 border-cyan-200/80', dot: 'bg-cyan-500' },
          { label: 'Active Alerts', value: alerts.filter(a => a.type === 'danger').length, color: alerts.filter(a => a.type === 'danger').length > 0 ? 'text-rose-700' : 'text-slate-700', bg: alerts.filter(a => a.type === 'danger').length > 0 ? 'bg-gradient-to-br from-rose-50/80 via-white to-rose-50/30 border-rose-200' : 'bg-gradient-to-br from-slate-50/70 via-white to-slate-100/30 border-slate-200/80', dot: alerts.filter(a => a.type === 'danger').length > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-400' },
        ].map(({ label, value, color, bg, dot }) => (
          <div key={label} className={clsx('rounded-xl border p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between', bg)}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500 font-medium">{label}</span>
              <div className="flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded-full border border-slate-200/60 shadow-2xs">
                <div className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
                <span className="text-[10px] font-semibold text-slate-400">LIVE</span>
              </div>
            </div>
            <div className={clsx('text-2xl sm:text-[26px] font-bold tracking-tight', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100/90 border border-slate-200/80 rounded-xl p-1 w-fit shadow-2xs">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
              activeTab === t.id ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/60' : 'text-slate-500 hover:text-slate-900 hover:bg-white/60')}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'overview' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--t-text2)] flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Operations ({activeProjects.length})
              </h2>
              {activeProjects.length === 0 ? (
                <div className="card p-8 text-center text-[var(--t-text3)] text-sm">No active projects</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeProjects.map(p => (
                    <ProjectStatusCard key={p.id} project={p} assets={assets} employees={employees} />
                  ))}
                </div>
              )}
            </div>

            {preparingProjects.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[var(--t-text2)] flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Preparing for Mobilization ({preparingProjects.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {preparingProjects.map(p => (
                    <ProjectStatusCard key={p.id} project={p} assets={assets} employees={employees} />
                  ))}
                </div>
              </div>
            )}

            {returningAssets.length > 0 && (
              <div className="bg-gradient-to-b from-white to-slate-50/70 rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80">
                  <h3 className="font-semibold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-600" />
                    Equipment Returning Soon (next 14 days)
                  </h3>
                </div>
                <div className="divide-y divide-slate-200/70">
                  {returningAssets.map(asset => {
                    const days = differenceInDays(parseISO(asset.availableDate), new Date());
                    return (
                      <div key={asset.id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                        <div>
                          <div className="text-xs sm:text-sm text-slate-800 font-semibold">{asset.name}</div>
                          <div className="text-xs text-slate-500">{asset.location}</div>
                        </div>
                        <div className="text-right">
                          <div className={clsx('text-xs sm:text-sm font-bold', days <= 3 ? 'text-emerald-600' : 'text-cyan-600')}>
                            {days === 0 ? 'Today' : `In ${days} days`}
                          </div>
                          <div className="text-xs text-slate-400 font-sans">{asset.availableDate}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              System Alerts ({alerts.length})
            </h2>
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="bg-white border border-slate-200/80 rounded-xl p-6 text-center shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center mx-auto mb-2 text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold text-slate-700">All systems operational</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">No critical alerts or warnings pending</div>
                </div>
              ) : alerts.map((alert, i) => {
                const cfg = ALERT_STYLES[alert.type];
                const Icon = cfg.Icon;
                return (
                  <div key={i} className={clsx('px-3 py-2.5 rounded-lg border text-xs flex gap-2.5', cfg.bg, cfg.border)}>
                    <Icon className={clsx('w-3.5 h-3.5 mt-0.5 flex-shrink-0', cfg.text)} />
                    <div>
                      <div className={clsx('font-semibold', cfg.text)}>{alert.category}</div>
                      <div className="text-[var(--t-text3)] mt-0.5">{alert.message}</div>
                      {alert.date && <div className="text-slate-600 mt-0.5">Due: {alert.date}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'equipment' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--t-text2)]">Equipment Allocation Board</h2>
            <div className="flex items-center gap-3 text-xs text-[var(--t-text3)]">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" />Available</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" />In Use</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500" />Reserved</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />Maint/Cal</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />Damaged</div>
            </div>
          </div>
          <EquipmentAllocationBoard assets={assets} />
        </div>
      ) : activeTab === 'deployment' ? (
        <PersonnelDeploymentView employees={employees} projects={projects} />
      ) : null}
    </div>
  );
}
