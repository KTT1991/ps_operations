import { useState, useEffect } from 'react';
import { Radio, Package, Users, AlertTriangle, Clock, CheckCircle, XCircle, Zap, MapPin, ArrowRight, RefreshCw } from 'lucide-react';
import { assetsService, projectsService, employeesService, getSystemAlerts } from '../../services/firebaseService';
import { differenceInDays, parseISO, format } from 'date-fns';
import clsx from 'clsx';

const ALERT_STYLES = {
  danger: { border: 'border-red-700/60', bg: 'bg-red-900/20', text: 'text-red-400', dot: 'bg-red-500', Icon: XCircle },
  warning: { border: 'border-amber-700/60', bg: 'bg-amber-900/20', text: 'text-amber-400', dot: 'bg-amber-500', Icon: AlertTriangle },
  info: { border: 'border-blue-700/60', bg: 'bg-blue-900/20', text: 'text-blue-400', dot: 'bg-blue-500', Icon: Clock },
};

function EquipmentStatusBadge({ status }) {
  const map = {
    Available: 'bg-green-500/20 text-green-400 border-green-700/50',
    'In Use': 'bg-blue-500/20 text-blue-400 border-blue-700/50',
    Reserved: 'bg-cyan-500/20 text-cyan-400 border-cyan-700/50',
    'Under Maintenance': 'bg-amber-500/20 text-amber-400 border-amber-700/50',
    Calibration: 'bg-purple-500/20 text-purple-400 border-purple-700/50',
    Damaged: 'bg-red-500/20 text-red-400 border-red-700/50',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs border', map[status] || 'bg-[var(--t-bg3)] text-[var(--t-text3)] border-[var(--t-border2)]')}>
      {status}
    </span>
  );
}

