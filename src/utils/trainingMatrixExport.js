import * as XLSX from 'xlsx';
import { formatDate } from './dateFormatter';
import { matchEmployeeLog, matchCourseLog, formatDisplayEmployeeId } from '../services/trainingService';

/**
 * Exports the 2D Training Matrix grid to an Excel file matching the Status Dashboard layout
 */
export function exportTrainingMatrixToExcel({
  employees = [],
  courses = [],
  matrix = [],
  logs = [],
  selectedProject = 'ALL',
}) {
  const validLogs = logs.filter(l => !l.cancelled);

  // Filter employees if selectedProject is set
  const filteredEmployees = employees.filter(emp => {
    if (emp.status === 'Resigned') return false;
    if (selectedProject !== 'ALL') {
      const matchProj = emp.currentProject === selectedProject || (emp.department && emp.department === selectedProject);
      if (!matchProj) return false;
    }
    return true;
  });

  const wb = XLSX.utils.book_new();

  // 1. Title row
  const titleRow = [
    'Status Dashboard — automatically calculated from Training_Log (do not type into this sheet)'
  ];

  // 2. Category header row
  const catRow = ['', '', '', '', ''];
  courses.forEach(c => {
    catRow.push(c.requirementTier || c.category || 'TRAINING');
  });

  // 3. Course name header row
  const headerRow = ['No.', 'Employee ID', 'Name', 'Group/Project', 'Row'];
  courses.forEach(c => {
    headerRow.push(c.name || c.code || c.id);
  });

  const aoa = [
    titleRow,
    catRow,
    headerRow,
  ];

  // Helper to get required status for an employee and course
  const isCourseRequired = (emp, course) => {
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
    const globalDefault = matrix.filter(m => m.projectId === 'GLOBAL-DEFAULT');
    if (globalDefault.length > 0) {
      return globalDefault.some(m => (m.requiredCourseIds || []).includes(course.id));
    }
    // Fallback standard
    if (course.requirementTier === 'MANDATORY') return true;
    return ['CRS-001', 'CRS-002', 'CRS-007'].includes(course.id);
  };

  // Helper to compute course cell data for employee
  const getCellData = (emp, course) => {
    const isReq = isCourseRequired(emp, course);
    const empLogs = validLogs
      .filter(l => matchEmployeeLog(emp, l) && matchCourseLog(course, l))
      .sort((a, b) => new Date(b.completionDate || 0) - new Date(a.completionDate || 0));

    const latest = empLogs[0];
    const isELearning = course.validityMonths === 0 || course.category === 'E-Learning' || course.code?.includes('EL');

    let trainedDate = '-';
    let expireDate = '-';
    let status = '-';

    if (latest) {
      trainedDate = formatDate(latest.completionDate);
      if (isELearning) {
        expireDate = 'N/A';
        status = 'AVB';
      } else if (latest.expiryDate) {
        expireDate = formatDate(latest.expiryDate);
        const expTime = new Date(latest.expiryDate).getTime();
        const nowTime = new Date().getTime();
        const diffDays = Math.round((expTime - nowTime) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          status = 'EXP';
        } else if (diffDays <= 90) {
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
    };
  };

  // Build rows for each employee (4 sub-rows each)
  filteredEmployees.forEach((emp, idx) => {
    const num = idx + 1;
    const empId = formatDisplayEmployeeId(emp);
    const empName = emp.name;
    const groupProject = emp.department || emp.currentProject || 'OPS';

    const row1 = [num, empId, empName, groupProject, 'Last Training Date'];
    const row2 = ['', empId, empName, groupProject, 'Expire Date'];
    const row3 = ['', '', '', groupProject, 'Status'];
    const row4 = ['', empId, empName, groupProject, 'Required (helper)'];

    courses.forEach(c => {
      const data = getCellData(emp, c);
      row1.push(data.trainedDate);
      row2.push(data.expireDate);
      row3.push(data.status);
      row4.push(data.required);
    });

    aoa.push(row1, row2, row3, row4);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column width calculations
  const cols = [
    { wch: 6 },  // No.
    { wch: 16 }, // EmployeeID
    { wch: 26 }, // Name
    { wch: 14 }, // Group/Project
    { wch: 18 }, // Row
  ];
  courses.forEach(c => {
    cols.push({ wch: Math.max(14, (c.name || '').length > 20 ? 18 : 14) });
  });
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, 'Status Dashboard');

  const fileName = `Training_Matrix_Dashboard_${selectedProject}_${formatDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
