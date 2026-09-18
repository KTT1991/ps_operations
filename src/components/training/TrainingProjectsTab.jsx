import { useState, useMemo } from 'react';
import {
  FolderKanban, Plus, Search, CheckCircle, CheckCircle2,
  Building2, Users, Calendar, ArrowUpRight, BarChart3
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function TrainingProjectsTab({
  projects = [],
  projectMetrics = [],
  canManageProjects = false,
  onAddProject,
  onMarkProjectCompleted,
  onSelectProjectForDashboard
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  const [form, setForm] = useState({
    projectNo: '',
    name: '',
    clientName: 'PTTEP',
    location: 'Offshore Gulf of Thailand',
    status: 'Active',
    startDate: '',
    endDate: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManageProjects) {
      toast.error('Access restricted: Only Admin or Base Manager can create projects');
      return;
    }
    if (!form.projectNo.trim() || !form.name.trim()) {
      toast.error('Project number and name are required');
      return;
    }

    const newId = form.projectNo.trim().toUpperCase();
    const payload = {
      ...form,
      id: newId,
      projectNo: newId,
    };

    try {
      await onAddProject(payload);
      toast.success(`Project ${payload.projectNo} created successfully!`);
      setShowAddModal(false);
      setForm({
        projectNo: '',
        name: '',
        clientName: 'PTTEP',
        location: 'Offshore Gulf of Thailand',
        status: 'Active',
        startDate: '',
        endDate: '',
      });
    } catch (err) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (p.projectNo || p.id)?.toLowerCase().includes(q);
        const matchName = p.name?.toLowerCase().includes(q);
        const matchClient = p.clientName?.toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchClient) return false;
      }
      return true;
    });
  }, [projects, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-orange-500" />
              Project Compliance & Mobilization Portfolio
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Operations Roster
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Track operational project rosters, mobilization statuses, and workforce competency health across offshore concessions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Project
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project number, name, or operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'Active', 'Preparing', 'Completed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map(proj => {
          const metric = projectMetrics.find(m => m.projectId === proj.id) || {
            employeeCount: 0,
            totalRequired: 0,
            compliant: 0,
            readinessPct: 100,
            expired: 0,
            expiringSoon: 0,
          };

          const isCompleted = proj.status === 'Completed';

          return (
            <div
              key={proj.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {proj.projectNo || proj.id}
                  </span>
                  <span className={clsx(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                    isCompleted
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  )}>
                    {proj.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-2.5 leading-snug">
                  {proj.name}
                </h3>

                <div className="text-xs text-slate-500 mt-1">
                  Client: <strong>{proj.clientName || 'PTTEP'}</strong> &bull; {proj.location || 'Offshore'}
                </div>

                {/* Readiness Bar */}
                <div className="mt-4 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Training Readiness</span>
                    <span className="font-bold text-slate-800">{metric.readinessPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        metric.readinessPct >= 90 ? 'bg-emerald-500' : metric.readinessPct >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                      )}
                      style={{ width: `${metric.readinessPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span>{metric.employeeCount} Personnel</span>
                    <span>{metric.compliant}/{metric.totalRequired} Valid</span>
                    {metric.expired > 0 && <span className="text-rose-600 font-semibold">{metric.expired} Exp</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectProjectForDashboard(proj.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  View Details &bull; Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                </button>

                {!isCompleted && (
                  <button
                    onClick={() => onMarkProjectCompleted(proj.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl transition-all shadow-2xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Create Operational Project</h3>
                  <p className="text-xs text-slate-400">Establish new offshore/onshore campaign</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PRJ-2025-004"
                  value={form.projectNo}
                  onChange={(e) => setForm(prev => ({ ...prev, projectNo: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-sans focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Platong Gas Field Annual Turnaround"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Client / Operator
                  </label>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm(prev => ({ ...prev, clientName: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Location / Platform
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