function ProjectStatusCard({ project, assets, employees }) {
  const statusColors = {
    Active: { border: 'border-l-green-500', indicator: 'bg-green-500', text: 'text-green-400' },
    Preparing: { border: 'border-l-blue-500', indicator: 'bg-blue-500', text: 'text-blue-400' },
    Mobilizing: { border: 'border-l-cyan-500', indicator: 'bg-cyan-500', text: 'text-cyan-400' },
    Planned: { border: 'border-l-purple-500', indicator: 'bg-purple-500', text: 'text-purple-400' },
    Delayed: { border: 'border-l-red-500', indicator: 'bg-red-500 animate-pulse', text: 'text-red-400' },
  };
  const cfg = statusColors[project.status] || statusColors.Planned;
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const reqEquip = (project.requiredEquipment || []).map(id => assets.find(a => a.id === id)).filter(Boolean);
  const reqTechs = (project.requiredTechnicians || []).map(id => employees.find(e => e.id === id)).filter(Boolean);

  return (
    <div className={clsx('card border-l-4 p-4 space-y-3 hover:border-t-slate-600 transition-colors', cfg.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={clsx('w-2 h-2 rounded-full', cfg.indicator)} />
            <span className={clsx('text-xs font-medium', cfg.text)}>{project.status}</span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-[var(--t-text3)]">{project.type}</span>
          </div>
          <h3 className="font-semibold text-[var(--t-text)] text-sm leading-snug">{project.name}</h3>
          <div className="flex items-center gap-1 text-xs text-[var(--t-text3)] mt-1">
            <MapPin className="w-3 h-3" />
            {project.siteLocation}
          </div>
        </div>
        {daysLeft !== null && (
          <div className={clsx('text-right flex-shrink-0', daysLeft < 0 ? 'text-red-400' : daysLeft < 7 ? 'text-amber-400' : 'text-[var(--t-text3)]')}>
            <div className="text-lg font-bold leading-none">{Math.abs(daysLeft)}</div>
            <div className="text-[10px]">{daysLeft < 0 ? 'days over' : 'days left'}</div>
          </div>
        )}
      </div>

      {/* Readiness */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[var(--t-text3)]">Readiness</span>
          <span className={project.readiness >= 80 ? 'text-green-400' : project.readiness >= 60 ? 'text-amber-400' : 'text-red-400'}>{project.readiness}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${project.readiness}%`, background: project.readiness >= 80 ? '#22c55e' : project.readiness >= 60 ? '#f59e0b' : '#ef4444' }} />
        </div>
      </div>

      {/* Equipment */}
      {reqEquip.length > 0 && (
        <div>
          <div className="text-xs text-[var(--t-text3)] mb-1.5 flex items-center gap-1"><Package className="w-3 h-3" />Equipment</div>
          <div className="flex flex-wrap gap-1">
            {reqEquip.map(asset => (
              <div key={asset.id} className="flex items-center gap-1 bg-slate-800/50 rounded px-2 py-0.5">
                <div className={clsx('w-1.5 h-1.5 rounded-full',
                  asset.status === 'Available' ? 'bg-green-500' : asset.status === 'In Use' ? 'bg-blue-500' : 'bg-amber-500')} />
                <span className="text-xs text-[var(--t-text3)] truncate max-w-[100px]">{asset.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technicians */}
      {reqTechs.length > 0 && (
        <div>
          <div className="text-xs text-[var(--t-text3)] mb-1.5 flex items-center gap-1"><Users className="w-3 h-3" />Technicians</div>
          <div className="flex flex-wrap gap-1">
            {reqTechs.map(tech => (
              <span key={tech.id} className="text-xs bg-slate-800/50 text-[var(--t-text3)] rounded px-2 py-0.5 flex items-center gap-1">
                <div className={clsx('w-1.5 h-1.5 rounded-full',
                  tech.availability === 'Available' ? 'bg-green-500' : 'bg-blue-500')} />
                {tech.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-600">{project.clientName}</div>
    </div>
  );
}

function EquipmentAllocationBoard({ assets }) {
  const statusGroups = {
    Available: assets.filter(a => a.status === 'Available'),
    'In Use': assets.filter(a => a.status === 'In Use'),
    Reserved: assets.filter(a => a.status === 'Reserved'),
    'Maintenance/Cal': assets.filter(a => ['Under Maintenance', 'Calibration'].includes(a.status)),
    'Damaged': assets.filter(a => a.status === 'Damaged'),
  };

  const colors = {
    Available: { bg: 'bg-green-900/20', border: 'border-green-700/40', text: 'text-green-400', header: 'bg-green-900/30', dot: 'bg-green-500' },
    'In Use': { bg: 'bg-blue-900/20', border: 'border-blue-700/40', text: 'text-blue-400', header: 'bg-blue-900/30', dot: 'bg-blue-500' },
    Reserved: { bg: 'bg-cyan-900/20', border: 'border-cyan-700/40', text: 'text-cyan-400', header: 'bg-cyan-900/30', dot: 'bg-cyan-500' },
    'Maintenance/Cal': { bg: 'bg-amber-900/20', border: 'border-amber-700/40', text: 'text-amber-400', header: 'bg-amber-900/30', dot: 'bg-amber-500' },
    'Damaged': { bg: 'bg-red-900/20', border: 'border-red-700/40', text: 'text-red-400', header: 'bg-red-900/30', dot: 'bg-red-500' },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {Object.entries(statusGroups).map(([status, items]) => {
        const cfg = colors[status];
        return (
          <div key={status} className={clsx('rounded-xl border', cfg.bg, cfg.border)}>
            <div className={clsx('px-3 py-2 rounded-t-xl flex items-center justify-between', cfg.header)}>
              <div className="flex items-center gap-2">
                <div className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
                <span className={clsx('text-xs font-semibold', cfg.text)}>{status}</span>
              </div>
              <span className={clsx('text-xs font-bold', cfg.text)}>{items.length}</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-center py-4 text-slate-600 text-xs">None</div>
              ) : items.map(asset => (
                <div key={asset.id} className="bg-slate-900/60 rounded-lg p-2">
                  <div className="text-xs font-medium text-[var(--t-text2)] leading-snug">{asset.name}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{asset.id}</div>
                  {asset.location && <div className="text-[10px] text-slate-600 truncate">{asset.location}</div>}
                  {asset.availableDate && status !== 'Available' && (
                    <div className="text-[10px] text-amber-500 mt-0.5">Avail: {asset.availableDate}</div>
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
  const plannedProjects = projects.filter(p => p.status === 'Planned');

  // Upcoming: assets returning in next 14 days
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
          <h1 className="section-title flex items-center gap-2">
            <Radio className="w-5 h-5 text-orange-500" />
            Operations Control Center
          </h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">
            Real-time operational visibility — Last updated: {format(lastUpdate, 'HH:mm:ss')}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs flex items-center gap-2">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Live status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Projects', value: activeProjects.length, color: 'text-green-400', dot: 'bg-green-500 animate-pulse' },
          { label: 'Equipment In Field', value: assets.filter(a => a.status === 'In Use').length, color: 'text-blue-400', dot: 'bg-blue-500' },
          { label: 'Personnel Deployed', value: employees.filter(e => e.availability === 'Assigned' || e.availability === 'Offshore').length, color: 'text-cyan-400', dot: 'bg-cyan-500' },
          { label: 'Active Alerts', value: alerts.filter(a => a.type === 'danger').length, color: alerts.filter(a => a.type === 'danger').length > 0 ? 'text-red-400' : 'text-green-400', dot: alerts.filter(a => a.type === 'danger').length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500' },
        ].map(({ label, value, color, dot }) => (
          <div key={label} className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <div className={clsx('w-2 h-2 rounded-full', dot)} />
              <span className="text-xs text-[var(--t-text3)]">LIVE</span>
            </div>
            <div className={clsx('text-3xl font-bold font-display', color)}>{value}</div>
            <div className="text-sm text-[var(--t-text3)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--t-bg2)] border border-[var(--t-border)] rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('px-4 py-1.5 rounded-md text-sm transition-all',
              activeTab === t.id ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]')}>
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
          {/* Active Projects */}
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

            {/* Returning equipment */}
            {returningAssets.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="font-medium text-[var(--t-text)] flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-cyan-500" />
                    Equipment Returning Soon (next 14 days)
                  </h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {returningAssets.map(asset => {
                    const days = differenceInDays(parseISO(asset.availableDate), new Date());
                    return (
                      <div key={asset.id} className="px-4 py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm text-[var(--t-text)] font-medium">{asset.name}</div>
                          <div className="text-xs text-[var(--t-text3)]">{asset.location}</div>
                        </div>
                        <div className="text-right">
                          <div className={clsx('text-sm font-bold', days <= 3 ? 'text-green-400' : 'text-cyan-400')}>
                            {days === 0 ? 'Today' : `In ${days} days`}
                          </div>
                          <div className="text-xs text-[var(--t-text3)]">{asset.availableDate}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Alerts panel */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--t-text2)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              System Alerts ({alerts.length})
            </h2>
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="card p-8 text-center text-sm text-[var(--t-text3)]">
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                  All clear — no active alerts
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
      ) : (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="font-medium text-[var(--t-text)]">Personnel Deployment Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Current Project</th>
                  <th>Rotation</th>
                  <th>Offshore Cert</th>
                  <th><HUET></HUET></th>
                  <th>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const project = projects.find(p => p.id === emp.currentProject);
                  const offDays = emp.offshoreExpiry ? differenceInDays(parseISO(emp.offshoreExpiry), new Date()) : null;
                  const huetDays = emp.huetExpiry ? differenceInDays(parseISO(emp.huetExpiry), new Date()) : null;
                  const availCfg = { Available: 'text-green-400', Assigned: 'text-blue-400', Offshore: 'text-cyan-400', 'On Leave': 'text-amber-400', Training: 'text-purple-400' };
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className="font-medium text-[var(--t-text)] text-sm">{emp.name}</div>
                        <div className="text-xs text-[var(--t-text3)]">{emp.id}</div>
                      </td>
                      <td><span className="text-sm text-[var(--t-text3)]">{emp.position}</span></td>
                      <td>
                        <span className={clsx('text-sm font-medium', availCfg[emp.availability] || 'text-[var(--t-text3)]')}>
                          {emp.availability}
                        </span>
                      </td>
                      <td>
                        {project ? (
                          <div>
                            <div className="text-sm text-[var(--t-text2)] max-w-[160px] truncate">{project.name}</div>
                            <div className="text-xs text-[var(--t-text3)]">{project.id}</div>
                          </div>
                        ) : <span className="text-[var(--t-text3)]">—</span>}
                      </td>
                      <td><span className="text-sm text-[var(--t-text3)]">{emp.rotation}</span></td>
                      <td>
                        {offDays !== null ? (
                          <span className={clsx('text-xs', offDays < 0 ? 'text-red-400 font-medium' : offDays < 30 ? 'text-amber-400' : 'text-[var(--t-text3)]')}>
                            {offDays < 0 ? 'EXPIRED' : `${offDays}d`}
                          </span>
                        ) : <span className="text-[var(--t-text3)]">—</span>}
                      </td>
                      <td>
                        {huetDays !== null ? (
                          <span className={clsx('text-xs', huetDays < 0 ? 'text-red-400 font-medium' : huetDays < 30 ? 'text-amber-400' : 'text-[var(--t-text3)]')}>
                            {huetDays < 0 ? 'EXPIRED' : `${huetDays}d`}
                          </span>
                        ) : <span className="text-[var(--t-text3)]">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-14 progress-bar">
                            <div className="progress-fill" style={{ width: `${emp.utilization}%`, background: emp.utilization > 90 ? '#ef4444' : emp.utilization > 70 ? '#f59e0b' : '#22c55e' }} />
                          </div>
                          <span className="text-xs text-[var(--t-text3)]">{emp.utilization}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
