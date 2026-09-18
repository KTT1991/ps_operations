import { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2,
  X, AlertTriangle, FileText, Check, ShieldAlert, ArrowRight, Info,
  Users, UserPlus, RefreshCw, BookOpen, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  downloadTrainingLogTemplate,
  parseAndValidateTrainingExcel
} from '../../services/trainingService';

export default function TrainingExcelImportModal({
  isOpen,
  onClose,
  courses = [],
  employees = [],
  existingLogs = [],
  onBatchAddLogs,
  onAddEmployee,
  onAddCourse,
}) {
  const [file, setFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [activePreviewTab, setActivePreviewTab] = useState('valid'); // 'valid', 'duplicates', 'invalid'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoRegistering, setIsAutoRegistering] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    try {
      downloadTrainingLogTemplate({ courses, employees });
      toast.success('Excel template downloaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download template');
    }
  };

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;

    if (!/\.(xlsx|xls|csv)$/i.test(selectedFile.name)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setParseResult(null);

    try {
      const result = await parseAndValidateTrainingExcel(selectedFile, {
        courses,
        employees,
        existingLogs,
      });
      setParseResult(result);

      if (result.validRows.length > 0) {
        setActivePreviewTab('valid');
      } else if (result.duplicateRows.length > 0) {
        setActivePreviewTab('duplicates');
      } else {
        setActivePreviewTab('invalid');
      }

      if (result.validRows.length === 0 && result.duplicateRows.length > 0) {
        toast('All records in file are already in the database (duplicates skipped)', {
          icon: 'ℹ️',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to parse Excel file');
      setFile(null);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAutoRegisterMissing = async ({ registerEmployees = true, registerCourses = true } = {}) => {
    if (!file) return;
    setIsAutoRegistering(true);
    try {
      let currentEmps = [...employees];
      let currentCourses = [...courses];
      let empCount = 0;
      let crsCount = 0;

      // 1. Register Missing Employees
      if (registerEmployees && onAddEmployee && parseResult?.unmatchedEmployees?.length) {
        for (const u of parseResult.unmatchedEmployees) {
          const payload = {
            id: u.suggestedId,
            empNo: u.suggestedId,
            name: u.suggestedName,
            position: u.position || 'Technician',
            department: u.department || 'Operations',
            status: 'Active',
            joinDate: new Date().toISOString().split('T')[0],
          };
          await onAddEmployee(payload);
          currentEmps.push(payload);
          empCount++;
        }
      }

      // 2. Register Missing Courses
      if (registerCourses && onAddCourse && parseResult?.unmatchedCourses?.length) {
        for (const c of parseResult.unmatchedCourses) {
          const payload = {
            code: c.suggestedCode,
            name: c.suggestedName,
            category: c.suggestedCategory || 'Offshore Safety',
            validityMonths: c.suggestedValidity || 24,
            provider: c.suggestedProvider || '',
            active: true,
          };
          await onAddCourse(payload);
          currentCourses.push(payload);
          crsCount++;
        }
      }

      const summary = [];
      if (empCount > 0) summary.push(`${empCount} personnel (with positions)`);
      if (crsCount > 0) summary.push(`${crsCount} course(s)`);
      toast.success(`Successfully registered: ${summary.join(', ')}!`);

      // 3. Re-validate file with updated data
      const newResult = await parseAndValidateTrainingExcel(file, {
        courses: currentCourses,
        employees: currentEmps,
        existingLogs,
      });
      setParseResult(newResult);
      if (newResult.validRows.length > 0) {
        setActivePreviewTab('valid');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to auto-register: ' + err.message);
    } finally {
      setIsAutoRegistering(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await onBatchAddLogs(parseResult.validRows);
      const addedCount = response?.accepted?.length || parseResult.validRows.length;
      const dupCount = (parseResult.duplicateRows.length) + (response?.duplicates?.length || 0);

      toast.success(
        `Imported ${addedCount} records successfully! ${
          dupCount > 0 ? `(${dupCount} duplicates safely skipped)` : ''
        }`
      );
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Import failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const hasUnmatchedEmps = Boolean(parseResult?.unmatchedEmployees?.length);
  const hasUnmatchedCourses = Boolean(parseResult?.unmatchedCourses?.length);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/80">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Import Training Records via Excel
              </h3>
              <p className="text-xs text-slate-500">
                Safe Append Mode: Adds new records without overwriting existing data, with duplicate filtering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip box explaining append behavior */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Append Only Mode:</span> Simply enter newly completed certifications in the template. The system automatically appends new records while protecting historical records against duplicates.
          </div>
        </div>

        {/* Action 1: Download Template Banner */}
        <div className="bg-gradient-to-r from-orange-50/70 to-amber-50/50 border border-orange-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-orange-900">
              <Download className="w-4 h-4 text-orange-600" />
              Step 1: Download Standard Form Template
            </div>
            <p className="text-[11px] text-orange-800/80 mt-0.5 max-w-md">
              Includes pre-filled column formats, sample inputs, and reference sheets for all active Personnel & Course Codes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            Download Form (.xlsx)
          </button>
        </div>

        {/* Action 2: Upload Zone */}
        {!parseResult && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-orange-500 hover:bg-orange-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />
            <div className="p-3.5 bg-slate-100 rounded-2xl text-slate-500 group-hover:text-orange-600 transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">
                {isParsing ? 'Parsing Excel File...' : 'Click to select or drag & drop filled Excel file'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Supports .xlsx or .xls (Excel files). Duplicates will be detected automatically.
              </p>
            </div>
            {isParsing && (
              <div className="flex items-center gap-2 text-xs text-orange-600 font-semibold">
                <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                Validating personnel, courses & duplicate checks...
              </div>
            )}
          </div>
        )}

        {/* Parse Results Preview */}
        {parseResult && (
          <div className="space-y-4">
            {/* File info bar & Reset */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold text-slate-800 truncate">{file?.name}</span>
                <span className="text-slate-400 text-[11px]">({parseResult.totalRows} rows read)</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex-shrink-0 ml-2"
              >
                Change File
              </button>
            </div>

            {/* Metrics pills */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => setActivePreviewTab('valid')}
                className={clsx(
                  'p-3 rounded-xl border transition-all text-left flex flex-col justify-between',
                  activePreviewTab === 'valid'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800">Ready to Import</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  {parseResult.validRows.length}
                </div>
                <span className="text-[10px] text-emerald-600">New valid records</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('duplicates')}
                className={clsx(
                  'p-3 rounded-xl border transition-all text-left flex flex-col justify-between',
                  activePreviewTab === 'duplicates'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-amber-800">Duplicates Skipped</span>
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xl font-bold text-amber-700 mt-1">
                  {parseResult.duplicateRows.length}
                </div>
                <span className="text-[10px] text-amber-600">Will NOT be added</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab('invalid')}
                className={clsx(
                  'p-3 rounded-xl border transition-all text-left flex flex-col justify-between',
                  activePreviewTab === 'invalid'
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-rose-800">Invalid Rows</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-rose-700 mt-1">
                  {parseResult.invalidRows.length}
                </div>
                <span className="text-[10px] text-rose-600">Errors in data</span>
              </button>
            </div>

            {/* 1-Click Master Auto-Create Banner if both or either missing */}
            {(hasUnmatchedEmps || hasUnmatchedCourses) && (
              <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-emerald-50 border-2 border-orange-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-2.5 bg-gradient-to-br from-orange-600 to-amber-600 text-white rounded-xl shadow-xs shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>1-Click Auto-Setup Missing Master Data</span>
                      <span className="text-[10px] font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full border border-orange-200">
                        {[
                          hasUnmatchedEmps && `${parseResult.unmatchedEmployees.length} Personnel`,
                          hasUnmatchedCourses && `${parseResult.unmatchedCourses.length} Courses`
                        ].filter(Boolean).join(' + ')}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Automatically extract and create all missing Personnel (with Position & Department) and Courses from your spreadsheet in one step, without having to manually add them one by one.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAutoRegistering}
                  onClick={() => handleAutoRegisterMissing({ registerEmployees: true, registerCourses: true })}
                  className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 shrink-0 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isAutoRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating All Records...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Auto-Create All & Re-validate
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Unmatched Employees Prompt */}
            {hasUnmatchedEmps && (
              <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-4 text-amber-950 space-y-3 animate-fade-in shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>New Personnel IDs / Names found in Excel</span>
                        <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {parseResult.unmatchedEmployees.length} people
                        </span>
                      </h4>
                      <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                        Positions and Departments detected from Excel will be automatically assigned.
                      </p>
                    </div>
                  </div>

                  {onAddEmployee && (
                    <button
                      type="button"
                      disabled={isAutoRegistering}
                      onClick={() => handleAutoRegisterMissing({ registerEmployees: true, registerCourses: false })}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {isAutoRegistering ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Register Personnel ({parseResult.unmatchedEmployees.length})
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-amber-200/60 max-h-28 overflow-y-auto">
                  {parseResult.unmatchedEmployees.map((u, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200/80 text-slate-800 rounded-lg text-[11px] font-medium shadow-2xs"
                    >
                      <span className="font-semibold text-slate-900">{u.suggestedName}</span>
                      <span className="text-amber-700 font-mono text-[10px]">({u.suggestedId})</span>
                      <span className="text-[10px] text-slate-500">[{u.position || 'Technician'}]</span>
                      <span className="text-[9.5px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                        {u.count} rows
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Courses Prompt */}
            {hasUnmatchedCourses && (
              <div className="bg-indigo-50 border border-indigo-300/80 rounded-2xl p-4 text-indigo-950 space-y-3 animate-fade-in shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700 shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>New Courses found in Excel</span>
                        <span className="bg-indigo-200/80 text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {parseResult.unmatchedCourses.length} courses
                        </span>
                      </h4>
                      <p className="text-[11px] text-indigo-800/90 mt-0.5 leading-relaxed">
                        Course titles and validity durations will be added directly into your Course Catalog.
                      </p>
                    </div>
                  </div>

                  {onAddCourse && (
                    <button
                      type="button"
                      disabled={isAutoRegistering}
                      onClick={() => handleAutoRegisterMissing({ registerEmployees: false, registerCourses: true })}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-98 disabled:opacity-50 cursor-pointer"
                    >
                      {isAutoRegistering ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3.5 h-3.5" />
                          Register Courses ({parseResult.unmatchedCourses.length})
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-200/60 max-h-28 overflow-y-auto">
                  {parseResult.unmatchedCourses.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-indigo-200/80 text-slate-800 rounded-lg text-[11px] font-medium shadow-2xs"
                    >
                      <span className="font-semibold text-slate-900">{c.suggestedName}</span>
                      <span className="text-indigo-600 font-mono text-[10.5px]">({c.suggestedCode})</span>
                      <span className="text-[10px] text-slate-500 font-sans">({c.suggestedValidity} mos)</span>
                      <span className="text-[9.5px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full font-bold">
                        {c.count} rows
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tab Preview Table */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-56 overflow-y-auto">
              {activePreviewTab === 'valid' && (
                <div>
                  <div className="text-[11px] font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Valid Records to be Added ({parseResult.validRows.length})</span>
                    <span className="text-[10.5px] text-slate-400 font-normal">Duplicates are excluded</span>
                  </div>
                  {parseResult.validRows.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No new valid records found to import.
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {parseResult.validRows.map((r, i) => (
                        <div
                          key={i}
                          className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>{r.employeeName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({r.employeeId})</span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                              <span className="font-medium text-slate-800">{r.courseName}</span>
                              {r.courseCode && (
                                <span className="text-slate-400 font-mono text-[10px]">({r.courseCode})</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-slate-500">
                            <div>Trained: <strong className="text-slate-700">{r.completionDate}</strong></div>
                            {r.expiryDate ? (
                              <div>Expires: <strong className="text-slate-700">{r.expiryDate}</strong></div>
                            ) : (
                              <div className="text-slate-400 italic">No expiry</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activePreviewTab === 'duplicates' && (
                <div>
                  <div className="text-[11px] font-bold text-amber-800 mb-2 flex items-center justify-between">
                    <span>Identified Duplicate Records ({parseResult.duplicateRows.length})</span>
                    <span className="text-[10.5px] text-amber-600 font-normal">Protected against duplicate insert</span>
                  </div>
                  {parseResult.duplicateRows.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No duplicate entries detected!
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {parseResult.duplicateRows.map((r, i) => (
                        <div
                          key={i}
                          className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80 text-amber-900"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span>{r.employeeName} ({r.employeeId})</span>
                            <span className="text-[10px] bg-amber-200/70 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                              DUPLICATE
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-800/80 mt-1">
                            {r.reason || 'Already recorded in system'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activePreviewTab === 'invalid' && (
                <div>
                  <div className="text-[11px] font-bold text-rose-800 mb-2">
                    Invalid Rows ({parseResult.invalidRows.length})
                  </div>
                  {parseResult.invalidRows.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      All rows passed formatting requirements!
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      {parseResult.invalidRows.map((r, i) => (
                        <div
                          key={i}
                          className="bg-rose-50/70 p-2.5 rounded-lg border border-rose-200 text-rose-900 text-[11px] flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-rose-900">
                              Row #{r.rowNum}: {r.reason}
                            </div>
                            {r.isMissingEmployee && (
                              <div className="text-[10.5px] text-rose-700/90 mt-0.5">
                                Tip: Click &quot;Auto-Create All&quot; above to register this employee with position and department automatically.
                              </div>
                            )}
                            {r.isMissingCourse && (
                              <div className="text-[10.5px] text-indigo-700/90 mt-0.5">
                                Tip: Click &quot;Auto-Create All&quot; above to register this course code into your Course Catalog automatically.
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            {r.isMissingEmployee && (
                              <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                                Unregistered Personnel
                              </span>
                            )}
                            {r.isMissingCourse && (
                              <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-bold whitespace-nowrap">
                                Unregistered Course
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {parseResult && parseResult.validRows.length > 0 ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Records...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Import {parseResult.validRows.length} New Records
                  </>
                )}
              </button>
            ) : parseResult ? (
              <span className="text-xs text-slate-400 italic">
                No new valid records to import
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
