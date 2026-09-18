import { useState, useMemo } from 'react';
import {
  FileText, Download, Printer, User, Award,
  CheckCircle2, Clock, XCircle, AlertTriangle, Building2,
  Calendar, ShieldCheck, Search
} from 'lucide-react';
import { exportEmployeePDF, formatDisplayEmployeeId, compareEmployeeId } from '../../services/trainingService';
import { formatDate } from '../../utils/dateFormatter';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function TrainingIndividualReportTab({
  employees = [],
  courses = [],
  complianceRecords = [],
  logs = [],
  selectedEmployeeId = null,
  onSelectEmployee
}) {
  const [currentEmpId, setCurrentEmpId] = useState(
    selectedEmployeeId || (employees[0]?.id || '')
  );

  // Sync if selectedEmployeeId prop changes
  useMemo(() => {
    if (selectedEmployeeId) {
      setCurrentEmpId(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  const currentEmployee = useMemo(() => {
    return employees.find(e => e.id === currentEmpId) || employees[0] || null;
  }, [employees, currentEmpId]);

  // Employee compliance records
  const empCompliance = useMemo(() => {
    if (!currentEmployee) return [];
    return complianceRecords.filter(r => r.employeeId === currentEmployee.id);
  }, [complianceRecords, currentEmployee]);

  // Employee logs sorted newest to oldest
  const empLogs = useMemo(() => {
    if (!currentEmployee) return [];
    return logs
      .filter(l => l.employeeId === currentEmployee.id)
      .sort((a, b) => new Date(b.completionDate || b.recordedAt) - new Date(a.completionDate || a.recordedAt));
  }, [logs, currentEmployee]);

  // Stats
  const compliantCount = empCompliance.filter(r => r.status === 'AVB').length;
  const remCount = empCompliance.filter(r => r.status === 'REM').length;
  const expCount = empCompliance.filter(r => r.status === 'EXP').length;
  const notTrainedCount = empCompliance.filter(r => r.status === 'NOT_TRAINED').length;
  const complianceRate = empCompliance.length > 0 ? Math.round((compliantCount / empCompliance.length) * 100) : 100;

  const handleDownloadPDF = () => {
    if (!currentEmployee) return;
    try {
      exportEmployeePDF({
        employee: currentEmployee,
        complianceRecords,
        allLogs: logs,
        courses,
      });
      toast.success(`Generated Training Passport PDF for ${currentEmployee.name}`);
    } catch (err) {
      toast.error(err.message || 'Failed to generate PDF');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!currentEmployee) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs">
        <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No employee records available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Selector & Export Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100">
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1 max-w-sm">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Select Personnel</div>
            <select
              value={currentEmpId}
              onChange={(e) => {
                setCurrentEmpId(e.target.value);
                if (onSelectEmployee) onSelectEmployee(e.target.value);
              }}
              className="w-full text-sm font-bold text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-6 mt-0.5 font-sans"
            >
              {employees
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
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleDownloadPDF}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print
          </button>
        </div>
      </div>

      {/* Printable / Viewable Passport Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Top Header Identity Banner */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-sans font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/80">
                Employee ID: {formatDisplayEmployeeId(currentEmployee)}
              </span>
              <span className={clsx(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                currentEmployee.status === 'Resigned'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}>
                {currentEmployee.status || 'Active'}
              </span>
            </div>

            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {currentEmployee.name}
            </h1>
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
              <span>{currentEmployee.position}</span>
              <span>&bull;</span>
              <span>{currentEmployee.department || 'Operations'}</span>
              <span>&bull;</span>
              <span>Project: <strong className="text-orange-600">{currentEmployee.currentProject || 'Unassigned'}</strong></span>
            </div>
          </div>

          {/* Compliance Badge */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-right">
              <div className="text-[11px] font-medium text-slate-400">Role Compliance</div>
              <div className="text-lg font-bold text-slate-900">{complianceRate}%</div>
            </div>
            <div className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border',
              complianceRate >= 90
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : complianceRate >= 70
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            )}>
              {compliantCount}/{empCompliance.length}
            </div>
          </div>
        </div>

        {/* Section 1: Required Matrix Competencies */}
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                Required Matrix Competencies & Current Status
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Mandatory courses governed by project requirements for this job role
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Course / Qualification</th>
                  <th className="py-2.5 px-3">Completed</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Certificate #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {empCompliance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                      No mandatory courses specified in matrix for this position.
                    </td>
                  </tr>
                ) : (
                  empCompliance.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 leading-snug">
                          {row.courseName}
                        </div>
                        {row.courseCode && (
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Ref: <span className="font-mono text-slate-500">{row.courseCode}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-600">
                        {formatDate(row.completionDate)}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-600">
                        {formatDate(row.expiryDate)}
                      </td>
                      <td className="py-3 px-3">
                        {row.status === 'AVB' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            VALID (AVB)
                          </span>
                        )}
                        {row.status === 'REM' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            EXPIRING ({row.daysRemaining}d)
                          </span>
                        )}
                        {row.status === 'EXP' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            EXPIRED ({Math.abs(row.daysRemaining)}d ago)
                          </span>
                        )}
                        {row.status === 'NOT_TRAINED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <AlertTriangle className="w-3 h-3 text-purple-600" />
                            NOT TRAINED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-600">
                        {row.certNo || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Historical Training Log (Chronological: Newest -> Oldest) */}
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Complete Certification History (Newest &rarr; Oldest)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditable chronological ledger of all safety qualifications and refresher completions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Date Completed</th>
                  <th className="py-2.5 px-3">Course / Skill</th>
                  <th className="py-2.5 px-3">Certificate #</th>
                  <th className="py-2.5 px-3">Training Provider</th>
                  <th className="py-2.5 px-3">Valid Until</th>
                  <th className="py-2.5 px-3">Remarks / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {empLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No training completion history recorded for this employee.
                    </td>
                  </tr>
                ) : (
                  empLogs.map(log => {
                    const isVoid = Boolean(log.cancelled);
                    return (
                      <tr
                        key={log.id}
                        className={clsx(
                          'hover:bg-slate-50/50',
                          isVoid && 'bg-rose-50/20 line-through opacity-60'
                        )}
                      >
                        <td className="py-3 px-3 font-sans text-slate-700 whitespace-nowrap">
                          {formatDate(log.completionDate)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 leading-snug">
                            {log.courseName || log.courseCode}
                          </div>
                          {log.courseCode && log.courseName && log.courseCode !== log.courseName && (
                            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                              Ref: <span className="font-mono text-slate-500">{log.courseCode}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans font-medium text-slate-700 whitespace-nowrap">
                          {log.certNo || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {log.institute || '—'}
                        </td>
                        <td className="py-3 px-3 font-sans whitespace-nowrap">
                          {isVoid ? (
                            <span className="text-rose-600 font-semibold">VOIDED</span>
                          ) : log.expiryDate ? (
                            <span className="text-slate-700">{formatDate(log.expiryDate)}</span>
                          ) : (
                            <span className="text-slate-400 italic">No Expiry</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {isVoid ? (
                            <span className="text-rose-600 italic">
                              Cancelled: {log.cancelReason || 'Void'}
                            </span>
                          ) : (
                            log.remarks || '—'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
