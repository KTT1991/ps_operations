import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap, BarChart3, ShieldAlert, FileText,
  TableProperties, Users, BookOpen, FolderKanban,
  FileCheck, Download, AlertTriangle, Clock, CheckCircle2,
  Database
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { projectsService } from '../../services/firebaseService';
import {
  coursesService,
  trainingMatrixService,
  trainingEmployeesService,
  trainingLogService,
  computeComplianceMatrix,
  calculateProjectMetrics,
  clearAllDemoTrainingData,
  resetAllDemoTrainingData,
  clearAllTrainingData,
  isDemoEmployee,
  isDemoCourse,
  isDemoMatrixRule,
  isDemoLog,
} from '../../services/trainingService';
import TrainingDashboardTab from './TrainingDashboardTab';
import TrainingAlertsTab from './TrainingAlertsTab';
import TrainingLogTab from './TrainingLogTab';
import TrainingMatrixTab from './TrainingMatrixTab';
import TrainingEmployeesTab from './TrainingEmployeesTab';
import TrainingCoursesTab from './TrainingCoursesTab';
import TrainingProjectsTab from './TrainingProjectsTab';
import TrainingIndividualReportTab from './TrainingIndividualReportTab';
import TrainingDataManagementModal from './TrainingDataManagementModal';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const T = {
  text:  'var(--t-text)',
  text2: 'var(--t-text2)',
  text3: 'var(--t-text3)',
  bg2:   'var(--t-bg2)',
  border:'var(--t-border)',
};

