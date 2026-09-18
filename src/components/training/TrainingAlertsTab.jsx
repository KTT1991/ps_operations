import { useState, useMemo } from 'react';
import {
  AlertTriangle, XCircle, Clock, ShieldAlert, Search,
  Filter, CheckCircle2, Calendar, User, Briefcase,
  ChevronRight, ArrowUpDown, PlusCircle
} from 'lucide-react';
import clsx from 'clsx';
import { formatDate } from '../../utils/dateFormatter';

export default function TrainingAlertsTab({
  complianceRecords = [],
  projects = [],
  courses = [],
  canManageTraining = false,
  onOpenLogModal
}) {
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('URGENT'); // 'URGENT', 'EXP', 'REM', 'NOT_TRAINED', 'ALL'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set();
    courses.forEach(c => { if (c.category) set.add(c.category); });
    return Array.from(set);
  }, [courses]);

  // Filter and sort by urgency:
  // 1. EXP (Expired) - daysRemaining most negative
  // 2. NOT_TRAINED
  // 3. REM (Expiring soon) - daysRemaining lowest
  // Note: complianceRecords already excludes Resigned employees by computeComplianceMatrix
  const filteredRecords = useMemo(() => {
    return complianceRecords
      .filter(r => {
        // Exclude resigned employees just in case
        if (r.employeeStatus === 'Resigned') return false;

        // Project filter
        if (selectedProject !== 'ALL' && r.projectId !== selectedProject) return false;

        // Category filter
        if (selectedCategory !== 'ALL' && r.courseCategory !== selectedCategory) return false;

        // Status filter
        if (selectedStatus === 'URGENT') {
          if (r.status === 'AVB') return false; // Show only EXP, REM, NOT_TRAINED
        } else if (selectedStatus !== 'ALL') {
          if (r.status !== selectedStatus) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchEmp = r.employeeName?.toLowerCase().includes(q);
          const matchPos = r.employeePosition?.toLowerCase().includes(q);
          const matchCourse = r.courseName?.toLowerCase().includes(q) || r.courseCode?.toLowerCase().includes(q);
          if (!matchEmp && !matchPos && !matchCourse) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const priority = { EXP: 1, NOT_TRAINED: 2, REM: 3, AVB: 4 };
        const pDiff = (priority[a.status] || 99) - (priority[b.status] || 99);
        if (pDiff !== 0) return pDiff;

        // For EXP: most overdue first (lowest daysRemaining)
        // For REM: closest expiry first (lowest daysRemaining)
        if (a.daysRemaining !== null && b.daysRemaining !== null) {
          return a.daysRemaining - b.daysRemaining;
        }
        return 0;
      });
  }, [complianceRecords, selectedProject, selectedStatus, selectedCategory, searchQuery]);

  const expCount = complianceRecords.filter(r => r.status === 'EXP').length;
  const remCount = complianceRecords.filter(r => r.status === 'REM').length;
  const notTrainedCount = complianceRecords.filter(r => r.status === 'NOT_TRAINED').length;

  return (
    <div className="space-y-6">
      {/* Filters & Search Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Compliance Action Items & Expiry Alerts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized list of expired qualifications, 90-day expiry reminders, and missing matrix requirements
            </p>
          </div>

          {/* Quick status counters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedStatus('EXP')}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                selectedStatus === 'EXP'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70'
              )}
            >
              <XCircle className="w-3.5 h-3.5" />
              Expired ({expCount})
            </button>
            <button
              onClick={() => setSelectedStatus('REM')}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                selectedStatus === 'REM'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              Due in &le;90d ({remCount})
            </button>
            <button
              onClick={() => setSelectedStatus('NOT_TRAINED')}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                selectedStatus === 'NOT_TRAINED'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/70'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Missing Matrix ({notTrainedCount})
            </button>
            <button
              onClick={() => setSelectedStatus('URGENT')}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                selectedStatus === 'URGENT'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              )}
            >
              All Actionable ({expCount + remCount + notTrainedCount})
            </button>
          </div>
        </div>

        {/* Search and Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, title, course code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
            />
          </div>

          {/* Project dropdown */}
          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projectNo || p.id} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
            >
              <option value="ALL">All Course Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Clear filter button */}
          <div className="flex items-center justify-end">
            <span className="text-xs text-slate-400">
              Found <strong className="text-slate-700">{filteredRecords.length}</strong> items
            </span>
          </div>
        </div>
      </div>

      {/* Alerts Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">No Compliance Alerts Matching Criteria</div>
            <div className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All personnel meet mandatory qualification criteria under this filter, or no records were found.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Urgency & Status</th>
                  <th className="py-3 px-4">Personnel</th>
                  <th className="py-3 px-4">Required Course</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Expiry / Remaining</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRecords.map(item => {
                  let statusBadge = null;
                  let urgencyIndicator = null;

                  if (item.status === 'EXP') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        EXPIRED
                      </span>
                    );
                    urgencyIndicator = 'border-l-4 border-rose-500 bg-rose-50/20';
                  } else if (item.status === 'REM') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        EXPIRING SOON
                      </span>
                    );
                    urgencyIndicator = 'border-l-4 border-amber-400 bg-amber-50/20';
                  } else if (item.status === 'NOT_TRAINED') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                        <AlertTriangle className="w-3 h-3 text-purple-600" />
                        NOT TRAINED
                      </span>
                    );
                    urgencyIndicator = 'border-l-4 border-purple-400 bg-purple-50/20';
                  } else {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        VALID (AVB)
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className={clsx('hover:bg-slate-50/60 transition-colors', urgencyIndicator)}>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {statusBadge}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 text-sm">{item.employeeName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{item.employeePosition}</span>
                          {item.employeeId && item.employeeId.length <= 15 && !/^[A-Za-z0-9_-]{16,}$/.test(item.employeeId) && !item.employeeId.startsWith('emp_') && (
                            <>
                              <span className="text-slate-300">&bull;</span>
                              <span className="text-slate-500 font-sans font-medium">{item.employeeId}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 leading-snug">
                          {item.courseName || item.courseCode}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          {item.courseCode && item.courseName && item.courseCode !== item.courseName && (
                            <span>Ref: <span className="font-mono text-slate-500">{item.courseCode}</span></span>
                          )}
                          {item.courseCategory && (
                            <span>&bull; {item.courseCategory}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-sans text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {item.projectId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === 'NOT_TRAINED' ? (
                          <span className="text-slate-400 italic">No record found</span>
                        ) : item.status === 'EXP' ? (
                          <div>
                            <div className="font-semibold text-rose-600">
                              Expired {Math.abs(item.daysRemaining)} days ago
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans">{formatDate(item.expiryDate)}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-amber-700">
                              Expires in {item.daysRemaining} days
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans">{formatDate(item.expiryDate)}</div>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {canManageTraining ? (
                          <button
                            onClick={() => onOpenLogModal({
                              employeeId: item.employeeId,
                              courseId: item.courseId,
                              courseCode: item.courseCode,
                              courseName: item.courseName,
                            })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100/80 border border-orange-200 rounded-xl transition-all shadow-2xs"
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-orange-600" />
                            Record Training
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">
                            Admin / Safety Only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
