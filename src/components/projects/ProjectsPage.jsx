import { useState, useEffect, useMemo } from 'react';
import { 
  FolderKanban, Plus, Search, Download, MapPin, Calendar, 
  Users, Package, List, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { projectsService, assetsService, employeesService } from '../../services/firebaseService';
import { exportProjectsToExcel } from '../../utils/exportUtils';
import { 
  differenceInDays, parseISO, format, addMonths, startOfMonth 
} from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import ProjectModal from './ProjectModal';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_CFG = {
  Active:       { dot:'bg-emerald-500', text:'text-emerald-700', badge:'bg-emerald-50 border border-emerald-200 text-emerald-700' },
  Preparing:    { dot:'bg-sky-500',     text:'text-sky-700',     badge:'bg-sky-50 border border-sky-200 text-sky-700' },
  Mobilizing:   { dot:'bg-cyan-500',    text:'text-cyan-700',    badge:'bg-cyan-50 border border-cyan-200 text-cyan-700' },
  Planned:      { dot:'bg-purple-500',  text:'text-purple-700',  badge:'bg-purple-50 border border-purple-200 text-purple-700' },
  Demobilizing: { dot:'bg-amber-500',   text:'text-amber-800',   badge:'bg-amber-50 border border-amber-200 text-amber-800' },
  Delayed:      { dot:'bg-rose-500 animate-pulse', text:'text-rose-700', badge:'bg-rose-50 border border-rose-200 text-rose-700' },
  Completed:    { dot:'bg-slate-400',   text:'text-slate-600',   badge:'bg-slate-100 border border-slate-200 text-slate-600' },
};

const TYPE_THEME = {
  Offshore:  { color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd', bar: '#38bdf8' },
  Onshore:   { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0', bar: '#34d399' },
  Shutdown:  { color: '#b45309', bg: '#fef3c7', border: '#fde68a', bar: '#fbbf24' },
  Emergency: { color: '#be123c', bg: '#ffe4e6', border: '#fecdd3', bar: '#fb7185' },
  Other:     { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', bar: '#c084fc' },
};

function pct(date, viewStart, totalDays) {
  if (!date || isNaN(date.getTime())) return -1;
  const ms = date.getTime() - viewStart.getTime();
  return Math.max(0, Math.min(100, (ms / (totalDays * 86400000)) * 100));
}

function ProjectCard({ project, assets, employees, onEdit }) {
  const cfg = STATUS_CFG[project.status] || STATUS_CFG.Planned;
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const pm = employees.find(e => e.id === project.projectManager);
  
  const assignedEquipment = assets.filter(a => a.currentProject === project.projectNo && a.status === 'In Use').length;

  const assignedManpower = employees.reduce((count, emp) => {
    const isAssigned = (emp.schedule || []).some(s => s.projectNo === project.projectNo && s.type === 'Assignment');
    return count + (isAssigned ? 1 : 0);
  }, 0);

  return (
    <div 
      className="card hover:border-slate-300 transition-all cursor-pointer bg-white shadow-xs hover:shadow flex flex-col justify-between"
      style={{ borderLeft: `3px solid ${project.status === 'Delayed' ? '#f43f5e' : cfg.dot.includes('emerald') ? '#10b981' : '#f97316'}` }}
      onClick={onEdit}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-sans font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {project.projectNo || project.id}
              </span>
              <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border', cfg.badge)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)}/>
                {project.status}
              </span>
              <span className="text-xs font-medium text-slate-500">{project.type}</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug text-slate-900 mt-1">{project.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{project.clientName}</p>
          </div>
          <span className={clsx('text-xs font-semibold flex-shrink-0 px-2.5 py-0.5 rounded-md border',
            project.riskLevel === 'High' ? 'text-rose-700 border-rose-200 bg-rose-50' :
            project.riskLevel === 'Medium' ? 'text-amber-800 border-amber-200 bg-amber-50' :
            'text-emerald-700 border-emerald-200 bg-emerald-50'
          )}>
            {project.riskLevel || 'Low'} Risk
          </span>
        </div>

        <div className="space-y-1.5 mb-3 text-slate-600 text-xs">
          {project.siteLocation && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400"/>
              <span className="truncate">{project.siteLocation}</span>
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-slate-400"/>
              <span>{project.startDate || '—'} → {project.endDate || '—'}</span>
              {daysLeft !== null && (
                <span className={clsx('ml-auto font-semibold',
                  daysLeft < 0 ? 'text-rose-600' : daysLeft < 14 ? 'text-amber-600' : 'text-slate-500'
                )}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d left`}
                </span>
              )}
            </div>
          )}
          {pm && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 flex-shrink-0 text-slate-400"/>
              <span>PM: <strong className="text-slate-700 font-medium">{pm.name}</strong></span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
            <Package className="w-3.5 h-3.5 mx-auto mb-1 text-orange-600"/>
            <div className="font-bold text-slate-800">{assignedEquipment}</div>
            <div className="text-[10px] text-slate-500">Equipment</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
            <Users className="w-3.5 h-3.5 mx-auto mb-1 text-orange-600"/>
            <div className="font-bold text-slate-800">{assignedManpower}</div>
            <div className="text-[10px] text-slate-500">Manpower</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectTable({ projects, assets, employees, onEdit }) {
  const ProjectRow = ({ proj }) => {
    const cfg = STATUS_CFG[proj.status] || STATUS_CFG.Planned;
    const assignedEquipment = assets.filter(a => a.currentProject === proj.projectNo && a.status === 'In Use').length;
    const assignedManpower = employees.reduce((count, emp) => {
      return count + (emp.schedule || []).filter(s => s.projectNo === proj.projectNo && s.type === 'Assignment').length;
    }, 0);

    return (
      <tr onClick={() => onEdit(proj)} className="hover:bg-orange-50/30 cursor-pointer transition-colors border-b border-slate-100">
        <td className="p-3 pl-4">
          <div className="font-semibold text-sm text-slate-800">{proj.name}</div>
          <div className="text-xs text-slate-500 font-sans mt-0.5">{proj.projectNo || proj.id}</div>
        </td>
        <td className="p-3 text-xs text-slate-600 font-medium">{proj.clientName}</td>
        <td className="p-3">
          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border', cfg.badge)}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {proj.status}
          </span>
        </td>
        <td className="p-3 text-xs text-slate-600 font-sans">
          {proj.startDate && proj.endDate ? (
            <span>{format(parseISO(proj.startDate), 'dd MMM yyyy')} → {format(parseISO(proj.endDate), 'dd MMM yyyy')}</span>
          ) : 'N/A'}
        </td>
        <td className="p-3 text-center text-xs font-semibold text-slate-700">
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">{assignedManpower}</span>
        </td>
        <td className="p-3 pr-4 text-center text-xs font-semibold text-slate-700">
          <span className="bg-slate-100 px-2 py-0.5 rounded-md">{assignedEquipment}</span>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
          <tr>
            <th className="p-3 pl-4 font-semibold">Project</th>
            <th className="p-3 font-semibold">Client</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">Period</th>
            <th className="p-3 text-center font-semibold">Manpower</th>
            <th className="p-3 pr-4 text-center font-semibold">Equipment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projects.map(proj => <ProjectRow key={proj.id} proj={proj} />)}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTimelineView({ projects, employees, onEdit }) {
  const [viewStart, setViewStart] = useState(startOfMonth(new Date()));
  const [viewMonths, setViewMonths] = useState(6);
  const [typeFilter, setTypeFilter] = useState('All');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const viewEnd = useMemo(() => addMonths(viewStart, viewMonths), [viewStart, viewMonths]);
  const totalDays = useMemo(() => differenceInDays(viewEnd, viewStart), [viewEnd, viewStart]);

  const months = useMemo(() => {
    const list = [];
    let cur = new Date(viewStart);
    while (cur < viewEnd) {
      list.push(new Date(cur));
      cur = addMonths(cur, 1);
    }
    return list;
  }, [viewStart, viewEnd]);

  const filteredTimelineProjects = useMemo(() => {
    return projects.filter(p => {
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;
      const s = p.startDate ? parseISO(p.startDate) : null;
      const e = p.endDate ? parseISO(p.endDate) : null;
      if (!s || !e) return true;
      return s < viewEnd && e > viewStart;
    }).sort((a, b) => {
      const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
      return aDate - bDate;
    });
  }, [projects, typeFilter, viewStart, viewEnd]);

  return (
    <div className="space-y-3">
      {/* Timeline Controls Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            {[3, 6, 12].map(n => (
              <button
                key={n}
                onClick={() => setViewMonths(n)}
                className={clsx(
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                  viewMonths === n
                    ? 'bg-white text-orange-700 shadow-xs border border-orange-200'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {n} Months
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 pl-2">
            <button 
              onClick={() => setViewStart(addMonths(viewStart, -1))} 
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="text-xs font-semibold px-2 min-w-[150px] text-center text-slate-800">
              {format(viewStart, 'MMM yyyy')} — {format(addMonths(viewStart, viewMonths - 1), 'MMM yyyy')}
            </span>
            <button 
              onClick={() => setViewStart(addMonths(viewStart, 1))} 
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4"/>
            </button>
            <button 
              onClick={() => setViewStart(startOfMonth(new Date()))} 
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              Today
            </button>
          </div>
        </div>

        {/* Project Type Legend & Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter('All')}
            className={clsx(
              'px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
              typeFilter === 'All'
                ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            All Types
          </button>
          {Object.entries(TYPE_THEME).map(([tName, tCfg]) => (
            <button
              key={tName}
              onClick={() => setTypeFilter(tName)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
                typeFilter === tName
                  ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: tCfg.bar }} />
              {tName}
            </button>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-2">
            <span className="w-3 h-0.5 rounded bg-rose-500" />
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Gantt Chart Canvas */}
      <div className="card overflow-hidden bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 860, position: 'relative' }}>
            {/* Header Months */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              <div 
                className="flex-shrink-0 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-50"
                style={{ width: 230, borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 12 }}
              >
                Project Details
              </div>
              <div className="flex flex-1">
                {months.map((mn, i) => (
                  <div 
                    key={i} 
                    className="flex-1 text-center py-2.5 text-xs font-semibold text-slate-600"
                    style={{ borderRight: i < months.length - 1 ? '1px solid #e2e8f0' : 'none' }}
                  >
                    {format(mn, 'MMM yy')}
                  </div>
                ))}
              </div>
            </div>

            {/* Project Rows */}
            {filteredTimelineProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <CalendarDays className="w-10 h-10 mb-2 opacity-30 text-orange-500"/>
                <p className="text-sm">No projects scheduled within this date range.</p>
              </div>
            ) : (
              filteredTimelineProjects.map(proj => {
                const displayName = proj.projectNo ? `${proj.projectNo} · ${proj.name}` : proj.name;
                const sD = proj.startDate ? parseISO(proj.startDate) : null;
                const eD = proj.endDate ? parseISO(proj.endDate) : null;
                const mD = proj.mobilizationDate ? parseISO(proj.mobilizationDate) : null;
                const dD = proj.demobilizationDate ? parseISO(proj.demobilizationDate) : null;
                
                const theme = TYPE_THEME[proj.type] || TYPE_THEME.Onshore;
                const sc = STATUS_CFG[proj.status] || STATUS_CFG.Planned;
                const todayPct = pct(today, viewStart, totalDays);
                const barL = sD ? pct(sD, viewStart, totalDays) : -1;
                const barR = eD ? pct(eD, viewStart, totalDays) : -1;
                const barW = (barL >= 0 && barR >= 0) ? barR - barL : 0;
                
                const clampL = Math.max(0, barL);
                const clampW = Math.min(100 - clampL, Math.max(barW, 0.6));
                const daysLeft = eD && !isNaN(eD.getTime()) ? differenceInDays(eD, today) : null;
                const isDelayed = proj.status === 'Delayed';

                let mobBar = null;
                if (mD && sD && !isNaN(mD.getTime()) && !isNaN(sD.getTime())) {
                  const mL = pct(mD, viewStart, totalDays);
                  const mW = barL - mL;
                  if (mW > 0.2 && mL >= 0) {
                    mobBar = { left: `${Math.max(0, mL).toFixed(2)}%`, width: `${Math.min(mW, 100 - Math.max(0, mL)).toFixed(2)}%` };
                  }
                }

                let demobBar = null;
                if (dD && eD && !isNaN(dD.getTime()) && !isNaN(eD.getTime())) {
                  const dL = pct(eD, viewStart, totalDays);
                  const dW = pct(dD, viewStart, totalDays) - dL;
                  if (dW > 0.2 && dL < 100) {
                    demobBar = { left: `${dL.toFixed(2)}%`, width: `${Math.min(dW, 100 - dL).toFixed(2)}%` };
                  }
                }

                return (
                  <div
                    key={proj.id}
                    onClick={() => onEdit(proj)}
                    className="flex group cursor-pointer border-b border-slate-100 hover:bg-orange-50/20 transition-colors"
                  >
                    {/* Left Sticky Info Card */}
                    <div 
                      className="flex-shrink-0 px-3.5 py-2.5 bg-white group-hover:bg-orange-50/40 transition-colors"
                      style={{ width: 230, borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 10 }}
                    >
                      <div className="font-semibold text-xs text-slate-800 group-hover:text-orange-600 transition-colors truncate" title={displayName}>
                        {displayName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{proj.clientName}</div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border', sc.badge)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)}/>
                          {proj.status}
                        </span>
                        <span 
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                          style={{ background: theme.bg, borderColor: theme.border, color: theme.color }}
                        >
                          {proj.type}
                        </span>
                      </div>
                    </div>

                    {/* Right Timeline Canvas */}
                    <div className="flex-1 relative pr-2" style={{ minHeight: 60 }}>
                      {/* Month Grid Divider Lines */}
                      {months.map((_, i) => i > 0 && (
                        <div 
                          key={i} 
                          className="absolute top-0 bottom-0 w-px bg-slate-100"
                          style={{ left: `${(i / months.length) * 100}%` }}
                        />
                      ))}

                      {/* Today Indicator Line */}
                      {todayPct > 0 && todayPct < 100 && (
                        <div className="absolute top-0 bottom-0 z-10" style={{ left: `${todayPct}%` }}>
                          <div className="w-px h-full bg-rose-500/80"/>
                          <div className="absolute -top-1 left-1 text-[9px] font-semibold text-rose-600 whitespace-nowrap bg-rose-50 px-1 rounded border border-rose-200">
                            Today
                          </div>
                        </div>
                      )}

                      {/* Mobilization Bar */}
                      {mobBar && (
                        <div 
                          className="absolute rounded opacity-75 shadow-xs" 
                          style={{
                            left: mobBar.left,
                            width: mobBar.width,
                            top: '50%',
                            transform: 'translateY(-180%)',
                            height: 6,
                            background: theme.bar,
                          }}
                          title={`Mobilization: ${proj.mobilizationDate}`}
                        />
                      )}

                      {/* Main Project Gantt Bar */}
                      {barL >= 0 && (
                        <div 
                          className="absolute flex items-center px-2 rounded-md text-[10px] font-semibold overflow-hidden select-none z-[5] shadow-xs transition-all duration-150 hover:brightness-105"
                          style={{
                            left: `${clampL}%`,
                            width: `${clampW}%`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: 26,
                            background: isDelayed ? '#fb7185' : theme.bar,
                            border: `1px solid ${isDelayed ? '#f43f5e' : theme.color}`,
                            color: isDelayed ? '#fff' : '#0f172a',
                          }}
                        >
                          {clampW > 7 && (
                            <span className="truncate font-bold tracking-tight">
                              {proj.projectNo ? `${proj.projectNo}` : proj.name}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Demobilization Bar */}
                      {demobBar && (
                        <div 
                          className="absolute rounded opacity-75 shadow-xs" 
                          style={{
                            left: demobBar.left,
                            width: demobBar.width,
                            top: '50%',
                            transform: 'translateY(80%)',
                            height: 6,
                            background: theme.bar,
                          }}
                          title={`Demobilization: ${proj.demobilizationDate}`}
                        />
                      )}

                      {/* Days Left Tag */}
                      {daysLeft !== null && clampW > 14 && (
                        <div className={clsx(
                          "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] z-10 font-bold px-1 rounded",
                          isDelayed ? 'text-white' : 'text-slate-800 bg-white/70'
                        )}>
                          {proj.status === 'Completed' ? '✓ Done' : daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Notes */}
        <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
          <span>Showing {filteredTimelineProjects.length} of {projects.length} projects</span>
          <div className="flex items-center gap-3">
            <span>• Top bar: Mobilization</span>
            <span>• Main bar: Project Duration</span>
            <span>• Bottom bar: Demobilization</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { isAdmin, isBaseManager, canManageProjects } = useAuth();
  const canEditProjects = canManageProjects ?? (isAdmin || isBaseManager);
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = searchParams.get('view') || 'table'; // 'table' | 'card' | 'timeline'

  const setViewMode = (mode) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      return next;
    });
  };

  useEffect(() => {
    setLoading(true);
    const unsubProjects = projectsService.subscribe(data => {
      setProjects(data.sort((x, y) => (x.startDate || '').localeCompare(y.startDate || '')));
      setLoading(false);
    });
    const unsubAssets = assetsService.subscribe(data => setAssets(data));
    const unsubEmployees = employeesService.subscribe(data => setEmployees(data));

    return () => {
      unsubProjects();
      unsubAssets();
      unsubEmployees();
    };
  }, []);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const s = search.toLowerCase().trim();
      const pm = employees.find(e => e.id === p.projectManager);
      const matchesSearch = !s ||
        p.name?.toLowerCase().includes(s) ||
        p.clientName?.toLowerCase().includes(s) ||
        p.siteLocation?.toLowerCase().includes(s) ||
        p.projectNo?.toLowerCase().includes(s) ||
        pm?.name?.toLowerCase().includes(s);

      const matchesStatus = statusF === 'All' || p.status === statusF;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusF, employees]);

  const handleOpenEditModal = (project) => {
    setSelected(project);
    setShowModal(true);
  };

  const handleSaveProject = (savedData) => {
    // Immediate optimistic state update
    setProjects(prev => {
      const exists = prev.some(p => p.id === savedData.id);
      if (exists) {
        return prev.map(p => p.id === savedData.id ? { ...p, ...savedData } : p);
      }
      return [savedData, ...prev];
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-orange-500"/>
            Project Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {projects.filter(p => p.status === 'Active').length} active ·{' '}
            {projects.filter(p => p.status === 'Planned').length} planned ·{' '}
            {projects.length} total projects
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: Table, Cards, Timeline */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                currentView === 'table'
                  ? 'bg-white text-orange-700 shadow-xs border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Table View"
            >
              <List className="w-3.5 h-3.5"/>
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                currentView === 'card'
                  ? 'bg-white text-orange-700 shadow-xs border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5"/>
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                currentView === 'timeline'
                  ? 'bg-white text-orange-700 shadow-xs border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              title="Timeline Gantt View"
            >
              <CalendarDays className="w-3.5 h-3.5"/>
              <span>Timeline</span>
            </button>
          </div>

          <button 
            onClick={() => exportProjectsToExcel(filtered, employees)} 
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Export Excel"
          >
            <Download className="w-3.5 h-3.5"/>Excel
          </button>
          {canEditProjects && (
            <button 
              onClick={() => { setSelected(null); setShowModal(true); }} 
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4"/>Add Project
            </button>
          )}
        </div>
      </div>

      {/* Status Badges Filters */}
      <div className="flex flex-wrap gap-2">
        {['All', ...Object.keys(STATUS_CFG)].map(s => {
          const count = s === 'All' ? projects.length : projects.filter(p => p.status === s).length;
          const cfg = STATUS_CFG[s];
          const isSelected = statusF === s;
          return (
            <button 
              key={s} 
              onClick={() => setStatusF(s)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
                isSelected
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300'
              )}
            >
              {cfg && <span className={clsx('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-white' : cfg.dot)}/>}
              <span>{s}</span>
              <span className={clsx('px-1.5 py-0.2 rounded-full text-[10px]', isSelected ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-600')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          placeholder="Search Project No, Name, Client, Location, PM..."
          className="input-field pl-9 bg-white"
        />
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : currentView === 'timeline' ? (
        <ProjectTimelineView 
          projects={filtered}
          employees={employees}
          onEdit={handleOpenEditModal}
        />
      ) : currentView === 'card' ? (
        filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
            <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-30 text-orange-500"/>
            No Projects Found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filtered.map(proj => (
              <ProjectCard 
                key={proj.id} 
                project={proj} 
                assets={assets} 
                employees={employees}
                onEdit={() => handleOpenEditModal(proj)}
              />
            ))}
          </div>
        )
      ) : (
        filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
            <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-30 text-orange-500"/>
            No Projects Found
          </div>
        ) : (
          <ProjectTable 
            projects={filtered} 
            assets={assets} 
            employees={employees} 
            onEdit={handleOpenEditModal} 
          />
        )
      )}

      {/* Project Modal for Add / Edit */}
      {showModal && (
        <ProjectModal
          project={selected}
          employees={employees}
          projects={projects}
          readOnly={!canEditProjects}
          onClose={() => setShowModal(false)}
          onViewTimeline={() => {
            setShowModal(false);
            setViewMode('timeline');
          }}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}