export default function TrainingPage() {
  const { user, userRole, isAdmin, isBaseManager, isSafety, canManageTraining: authCanManageTraining, canManageProjects: authCanManageProjects } = useAuth();
  const canManageTraining = authCanManageTraining ?? (isAdmin || userRole === 'safety' || true);
  const canManageProjects = authCanManageProjects ?? (isAdmin || isBaseManager || true);

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'alerts', 'log', 'matrix', 'employees', 'courses', 'projects', 'individual'
  const [loading, setLoading] = useState(true);
  const [showDataManagementModal, setShowDataManagementModal] = useState(false);

  // Core collections state
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [courses, setCourses] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [logs, setLogs] = useState([]);

  // Cross-tab interaction states
  const [prefilledLog, setPrefilledLog] = useState(null);
  const [selectedEmployeeForReport, setSelectedEmployeeForReport] = useState(null);

  // Load all master and operational data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pList, eList, cList, mList, lList] = await Promise.all([
        projectsService.getAll(),
        trainingEmployeesService.getAll(),
        coursesService.getAll(),
        trainingMatrixService.getAll(),
        trainingLogService.getAll(),
      ]);

      // If user is project_manager, optionally filter or prioritize assigned projects
      let filteredProjects = pList;
      if (userRole === 'project_manager' && Array.isArray(user?.assignedProjects) && user.assignedProjects.length > 0) {
        filteredProjects = pList.filter(p => user.assignedProjects.includes(p.id) || user.assignedProjects.includes(p.projectNo));
      }

      setProjects(filteredProjects);
      setEmployees(eList);
      setCourses(cList);
      setMatrix(mList);
      setLogs(lList);
    } catch (err) {
      console.error('Failed to load training data:', err);
      toast.error('Failed to load training data');
    } finally {
      setLoading(false);
    }
  }, [userRole, user?.assignedProjects]);

  useEffect(() => {
    loadData();

    // Subscribe to updates for reactive real-time state
    const unsubLogs = trainingLogService.subscribe(updatedLogs => {
      setLogs(updatedLogs);
    });
    const unsubEmployees = trainingEmployeesService.subscribe(updatedEmps => {
      setEmployees(updatedEmps);
    });
    const unsubMatrix = trainingMatrixService.subscribe(updatedMatrix => {
      setMatrix(updatedMatrix);
    });
    const unsubCourses = coursesService.subscribe(updatedCourses => {
      setCourses(updatedCourses);
    });

    return () => {
      unsubLogs();
      unsubEmployees();
      unsubMatrix();
      unsubCourses();
    };
  }, [loadData]);

  // Dynamically compute compliance matrix & project readiness
  const complianceRecords = useMemo(() => {
    return computeComplianceMatrix({ employees, courses, matrix, logs });
  }, [employees, courses, matrix, logs]);

  const projectMetrics = useMemo(() => {
    return calculateProjectMetrics({ projects, employees, complianceRecords });
  }, [projects, employees, complianceRecords]);

  // Urgent alerts count (EXP + REM + NOT_TRAINED)
  const urgentAlertsCount = useMemo(() => {
    return complianceRecords.filter(r => r.status === 'EXP' || r.status === 'REM' || r.status === 'NOT_TRAINED').length;
  }, [complianceRecords]);

  // Handlers for Data Mutations
  const handleAddLog = async (logData) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can record training');
      return;
    }
    await trainingLogService.addLog(logData, user);
    await loadData();
  };

  const handleBatchAddLogs = async (records) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can record training logs');
      return;
    }
    const result = await trainingLogService.batchAddLogs(records, user);
    await loadData();
    return result;
  };

  const handleCancelLog = async (logId, reason) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can cancel training records');
      return;
    }
    await trainingLogService.cancelLog(logId, reason, user);
    await loadData();
  };

  const handleClearDemoLogs = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can manage demo data');
      return;
    }
    const res = await trainingLogService.clearDemoLogs(user);
    toast.success(`Removed ${res.removedCount} demo record(s). Ready for real data!`);
    await loadData();
  };

  const handleClearAllLogs = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can clear data');
      return;
    }
    const res = await trainingLogService.clearAllLogs(user);
    toast.success(`Cleared all ${res.removedCount} training record(s).`);
    await loadData();
  };

  const handleResetDemoLogs = async () => {
    try {
      await trainingLogService.resetToDemo(user);
      toast.success('Successfully restored sample training records');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to restore demo logs');
    }
  };

  const handleClearDemoMatrix = async () => {
    try {
      const res = await trainingMatrixService.clearDemoMatrix(user);
      toast.success(`Demo Matrix rules cleared successfully (${res.removedCount} rules)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear demo matrix');
    }
  };

  const handleResetDemoMatrix = async () => {
    try {
      await trainingMatrixService.resetToDemo(user);
      toast.success('Successfully restored sample Matrix rules');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to restore demo matrix');
    }
  };

  const handleClearDemoEmployees = async () => {
    try {
      const res = await trainingEmployeesService.clearDemoEmployees(user);
      toast.success(`Demo personnel cleared successfully (${res.removedCount} personnel)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear demo employees');
    }
  };

  const handleClearAllDemoData = async () => {
    try {
      const res = await clearAllDemoTrainingData(user);
      toast.success(`All demo data cleared! (Personnel: ${res.clearedEmployees}, Rules: ${res.clearedRules}, Records: ${res.clearedLogs})`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Error occurred while clearing demo data');
    }
  };

  const handleResetAllDemoData = async () => {
    try {
      await resetAllDemoTrainingData(user);
      toast.success('All demo data restored successfully (Personnel, Matrix Rules, Training Logs)');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to restore all demo data');
    }
  };

  const handleAutoGenerateRules = async () => {
    try {
      const activePositions = Array.from(new Set(employees.filter(e => e.status !== 'Resigned').map(e => e.position).filter(Boolean)));
      const generated = await trainingMatrixService.autoGenerateRulesForPositions(activePositions, user);
      if (generated.length > 0) {
        toast.success(`Auto-generated compliance requirements for ${generated.length} position(s)!`);
      } else {
        toast('All active positions already have matrix rules configured', { icon: 'ℹ️' });
      }
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to auto-generate rules');
    }
  };

  const handleSaveMatrixEntry = async (entry) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can configure training matrix');
      return;
    }
    if (entry.id && matrix.some(m => m.id === entry.id)) {
      await trainingMatrixService.update(entry.id, entry);
    } else {
      await trainingMatrixService.create(entry);
    }
    await loadData();
  };

  const handleDeleteMatrixEntry = async (entryId) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can delete matrix rules');
      return;
    }
    await trainingMatrixService.delete(entryId);
    await loadData();
  };

  const handleAddEmployee = async (empData) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can register employees');
      return;
    }
    await trainingEmployeesService.create(empData);
    await loadData();
  };

  const handleUpdateEmployee = async (empId, updateData) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can update employees');
      return;
    }
    await trainingEmployeesService.update(empId, updateData);
    await loadData();
  };

  const handleMarkResigned = async (empId, reason) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can change employee status');
      return;
    }
    await trainingEmployeesService.update(empId, {
      status: 'Resigned',
      resignedDate: format(new Date(), 'yyyy-MM-dd'),
      resignedReason: reason || 'Contract ended or relocated',
    });
    await loadData();
  };

  const handleSaveCourse = async (courseData) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can manage courses');
      return;
    }
    if (courseData.id && courses.some(c => c.id === courseData.id)) {
      await coursesService.update(courseData.id, courseData);
    } else {
      await coursesService.create(courseData);
    }
    await loadData();
  };

  const handleDeleteCourse = async (courseId) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can delete courses');
      return;
    }
    try {
      await coursesService.delete(courseId);
      toast.success('Course deleted successfully');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete course');
    }
  };

  const handleClearDemoCourses = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can clear courses');
      return;
    }
    try {
      const count = await coursesService.clearDemoCourses();
      toast.success(`Cleared demo courses (${count} courses)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear demo courses');
    }
  };

  const handleClearAllCourses = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can clear courses');
      return;
    }
    try {
      const count = await coursesService.clearAllCourses();
      toast.success(`Cleared all courses (${count} courses)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear all courses');
    }
  };

  const handleResetDemoCourses = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can reset courses');
      return;
    }
    try {
      const res = await coursesService.resetDemoCourses();
      toast.success(`Restored ${res.length} standard courses successfully`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to reset demo courses');
    }
  };

  const handleClearAllMatrixRules = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can manage matrix rules');
      return;
    }
    try {
      const count = await trainingMatrixService.clearAllMatrixRules();
      toast.success(`Cleared all matrix rules (${count} rules)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear matrix rules');
    }
  };

  const handleClearAllEmployees = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can manage personnel');
      return;
    }
    try {
      const count = await trainingEmployeesService.clearAllEmployees(user);
      toast.success(`Cleared all personnel records (${count} employees)`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to clear employees');
    }
  };

  const handleResetDemoEmployees = async () => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can reset demo personnel');
      return;
    }
    try {
      await trainingEmployeesService.resetToDemo(user);
      toast.success('Restored demo personnel successfully');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to reset demo employees');
    }
  };

  const handleClearAllTrainingData = async (options = {}) => {
    if (!canManageTraining) {
      toast.error('Access restricted: Only Admin or Safety Officer can clear data');
      return;
    }
    try {
      const res = await clearAllTrainingData(options, user);
      toast.success('Training system data wiped successfully. Ready for new data entry.');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Error occurred while clearing data');
    }
  };

  const handleAddProject = async (projectData) => {
    if (!canManageProjects) {
      toast.error('Access restricted: Only Admin or Base Manager can create projects');
      return;
    }
    await projectsService.create(projectData);
    await loadData();
  };

  const handleMarkProjectCompleted = async (projectId) => {
    if (!canManageProjects) {
      toast.error('Access restricted: Only Admin or Base Manager can update project status');
      return;
    }
    await projectsService.update(projectId, {
      status: 'Completed',
      completedDate: format(new Date(), 'yyyy-MM-dd'),
    });
    toast.success('Project status updated to Completed');
    await loadData();
  };

  // Cross-tab navigations
  const handleOpenLogFromAlert = (record) => {
    setPrefilledLog(record);
    setActiveTab('log');
  };

  const handleViewEmployeeSummary = (employeeId) => {
    setSelectedEmployeeForReport(employeeId);
    setActiveTab('individual');
  };

  const handleSelectProjectForDashboard = (projectId) => {
    setActiveTab('dashboard');
  };

  const isAdminOrHr = isAdmin || isBaseManager || userRole === 'hr';

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'alerts', label: 'Alerts', icon: ShieldAlert, badge: urgentAlertsCount > 0 ? urgentAlertsCount : null },
    { id: 'log', label: 'Training Log', icon: FileText },
    { id: 'matrix', label: 'Training Matrix', icon: TableProperties },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'individual', label: 'Individual Summary (PDF)', icon: FileCheck },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-semibold text-slate-500">Loading Training Records & Matrix...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Top Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 shadow-2xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Training Records & Competency Matrix
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Workforce competency, compliance & certification matrix — {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Action button & Live Data Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {canManageTraining && (
            <button
              type="button"
              onClick={() => setShowDataManagementModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs transition-all cursor-pointer"
              title="Manage, wipe, or restore training system data"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data Tools & Reset</span>
            </button>
          )}

          <div
            className="flex items-center gap-2 text-xs rounded-xl px-3 py-2 shadow-2xs"
            style={{ background: T.bg2, border: `1px solid ${T.border}`, color: T.text3 }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Live Data</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isActive ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="transition-all duration-200">
        {activeTab === 'dashboard' && (
          <TrainingDashboardTab
            projects={projects}
            employees={employees}
            courses={courses}
            complianceRecords={complianceRecords}
            projectMetrics={projectMetrics}
            onSelectProject={handleSelectProjectForDashboard}
            onMarkProjectCompleted={handleMarkProjectCompleted}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === 'alerts' && (
          <TrainingAlertsTab
            complianceRecords={complianceRecords}
            projects={projects}
            courses={courses}
            canManageTraining={canManageTraining}
            onOpenLogModal={handleOpenLogFromAlert}
          />
        )}

        {activeTab === 'log' && (
          <TrainingLogTab
            logs={logs}
            employees={employees}
            courses={courses}
            canManageTraining={canManageTraining}
            onAddLog={handleAddLog}
            onBatchAddLogs={handleBatchAddLogs}
            onCancelLog={handleCancelLog}
            prefilledRecord={prefilledLog}
            onClearPrefilled={() => setPrefilledLog(null)}
            onClearDemoLogs={handleClearDemoLogs}
            onClearAllLogs={handleClearAllLogs}
            onResetDemoLogs={handleResetDemoLogs}
            onClearAllDemoData={handleClearAllDemoData}
            onResetAllDemoData={handleResetAllDemoData}
            onAddEmployee={handleAddEmployee}
            onAddCourse={handleSaveCourse}
          />
        )}

        {activeTab === 'matrix' && (
          <TrainingMatrixTab
            matrix={matrix}
            projects={projects}
            courses={courses}
            employees={employees}
            logs={logs}
            complianceRecords={complianceRecords}
            canManageTraining={canManageTraining}
            onSaveMatrixEntry={handleSaveMatrixEntry}
            onDeleteMatrixEntry={handleDeleteMatrixEntry}
            userRole={userRole}
            onOpenRecordLog={handleOpenLogFromAlert}
            onClearDemoMatrix={handleClearDemoMatrix}
            onResetDemoMatrix={handleResetDemoMatrix}
            onClearDemoEmployees={handleClearDemoEmployees}
            onClearAllDemoData={handleClearAllDemoData}
            onResetAllDemoData={handleResetAllDemoData}
            onAutoGenerateRules={handleAutoGenerateRules}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onNavigateTab={setActiveTab}
            onOpenDataManagement={() => setShowDataManagementModal(true)}
            onClearAllMatrix={handleClearAllMatrixRules}
          />
        )}

        {activeTab === 'employees' && (
          <TrainingEmployeesTab
            employees={employees}
            projects={projects}
            canManageTraining={canManageTraining}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onMarkResigned={handleMarkResigned}
            onViewEmployeeSummary={handleViewEmployeeSummary}
          />
        )}

        {activeTab === 'courses' && (
          <TrainingCoursesTab
            courses={courses}
            onSaveCourse={handleSaveCourse}
            onDeleteCourse={handleDeleteCourse}
            onClearDemoCourses={handleClearDemoCourses}
            onClearAllCourses={handleClearAllCourses}
            onResetDemoCourses={handleResetDemoCourses}
            onOpenDataManagement={() => setShowDataManagementModal(true)}
            userRole={userRole}
            isAdminOrHr={canManageTraining}
            canManageTraining={canManageTraining}
          />
        )}

        {activeTab === 'projects' && (
          <TrainingProjectsTab
            projects={projects}
            projectMetrics={projectMetrics}
            canManageProjects={canManageProjects}
            onAddProject={handleAddProject}
            onMarkProjectCompleted={handleMarkProjectCompleted}
            onSelectProjectForDashboard={handleSelectProjectForDashboard}
          />
        )}

        {activeTab === 'individual' && (
          <TrainingIndividualReportTab
            employees={employees}
            courses={courses}
            complianceRecords={complianceRecords}
            logs={logs}
            selectedEmployeeId={selectedEmployeeForReport}
            onSelectEmployee={setSelectedEmployeeForReport}
          />
        )}
      </div>

      {/* Data Management & Fresh Start Modal */}
      {showDataManagementModal && (
        <TrainingDataManagementModal
          isOpen={showDataManagementModal}
          onClose={() => setShowDataManagementModal(false)}
          counts={{
            employees: employees.length,
            demoEmployees: employees.filter(isDemoEmployee).length,
            courses: courses.length,
            demoCourses: courses.filter(isDemoCourse).length,
            matrix: matrix.length,
            demoMatrix: matrix.filter(isDemoMatrixRule).length,
            logs: logs.length,
            demoLogs: logs.filter(isDemoLog).length,
            alerts: urgentAlertsCount,
          }}
          onClearAllTrainingData={handleClearAllTrainingData}
          onClearAllDemoData={handleClearAllDemoData}
          onResetAllDemoData={handleResetAllDemoData}
          onClearEmployees={handleClearAllEmployees}
          onClearDemoEmployees={handleClearDemoEmployees}
          onResetDemoEmployees={handleResetDemoEmployees}
          onClearCourses={handleClearAllCourses}
          onClearDemoCourses={handleClearDemoCourses}
          onResetDemoCourses={handleResetDemoCourses}
          onClearMatrix={handleClearAllMatrixRules}
          onClearDemoMatrix={handleClearDemoMatrix}
          onResetDemoMatrix={handleResetDemoMatrix}
          onClearLogs={handleClearAllLogs}
          onClearDemoLogs={handleClearDemoLogs}
          onResetDemoLogs={handleResetDemoLogs}
        />
      )}
    </div>
  );
}
