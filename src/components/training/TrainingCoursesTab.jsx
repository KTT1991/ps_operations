import { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Edit2, Trash2, RotateCcw,
  CheckCircle2, Clock, ShieldCheck, Tag, ExternalLink, Lock,
  Database, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function TrainingCoursesTab({
  courses = [],
  onSaveCourse,
  onDeleteCourse,
  onClearDemoCourses,
  onClearAllCourses,
  onResetDemoCourses,
  onOpenDataManagement,
  userRole = 'admin',
  canManageTraining = false,
  isAdminOrHr = false
}) {
  const canEdit = canManageTraining || isAdminOrHr;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [deletingCourseId, setDeletingCourseId] = useState(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'Offshore Safety',
    validityMonths: 24,
    provider: '',
    description: '',
    active: true,
  });

  const categories = [
    'Offshore Safety',
    'Process Safety',
    'Technical',
    'Workplace Safety',
    'Lifting Operations',
    'Medical Compliance',
    'Operational'
  ];

  const handleOpenAdd = () => {
    if (!canEdit) {
      toast.error('Access restricted: Only Admin or Safety Officer can register new courses');
      return;
    }
    setEditingCourse(null);
    setForm({
      code: '',
      name: '',
      category: 'Offshore Safety',
      validityMonths: 24,
      provider: 'Approved Training Center (Songkhla)',
      description: '',
      active: true,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (course) => {
    if (!canEdit) {
      toast.error('Access restricted: Only Admin or Safety Officer can modify courses');
      return;
    }
    setEditingCourse(course);
    setForm({
      code: course.code,
      name: course.name,
      category: course.category || 'Offshore Safety',
      validityMonths: course.validityMonths || 0,
      provider: course.provider || '',
      description: course.description || '',
      active: course.active !== false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Course code and title are required');
      return;
    }

    const payload = {
      id: editingCourse?.id || `CRS-${Date.now()}`,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      validityMonths: Number(form.validityMonths) || 0,
      provider: form.provider.trim(),
      description: form.description.trim(),
      active: form.active,
    };

    try {
      await onSaveCourse(payload);
      toast.success(editingCourse ? 'Course updated!' : 'Course registered successfully!');
      setShowModal(false);
    } catch (err) {
      toast.error(err.message || 'Save failed');
    }
  };

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = c.code?.toLowerCase().includes(q);
        const matchName = c.name?.toLowerCase().includes(q);
        const matchProvider = c.provider?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchProvider) return false;
      }
      return true;
    });
  }, [courses, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-500" />
              Course Catalog & Accreditation Registry
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Admin & HR Controlled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Standard certifications recognized across offshore rigs, supply bases, and production platforms. Defines default renewal cycles and accredited institutions.
          </p>
        </div>

        {canEdit ? (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {onOpenDataManagement && (
              <button
                type="button"
                onClick={onOpenDataManagement}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                title="Manage and reset training data"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Data Tools & Reset</span>
              </button>
            )}
            {courses.length === 0 && onResetDemoCourses && (
              <button
                type="button"
                onClick={async () => {
                  await onResetDemoCourses();
                  toast.success('Restored 12 standard courses successfully');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                title="Restore 12 standard safety courses"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore 12 Courses</span>
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs flex-shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Course
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs border border-slate-200">
            <Lock className="w-3.5 h-3.5" />
            Read Only (Admin / Safety Only)
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by course code, title, or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
          >
            <option value="ALL">All Categories ({courses.length})</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Courses */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            {courses.length === 0 ? 'No courses in catalog' : 'No courses match the current search'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {courses.length === 0
              ? 'Click "Add New Course" to define company courses, or click "Restore 12 Courses" to load standard industry safety courses.'
              : 'Try adjusting your search keywords or filter category.'}
          </p>
          {courses.length === 0 && canEdit && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                + Add New Course
              </button>
              {onResetDemoCourses && (
                <button
                  type="button"
                  onClick={async () => {
                    await onResetDemoCourses();
                    toast.success('Restored 12 standard courses successfully');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Restore 12 Courses
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(c => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {c.category}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                    Ref: {c.code}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mt-2.5 leading-snug">
                  {c.name}
                </h3>

                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {c.description || 'No detailed syllabus specified.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Validity Period:</span>
                    <span className="font-semibold text-slate-800">
                      {c.validityMonths > 0 ? `${c.validityMonths} months (${c.validityMonths / 12} yrs)` : 'Permanent / No Expiry'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between truncate">
                    <span className="text-slate-400">Accredited Center:</span>
                    <span className="truncate max-w-[170px]">{c.provider || '—'}</span>
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {deletingCourseId === c.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-rose-600 font-semibold">Delete course?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (onDeleteCourse) {
                            await onDeleteCourse(c.id);
                            toast.success(`Deleted course ${c.name}`);
                          }
                          setDeletingCourseId(null);
                        }}
                        className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCourseId(null)}
                        className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    onDeleteCourse ? (
                      <button
                        type="button"
                        onClick={() => setDeletingCourseId(c.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : <div />
                  )}

                  <button
                    onClick={() => handleOpenEdit(c)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    Edit Course
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Course Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingCourse ? 'Edit Course Record' : 'Register New Course'}
                  </h3>
                  <p className="text-xs text-slate-400">Master course registry and accreditation metadata</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Course Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BOSIET, H2S-01"
                    value={form.code}
                    onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-sans focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Course Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basic Offshore Safety Induction & Emergency Training"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Validity (Months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={form.validityMonths}
                    onChange={(e) => setForm(prev => ({ ...prev, validityMonths: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400">Enter 0 for permanent / no expiry</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Accredited Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OPITO / TSTC Songkhla"
                    value={form.provider}
                    onChange={(e) => setForm(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Syllabus Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Course scope, practical modules, PPE requirements..."
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
