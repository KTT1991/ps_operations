import React, { useState } from 'react';
import {
  Database,
  Trash2,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  BookOpen,
  Users,
  FileSpreadsheet,
  Layers,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrainingDataManagementModal({
  isOpen,
  onClose,
  user,
  employees = [],
  courses = [],
  matrix = [],
  logs = [],
  urgentAlertsCount = 0,
  onClearAllTrainingData,
  onClearAllDemoData,
  onResetAllDemoData,
  onClearDemoCourses,
  onClearAllCourses,
  onResetDemoCourses,
  onClearAllMatrix,
  onResetDemoMatrix,
  onAutoGenerateRules,
  onClearAllEmployees,
  onResetDemoEmployees,
  onClearAllLogs,
  onResetDemoLogs,
  onDataChanged,
}) {
  const [activeSubTab, setActiveSubTab] = useState('fresh_start'); // 'fresh_start' | 'demo_only' | 'individual' | 'restore'
  const [freshOptions, setFreshOptions] = useState({
    logs: true,
    rules: true,
    employees: true,
    courses: false,
  });
  const [includeCoursesInDemoClear, setIncludeCoursesInDemoClear] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmStep, setConfirmStep] = useState(null); // null | 'fresh_start' | 'clear_demo' | 'restore_demo'

  if (!isOpen) return null;

  const handleExecuteFreshStart = async () => {
    setIsProcessing(true);
    try {
      if (onClearAllTrainingData) {
        const res = await onClearAllTrainingData({
          clearEmployees: freshOptions.employees,
          clearRules: freshOptions.rules,
          clearLogs: freshOptions.logs,
          clearCourses: freshOptions.courses,
        });
        toast.success(
          `Data cleared successfully! (Employees: ${res?.clearedEmployees ?? 0}, Rules: ${res?.clearedRules ?? 0}, Logs: ${res?.clearedLogs ?? 0}${freshOptions.courses ? `, Courses: ${res?.clearedCourses ?? 0}` : ''})`
        );
      }
      setConfirmStep(null);
      if (onDataChanged) await onDataChanged();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error occurred while clearing data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteDemoClear = async () => {
    setIsProcessing(true);
    try {
      if (onClearAllDemoData) {
        const res = await onClearAllDemoData({ clearCourses: includeCoursesInDemoClear });
        toast.success(
          `Demo data removed successfully! (Employees: ${res?.clearedEmployees ?? 0}, Rules: ${res?.clearedRules ?? 0}, Logs: ${res?.clearedLogs ?? 0}${includeCoursesInDemoClear ? `, Courses: ${res?.clearedCourses ?? 0}` : ''})`
        );
      }
      setConfirmStep(null);
      if (onDataChanged) await onDataChanged();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error occurred while clearing demo data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteRestoreDemo = async () => {
    setIsProcessing(true);
    try {
      if (onResetAllDemoData) {
        await onResetAllDemoData();
        toast.success('Standard demo dataset restored successfully (Employees, Rules, Courses, and Training Logs)');
      }
      setConfirmStep(null);
      if (onDataChanged) await onDataChanged();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error occurred while restoring demo data');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Data Tools & Reset Manager
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Wipe demo data to start entering real organization records, or restore sample data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Counters */}
        <div className="px-6 py-3.5 bg-slate-100/50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-500" />
              <span>Personnel</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{employees.length} <span className="text-[11px] font-normal text-slate-500">active</span></div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Layers className="w-3 h-3 text-orange-500" />
              <span>Matrix Rules</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{matrix.length} <span className="text-[11px] font-normal text-slate-500">rules</span></div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-emerald-500" />
              <span>Courses</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{courses.length} <span className="text-[11px] font-normal text-slate-500">courses</span></div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-blue-500" />
              <span>Training Logs</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">{logs.length} <span className="text-[11px] font-normal text-slate-500">records</span></div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Active Alerts</span>
            </div>
            <div className={`text-base font-bold mt-0.5 ${urgentAlertsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {urgentAlertsCount} <span className="text-[11px] font-normal text-slate-500">pending</span>
            </div>
          </div>
        </div>

        {/* Informative Explanation Banner */}
        <div className="mx-6 mt-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">
                Why did Alerts or Matrix still display after clearing training logs?
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                <li>
                  <strong>Compliance Alerts:</strong> Computed dynamically between <em>&ldquo;Personnel&rdquo;</em> and their <em>&ldquo;Position Matrix Rules&rdquo;</em>. If personnel exist with required courses but have no completion logs, the system alerts that training is <strong>&ldquo;Not Trained&rdquo;</strong>.
                </li>
                <li>
                  <strong>Clean Slate (0 Alerts):</strong> To make the dashboard completely clean and set Alerts to 0, choose <strong>Fresh Start</strong> to clear Matrix Rules and Demo Personnel. You can then import your real employee roster and define position rules.
                </li>
                <li>
                  <strong>Course Catalog:</strong> You can keep the standard safety courses (BOSIET, H2S, OGUK Medical, etc.) or clear them to define your own custom catalog.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => { setActiveSubTab('fresh_start'); setConfirmStep(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'fresh_start'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🌟 Fresh Start (Wipe for Real Data)
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('demo_only'); setConfirmStep(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'demo_only'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🧹 Demo Only (Clear Samples)
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('individual'); setConfirmStep(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'individual'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ⚙️ Modular (By Category)
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('restore'); setConfirmStep(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'restore'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🔄 Restore Demo Data
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* TAB 1: FRESH START */}
          {activeSubTab === 'fresh_start' && (
            <div className="space-y-4">
              <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-4">
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <span>Select data to wipe before entering real organizational data</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Check the boxes for categories you want to reset to zero. When Matrix rules and personnel are cleared, Alerts will immediately drop to 0.
                </p>

                <div className="mt-3 space-y-2.5">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={freshOptions.logs}
                      onChange={(e) => setFreshOptions(prev => ({ ...prev, logs: e.target.checked }))}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800">Clear All Training Logs</span>
                      <span className="text-slate-500 ml-2">({logs.length} current records)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={freshOptions.rules}
                      onChange={(e) => setFreshOptions(prev => ({ ...prev, rules: e.target.checked }))}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800">Clear All Position Matrix Rules</span>
                      <span className="text-slate-500 ml-2">({matrix.length} current rules)</span>
                      <span className="block text-[11px] text-emerald-700 font-medium mt-0.5">
                        ✓ Recommended: Alerts counter will instantly reset to 0 with no pending phantom warnings.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={freshOptions.employees}
                      onChange={(e) => setFreshOptions(prev => ({ ...prev, employees: e.target.checked }))}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800">Clear All Personnel / Employees</span>
                      <span className="text-slate-500 ml-2">({employees.length} current employees)</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Prepares system for importing company employee roster via Excel or manual entry.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={freshOptions.courses}
                      onChange={(e) => setFreshOptions(prev => ({ ...prev, courses: e.target.checked }))}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold text-slate-800">Clear Courses Catalog</span>
                      <span className="text-slate-500 ml-2">({courses.length} courses)</span>
                      <span className="block text-[11px] text-amber-700 font-medium mt-0.5">
                        Leave unchecked to keep standard industry courses (BOSIET, H2S, OGUK, etc.) ready for use.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {confirmStep === 'fresh_start' ? (
                <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 animate-in fade-in">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Confirm Fresh Start Wipe?</span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-1">
                    This action will remove the selected data so you can begin entering real company records cleanly.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteFreshStart}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Wiping data...' : 'Yes, Wipe Selected Data'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmStep(null)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-500">
                    After wiping, you can import personnel and training records directly via Excel.
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmStep('fresh_start')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Execute Fresh Start Wipe</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DEMO ONLY */}
          {activeSubTab === 'demo_only' && (
            <div className="space-y-4">
              <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4">
                <h3 className="text-sm font-bold text-orange-950 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-orange-600" />
                  <span>Remove Demo Data Only</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Removes built-in sample employees, sample matrix rules, and sample training logs, while keeping any records you personally entered.
                </p>

                <div className="mt-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeCoursesInDemoClear}
                      onChange={(e) => setIncludeCoursesInDemoClear(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-800">Clear Demo Courses as well (12 standard courses)</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Leave unchecked to keep standard safety course definitions.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {confirmStep === 'clear_demo' ? (
                <div className="p-4 rounded-xl bg-orange-50 border-2 border-orange-300 animate-in fade-in">
                  <div className="flex items-center gap-2 text-orange-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span>Confirm removing demo sample data?</span>
                  </div>
                  <p className="text-[11px] text-orange-700 mt-1">
                    System demo records will be removed. Your custom entered data will be preserved.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteDemoClear}
                      className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Removing...' : 'Confirm Remove Demo Data'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmStep(null)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep('clear_demo')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Demo Data</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INDIVIDUAL / MODULAR */}
          {activeSubTab === 'individual' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 mb-2">
                Manage or wipe individual data categories as needed:
              </p>

              {/* Matrix Rules Row */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-600" />
                    <span>Job Position Matrix Rules</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Currently <strong>{matrix.length}</strong> rules (Clear to reset Active Alerts to 0)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onAutoGenerateRules && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onAutoGenerateRules();
                        if (onDataChanged) await onDataChanged();
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Auto-Generate from Positions
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (onClearAllMatrix) {
                        await onClearAllMatrix();
                        toast.success('Cleared all matrix rules');
                        if (onDataChanged) await onDataChanged();
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear All Rules
                  </button>
                </div>
              </div>

              {/* Courses Row */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Safety Courses Catalog</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Currently <strong>{courses.length}</strong> courses defined
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onResetDemoCourses) {
                        await onResetDemoCourses();
                        toast.success('Restored 12 standard courses');
                        if (onDataChanged) await onDataChanged();
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Restore 12 Courses
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onClearAllCourses) {
                        await onClearAllCourses();
                        toast.success('Cleared all courses');
                        if (onDataChanged) await onDataChanged();
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear All Courses
                  </button>
                </div>
              </div>

              {/* Personnel Row */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Personnel / Employees</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Currently <strong>{employees.length}</strong> employees registered
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onClearAllEmployees) {
                        await onClearAllEmployees();
                        toast.success('Cleared all personnel records');
                        if (onDataChanged) await onDataChanged();
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear All Personnel
                  </button>
                </div>
              </div>

              {/* Training Logs Row */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span>Training Certificate Logs</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Currently <strong>{logs.length}</strong> training completion records
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onClearAllLogs) {
                        await onClearAllLogs();
                        toast.success('Cleared all training logs');
                        if (onDataChanged) await onDataChanged();
                      }
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear All Logs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RESTORE DEMO */}
          {activeSubTab === 'restore' && (
            <div className="space-y-4">
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span>Restore Standard Demo Dataset</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Loads the complete demo sandbox dataset for exploration and testing:
                </p>
                <ul className="mt-2 text-xs space-y-1 text-slate-700 list-disc list-inside">
                  <li><strong>14 Sample Personnel</strong> with job positions, departments, and Employee IDs</li>
                  <li><strong>7 Standard Position Matrix Rules</strong> mapped by job title</li>
                  <li><strong>12 Industry Safety Courses</strong> (BOSIET, H2S, WAH, Confined Space, etc.)</li>
                  <li><strong>36 Training Completion Records</strong> simulating Valid, Due Soon, and Expired states</li>
                </ul>
              </div>

              {confirmStep === 'restore_demo' ? (
                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Confirm restoring demo dataset?</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteRestoreDemo}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Loading...' : 'Yes, Restore Demo Dataset'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmStep(null)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmStep('restore_demo')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restore Demo Dataset</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Data is securely saved and can be exported to Excel anytime</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
