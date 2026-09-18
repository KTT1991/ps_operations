import { useState, useMemo } from 'react';
import {
  GraduationCap, CheckCircle2, AlertTriangle, XCircle, Clock,
  FolderKanban, Users, ShieldAlert, ArrowUpRight, CheckCircle,
  Building2, ChevronRight, BarChart3, Download
} from 'lucide-react';
import { exportTrainingMatrixExcel } from '../../services/trainingService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function TrainingDashboardTab({
  projects = [],
  employees = [],
  courses = [],
  complianceRecords = [],
  projectMetrics = [],
  onSelectProject,
  onMarkProjectCompleted,
  onNavigateToTab
}) {
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');

  // Overall KPIs
  const totalRequired = complianceRecords.length;
  const compliantCount = complianceRecords.filter(r => r.status === 'AVB').length;
  const expiringCount = complianceRecords.filter(r => r.status === 'REM').length;
  const expiredCount = complianceRecords.filter(r => r.status === 'EXP').length;
  const notTrainedCount = complianceRecords.filter(r => r.status === 'NOT_TRAINED').length;

  const overallComplianceRate = totalRequired > 0 ? Math.round((compliantCount / totalRequired) * 100) : 100;
  const activeEmployeesCount = employees.filter(e => e.status !== 'Resigned').length;

  // Filtered project data if user filters
  const currentMetric = useMemo(() => {
    if (selectedProjectId === 'ALL') return null;
    return projectMetrics.find(m => m.projectId === selectedProjectId);
  }, [selectedProjectId, projectMetrics]);

  return (
    <div className="space-y-6">
      {/* Project Selector & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Scope</div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="mt-0.5 text-sm font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-6"
            >
              <option value="ALL">All Projects & Offshore Locations (Overall)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projectNo || p.id} - {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {selectedProjectId !== 'ALL' && currentMetric?.status !== 'Completed' && (
            <button
              onClick={() => onMarkProjectCompleted(selectedProjectId)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl transition-all shadow-2xs"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Mark Completed
            </button>
          )}

          <button
            onClick={() => exportTrainingMatrixExcel({ employees, courses, complianceRecords, selectedProject: selectedProjectId })}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid with Themed Background Colors & Compact Sizing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Compliance Rate */}
        <div className="bg-gradient-to-br from-emerald-50/90 to-emerald-100/40 rounded-xl p-3.5 border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Target: 95%
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold text-emerald-950 tracking-tight">{overallComplianceRate}%</div>
            <div className="text-xs font-semibold text-emerald-800/90 mt-0.5">Overall Compliance</div>
            <div className="w-full h-1.5 rounded-full bg-emerald-200/60 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${overallComplianceRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Valid Certifications (AVB) */}
        <div className="bg-gradient-to-br from-sky-50/90 to-sky-100/40 rounded-xl p-3.5 border border-sky-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-sky-100/80 border border-sky-200 flex items-center justify-center text-sky-700">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
              AVB
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold text-sky-950 tracking-tight">{compliantCount}</div>
            <div className="text-xs font-semibold text-sky-800/90 mt-0.5">Valid Certifications</div>
            <div className="text-[10.5px] text-sky-600 font-medium mt-0.5">Ready for deployment</div>
          </div>
        </div>

        {/* Expiring in 90 Days (REM) */}
        <div
          className="bg-gradient-to-br from-amber-50/90 to-amber-100/40 rounded-xl p-3.5 border border-amber-200/80 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-amber-400 hover:shadow-xs transition-all"
          onClick={() => onNavigateToTab('alerts')}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              REM (&le; 90d)
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold text-amber-900 tracking-tight">{expiringCount}</div>
            <div className="text-xs font-semibold text-amber-800/90 mt-0.5">Expiring Soon</div>
            <div className="text-[10.5px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
              Refresher required <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Expired (EXP) */}
        <div
          className="bg-gradient-to-br from-rose-50/90 to-rose-100/40 rounded-xl p-3.5 border border-rose-200/80 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-rose-400 hover:shadow-xs transition-all"
          onClick={() => onNavigateToTab('alerts')}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-rose-100/80 border border-rose-200 flex items-center justify-center text-rose-700">
              <XCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              EXP
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold text-rose-900 tracking-tight">{expiredCount}</div>
            <div className="text-xs font-semibold text-rose-800/90 mt-0.5">Expired Certifications</div>
            <div className="text-[10.5px] text-rose-700 font-medium mt-0.5 flex items-center gap-1">
              Stop deployment <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Not Trained */}
        <div className="bg-gradient-to-br from-purple-50/90 to-purple-100/40 rounded-xl p-3.5 border border-purple-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-purple-100/80 border border-purple-200 flex items-center justify-center text-purple-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              GAP
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-bold text-purple-950 tracking-tight">{notTrainedCount}</div>
            <div className="text-xs font-semibold text-purple-800/90 mt-0.5">Missing Courses</div>
            <div className="text-[10.5px] text-purple-600 font-medium mt-0.5">Enrollment needed</div>
          </div>
        </div>
      </div>

      {/* Project Readiness Table / Bar Chart Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Project Training Readiness Matrix
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live qualification & mandatory certification % across offshore and onshore project teams
            </p>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Showing {projectMetrics.length} operational projects
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {projectMetrics.map(p => {
            const isSelected = selectedProjectId === p.projectId;
            const barColor = p.readinessPct >= 90 ? 'bg-emerald-500' : p.readinessPct >= 70 ? 'bg-amber-500' : 'bg-rose-500';
            const badgeClass = p.readinessPct >= 90
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : p.readinessPct >= 70
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200';

            return (
              <div
                key={p.projectId}
                className={clsx(
                  'p-5 transition-colors hover:bg-slate-50/70',
                  isSelected && 'bg-orange-50/40 border-l-4 border-orange-500'
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {p.projectNo}
                      </span>
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {p.projectName}
                      </span>
                      <span className="text-xs text-slate-400">
                        &bull; {p.clientName}
                      </span>
                      <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                        p.status === 'Completed' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-sky-50 text-sky-700 border-sky-200'
                      )}>
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                      <span><strong className="text-slate-700">{p.employeeCount}</strong> Assigned Personnel</span>
                      <span>&bull;</span>
                      <span><strong className="text-slate-700">{p.compliant}</strong> / {p.totalRequired} Valid Requirements</span>
                      {p.expired > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="text-rose-600 font-semibold">{p.expired} Expired</span>
                        </>
                      )}
                      {p.expiringSoon > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-600 font-semibold">{p.expiringSoon} Expiring soon</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Readiness Progress Bar */}
                  <div className="w-full lg:w-72 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-500">Readiness Score</span>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold border', badgeClass)}>
                        {p.readinessPct}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-500', barColor)}
                        style={{ width: `${p.readinessPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
