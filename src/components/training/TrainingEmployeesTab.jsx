import { useState, useMemo, useRef } from 'react';
import {
  Users, Plus, Search, Filter, UserX, CheckCircle,
  FileText, Briefcase, Mail, Phone, Building2, AlertCircle, Edit2, X,
  Download, Upload, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  formatDisplayEmployeeId,
  compareEmployeeId,
  sortEmployees,
  cleanHrEmployeeId,
  downloadEmployeeMasterTemplate,
  parseAndBatchUpdateEmployeeIds,
} from '../../services/trainingService';

export default function TrainingEmployeesTab({
  employees = [],
  projects = [],
  canManageTraining = false,
  onAddEmployee,
  onUpdateEmployee,
  onMarkResigned,
  onViewEmployeeSummary
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('Active'); // 'Active', 'Resigned', 'ALL'
  const [sortBy, setSortBy] = useState('empId'); // 'empId', 'no', 'name', 'dept'
  const [sortDir, setSortDir] = useState('asc'); // 'asc', 'desc'
  const [idFilter, setIdFilter] = useState('ALL'); // 'ALL', 'HAS_ID', 'MISSING_ID'
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const fileInputRef = useRef(null);

  const handleDownloadTemplate = () => {
    try {
      downloadEmployeeMasterTemplate(employees);
      toast.success('Downloaded Employee ID Master Template (.xlsx)');
    } catch (err) {
      toast.error('Failed to download template: ' + err.message);
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBatch(true);
    try {
      const result = await parseAndBatchUpdateEmployeeIds(file, employees);
      toast.success(`Successfully updated Employee ID for ${result.updatedCount} personnel!`);
      if (result.skippedCount > 0) {
        toast(`Skipped ${result.skippedCount} rows without matching name or ID`, { icon: 'ℹ️' });
      }
      if (onUpdateEmployee && result.updatedEmployees.length > 0) {
        const first = result.updatedEmployees[0];
        const empObj = employees.find(emp => emp.id === first.id);
        if (empObj) await onUpdateEmployee(first.id, { ...empObj, empNo: first.empNo });
      }
    } catch (err) {
      toast.error('Failed to import IDs: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploadingBatch(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [employeeToResign, setEmployeeToResign] = useState(null);
  const [resignReason, setResignReason] = useState('');

  // Add Employee form
  const [form, setForm] = useState({
    name: '',
    nameEn: '',
    empNo: '',
    position: 'Instrumentation Technician',
    department: 'Operations',
    currentProject: '',
    email: '',
    phone: '',
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can register employees');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Please enter employee name');
      return;
    }

    const userDefinedNo = cleanHrEmployeeId(form.empNo);
    const payload = {
      ...form,
      empNo: userDefinedNo,
      status: 'Active',
      joinDate: format(new Date(), 'yyyy-MM-dd'),
    };

    try {
      await onAddEmployee(payload);
      toast.success(`Employee ${payload.name} added successfully!`);
      setShowAddModal(false);
      setForm({
        name: '',
        nameEn: '',
        empNo: '',
        position: 'Instrumentation Technician',
        department: 'Operations',
        currentProject: '',
        email: '',
        phone: '',
      });
    } catch (err) {
      toast.error(err.message || 'Failed to add employee');
    }
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    const cleanId = cleanHrEmployeeId(emp.empNo || emp.employeeId);
    setEditForm({
      name: emp.name || '',
      nameEn: emp.nameEn || '',
      empNo: cleanId,
      position: emp.position || 'Instrumentation Technician',
      department: emp.department || 'Operations',
      currentProject: emp.currentProject || '',
      email: emp.email || '',
      phone: emp.phone || '',
      status: emp.status || 'Active',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can update employees');
      return;
    }
    if (!editForm.name?.trim()) {
      toast.error('Please enter employee name');
      return;
    }
    setIsUpdating(true);
    try {
      if (onUpdateEmployee) {
        await onUpdateEmployee(editingEmployee.id, {
          ...editingEmployee,
          ...editForm,
          empNo: cleanHrEmployeeId(editForm.empNo),
        });
      }
      toast.success(`Updated ${editForm.name} successfully!`);
      setShowEditModal(false);
      setEditingEmployee(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update employee details');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmResign = async () => {
    if (!employeeToResign) return;
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can update employee status');
      return;
    }
    try {
      await onMarkResigned(employeeToResign.id, resignReason);
      toast.success(`${employeeToResign.name} has been marked as Resigned.`);
      setShowResignModal(false);
      setEmployeeToResign(null);
      setResignReason('');
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
  };

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      if (selectedStatus !== 'ALL' && (emp.status || 'Active') !== selectedStatus) return false;
      if (selectedProject !== 'ALL' && emp.currentProject !== selectedProject) return false;

      // Filter by Employee ID status
      if (idFilter === 'HAS_ID') {
        const hasId = !!cleanHrEmployeeId(emp.empNo || emp.employeeId);
        if (!hasId) return false;
      } else if (idFilter === 'MISSING_ID') {
        const hasId = !!cleanHrEmployeeId(emp.empNo || emp.employeeId);
        if (hasId) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.name?.toLowerCase().includes(q) || emp.nameEn?.toLowerCase().includes(q);
        const matchNo = emp.empNo?.toLowerCase().includes(q) || emp.id?.toLowerCase().includes(q);
        const matchPos = emp.position?.toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchPos) return false;
      }
      return true;
    });

    return sortEmployees(filtered, sortBy, sortDir);
  }, [employees, selectedStatus, selectedProject, searchQuery, idFilter, sortBy, sortDir]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Employee Training Directory
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Synced with Manpower ({employees.length})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Personnel directory synchronized automatically with the Manpower system to ensure consistent training records and project assignments across all operations. Use <strong>Mark Resigned</strong> to manage inactive personnel without losing historical certification records.
          </p>
        </div>

        {canManageTraining ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-xl transition-all cursor-pointer"
              title="Download Master Template Excel with Name and Employee ID columns"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Master Template</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadExcel}
              accept=".xlsx,.xls"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingBatch}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              title="Upload Excel to batch update Employee IDs by matching employee names"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isUploadingBatch ? 'Updating...' : 'Upload HR IDs (Excel)'}</span>
            </button>

            <button
              onClick={() => {
                setForm({
                  name: '',
                  nameEn: '',
                  empNo: '',
                  position: 'Instrumentation Technician',
                  department: 'Operations',
                  currentProject: '',
                  email: '',
                  phone: '',
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs flex-shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        ) : (
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200">
            Read Only (Admin / Safety Only)
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name, ID, position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
            />
          </div>

          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.projectNo || p.id} - {p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedStatus('Active')}
              className={clsx(
                'flex-1 py-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer',
                selectedStatus === 'Active'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              )}
            >
              Active ({employees.filter(e => (e.status || 'Active') === 'Active').length})
            </button>
            <button
              onClick={() => setSelectedStatus('Resigned')}
              className={clsx(
                'flex-1 py-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer',
                selectedStatus === 'Resigned'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60'
              )}
            >
              Resigned ({employees.filter(e => e.status === 'Resigned').length})
            </button>
          </div>
        </div>

        {/* Secondary controls: Sort By and ID Filter */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-500">Filter Employee ID:</span>
            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIdFilter('ALL')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer',
                  idFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                All ({employees.length})
              </button>
              <button
                type="button"
                onClick={() => setIdFilter('HAS_ID')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer',
                  idFilter === 'HAS_ID' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                With ID ({employees.filter(e => !!cleanHrEmployeeId(e.empNo || e.employeeId)).length})
              </button>
              <button
                type="button"
                onClick={() => setIdFilter('MISSING_ID')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer',
                  idFilter === 'MISSING_ID' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Pending ID ({employees.filter(e => !cleanHrEmployeeId(e.empNo || e.employeeId)).length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
            >
              <option value="empId">Employee ID (HR)</option>
              <option value="no">No. (Sequence)</option>
              <option value="name">Name (A-Z)</option>
              <option value="dept">Department & Position</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
              title={`Sort direction: currently ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((emp, idx) => {
          const isResigned = emp.status === 'Resigned';
          const displayEmpId = formatDisplayEmployeeId(emp);
          return (
            <div
              key={emp.id}
              className={clsx(
                'bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between transition-all',
                isResigned ? 'opacity-70 bg-slate-50/50' : 'hover:border-slate-300'
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                    <div className="text-xs text-slate-500">{emp.position}</div>
                  </div>
                  <span className={clsx(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    isResigned
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  )}>
                    {isResigned ? 'Resigned' : 'Active'}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">No.:</span>
                    <span className="font-sans font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      No. {idx + 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Employee ID:</span>
                    <span className="font-sans font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/70 flex items-center gap-1.5" title={`Employee ID: ${displayEmpId || 'Not Assigned'}`}>
                      {displayEmpId || (
                        <span className="text-slate-400 font-normal italic text-[11px]">Not Assigned</span>
                      )}
                      {canManageTraining && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="text-amber-700 hover:text-amber-900 p-0.5 rounded transition-colors cursor-pointer"
                          title="Edit Employee Information & ID"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span>{emp.department || 'Operations'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Project:</span>
                    <span className="font-sans font-medium text-orange-600">{emp.currentProject || 'Unassigned'}</span>
                  </div>
                  {emp.email && (
                    <div className="flex items-center justify-between truncate">
                      <span className="text-slate-400">Email:</span>
                      <span className="truncate max-w-[150px]">{emp.email}</span>
                    </div>
                  )}
                  {isResigned && emp.resignedDate && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-700 mt-2">
                      Resigned on {emp.resignedDate} {emp.resignedReason && `— ${emp.resignedReason}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onViewEmployeeSummary(emp.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  View Passport
                </button>

                <div className="flex items-center gap-1.5">
                  {canManageTraining && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(emp)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                      title="Edit Employee Information & ID"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}

                  {!isResigned && canManageTraining && (
                    <button
                      onClick={() => {
                        setEmployeeToResign(emp);
                        setShowResignModal(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
                      title="Mark Resigned (Safe status update, preserves history)"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Resign
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add New Employee</h3>
                  <p className="text-xs text-slate-400">Register employee for workforce training tracking</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Somchai Wiriyaporn"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-slate-400 font-normal">(HR Employee ID - optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PS-SKL-008 or HR ID"
                    value={form.empNo}
                    onChange={(e) => setForm(prev => ({ ...prev, empNo: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 font-sans"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Assigned company Employee ID. Can be left empty or updated anytime.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Position <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.position}
                    onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Project
                </label>
                <select
                  value={form.currentProject}
                  onChange={(e) => setForm(prev => ({ ...prev, currentProject: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                >
                  <option value="">-- Unassigned (Base Pool) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.projectNo || p.id} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="name@ogsops.com"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+66-8x-xxx-xxxx"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
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
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Resigned Modal */}
      {showResignModal && employeeToResign && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Mark Employee as Resigned</h3>
                <p className="text-xs text-slate-500">Record remains preserved in audit trail</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              Are you sure you want to mark <strong>{employeeToResign.name}</strong> ({employeeToResign.position}) as resigned? They will no longer appear on active compliance alert lists.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason / Remarks (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Completed contract, overseas transfer..."
                value={resignReason}
                onChange={(e) => setResignReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResignModal(false);
                  setEmployeeToResign(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResign}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs"
              >
                Confirm Resignation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Edit Employee Details</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEmployee(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-slate-400 font-normal">(HR Employee ID - optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.empNo}
                    onChange={(e) => setEditForm({ ...editForm, empNo: e.target.value })}
                    placeholder="e.g. PS-SKL-001 or HR ID"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500 font-sans font-semibold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Assigned company Employee ID. Can be left empty or updated anytime.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name (Secondary / Local)
                  </label>
                  <input
                    type="text"
                    value={editForm.nameEn}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Position *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Project
                  </label>
                  <select
                    value={editForm.currentProject}
                    onChange={(e) => setEditForm({ ...editForm, currentProject: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500"
                  >
                    <option value="">-- Unassigned / Pool --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectNo || p.id} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employment Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Resigned">Resigned</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
