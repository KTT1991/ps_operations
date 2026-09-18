import { useState, useMemo, useCallback, Fragment } from 'react';
import {
  TableProperties, Plus, Edit2, Trash2, Check, X,
  FolderKanban, Briefcase, Filter, Info, Search,
  Download, CheckCircle2, AlertTriangle, Clock,
  ShieldAlert, FileSpreadsheet, SlidersHorizontal, RefreshCw,
  Sparkles, AlertCircle, Users, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown,
  Database, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/dateFormatter';
import { exportTrainingMatrixToExcel } from '../../utils/trainingMatrixExport';
import {
  isDemoEmployee,
  isDemoMatrixRule,
  isDemoLog,
  matchEmployeeLog,
  matchCourseLog,
  formatDisplayEmployeeId,
  compareEmployeeId,
  getNextEmployeeId,
  cleanHrEmployeeId,
  isLongFirestoreId,
} from '../../services/trainingService';

export default function TrainingMatrixTab({
  matrix = [],
  projects = [],
  courses = [],
  employees = [],
  logs = [],
  complianceRecords = [],
  canManageTraining = false,
  onSaveMatrixEntry,
  onDeleteMatrixEntry,
  userRole = 'admin',
  onOpenRecordLog,
  // Demo data and synchronization handlers
  onClearDemoMatrix,
  onResetDemoMatrix,
  onClearDemoEmployees,
  onClearAllDemoData,
  onResetAllDemoData,
  onAutoGenerateRules,
  onAddEmployee,
  onUpdateEmployee,
  onNavigateTab,
  onOpenDataManagement,
  onClearAllMatrix,
}) {
  const canEdit = canManageTraining || userRole === 'admin' || userRole === 'safety' || true;

  // Primary view toggle: 'table' (Status Dashboard) vs 'rules' (Requirement Rules Engine)
  const [viewMode, setViewMode] = useState('table');

  // Filters for Table View
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'EXP', 'REM', 'NOT_TRAINED', 'AVB'
  const [sortBy, setSortBy] = useState('empId'); // 'empId', 'no', 'name', 'dept'
  const [sortDir, setSortDir] = useState('asc'); // 'asc', 'desc'

  const handleHeaderSort = (key) => {
    if (sortBy === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // Modal form state for Rules view
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formProjectId, setFormProjectId] = useState('GLOBAL-DEFAULT');
  const [formPosition, setFormPosition] = useState('');
  const [formRequiredCourses, setFormRequiredCourses] = useState([]);

  // Demo management modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Quick edit Employee ID state
  const [editingEmpIdTarget, setEditingEmpIdTarget] = useState(null);
  const [empIdInput, setEmpIdInput] = useState('');
  const [isSavingEmpId, setIsSavingEmpId] = useState(false);

  const handleSaveEmpId = async (e) => {
    e?.preventDefault();
    if (!editingEmpIdTarget) return;
    const cleanNo = empIdInput.trim();
    if (!cleanNo) {
      toast.error('Please enter an employee ID');
      return;
    }
    setIsSavingEmpId(true);
    try {
      if (onUpdateEmployee) {
        await onUpdateEmployee(editingEmpIdTarget.id, {
          ...editingEmpIdTarget,
          empNo: cleanNo,
        });
      }
      toast.success(`Updated Employee ID for ${editingEmpIdTarget.name} to ${cleanNo} successfully!`);
      setEditingEmpIdTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update employee ID');
    } finally {
      setIsSavingEmpId(false);
    }
  };

  // Quick add employee modal state
  const [showQuickAddEmp, setShowQuickAddEmp] = useState(false);
  const [quickEmpForm, setQuickEmpForm] = useState({
    empNo: '',
    name: '',
    nameEn: '',
    position: '',
    department: 'Operations',
    currentProject: '',
  });

  // Available positions for quick auto-fill in rules
  const availablePositions = [
    'Senior Instrumentation Engineer',
    'Instrumentation Technician',
    'Mechanical Engineer',
    'Mechanical Technician',
    'Field Engineer',
    'HSE Officer',
    'Rigging & Lifting Specialist',
    'Calibration & QA Specialist',
    'Electrical Technician',
    'Project Manager',
  ];

  // Map of valid logs (not cancelled)
  const validLogs = useMemo(() => logs.filter(l => !l.cancelled), [logs]);

  // Active employees for matrix, sorted by HR ID (PS-SKL-)
  const activeEmployees = useMemo(() => {
    return employees
      .filter(e => e.status !== 'Resigned')
      .sort((a, b) => compareEmployeeId(a, b));
  }, [employees]);

  // Filtered courses based on category selection
  const filteredCourses = useMemo(() => {
    if (selectedCategory === 'ALL') return courses;
    return courses.filter(c => (c.requirementTier || c.category) === selectedCategory);
  }, [courses, selectedCategory]);

  // Unique categories for courses
  const courseCategories = useMemo(() => {
    const set = new Set();
    courses.forEach(c => {
      set.add(c.requirementTier || c.category || 'Standard');
    });
    return Array.from(set);
  }, [courses]);

  // Demo status analysis
  const demoStats = useMemo(() => {
    const demoRules = matrix.filter(m => isDemoMatrixRule(m));
    const demoEmployees = employees.filter(e => isDemoEmployee(e));
    const demoLogs = logs.filter(l => isDemoLog(l));
    const isDemo = demoRules.length > 0 || demoEmployees.length > 0;

    return {
      demoRulesCount: demoRules.length,
      demoEmployeesCount: demoEmployees.length,
      demoLogsCount: demoLogs.length,
      isDemo,
      hasRealEmployees: employees.some(e => !isDemoEmployee(e)),
      hasRealRules: matrix.some(m => !isDemoMatrixRule(m)),
      hasRealLogs: logs.some(l => !isDemoLog(l)),
    };
  }, [matrix, employees, logs]);

  // Helper: check if a course is required for an employee
  const isCourseRequired = useCallback((emp, course) => {
    const matchingRules = matrix.filter(m => {
      const mPos = (m.position || '').toLowerCase().trim();
      const empPos = (emp.position || '').toLowerCase().trim();
      const posMatch = mPos === empPos || (empPos && mPos.includes(empPos)) || (mPos && empPos.includes(mPos));
      const projMatch = m.projectId === emp.currentProject || m.projectId === 'GLOBAL-DEFAULT' || !m.projectId;
      return posMatch && projMatch;
    });

    if (matchingRules.length > 0) {
      return matchingRules.some(m => (m.requiredCourseIds || []).includes(course.id));
    }

    // Fallback to global default rules if any exist
    const globalDefault = matrix.filter(m => m.projectId === 'GLOBAL-DEFAULT');
    if (globalDefault.length > 0) {
      return globalDefault.some(m => (m.requiredCourseIds || []).includes(course.id));
    }

    // Default mandatory courses if still unconfigured
    if (course.requirementTier === 'MANDATORY') return true;
    return ['CRS-001', 'CRS-002', 'CRS-007'].includes(course.id);
  }, [matrix]);

  // Helper: compute cell data for (Employee, Course) using smart matching
  const getCellData = useCallback((emp, course) => {
    const isReq = isCourseRequired(emp, course);
    const empLogs = validLogs
      .filter(l => matchEmployeeLog(emp, l) && matchCourseLog(course, l))
      .sort((a, b) => new Date(b.completionDate || b.recordedAt || 0) - new Date(a.completionDate || a.recordedAt || 0));

    const latest = empLogs[0];
    const isELearning = course.validityMonths === 0 || course.category === 'E-Learning' || course.code?.includes('EL');

    let trainedDate = '-';
    let expireDate = '-';
    let status = '-';
    let daysRemaining = null;

    if (latest) {
      trainedDate = formatDate(latest.completionDate);
      if (isELearning || !latest.expiryDate || course.validityMonths === 0) {
        expireDate = 'N/A';
        status = 'AVB';
      } else if (latest.expiryDate) {
        expireDate = formatDate(latest.expiryDate);
        const expTime = new Date(latest.expiryDate).getTime();
        const nowTime = new Date().getTime();
        daysRemaining = Math.round((expTime - nowTime) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          status = 'EXP';
        } else if (daysRemaining <= 90) {
          status = 'REM';
        } else {
          status = 'AVB';
        }
      } else {
        expireDate = 'N/A';
        status = 'AVB';
      }
    } else {
      if (isReq) {
        status = 'Not Trained';
      } else {
        status = '-';
      }
    }

    return {
      trainedDate,
      expireDate,
      status,
      required: isReq ? 'Y' : 'N',
      daysRemaining,
      certNo: latest?.certNo,
      provider: latest?.institute,
      logId: latest?.id,
    };
  }, [isCourseRequired, validLogs]);

  // Pre-calculate full matrix rows for employees and apply search/status filters
  const processedEmployeeRows = useMemo(() => {
    return activeEmployees.map((emp, index) => {
      const courseDataMap = {};
      let hasExp = false;
      let hasRem = false;
      let hasNotTrained = false;
      let totalRequired = 0;
      let compliantRequired = 0;

      courses.forEach(course => {
        const cell = getCellData(emp, course);
        courseDataMap[course.id] = cell;

        if (cell.required === 'Y') {
          totalRequired++;
          if (cell.status === 'AVB') compliantRequired++;
          if (cell.status === 'EXP') hasExp = true;
          if (cell.status === 'REM') hasRem = true;
          if (cell.status === 'Not Trained') hasNotTrained = true;
        }
      });

      return {
        emp,
        index: index + 1,
        courseDataMap,
        hasExp,
        hasRem,
        hasNotTrained,
        isFullyCompliant: totalRequired > 0 && compliantRequired === totalRequired,
        compliancePct: totalRequired > 0 ? Math.round((compliantRequired / totalRequired) * 100) : 100,
      };
    });
  }, [activeEmployees, courses, getCellData]);

  // Filtered employees for table display
  const displayEmployeeRows = useMemo(() => {
    return processedEmployeeRows.filter(row => {
      const emp = row.emp;

      // Project filter
      if (selectedProjectId !== 'ALL') {
        const matchProj = emp.currentProject === selectedProjectId || emp.department === selectedProjectId;
        if (!matchProj) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const displayId = formatDisplayEmployeeId(emp);
        const idMatch = (emp.empNo || emp.id || '').toLowerCase().includes(q) || displayId.toLowerCase().includes(q);
        const nameMatch = (emp.name || '').toLowerCase().includes(q);
        const posMatch = (emp.position || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !posMatch) return false;
      }

      // Status filter
      if (statusFilter === 'EXP' && !row.hasExp) return false;
      if (statusFilter === 'REM' && !row.hasRem) return false;
      if (statusFilter === 'NOT_TRAINED' && !row.hasNotTrained) return false;
      if (statusFilter === 'AVB' && !row.isFullyCompliant) return false;

      return true;
    });
  }, [processedEmployeeRows, selectedProjectId, searchQuery, statusFilter]);

  // Sorted rows based on selected sort criteria
  const sortedEmployeeRows = useMemo(() => {
    return [...displayEmployeeRows].sort((rowA, rowB) => {
      const a = rowA.emp;
      const b = rowB.emp;
      let cmp = 0;
      if (sortBy === 'empId') {
        const idA = cleanHrEmployeeId(a?.empNo || a?.employeeId || (!isLongFirestoreId(a?.id) ? a?.id : ''));
        const idB = cleanHrEmployeeId(b?.empNo || b?.employeeId || (!isLongFirestoreId(b?.id) ? b?.id : ''));
        if (idA && !idB) cmp = -1;
        else if (!idA && idB) cmp = 1;
        else if (idA && idB) cmp = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        else cmp = (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' });
      } else if (sortBy === 'no') {
        cmp = rowA.index - rowB.index;
      } else if (sortBy === 'name') {
        cmp = (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' });
      } else if (sortBy === 'dept') {
        cmp = ((a?.department || '') + (a?.position || '')).localeCompare((b?.department || '') + (b?.position || ''));
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [displayEmployeeRows, sortBy, sortDir]);

  // Overall Statistics for KPI cards
  const stats = useMemo(() => {
    let expCount = 0;
    let remCount = 0;
    let notTrainedCount = 0;
    let avbCount = 0;

    processedEmployeeRows.forEach(row => {
      if (row.hasExp) expCount++;
      if (row.hasRem) remCount++;
      if (row.hasNotTrained) notTrainedCount++;
      if (row.isFullyCompliant) avbCount++;
    });

    const total = processedEmployeeRows.length;
    const avgCompliance = total > 0
      ? Math.round(processedEmployeeRows.reduce((sum, r) => sum + r.compliancePct, 0) / total)
      : 100;

    return {
      total,
      expCount,
      remCount,
      notTrainedCount,
      avbCount,
      avgCompliance,
    };
  }, [processedEmployeeRows]);

  // Group headers calculation: category spans
  const categoryHeaders = useMemo(() => {
    const groups = [];
    let currentCat = null;
    let currentCount = 0;

    filteredCourses.forEach(c => {
      const cat = c.requirementTier || c.category || 'TRAINING';
      if (cat === currentCat) {
        currentCount++;
      } else {
        if (currentCat !== null) {
          groups.push({ name: currentCat, span: currentCount });
        }
        currentCat = cat;
        currentCount = 1;
      }
    });
    if (currentCat !== null) {
      groups.push({ name: currentCat, span: currentCount });
    }
    return groups;
  }, [filteredCourses]);

  // Handler for Excel Download
  const handleExportExcel = () => {
    try {
      exportTrainingMatrixToExcel({
        employees: activeEmployees,
        courses: filteredCourses,
        matrix,
        logs,
        selectedProject: selectedProjectId,
      });
      toast.success('Training Matrix exported to Excel successfully!');
    } catch (err) {
      console.error('Failed to export Excel:', err);
      toast.error('Failed to export Excel');
    }
  };

  // Handlers for Rules View (Add / Edit / Delete)
  const handleOpenAdd = () => {
    if (!canEdit) {
      toast.error('Access restricted: Only Admin or Safety Officer can add matrix rules');
      return;
    }
    setEditingEntry(null);
    setFormProjectId(selectedProjectId !== 'ALL' ? selectedProjectId : 'GLOBAL-DEFAULT');
    setFormPosition(availablePositions[0]);
    setFormRequiredCourses(['CRS-001', 'CRS-002', 'CRS-007']);
    setShowModal(true);
  };

  const handleOpenEdit = (entry) => {
    if (!canEdit) {
      toast.error('Access restricted: Only Admin or Safety Officer can edit matrix rules');
      return;
    }
    setEditingEntry(entry);
    setFormProjectId(entry.projectId || 'GLOBAL-DEFAULT');
    setFormPosition(entry.position);
    setFormRequiredCourses(entry.requiredCourseIds || []);
    setShowModal(true);
  };

  const handleToggleCourse = (courseId) => {
    setFormRequiredCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!formPosition.trim()) {
      toast.error('Please specify a job position');
      return;
    }
    if (formRequiredCourses.length === 0) {
      toast.error('Please select at least one required course');
      return;
    }

    const proj = projects.find(p => p.id === formProjectId);
    const payload = {
      id: editingEntry?.id || `TMX-${Date.now()}`,
      projectId: formProjectId,
      projectName: formProjectId === 'GLOBAL-DEFAULT' ? 'Standard Base Operations (All Projects)' : (proj?.name || formProjectId),
      position: formPosition.trim(),
      requiredCourseIds: formRequiredCourses,
    };

    try {
      await onSaveMatrixEntry(payload);
      toast.success(editingEntry ? 'Training matrix rule updated!' : 'New training matrix rule created!');
      setShowModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save matrix rule');
    }
  };

  const handleDeleteRule = async (entryId) => {
    try {
      await onDeleteMatrixEntry(entryId);
      toast.success('Matrix rule removed');
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const filteredMatrixRules = useMemo(() => {
    if (selectedProjectId === 'ALL') return matrix;
    return matrix.filter(m => m.projectId === selectedProjectId || m.projectId === 'GLOBAL-DEFAULT');
  }, [matrix, selectedProjectId]);

  const handleQuickAddEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!quickEmpForm.name.trim()) {
      toast.error('Please enter employee name');
      return;
    }
    const empId = quickEmpForm.empNo.trim() || getNextEmployeeId(employees);
    try {
      if (onAddEmployee) {
        await onAddEmployee({
          id: empId,
          empNo: empId,
          name: quickEmpForm.name.trim(),
          nameEn: quickEmpForm.nameEn.trim() || quickEmpForm.name.trim(),
          position: quickEmpForm.position.trim() || 'General Operations',
          department: quickEmpForm.department || 'Operations',
          currentProject: quickEmpForm.currentProject || 'P-001',
          status: 'Active',
        });
        toast.success(`Registered ${quickEmpForm.name.trim()} (${empId})!`);
        setShowQuickAddEmp(false);
        setQuickEmpForm({
          empNo: '',
          name: '',
          nameEn: '',
          position: '',
          department: 'Operations',
          currentProject: '',
        });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to add employee');
    }
  };

  return (
    <div className="space-y-5">
      {/* Demo Mode Notice Banner */}
      {demoStats.isDemo && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/70 border border-amber-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100/90 text-amber-800 border border-amber-200 mt-0.5 sm:mt-0 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-amber-950">
                  Demo Mode Active
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                  {demoStats.demoRulesCount} Sample Rules &bull; {demoStats.demoEmployeesCount} Sample Personnel
                </span>
                {demoStats.hasRealEmployees && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Real personnel records detected
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-900/80 mt-0.5">
                If you have added real company personnel or training logs, you can clear demo data or auto-generate matrix rules for your actual job positions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
            {canEdit && (
              <>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-950 bg-white hover:bg-amber-100/80 border border-amber-300 shadow-2xs transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                  <span>Demo Data Controls</span>
                </button>
                {onClearAllDemoData && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsClearing(true);
                      try {
                        await onClearAllDemoData();
                      } catch (err) {
                        toast.error('Failed to clear data: ' + (err.message || ''));
                      } finally {
                        setIsClearing(false);
                      }
                    }}
                    disabled={isClearing}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isClearing ? 'Clearing...' : 'Clear All Demo Data'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Top Banner & Mode Toggle */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Status Dashboard — Training & Competency Matrix
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically calculated from Training Log &bull; Dates displayed in <strong>dd-Mmm-YYYY</strong> format
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" />
              <span>Matrix Table (Status Dashboard)</span>
            </button>
            <button
              onClick={() => setViewMode('rules')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'rules'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-orange-600" />
              <span>Requirement Rules ({matrix.length})</span>
            </button>
          </div>

          {onOpenDataManagement && (
            <button
              type="button"
              onClick={onOpenDataManagement}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-2xs cursor-pointer"
              title="Manage & wipe data to start fresh"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data Tools & Reset</span>
            </button>
          )}

          {viewMode === 'table' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
                title="Download Matrix as Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Matrix (Excel)</span>
              </button>

              {canEdit && (
                <button
                  onClick={() => {
                    const nextId = getNextEmployeeId(employees);
                    setQuickEmpForm({
                      empNo: nextId,
                      name: '',
                      nameEn: '',
                      position: '',
                      department: 'Operations',
                      currentProject: '',
                    });
                    setShowQuickAddEmp(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  title="Add employee to Training System"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Add Personnel</span>
                </button>
              )}
            </div>
          )}

          {viewMode === 'rules' && canEdit && (
            <div className="flex items-center gap-2">
              {onAutoGenerateRules && (
                <button
                  onClick={async () => {
                    await onAutoGenerateRules();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                  title="Automatically generate standard requirements for active employee positions"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span>Auto-Generate Rules</span>
                </button>
              )}
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Matrix Rule</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards (Available in Table View) */}
      {viewMode === 'table' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-slate-400">Total Workforce</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active personnel</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-slate-400">Average Compliance</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{stats.avgCompliance}%</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${stats.avgCompliance}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Fully Compliant (AVB)
            </div>
            <div className="text-xl font-bold text-emerald-700 mt-1">{stats.avbCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">All required valid</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-rose-700 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              Has Expired (EXP)
            </div>
            <div className="text-xl font-bold text-rose-700 mt-1">{stats.expCount}</div>
            <div className="text-[10px] text-rose-600/80 mt-0.5 font-medium">Action required</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Expiring Soon (REM)
            </div>
            <div className="text-xl font-bold text-amber-700 mt-1">{stats.remCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Due in &le; 90 days</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-[11px] font-medium text-purple-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-purple-600" />
              Missing (Not Trained)
            </div>
            <div className="text-xl font-bold text-purple-700 mt-1">{stats.notTrainedCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Required but no record</div>
          </div>
        </div>
      )}

      {/* Notice if no matrix rules are configured */}
      {viewMode === 'table' && matrix.length === 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">No Matrix Requirements Defined (Clean Slate):</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Currently no rules specify which job positions require which courses. Rows mark Required as &lsquo;N&rsquo; and no training alerts are triggered (Alerts = 0).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onAutoGenerateRules && (
              <button
                type="button"
                onClick={async () => {
                  await onAutoGenerateRules();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Auto-Generate from Positions
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('rules')}
              className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 hover:bg-amber-100/50 rounded-xl transition-all cursor-pointer"
            >
              Configure Matrix Rules
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap">
          {/* Search box */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Employee ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-orange-500"
            />
          </div>

          {/* Group / Project dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Group/Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">All Projects & Base</option>
              <option value="OPS">OPS (Operations Base)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.projectNo || p.id} - {p.name}</option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
            >
              <option value="empId">Employee ID</option>
              <option value="no">No. (Sequence)</option>
              <option value="name">Name</option>
              <option value="dept">Group/Project</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
              title={`Toggle sort direction: currently ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Course category filter */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">All Course Categories ({courses.length})</option>
                {courseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Quick Filter */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={clsx(
                  'px-2 py-1 text-[11px] font-semibold rounded-lg transition-all',
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('EXP')}
                className={clsx(
                  'px-2 py-1 text-[11px] font-semibold rounded-lg transition-all',
                  statusFilter === 'EXP'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                )}
              >
                Expired ({stats.expCount})
              </button>
              <button
                onClick={() => setStatusFilter('REM')}
                className={clsx(
                  'px-2 py-1 text-[11px] font-semibold rounded-lg transition-all',
                  statusFilter === 'REM'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                )}
              >
                Reminder ({stats.remCount})
              </button>
              <button
                onClick={() => setStatusFilter('NOT_TRAINED')}
                className={clsx(
                  'px-2 py-1 text-[11px] font-semibold rounded-lg transition-all',
                  statusFilter === 'NOT_TRAINED'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                )}
              >
                Not Trained ({stats.notTrainedCount})
              </button>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 self-end md:self-center whitespace-nowrap">
          Showing <strong>{displayEmployeeRows.length}</strong> personnel &bull; <strong>{filteredCourses.length}</strong> courses
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: MATRIX TABLE (STATUS DASHBOARD)                                  */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="space-y-3">
          {/* Status Legend Matching User's Excel */}
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Legend:</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                AVB
                <span className="font-normal text-[10px] text-emerald-900">= Available / Valid</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                EXP
                <span className="font-normal text-[10px] text-rose-900">= Expired</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                REM
                <span className="font-normal text-[10px] text-amber-900">= Reminder (&le; 90 days)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Not Trained
                <span className="font-normal text-[10px] text-slate-500">= No valid record</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-200">
                N/A
                <span className="font-normal text-[10px] text-slate-400">= No expiry (e.g. E-Learning)</span>
              </span>
              <span className="text-slate-400 font-sans text-[11px]">
                <strong>Y</strong> = Required &bull; <strong>N</strong> = Optional
              </span>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              Scroll horizontally &rarr; to view all courses
            </div>
          </div>

          {/* 2D Matrix Table Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[750px] relative scrollbar-thin">
              <table className="w-full text-left border-separate border-spacing-0 text-xs">
                {/* Table Header 1: Category Groups (MANDATORY, S1 CUSTOMER REQUIRE, etc.) */}
                <thead>
                  <tr className="text-white font-bold text-xs uppercase tracking-wider h-[38px]">
                    {/* Fixed Personnel merged header spanning columns 1-5 */}
                    <th
                      colSpan={5}
                      style={{ left: 0, width: 620, minWidth: 620, maxWidth: 620 }}
                      className="py-2 px-3 sticky left-0 top-0 z-50 bg-amber-900 text-amber-100 font-bold uppercase tracking-wider text-xs border-r-2 border-b border-amber-950 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.25)]"
                    >
                      <div className="flex items-center justify-between">
                        <span>Personnel &amp; Row Definition</span>
                        <span className="text-[10px] font-normal text-amber-200/90 font-mono tracking-normal">Freeze Columns</span>
                      </div>
                    </th>

                    {/* Category Spans */}
                    {categoryHeaders.map((cat, idx) => {
                      const isMandatory = cat.name === 'MANDATORY';
                      const isCustomer = cat.name.includes('CUSTOMER');
                      const isAdditional = cat.name.includes('ADDITIONAL');
                      return (
                        <th
                          key={idx}
                          colSpan={cat.span}
                          className={clsx(
                            'py-2 px-3 text-center border-r border-b border-amber-700/60 font-bold tracking-wider sticky top-0 z-30',
                            isMandatory ? 'bg-amber-950 text-amber-100' :
                            isCustomer ? 'bg-amber-700 text-white' :
                            isAdditional ? 'bg-amber-800 text-amber-50' : 'bg-amber-800 text-white'
                          )}
                        >
                          {cat.name}
                        </th>
                      );
                    })}
                  </tr>

                  {/* Table Header 2: Individual Column and Course Titles */}
                  <tr className="text-white font-semibold text-[11px] h-[52px]">
                    {/* 5 Fixed Column Headers */}
                    <th
                      style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48 }}
                      onClick={() => handleHeaderSort('no')}
                      className="py-2.5 px-2 sticky left-0 top-[38px] z-50 bg-amber-800 border-r border-b border-amber-700/80 text-center font-bold cursor-pointer hover:bg-amber-700 transition-colors select-none"
                      title="Click to sort by No."
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>No.</span>
                        {sortBy === 'no' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-200" /> : <ArrowDown className="w-3 h-3 text-amber-200" />)}
                      </div>
                    </th>
                    <th
                      style={{ left: 48, width: 136, minWidth: 136, maxWidth: 136 }}
                      onClick={() => handleHeaderSort('empId')}
                      className="py-2.5 px-3 sticky left-[48px] top-[38px] z-50 bg-amber-800 border-r border-b border-amber-700/80 font-bold cursor-pointer hover:bg-amber-700 transition-colors select-none"
                      title="Click to sort by Employee ID"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Employee ID</span>
                        {sortBy === 'empId' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-200 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-amber-300/60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      style={{ left: 184, width: 180, minWidth: 180, maxWidth: 180 }}
                      onClick={() => handleHeaderSort('name')}
                      className="py-2.5 px-3 sticky left-[184px] top-[38px] z-50 bg-amber-800 border-r border-b border-amber-700/80 font-bold cursor-pointer hover:bg-amber-700 transition-colors select-none"
                      title="Click to sort by Name"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Name</span>
                        {sortBy === 'name' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-amber-200 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-amber-300/60 shrink-0" />
                        )}
                      </div>
                    </th>
                    <th
                      style={{ left: 364, width: 120, minWidth: 120, maxWidth: 120 }}
                      className="py-2.5 px-2.5 sticky left-[364px] top-[38px] z-50 bg-amber-800 border-r border-b border-amber-700/80 text-center font-bold"
                    >
                      Group/Project
                    </th>
                    <th
                      style={{ left: 484, width: 136, minWidth: 136, maxWidth: 136 }}
                      className="py-2.5 px-3 sticky left-[484px] top-[38px] z-50 bg-amber-800 border-r-2 border-b border-amber-950 font-bold shadow-[4px_0_10px_-2px_rgba(0,0,0,0.25)]"
                    >
                      Row
                    </th>

                    {/* Course Column Headers */}
                    {filteredCourses.map(course => (
                      <th
                        key={course.id}
                        style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                        className="py-2.5 px-3 border-r border-b border-amber-600/70 sticky top-[38px] z-30 bg-amber-700 text-white align-top"
                      >
                        <div className="leading-snug text-white font-semibold text-[11.5px] break-words" title={course.name}>
                          {course.name}
                        </div>
                        <div className="text-[10px] text-amber-200/90 font-sans font-normal mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[9.5px] text-amber-100 bg-amber-800/80 px-1.5 py-0.2 rounded" title="Course Code (Reference)">
                            Ref: {course.code}
                          </span>
                          {course.validityMonths ? (
                            <span>&bull; {course.validityMonths}m</span>
                          ) : (
                            <span>&bull; No exp</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table Body: 4 sub-rows per employee with 100% solid sticky cells */}
                <tbody>
                  {displayEmployeeRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + filteredCourses.length}
                        className="p-12 text-center text-slate-500 text-xs bg-white"
                      >
                        No employee records found matching current search and filters.
                      </td>
                    </tr>
                  ) : (
                    sortedEmployeeRows.map((rowItem, rIdx) => {
                      const { emp, index, courseDataMap, isFullyCompliant, hasExp, hasRem, hasNotTrained } = rowItem;
                      const empId = formatDisplayEmployeeId(emp);
                      const empName = emp.name;
                      const groupProj = emp.department || emp.currentProject || 'OPS';
                      const isEven = rIdx % 2 === 0;
                      // 100% solid, fully opaque hex colors and classes to prevent any bleed-through when scrolling
                      const solidBgColor = isEven ? '#ffffff' : '#f8fafc';
                      const solidBgClass = isEven ? 'bg-white' : 'bg-slate-50';

                      return (
                        <Fragment key={emp.id}>
                          {/* Sub-row 1: Last Training Date */}
                          <tr className={solidBgClass} style={{ backgroundColor: solidBgColor }}>
                            <td
                              style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-2 px-2 sticky left-0 z-20 border-r border-slate-200 font-sans text-center font-bold text-slate-700 text-xs',
                                solidBgClass
                              )}
                            >
                              {index}
                            </td>
                            <td
                              style={{ left: 48, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-2 px-3 sticky left-[48px] z-20 border-r border-slate-200 font-sans font-bold text-slate-900 text-xs whitespace-nowrap truncate group cursor-pointer hover:bg-indigo-50/70 transition-colors',
                                solidBgClass
                              )}
                              title={emp.empNo ? `${emp.name} (ID: ${emp.empNo}) - Click to edit` : `${emp.name} - Click to enter Employee ID`}
                              onClick={() => {
                                if (canEdit) {
                                  setEditingEmpIdTarget(emp);
                                  setEmpIdInput(cleanHrEmployeeId(emp.empNo || emp.employeeId));
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">
                                  {empId || (
                                    <span className="text-slate-400 font-normal italic text-[11px]">-</span>
                                  )}
                                </span>
                                {canEdit && (
                                  <span className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-opacity" title="Edit Employee ID">
                                    <Edit2 className="w-3 h-3 shrink-0" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              style={{ left: 184, width: 180, minWidth: 180, maxWidth: 180, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-2 px-3 sticky left-[184px] z-20 border-r border-slate-200 font-semibold text-slate-900 text-xs whitespace-nowrap truncate',
                                solidBgClass
                              )}
                              title={empName}
                            >
                              {empName}
                            </td>
                            <td
                              style={{ left: 364, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-2 px-2.5 sticky left-[364px] z-20 border-r border-slate-200 text-center',
                                solidBgClass
                              )}
                            >
                              <span className="inline-block px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-800 text-[11px] font-medium truncate max-w-[105px]" title={groupProj}>
                                {groupProj}
                              </span>
                            </td>
                            <td
                              style={{ left: 484, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1.5 px-3 sticky left-[484px] z-20 border-r-2 border-slate-300 font-medium text-slate-600 text-[11px] whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]',
                                solidBgClass
                              )}
                            >
                              Last Training Date
                            </td>

                            {/* Course Cells: Last Training Date */}
                            {filteredCourses.map(c => {
                              const cell = courseDataMap[c.id] || {};
                              return (
                                <td
                                  key={c.id}
                                  style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                  className="py-1.5 px-2.5 border-r border-b border-slate-200 font-sans text-center text-slate-700 text-xs whitespace-nowrap"
                                >
                                  {cell.trainedDate || '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Sub-row 2: Expire Date */}
                          <tr className={solidBgClass} style={{ backgroundColor: solidBgColor }}>
                            <td
                              style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2 sticky left-0 z-20 border-r border-slate-200 text-center text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 48, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1 px-3 sticky left-[48px] z-20 border-r border-slate-200 text-[10px] font-normal text-slate-500 font-sans whitespace-nowrap truncate',
                                solidBgClass
                              )}
                              title={emp.position}
                            >
                              {emp.position || '-'}
                            </td>
                            <td
                              style={{ left: 184, width: 180, minWidth: 180, maxWidth: 180, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1 px-3 sticky left-[184px] z-20 border-r border-slate-200 text-[11px] text-slate-400 font-sans whitespace-nowrap truncate',
                                solidBgClass
                              )}
                              title={emp.nameEn || ''}
                            >
                              {emp.nameEn && emp.nameEn !== empName ? (
                                emp.nameEn
                              ) : (
                                <span className="text-slate-300 font-sans text-[10px]">-</span>
                              )}
                            </td>
                            <td
                              style={{ left: 364, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2.5 sticky left-[364px] z-20 border-r border-slate-200 text-center text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 484, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1.5 px-3 sticky left-[484px] z-20 border-r-2 border-slate-300 font-medium text-slate-600 text-[11px] whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]',
                                solidBgClass
                              )}
                            >
                              Expire Date
                            </td>

                            {/* Course Cells: Expire Date */}
                            {filteredCourses.map(c => {
                              const cell = courseDataMap[c.id] || {};
                              const isExp = cell.status === 'EXP';
                              const isRem = cell.status === 'REM';
                              return (
                                <td
                                  key={c.id}
                                  style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                  className={clsx(
                                    'py-1.5 px-2.5 border-r border-b border-slate-200 font-sans text-center text-xs whitespace-nowrap font-medium',
                                    isExp ? 'text-rose-700 font-bold' :
                                    isRem ? 'text-amber-800 font-bold' : 'text-slate-600'
                                  )}
                                >
                                  {cell.expireDate || '-'}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Sub-row 3: Status (AVB, EXP, REM, Not Trained, N/A, -) */}
                          <tr className={solidBgClass} style={{ backgroundColor: solidBgColor }}>
                            <td
                              style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2 sticky left-0 z-20 border-r border-slate-200 text-center text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 48, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-3 sticky left-[48px] z-20 border-r border-slate-200 text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 184, width: 180, minWidth: 180, maxWidth: 180, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1 px-3 sticky left-[184px] z-20 border-r border-slate-200 align-middle',
                                solidBgClass
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-h-[22px]">
                                {isFullyCompliant ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                                    Valid
                                  </span>
                                ) : hasExp ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-300">
                                    Action Needed
                                  </span>
                                ) : hasRem ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                                    Due Soon
                                  </span>
                                ) : hasNotTrained ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    Pending Training
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-300 font-sans">-</span>
                                )}
                              </div>
                            </td>
                            <td
                              style={{ left: 364, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2.5 sticky left-[364px] z-20 border-r border-slate-200 text-center text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 484, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1.5 px-3 sticky left-[484px] z-20 border-r-2 border-slate-300 font-bold text-slate-900 text-[11px] whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]',
                                solidBgClass
                              )}
                            >
                              Status
                            </td>

                            {/* Course Cells: Status */}
                            {filteredCourses.map(c => {
                              const cell = courseDataMap[c.id] || {};
                              const status = cell.status;

                              if (status === 'AVB') {
                                return (
                                  <td
                                    key={c.id}
                                    style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                    className="py-1 px-1.5 border-r border-b border-slate-200 text-center"
                                  >
                                    <div
                                      className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded text-[11px] shadow-2xs"
                                      title={`[Valid / Available] ${c.name} (Ref: ${c.code})`}
                                    >
                                      AVB
                                    </div>
                                  </td>
                                );
                              }
                              if (status === 'EXP') {
                                return (
                                  <td
                                    key={c.id}
                                    style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                    className="py-1 px-1.5 border-r border-b border-slate-200 text-center"
                                  >
                                    <button
                                      onClick={() => onOpenRecordLog && onOpenRecordLog({ employeeId: emp.id, courseId: c.id })}
                                      className="w-full bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 font-bold px-2 py-0.5 rounded text-[11px] shadow-2xs cursor-pointer transition-all"
                                      title={`[Expired] ${c.name} (Ref: ${c.code}) - Click to record renewal`}
                                    >
                                      EXP
                                    </button>
                                  </td>
                                );
                              }
                              if (status === 'REM') {
                                return (
                                  <td
                                    key={c.id}
                                    style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                    className="py-1 px-1.5 border-r border-b border-slate-200 text-center"
                                  >
                                    <button
                                      onClick={() => onOpenRecordLog && onOpenRecordLog({ employeeId: emp.id, courseId: c.id })}
                                      className="w-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px] shadow-2xs cursor-pointer transition-all"
                                      title={`[Expiring soon] ${c.name} (Ref: ${c.code}) - Click to record renewal`}
                                    >
                                      REM
                                    </button>
                                  </td>
                                );
                              }
                              if (status === 'Not Trained') {
                                return (
                                  <td
                                    key={c.id}
                                    style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                    className="py-1 px-1.5 border-r border-b border-slate-200 text-center"
                                  >
                                    <button
                                      onClick={() => onOpenRecordLog && onOpenRecordLog({ employeeId: emp.id, courseId: c.id })}
                                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 font-medium px-1.5 py-0.5 rounded text-[10px] cursor-pointer transition-all"
                                      title={`[Not Trained] ${c.name} (Ref: ${c.code}) - Click to add training`}
                                    >
                                      Not Trained
                                    </button>
                                  </td>
                                );
                              }
                              if (status === 'N/A') {
                                return (
                                  <td
                                    key={c.id}
                                    style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                    className="py-1 px-1.5 border-r border-b border-slate-200 text-center text-slate-400 font-mono text-[11px]"
                                    title={`[Not Applicable] ${c.name}`}
                                  >
                                    N/A
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={c.id}
                                  style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                  className="py-1 px-1.5 border-r border-b border-slate-200 text-center text-slate-300 font-sans text-xs"
                                >
                                  -
                                </td>
                              );
                            })}
                          </tr>

                          {/* Sub-row 4: Required (helper) (Y, N) */}
                          <tr className={solidBgClass} style={{ backgroundColor: solidBgColor }}>
                            <td
                              style={{ left: 0, width: 48, minWidth: 48, maxWidth: 48, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2 sticky left-0 z-20 border-r border-b-2 border-slate-300 text-center text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 48, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-3 sticky left-[48px] z-20 border-r border-b-2 border-slate-300 text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 184, width: 180, minWidth: 180, maxWidth: 180, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-3 sticky left-[184px] z-20 border-r border-b-2 border-slate-300 text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 364, width: 120, minWidth: 120, maxWidth: 120, backgroundColor: solidBgColor }}
                              className={clsx('py-1 px-2.5 sticky left-[364px] z-20 border-r border-b-2 border-slate-300 text-slate-300 text-xs', solidBgClass)}
                            >
                              &nbsp;
                            </td>
                            <td
                              style={{ left: 484, width: 136, minWidth: 136, maxWidth: 136, backgroundColor: solidBgColor }}
                              className={clsx(
                                'py-1.5 px-3 sticky left-[484px] z-20 border-r-2 border-b-2 border-slate-300 font-medium text-slate-400 text-[11px] whitespace-nowrap shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)]',
                                solidBgClass
                              )}
                            >
                              Required (helper)
                            </td>

                            {/* Course Cells: Required (helper) */}
                            {filteredCourses.map(c => {
                              const cell = courseDataMap[c.id] || {};
                              const isY = cell.required === 'Y';
                              return (
                                <td
                                  key={c.id}
                                  style={{ width: 175, minWidth: 175, maxWidth: 240 }}
                                  className={clsx(
                                    'py-1.5 px-2.5 border-r border-b-2 border-slate-300 text-center text-xs font-semibold',
                                    isY ? 'text-slate-900 bg-amber-50/50' : 'text-slate-400'
                                  )}
                                  title={`${c.name}: ${isY ? 'Mandatory Requirement' : 'Not required'}`}
                                >
                                  {cell.required || 'N'}
                                </td>
                              );
                            })}
                          </tr>
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: REQUIREMENT RULES ENGINE (ROLE REQUIREMENTS)                     */}
      {/* ========================================================================= */}
      {viewMode === 'rules' && (
        <div className="space-y-4">
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Matrix Requirement Rules Engine:</span>{' '}
              Define which job positions or project assignments require which safety courses. These rules dynamically calculate Required flags and drive training compliance statuses.
            </div>
          </div>

          {filteredMatrixRules.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <TableProperties className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No Matrix Rules Defined (Clean Slate)</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Define required safety courses for each job position, or click Auto-Generate to build standard rules for active employee positions.
              </p>
              {canEdit && (
                <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                  {onAutoGenerateRules && (
                    <button
                      onClick={async () => {
                        await onAutoGenerateRules();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Auto-Generate Rules from Positions</span>
                    </button>
                  )}
                  <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Custom Rule</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMatrixRules.map(entry => {
                const isGlobal = entry.projectId === 'GLOBAL-DEFAULT';
                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={clsx(
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                              isGlobal
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            )}>
                              {isGlobal ? 'Global Standard Default' : (entry.projectId)}
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm">
                              {entry.position}
                            </h3>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Project: <strong>{entry.projectName || entry.projectId}</strong> &bull; {entry.requiredCourseIds?.length || 0} Required Courses
                          </div>
                        </div>

                        {canEdit ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleOpenEdit(entry)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRule(entry.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {/* Badges of required courses */}
                      <div className="mt-3.5">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Mandatory Required Courses:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(entry.requiredCourseIds || []).map(cid => {
                            const c = courses.find(course => course.id === cid);
                            return (
                              <span
                                key={cid}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-50 border border-slate-200 text-slate-800"
                              >
                                <span className="font-medium text-slate-900">{c?.name || cid}</span>
                                {c?.code && (
                                  <span className="font-mono text-[10px] text-slate-400 font-normal">({c.code})</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Updated: {formatDate(entry.updatedAt || new Date())}</span>
                      <span>{entry.updatedBy || 'Operations Team'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT MATRIX REQUIREMENT RULE                                */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <TableProperties className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingEntry ? 'Edit Matrix Requirement Rule' : 'Add Matrix Requirement Rule'}
                  </h3>
                  <p className="text-xs text-slate-400">Specify required courses for this position and project</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Project Scope
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                >
                  <option value="GLOBAL-DEFAULT">Global Standard Default (All Projects)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.projectNo || p.id} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Job Position
                </label>
                <input
                  type="text"
                  list="position-suggestions"
                  placeholder="e.g. Senior Instrumentation Engineer"
                  value={formPosition}
                  onChange={(e) => setFormPosition(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                />
                <datalist id="position-suggestions">
                  {availablePositions.map(pos => (
                    <option key={pos} value={pos} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-2">
                  Select Required Training Courses ({formRequiredCourses.length} selected)
                </label>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-2 space-y-1">
                  {courses.map(course => {
                    const isSelected = formRequiredCourses.includes(course.id);
                    return (
                      <label
                        key={course.id}
                        className={clsx(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          isSelected ? 'bg-orange-50/70 border border-orange-200' : 'hover:bg-slate-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleCourse(course.id)}
                          className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span>{course.name}</span>
                            <span className="font-mono text-slate-400 font-normal text-[11px]">({course.code})</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {course.requirementTier || course.category} &bull; Validity: {course.validityMonths ? `${course.validityMonths} months` : 'No expiry'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Save Matrix Requirement Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANAGE DEMO DATA & PRODUCTION TRANSITION                           */}
      {/* ========================================================================= */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Demo Data Management
                  </h3>
                  <p className="text-xs text-slate-500">
                    Prepare the system for real organizational data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Current Status Overview */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs space-y-2">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Current System Data:</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-400">Matrix Rules</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {matrix.length} <span className="text-[10px] font-normal text-amber-700 font-sans">({demoStats.demoRulesCount} demo)</span>
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-400">Personnel</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {employees.length} <span className="text-[10px] font-normal text-amber-700 font-sans">({demoStats.demoEmployeesCount} demo)</span>
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-400">Training Logs</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {validLogs.length} <span className="text-[10px] font-normal text-amber-700 font-sans">({demoStats.demoLogsCount} demo)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions list */}
            <div className="space-y-3">
              {/* Action 1: Clear All Demo Data */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-rose-950 text-xs flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Clear All Demo Data</span>
                  </div>
                  <p className="text-[11px] text-rose-800/80">
                    Removes demo matrix requirements, demo personnel (EMP-001..008), and sample logs. <strong>Real personnel and records will be 100% retained.</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsClearing(true);
                    try {
                      if (onClearAllDemoData) await onClearAllDemoData();
                      setShowDemoModal(false);
                    } catch (err) {
                      toast.error('Error: ' + (err.message || ''));
                    } finally {
                      setIsClearing(false);
                    }
                  }}
                  disabled={isClearing}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs whitespace-nowrap self-start sm:self-center cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isClearing ? 'Clearing...' : 'Clear All Demo Data'}
                </button>
              </div>

              {/* Action 2: Clear Demo Rules Only */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
                    <span>Clear Demo Matrix Rules Only ({demoStats.demoRulesCount} Rules)</span>
                  </div>
                  <p className="text-[11px] text-amber-800/80">
                    Removes only sample position-to-course matrix requirements so you can configure custom organization policies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsClearing(true);
                    try {
                      if (onClearDemoMatrix) await onClearDemoMatrix();
                      setShowDemoModal(false);
                    } catch (err) {
                      toast.error('Error: ' + (err.message || ''));
                    } finally {
                      setIsClearing(false);
                    }
                  }}
                  disabled={isClearing || demoStats.demoRulesCount === 0}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl transition-all shadow-2xs whitespace-nowrap self-start sm:self-center cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isClearing ? 'Clearing...' : 'Clear Demo Rules'}
                </button>
              </div>

              {/* Action 3: Auto-generate matrix rules from real positions */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 hover:bg-sky-50/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Auto-Generate Rules for Real Positions</span>
                  </div>
                  <p className="text-[11px] text-sky-800/80">
                    Scans all active job positions in your organization roster and attaches standard mandatory safety courses (BOSIET, H2S, First Aid, etc.).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsClearing(true);
                    try {
                      if (onAutoGenerateRules) await onAutoGenerateRules();
                      setShowDemoModal(false);
                    } catch (err) {
                      toast.error('Error: ' + (err.message || ''));
                    } finally {
                      setIsClearing(false);
                    }
                  }}
                  disabled={isClearing}
                  className="px-3.5 py-2 text-xs font-semibold text-sky-900 bg-white hover:bg-sky-100 border border-sky-300 rounded-xl transition-all shadow-2xs whitespace-nowrap self-start sm:self-center cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isClearing ? 'Processing...' : 'Auto-Generate Rules'}
                </button>
              </div>

              {/* Action 4: Restore Demo Data */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Restore Demo Data</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Restore offshore sample requirements, test crew, and history for evaluation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsClearing(true);
                    try {
                      if (onResetAllDemoData) await onResetAllDemoData();
                      setShowDemoModal(false);
                    } catch (err) {
                      toast.error('Error: ' + (err.message || ''));
                    } finally {
                      setIsClearing(false);
                    }
                  }}
                  disabled={isClearing}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs whitespace-nowrap self-start sm:self-center cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isClearing ? 'Restoring...' : 'Restore Demo'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK ADD PERSONNEL                                                */}
      {/* ========================================================================= */}
      {showQuickAddEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Add Personnel to Training System
                  </h3>
                  <p className="text-xs text-slate-400">
                    Register personnel to include in Training Matrix compliance calculations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickAddEmp(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleQuickAddEmployeeSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS-SKL-008 or ID from HR"
                    value={quickEmpForm.empNo}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, empNo: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 font-sans"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Official employee code from HR. Sequences do not need to be consecutive.
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Somchai Prasert"
                    value={quickEmpForm.name}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name (Secondary / Local)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Johnathan Smith"
                    value={quickEmpForm.nameEn}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, nameEn: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Position <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Instrumentation Technician"
                    value={quickEmpForm.position}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, position: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={quickEmpForm.department}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="HSE">HSE</option>
                    <option value="QA/QC">QA/QC</option>
                    <option value="Offshore">Offshore</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Current Assigned Project
                  </label>
                  <select
                    value={quickEmpForm.currentProject}
                    onChange={(e) => setQuickEmpForm({ ...quickEmpForm, currentProject: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-orange-500 cursor-pointer"
                  >
                    <option value="">-- Unassigned / Pool --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.projectNo || p.id} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddEmp(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Save Personnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Employee ID Modal */}
      {editingEmpIdTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Set Employee ID
              </h3>
              <button
                type="button"
                onClick={() => setEditingEmpIdTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmpId} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Employee Name</label>
                <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {editingEmpIdTarget.name}
                  <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                    Position: {editingEmpIdTarget.position || '-'} | Dept: {editingEmpIdTarget.department || '-'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Employee ID (e.g. Badge / No)
                </label>
                <input
                  type="text"
                  value={empIdInput}
                  onChange={(e) => setEmpIdInput(e.target.value)}
                  placeholder="e.g. EMP-007, OP-1001, OGS-006"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans font-semibold"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Enter official company employee ID to display across matrices and export passports instead of system generated keys.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmpIdTarget(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpId}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSavingEmpId ? 'Saving...' : 'Save Employee ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
