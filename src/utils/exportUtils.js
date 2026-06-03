import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME || 'OGS OpsCenter';

// ==================== EXCEL EXPORTS ====================

export const exportAssetsToExcel = (assets) => {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['OGS OpsCenter - Asset Register Report'],
    [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
    [`Company: ${COMPANY_NAME}`],
    [],
    ['SUMMARY'],
    ['Total Assets', assets.length],
    ['Available', assets.filter(a => a.status === 'Available').length],
    ['In Use', assets.filter(a => a.status === 'In Use').length],
    ['Under Maintenance', assets.filter(a => a.status === 'Under Maintenance').length],
    ['Calibration', assets.filter(a => a.status === 'Calibration').length],
    ['Damaged', assets.filter(a => a.status === 'Damaged').length],
  ];
  const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

  // Full asset list
  const assetData = assets.map(a => ({
    'Asset No.': a.assetNo || a.id,
    'Serial Number': a.serialNumber,
    'Asset Name': a.name,
    'Type': a.type,
    'Category': a.category,
    'Manufacturer': a.manufacturer,
    'Model': a.model,
    'Status': a.status,
    'Location': a.location,
    'Current Project': a.currentProject || 'N/A',
    'Available Date': a.availableDate || 'N/A',
    'Calibration Due': a.calibrationDue || 'N/A',
    'Maintenance Due': a.maintenanceDue || 'N/A',
    'Certification Expiry': a.certificationExpiry || 'N/A',
    'Condition': a.condition,
    'Utilization %': a.utilization,
    'Purchase Cost': a.purchaseCost,
  }));

  const assetWS = XLSX.utils.json_to_sheet(assetData);

  // Set column widths
  const colWidths = [
    { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 22 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
  ];
  assetWS['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, assetWS, 'Asset Register');

  // Calibration due sheet
  const calDue = assets.filter(a => {
    if (!a.calibrationDue) return false;
    const d = new Date(a.calibrationDue);
    const in30 = new Date(Date.now() + 30 * 86400000);
    return d < in30;
  });

  if (calDue.length > 0) {
    const calData = calDue.map(a => ({
      'Asset No.': a.assetNo || a.id,
      'Asset Name': a.name,
      'Calibration Due': a.calibrationDue,
      'Status': a.status,
      'Location': a.location,
      'Days Until Due': Math.ceil((new Date(a.calibrationDue) - new Date()) / 86400000),
    }));
    const calWS = XLSX.utils.json_to_sheet(calData);
    XLSX.utils.book_append_sheet(wb, calWS, 'Calibration Due');
  }

  XLSX.writeFile(wb, `Asset_Register_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

export const exportProjectsToExcel = (projects) => {
  const wb = XLSX.utils.book_new();

  const projData = projects.map(p => ({
    'Project ID': p.id,
    'Project Name': p.name,
    'Client': p.clientName,
    'Location': p.siteLocation,
    'Type': p.type,
    'Status': p.status,
    'Start Date': p.startDate,
    'End Date': p.endDate,
    'Mobilization': p.mobilizationDate,
    'Readiness %': p.readiness,
    'Risk Level': p.riskLevel,
    'Budget (THB)': p.budget,
    'Actual Cost (THB)': p.actualCost,
    'Variance (THB)': p.budget - p.actualCost,
  }));

  const ws = XLSX.utils.json_to_sheet(projData);
  ws['!cols'] = Array(14).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');

  XLSX.writeFile(wb, `Projects_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

export const exportMaintenanceToExcel = (records, assets) => {
  const wb = XLSX.utils.book_new();

  const data = records.map(r => {
    const asset = assets.find(a => a.id === r.assetId);
    return {
      'Maintenance ID': r.id,
      'Asset ID': r.assetId,
      'Asset Name': asset?.name || 'Unknown',
      'Type': r.type,
      'Description': r.description,
      'Status': r.status,
      'Start Date': r.startDate,
      'End Date': r.endDate || 'In Progress',
      'Downtime (hrs)': r.downtime || 'TBD',
      'Cost (THB)': r.cost,
      'Root Cause': r.rootCause,
      'Parts Replaced': r.partsReplaced?.join(', ') || 'None',
      'Vendor': r.vendor || 'Internal',
      'Next Maintenance': r.nextMaintenanceDate || 'TBD',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Array(14).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Records');

  XLSX.writeFile(wb, `Maintenance_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

export const exportManpowerToExcel = (employees) => {
  const wb = XLSX.utils.book_new();

  // Create one sheet for the simple register
  const summaryData = employees.map(e => ({
    'Employee ID': e.id,
    'Name': e.name,
    'Position': e.position,
    'Department': e.department,
    'Current Status': e.availability,
    'Rotation': e.rotation,
    'Email': e.email,
    'Phone': e.phone,
  }));
  const summaryWS = XLSX.utils.json_to_sheet(summaryData);
  summaryWS['!cols'] = [ {wch:15},{wch:25},{wch:25},{wch:20},{wch:15},{wch:15},{wch:30},{wch:15} ];
  XLSX.utils.book_append_sheet(wb, summaryWS, 'Manpower Register');


  // Create a second sheet for the detailed schedule log
  const scheduleData = [];
  employees.forEach(e => {
    if (e.schedule && e.schedule.length > 0) {
      e.schedule.forEach(entry => {
        scheduleData.push({
          'Employee ID': e.id,
          'Name': e.name,
          'Position': e.position,
          'Schedule Type': entry.type,
          'Details': entry.details,
          'Start Date': entry.startDate,
          'End Date': entry.endDate || 'Present',
        });
      });
    } else {
      // Optionally, include employees with no schedule history
      scheduleData.push({
        'Employee ID': e.id,
        'Name': e.name,
        'Position': e.position,
        'Schedule Type': 'No Schedule Entries',
        'Details': '',
        'Start Date': '',
        'End Date': '',
      });
    }
  });

  const scheduleWS = XLSX.utils.json_to_sheet(scheduleData);
  scheduleWS['!cols'] = [ {wch:15},{wch:25},{wch:25},{wch:20},{wch:30},{wch:12},{wch:12} ];
  XLSX.utils.book_append_sheet(wb, scheduleWS, 'Schedule History');


  XLSX.writeFile(wb, `Manpower_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

// ==================== PDF EXPORTS ====================

const pdfHeader = (doc, title) => {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_NAME, 15, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 15, 19);
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 250, 19, { align: 'right' });
  doc.setTextColor(0, 0, 0);
};

export const exportAssetsToPDF = (assets) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdfHeader(doc, 'Asset Register Report');

  const tableData = assets.map(a => [
    a.assetNo || a.id, a.name, a.type, a.status, a.location,
    a.calibrationDue || 'N/A', a.maintenanceDue || 'N/A', `${a.utilization}%`,
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Asset No.', 'Name', 'Type', 'Status', 'Location', 'Cal. Due', 'Maint. Due', 'Utilization']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const status = data.cell.raw;
        if (status === 'Available') data.cell.styles.textColor = [21, 128, 61];
        else if (status === 'In Use') data.cell.styles.textColor = [29, 78, 216];
        else if (status === 'Damaged') data.cell.styles.textColor = [185, 28, 28];
        else if (status === 'Under Maintenance') data.cell.styles.textColor = [180, 83, 9];
      }
    },
  });

  doc.save(`Asset_Register_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};

export const exportProjectsToPDF = (projects) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdfHeader(doc, 'Projects Status Report');

  const tableData = projects.map(p => [
    p.id, p.name.substring(0, 30), p.clientName, p.type,
    p.status, p.startDate, p.endDate, `${p.readiness}%`, p.riskLevel,
  ]);

  doc.autoTable({
    startY: 30,
    head: [['ID', 'Project Name', 'Client', 'Type', 'Status', 'Start', 'End', 'Readiness', 'Risk']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`Projects_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
