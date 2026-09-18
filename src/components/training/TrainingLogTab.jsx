import { useState, useMemo } from 'react';
import {
  FileText, Plus, Search, RotateCcw, CheckCircle2,
  Calendar, Award, Building2, User, AlertCircle, Info,
  ExternalLink, Filter, Ban, Download, Upload, FileSpreadsheet,
  Trash2, Sparkles, RefreshCw, UserPlus
} from 'lucide-react';
import { format, parseISO, addMonths } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  downloadTrainingLogTemplate,
  checkDuplicateLog,
  formatDisplayEmployeeId,
  compareEmployeeId,
  getNextEmployeeId,
} from '../../services/trainingService';
import { formatDate } from '../../utils/dateFormatter';
import TrainingExcelImportModal from './TrainingExcelImportModal';

export default function TrainingLogTab({
  logs = [],
  employees = [],
  courses = [],
  canManageTraining = false,
  onAddLog,
  onBatchAddLogs,
  onCancelLog,
  prefilledRecord = null,
  onClearPrefilled,
  onClearDemoLogs,
  onClearAllLogs,
  onResetDemoLogs,
  onAddEmployee,
  onAddCourse,
}) {
  const [showAddModal, setShowAddModal] = useState(canManageTraining && Boolean(prefilledRecord));
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoActionLoading, setDemoActionLoading] = useState(false);
  const [selectedLogToCancel, setSelectedLogToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [filterMode, setFilterMode] = useState('active'); // 'active', 'all', 'cancelled'
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add Employee state (inline modal helper)
  const [showQuickAddEmp, setShowQuickAddEmp] = useState(false);
  const [quickEmpForm, setQuickEmpForm] = useState({
    name: '',
    empNo: '',
    position: 'Instrumentation Technician',
    department: 'Operations',
  });
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const handleQuickAddEmployee = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quickEmpForm.name.trim()) {
      toast.error('Please enter employee name');
      return;
    }
    setIsQuickAdding(true);
    try {
      const userDefinedNo = quickEmpForm.empNo.trim() || getNextEmployeeId(employees);
      const newId = userDefinedNo;
      const payload = {
        ...quickEmpForm,
        id: newId,
        empNo: userDefinedNo,
        status: 'Active',
      };
      if (onAddEmployee) {
        await onAddEmployee(payload);
      }
      toast.success(`Added employee ${payload.name} (${payload.empNo}) successfully!`);
      setFormData(prev => ({ ...prev, employeeId: payload.id }));
      setShowQuickAddEmp(false);
      setQuickEmpForm({
        name: '',
        empNo: '',
        position: 'Instrumentation Technician',
        department: 'Operations',
      });
    } catch (err) {
      toast.error('Error adding employee: ' + (err.message || 'Failed'));
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    employeeId: prefilledRecord?.employeeId || '',
    courseId: prefilledRecord?.courseId || '',
    completionDate: format(new Date(), 'yyyy-MM-dd'),
    expiryDate: '',
    certNo: '',
    institute: '',
    remarks: '',
  });

  // Whenever prefilledRecord changes
  useMemo(() => {
    if (prefilledRecord && canManageTraining) {
      setFormData(prev => ({
        ...prev,
        employeeId: prefilledRecord.employeeId || prev.employeeId,
        courseId: prefilledRecord.courseId || prev.courseId,
      }));
      setShowAddModal(true);
    }
  }, [prefilledRecord, canManageTraining]);

  // Handle course change: auto calculate suggested expiry based on course validityMonths
  const handleCourseChange = (cid) => {
    const course = courses.find(c => c.id === cid);
    let newExpiry = '';
    if (course && course.validityMonths && formData.completionDate) {
      try {
        const compDate = parseISO(formData.completionDate);
        newExpiry = format(addMonths(compDate, course.validityMonths), 'yyyy-MM-dd');
      } catch (e) {
        console.warn(e);
      }
    }
    setFormData(prev => ({
      ...prev,
      courseId: cid,
      expiryDate: newExpiry || prev.expiryDate,
      institute: prev.institute || course?.provider || '',
    }));
  };

  const handleCompletionDateChange = (dateStr) => {
    const course = courses.find(c => c.id === formData.courseId);
    let newExpiry = '';
    if (course && course.validityMonths && dateStr) {
      try {
        const compDate = parseISO(dateStr);
        newExpiry = format(addMonths(compDate, course.validityMonths), 'yyyy-MM-dd');
      } catch (e) {
        console.warn(e);
      }
    }
    setFormData(prev => ({
      ...prev,
      completionDate: dateStr,
      expiryDate: newExpiry || prev.expiryDate,
    }));
  };

  const handleSubmitNewLog = async (e) => {
    e.preventDefault();
    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (!formData.courseId) {
      toast.error('Please select a course');
      return;
    }
    if (!formData.completionDate) {
      toast.error('Please provide completion date');
      return;
    }

    const emp = employees.find(e => e.id === formData.employeeId);
    const course = courses.find(c => c.id === formData.courseId);

    const logPayload = {
      ...formData,
      employeeName: emp?.name || 'Unknown',
      courseCode: course?.code || '—',
      courseName: course?.name || '—',
    };

    // Duplicate check prevention
    const dupCheck = checkDuplicateLog(logPayload, logs);
    if (dupCheck.isDuplicate) {
      toast.error(dupCheck.reason || 'Duplicate record detected! This training is already recorded.', {
        duration: 5000,
      });
      return;
    }

    try {
      await onAddLog(logPayload);
      toast.success('Training completion recorded successfully!');
      setShowAddModal(false);
      if (onClearPrefilled) onClearPrefilled();
      // Reset form
      setFormData({
        employeeId: '',
        courseId: '',
        completionDate: format(new Date(), 'yyyy-MM-dd'),
        expiryDate: '',
        certNo: '',
        institute: '',
        remarks: '',
      });
    } catch (err) {
      toast.error(err.message || 'Failed to record training');
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedLogToCancel) return;
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancelling this record');
      return;
    }

    try {
      await onCancelLog(selectedLogToCancel.id, cancelReason);
      toast.success('Training log soft-cancelled (marked void). Historical record preserved.');
      setShowCancelModal(false);
      setSelectedLogToCancel(null);
      setCancelReason('');
    } catch (err) {
      toast.error(err.message || 'Cancellation failed');
    }
  };

  // Check demo logs count
  const demoCount = useMemo(() => {
    return logs.filter(l => /^LOG-0\d\d$/.test(l.id)).length;
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs
      .filter(l => {
        if (filterMode === 'active' && l.cancelled) return false;
        if (filterMode === 'cancelled' && !l.cancelled) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchEmp = l.employeeName?.toLowerCase().includes(q) || l.employeeId?.toLowerCase().includes(q);
          const matchCourse = l.courseName?.toLowerCase().includes(q) || l.courseCode?.toLowerCase().includes(q);
          const matchCert = l.certNo?.toLowerCase().includes(q);
          if (!matchEmp && !matchCourse && !matchCert) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.recordedAt || b.completionDate) - new Date(a.recordedAt || a.completionDate));
  }, [logs, filterMode, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Instructions & Add Action */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Training Log (Append-Only Registry)
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Audit-Protected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Immutable log of all safety and qualification certificates. Historical entries cannot be altered or hard-deleted. Use <strong>Soft-Undo</strong> to void erroneous records while maintaining a clean audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manage Demo Data Button */}
          {canManageTraining && (
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              title="Manage Demo vs Real Data (Clear or Restore sample records)"
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/90 rounded-xl transition-all shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Demo Data Controls</span>
              {demoCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                  {demoCount}
                </span>
              )}
            </button>
          )}

          {/* Download Form Template Button */}
          <button
            type="button"
            onClick={() => {
              downloadTrainingLogTemplate({ courses, employees });
              toast.success('Excel Form Template downloaded');
            }}
            title="Download formatted Excel template for entering training data"
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Download Form (Excel)</span>
          </button>

          {canManageTraining ? (
            <>
              {/* Upload Filled Excel Button */}
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                title="Upload filled Excel file to import records (with duplicate prevention)"
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all shadow-2xs"
              >
                <Upload className="w-4 h-4 text-orange-600" />
                <span>Upload Excel File</span>
              </button>

              {/* Record Single Training */}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Training</span>
              </button>
            </>
          ) : (
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200">
              Read Only (Admin / Safety Only)
            </div>
          )}
        </div>
      </div>

      {/* Demo Records Notice Banner */}
      {demoCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs text-amber-900">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                <span>Displaying {demoCount} Demo Training Records</span>
                <span className="text-[10px] bg-amber-200/80 text-amber-900 font-semibold px-2 py-0.5 rounded-full">Sample Data</span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                These records are demonstration data for evaluating system workflows. Click <strong>Manage Demo Records</strong> to remove them or download the Excel template to import your organization&apos;s real training records.
              </p>
            </div>
          </div>
          {canManageTraining && (
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-200/80 hover:bg-amber-300/80 rounded-xl transition-all shadow-2xs whitespace-nowrap"
              >
                Manage Demo Data
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee, certificate #, or course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode('active')}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              filterMode === 'active'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            )}
          >
            Active Records ({logs.filter(l => !l.cancelled).length})
          </button>
          <button
            onClick={() => setFilterMode('cancelled')}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              filterMode === 'cancelled'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/60'
            )}
          >
            Voided / Cancelled ({logs.filter(l => l.cancelled).length})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              filterMode === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            )}
          >
            All Logs ({logs.length})
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No training logs found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Course Title</th>
                  <th className="py-3 px-4">Certificate #</th>
                  <th className="py-3 px-4">Trained Date</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Provider / Recorded By</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map(log => {
                  const isVoid = Boolean(log.cancelled);
                  // Find matched employee to show clean employee No if available
                  const matchedEmp = employees.find(e => e.id === log.employeeId || e.empNo === log.employeeId);
                  const displayEmpNo = matchedEmp?.empNo && matchedEmp.empNo !== log.employeeName && !matchedEmp.empNo.startsWith('emp-') && !matchedEmp.empNo.startsWith('EMP-') && matchedEmp.empNo.length < 20
                    ? matchedEmp.empNo
                    : (log.employeeId && !log.employeeId.startsWith('emp-') && !log.employeeId.startsWith('EMP-') && log.employeeId.length < 20
                        ? log.employeeId
                        : null);

                  return (
                    <tr
                      key={log.id}
                      className={clsx(
                        'hover:bg-slate-50/60 transition-colors',
                        isVoid && 'bg-rose-50/30 line-through opacity-75'
                      )}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isVoid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <Ban className="w-3 h-3 text-rose-600" />
                            VOIDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            VALID
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{log.employeeName}</div>
                        {displayEmpNo && (
                          <div className="text-[11px] text-slate-500 font-sans font-medium">{displayEmpNo}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 leading-snug">
                          {log.courseName || log.courseCode}
                        </div>
                        {log.courseCode && log.courseName && log.courseCode !== log.courseName && (
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Ref: <span className="font-mono text-slate-500">{log.courseCode}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-sans font-medium text-slate-700 whitespace-nowrap">
                        {log.certNo || '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-sans text-slate-600">
                        {formatDate(log.completionDate)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        {log.expiryDate ? (
                          <span className="text-slate-700 font-medium">{formatDate(log.expiryDate)}</span>
                        ) : (
                          <span className="text-slate-400 italic">No Expiry</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-700 truncate max-w-[160px]">{log.institute || '—'}</div>
                        <div className="text-[10.5px] text-slate-400">by {log.recordedBy || 'Admin'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isVoid ? (
                          canManageTraining ? (
                            <button
                              onClick={() => {
                                setSelectedLogToCancel(log);
                                setShowCancelModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all shadow-2xs"
                              title="Soft-cancel (Undo record with reason)"
                            >
                              <RotateCcw className="w-3 h-3 text-rose-600" />
                              Undo
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Valid</span>
                          )
                        ) : (
                          <span className="text-[11px] text-rose-600/80 italic" title={log.cancelReason}>
                            {log.cancelReason ? `Reason: ${log.cancelReason.slice(0, 20)}...` : 'Voided'}
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

      {/* Record New Training Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Record Training Completion</h3>
                  <p className="text-xs text-slate-400">Append new certificate details to immutable log</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  if (onClearPrefilled) onClearPrefilled();
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitNewLog} className="space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Personnel / Employee <span className="text-rose-500">*</span>
                  </label>
                  {onAddEmployee && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!showQuickAddEmp) {
                          const nextId = getNextEmployeeId(employees);
                          setQuickEmpForm(prev => ({ ...prev, empNo: nextId }));
                        }
                        setShowQuickAddEmp(!showQuickAddEmp);
                      }}
                      className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {showQuickAddEmp ? 'Close Quick Add Form' : '+ Quick Add Employee'}
                    </button>
                  )}
                </div>

                {showQuickAddEmp && (
                  <div className="mb-3 p-3 bg-orange-50/80 border border-orange-200 rounded-2xl space-y-2.5 animate-fade-in shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-950">
                        Add New Employee (Syncs Manpower &amp; Training)
                      </span>
                      <span className="text-[10.5px] text-orange-700">Will be selected automatically</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Somchai Prasert"
                          value={quickEmpForm.name}
                          onChange={(e) => setQuickEmpForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          Employee ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. PS-SKL-008 or ID from HR"
                          value={quickEmpForm.empNo}
                          onChange={(e) => setQuickEmpForm(prev => ({ ...prev, empNo: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-orange-500 font-sans"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10.5px] text-slate-500">
                        Position: {quickEmpForm.position}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowQuickAddEmp(false)}
                          className="px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200/60 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isQuickAdding || !quickEmpForm.name.trim()}
                          onClick={handleQuickAddEmployee}
                          className="px-3.5 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isQuickAdding ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Save Employee
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 font-sans"
                >
                  <option value="">-- Select Employee ({employees.length} registered) --</option>
                  {employees
                    .filter(e => e.status !== 'Resigned')
                    .slice()
                    .sort((a, b) => compareEmployeeId(a, b))
                    .map((emp, idx) => {
                      const displayId = formatDisplayEmployeeId(emp, idx + 1);
                      return (
                        <option key={emp.id} value={emp.id}>
                          {displayId} &bull; {emp.name} ({emp.position})
                        </option>
                      );
                    })}
                </select>
                <div className="text-[10.5px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Synced from Manpower roster. You can click &quot;+ Quick Add Employee&quot; above if person is not in the list.
                </div>
              </div>

              {/* Course Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Training Course <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} {course.code ? `(Ref: ${course.code})` : ''} {course.validityMonths ? `· ${course.validityMonths}m validity` : '· No Expiry'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Completion Date & Expiry Date Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Completion Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.completionDate}
                    onChange={(e) => handleCompletionDateChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Expiry Date (Auto-calculated)
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Certificate Number & Institute */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Certificate / License #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OPITO-TH-2025-012"
                    value={formData.certNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, certNo: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Training Provider / Center
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TSTC Songkhla"
                    value={formData.institute}
                    onChange={(e) => setFormData(prev => ({ ...prev, institute: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remarks / Practical Assessment Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or qualification level..."
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    if (onClearPrefilled) onClearPrefilled();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs"
                >
                  Save Training Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft-Cancel (Undo) Modal */}
      {showCancelModal && selectedLogToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Soft-Cancel Training Log</h3>
                <p className="text-xs text-slate-500">Record will be marked as Void, preserving audit history</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div><strong>Employee:</strong> {selectedLogToCancel.employeeName}</div>
              <div><strong>Course:</strong> {selectedLogToCancel.courseName || selectedLogToCancel.courseCode} {selectedLogToCancel.courseCode && <span className="text-slate-500 font-mono text-xs">(Ref: {selectedLogToCancel.courseCode})</span>}</div>
              <div><strong>Certificate #:</strong> {selectedLogToCancel.certNo || 'N/A'}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for cancellation <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Data entry error, wrong employee selected, or duplicate submission..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedLogToCancel(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Keep Record
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs"
              >
                Confirm Soft-Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal with Duplicate Prevention */}
      <TrainingExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        courses={courses}
        employees={employees}
        existingLogs={logs}
        onBatchAddLogs={onBatchAddLogs}
        onAddEmployee={onAddEmployee}
        onAddCourse={onAddCourse}
      />

      {/* Demo Data Management Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Training Records (Demo vs Real)</h3>
                  <p className="text-xs text-slate-500">Configure sample records or clear data to prepare for production</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Status */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Total records in system:</span>
                <span className="font-bold text-slate-800">{logs.length} records</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sample demo records:</span>
                <span className="font-bold text-amber-700">{demoCount} records</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>User-created / imported real records:</span>
                <span className="font-bold text-emerald-700">{Math.max(0, logs.length - demoCount)} records</span>
              </div>
            </div>

            {/* Actions List */}
            <div className="space-y-3">
              {/* Option 1: Clear Demo Only */}
              <div className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-white transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Trash2 className="w-4 h-4 text-amber-600" />
                    <span>1. Clear Demo Records Only</span>
                  </div>
                  <button
                    type="button"
                    disabled={demoCount === 0 || demoActionLoading}
                    onClick={async () => {
                      setDemoActionLoading(true);
                      try {
                        if (onClearDemoLogs) await onClearDemoLogs();
                        setShowDemoModal(false);
                      } finally {
                        setDemoActionLoading(false);
                      }
                    }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-2xs",
                      demoCount > 0
                        ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    Remove {demoCount} demo items
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Removes only the initial demo logs, <strong>retaining 100%</strong> of any real logs or employees you have created.
                </p>
              </div>

              {/* Option 2: Clear All */}
              <div className="p-4 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                    <Ban className="w-4 h-4 text-rose-600" />
                    <span>2. Clear All Training Logs</span>
                  </div>
                  <button
                    type="button"
                    disabled={logs.length === 0 || demoActionLoading}
                    onClick={async () => {
                      setDemoActionLoading(true);
                      try {
                        if (onClearAllLogs) await onClearAllLogs();
                        setShowDemoModal(false);
                      } catch (err) {
                        toast.error(err.message || 'Failed to clear logs');
                      } finally {
                        setDemoActionLoading(false);
                      }
                    }}
                    className={clsx(
                      "px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-2xs",
                      logs.length > 0
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    )}
                  >
                    Clear All ({logs.length})
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Wipes all training log records for a completely blank state.
                </p>
              </div>

              {/* Option 3: Restore Demo Data */}
              <div className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <RefreshCw className="w-4 h-4 text-slate-600" />
                    <span>3. Restore Demo Data</span>
                  </div>
                  <button
                    type="button"
                    disabled={demoActionLoading}
                    onClick={async () => {
                      setDemoActionLoading(true);
                      try {
                        if (onResetDemoLogs) await onResetDemoLogs();
                        setShowDemoModal(false);
                      } finally {
                        setDemoActionLoading(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    Restore Demo
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Restores default offshore training sample data for testing reports, alerts, and dashboards.
                </p>
              </div>
            </div>

            {/* Step-by-step Guide */}
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-2 text-emerald-950">
              <div className="font-bold flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Production Data Onboarding Steps:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-emerald-800 text-[11px] leading-relaxed">
                <li>Go to the <strong>Employees</strong> tab to register or review active crew and workers.</li>
                <li>Go to the <strong>Courses</strong> tab to add or verify required training courses.</li>
                <li>Click <strong>Download Form (Excel)</strong> to get the standard import template.</li>
                <li>Click <strong>Upload Excel File</strong> to bulk-import verified certificates (includes validation and duplicate protection).</li>
                <li>Or click <strong>+ Record New Training</strong> to record completions individually at any time.</li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
