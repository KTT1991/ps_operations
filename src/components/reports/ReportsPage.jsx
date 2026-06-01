import { useState, useEffect } from 'react';
import { FileBarChart, Download, FileSpreadsheet, FileText, Calendar, Filter, CheckCircle, Package, Users, Wrench, Archive } from 'lucide-react';
import { assetsService, projectsService, employeesService, maintenanceService, inventoryService } from '../../services/firebaseService';
import { exportAssetsToExcel, exportAssetsToPDF, exportProjectsToExcel, exportProjectsToPDF, exportMaintenanceToExcel, exportManpowerToExcel } from '../../utils/exportUtils';
import { differenceInDays, parseISO, format } from 'date-fns';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const REPORTS = [
  {
    id: 'asset-utilization',
    title: 'Asset Utilization Report',
    description: 'Full asset register with utilization rates, status, and location',
    icon: Package,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/40',
    formats: ['excel', 'pdf'],
  },
  {
    id: 'calibration-due',
    title: 'Calibration Due Report',
    description: 'Assets with calibration due within 30/60/90 days',
    icon: Calendar,
    color: 'text-purple-400',
    bg: 'bg-purple-900/20 border-purple-700/40',
    formats: ['excel'],
  },
  {
    id: 'maintenance-report',
    title: 'Maintenance Report',
    description: 'All maintenance records with costs and downtime analysis',
    icon: Wrench,
    color: 'text-amber-400',
    bg: 'bg-amber-900/20 border-amber-700/40',
    formats: ['excel', 'pdf'],
  },
  {
    id: 'project-readiness',
    title: 'Project Readiness Report',
    description: 'All projects with readiness %, equipment, and manpower status',
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-900/20 border-green-700/40',
    formats: ['excel', 'pdf'],
  },
  {
    id: 'manpower-utilization',
    title: 'Manpower Utilization Report',
    description: 'Technician deployment, utilization, and certification expiry',
    icon: Users,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20 border-cyan-700/40',
    formats: ['excel'],
  },
  {
    id: 'inventory-shortage',
    title: 'Inventory Shortage Report',
    description: 'Parts and consumables below safety stock or reorder level',
    icon: Archive,
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/40',
    formats: ['excel'],
  },
  {
    id: 'equipment-availability',
    title: 'Equipment Availability Forecast',
    description: 'Forecast when assets will become available based on project end dates',
    icon: Calendar,
    color: 'text-orange-400',
    bg: 'bg-orange-900/20 border-orange-700/40',
    formats: ['excel'],
  },
];

export default function ReportsPage() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [a, p, e, m, i] = await Promise.all([
        assetsService.getAll(), projectsService.getAll(), employeesService.getAll(),
        maintenanceService.getAll(), inventoryService.getAll(),
      ]);
      setAssets(a); setProjects(p); setEmployees(e); setMaintenance(m); setInventory(i);
      setLoading(false);
    };
    load();
  }, []);

  const generateCalibrationReport = () => {
    const now = new Date();
    const data = assets
      .filter(a => a.calibrationDue)
      .map(a => {
        const days = differenceInDays(parseISO(a.calibrationDue), now);
        return { asset: a, days };
      })
      .sort((a, b) => a.days - b.days)
      .map(({ asset, days }) => ({
        'Asset ID': asset.id,
        'Asset Name': asset.name,
        'Serial Number': asset.serialNumber,
        'Type': asset.type,
        'Status': asset.status,
        'Location': asset.location,
        'Calibration Due Date': asset.calibrationDue,
        'Days Until Due': days,
        'Urgency': days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL' : days <= 30 ? 'SOON' : 'OK',
        'Assigned Technician': asset.assignedTechnician || 'Unassigned',
      }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(10).fill({ wch: 20 });
    XLSX.utils.book_append_sheet(wb, ws, 'Calibration Due');

    // Summary
    const summaryData = [
      ['Calibration Status Summary'],
      [`Generated: ${format(now, 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Status', 'Count'],
      ['Overdue', data.filter(d => d.Urgency === 'OVERDUE').length],
      ['Critical (≤7 days)', data.filter(d => d.Urgency === 'CRITICAL').length],
      ['Due Soon (≤30 days)', data.filter(d => d.Urgency === 'SOON').length],
      ['OK', data.filter(d => d.Urgency === 'OK').length],
    ];
    const sumWS = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, sumWS, 'Summary');
    XLSX.writeFile(wb, `Calibration_Due_Report_${format(now, 'yyyyMMdd')}.xlsx`);
  };

  const generateInventoryShortageReport = () => {
    const shortages = inventory.filter(i => i.quantity <= i.reorderLevel).map(i => ({
      'Item ID': i.id,
      'Item Name': i.name,
      'Part Number': i.partNumber,
      'Category': i.category,
      'Current Qty': i.quantity,
      'Unit': i.unit,
      'Safety Stock': i.safetyStock,
      'Reorder Level': i.reorderLevel,
      'Shortage Qty': Math.max(0, i.reorderQuantity - i.quantity),
      'Unit Cost (฿)': i.unitCost,
      'Est. Reorder Cost (฿)': i.reorderQuantity * i.unitCost,
      'Supplier': i.supplier,
      'Lead Time (days)': i.leadTimeDays,
      'Status': i.quantity <= 0 ? 'OUT OF STOCK' : i.quantity <= i.safetyStock ? 'CRITICAL' : 'REORDER',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(shortages);
    ws['!cols'] = Array(14).fill({ wch: 18 });
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Shortage');
    XLSX.writeFile(wb, `Inventory_Shortage_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const generateAvailabilityForecast = () => {
    const forecast = assets
      .filter(a => a.availableDate)
      .map(a => {
        const days = differenceInDays(parseISO(a.availableDate), new Date());
        return {
          'Asset ID': a.id,
          'Asset Name': a.name,
          'Type': a.type,
          'Current Status': a.status,
          'Current Location': a.location,
          'Available Date': a.availableDate,
          'Days Until Available': days,
          'Current Project': a.currentProject || 'N/A',
          'Condition': a.condition,
        };
      })
      .sort((a, b) => a['Days Until Available'] - b['Days Until Available']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(forecast);
    ws['!cols'] = Array(9).fill({ wch: 22 });
    XLSX.utils.book_append_sheet(wb, ws, 'Availability Forecast');
    XLSX.writeFile(wb, `Equipment_Availability_Forecast_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleGenerate = async (reportId, format_type) => {
    setGenerating(`${reportId}-${format_type}`);
    try {
      switch (reportId) {
        case 'asset-utilization':
          format_type === 'excel' ? exportAssetsToExcel(assets) : exportAssetsToPDF(assets);
          break;
        case 'calibration-due':
          generateCalibrationReport();
          break;
        case 'maintenance-report':
          format_type === 'excel' ? exportMaintenanceToExcel(maintenance, assets) : exportMaintenanceToExcel(maintenance, assets);
          break;
        case 'project-readiness':
          format_type === 'excel' ? exportProjectsToExcel(projects) : exportProjectsToPDF(projects);
          break;
        case 'manpower-utilization':
          exportManpowerToExcel(employees);
          break;
        case 'inventory-shortage':
          generateInventoryShortageReport();
          break;
        case 'equipment-availability':
          generateAvailabilityForecast();
          break;
      }
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  // Quick stats for the preview panel
  const overdueCal = assets.filter(a => a.calibrationDue && differenceInDays(parseISO(a.calibrationDue), new Date()) < 0).length;
  const lowStock = inventory.filter(i => i.quantity <= i.reorderLevel).length;
  const expiredCerts = employees.filter(e => e.offshoreExpiry && differenceInDays(parseISO(e.offshoreExpiry), new Date()) < 0).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-orange-500" />
          Reports & Export
        </h1>
        <p className="text-[var(--t-text3)] text-sm mt-1">Generate and download operational reports in Excel and PDF formats</p>
      </div>

      {/* Summary alerts row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Calibrations Overdue', value: overdueCal, color: 'text-red-400', desc: 'Require immediate attention' },
          { label: 'Inventory Below Reorder', value: lowStock, color: 'text-amber-400', desc: 'Items to procure' },
          { label: 'Expired Personnel Certs', value: expiredCerts, color: 'text-red-400', desc: 'Cannot be deployed offshore' },
        ].map(({ label, value, color, desc }) => (
          <div key={label} className="kpi-card">
            <div className={clsx('text-2xl font-bold', color)}>{value}</div>
            <div className="text-sm text-[var(--t-text3)] mt-0.5">{label}</div>
            <div className="text-xs text-slate-600">{desc}</div>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--t-text3)] uppercase tracking-wider mb-3">Available Reports</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {REPORTS.map(report => {
            const Icon = report.icon;
            return (
              <div key={report.id} className={clsx('card border rounded-xl overflow-hidden', report.bg)}>
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={clsx('p-2 rounded-lg bg-slate-900/50', report.color)}>
                      <Icon className={clsx('w-5 h-5', report.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--t-text)] text-sm">{report.title}</h3>
                      <p className="text-xs text-[var(--t-text3)] mt-1 leading-relaxed">{report.description}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {report.formats.includes('excel') && (
                      <button
                        onClick={() => handleGenerate(report.id, 'excel')}
                        disabled={loading || generating === `${report.id}-excel`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-700/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {generating === `${report.id}-excel` ? (
                          <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        )}
                        Excel
                      </button>
                    )}
                    {report.formats.includes('pdf') && (
                      <button
                        onClick={() => handleGenerate(report.id, 'pdf')}
                        disabled={loading || generating === `${report.id}-pdf`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/40 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {generating === `${report.id}-pdf` ? (
                          <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data preview tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calibration coming up */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-medium text-[var(--t-text)] text-sm">Calibration Due — Next 30 Days</h3>
            <button onClick={() => handleGenerate('calibration-due', 'excel')} className="btn-ghost text-xs">
              <Download className="w-3.5 h-3.5" />Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Asset</th><th>Due Date</th><th>Days</th><th>Status</th></tr>
              </thead>
              <tbody>
                {assets
                  .filter(a => a.calibrationDue)
                  .map(a => ({ ...a, days: differenceInDays(parseISO(a.calibrationDue), new Date()) }))
                  .filter(a => a.days <= 30)
                  .sort((a, b) => a.days - b.days)
                  .slice(0, 8)
                  .map(asset => (
                    <tr key={asset.id}>
                      <td>
                        <div className="text-sm text-[var(--t-text)]">{asset.name}</div>
                        <div className="text-xs text-[var(--t-text3)]">{asset.id}</div>
                      </td>
                      <td><span className="text-xs text-[var(--t-text3)]">{asset.calibrationDue}</span></td>
                      <td>
                        <span className={clsx('text-xs font-medium', asset.days < 0 ? 'text-red-400' : asset.days <= 7 ? 'text-red-400' : 'text-amber-400')}>
                          {asset.days < 0 ? `${Math.abs(asset.days)}d overdue` : `${asset.days}d`}
                        </span>
                      </td>
                      <td>
                        <span className={clsx('text-xs', asset.days < 0 ? 'text-red-400' : 'text-amber-400')}>
                          {asset.days < 0 ? '⚠ OVERDUE' : asset.days <= 7 ? '🔴 CRITICAL' : '🟡 SOON'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low inventory */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-medium text-[var(--t-text)] text-sm">Inventory Below Reorder Level</h3>
            <button onClick={() => handleGenerate('inventory-shortage', 'excel')} className="btn-ghost text-xs">
              <Download className="w-3.5 h-3.5" />Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Reorder Lvl</th><th>Status</th></tr>
              </thead>
              <tbody>
                {inventory.filter(i => i.quantity <= i.reorderLevel).map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="text-sm text-[var(--t-text)]">{item.name}</div>
                      <div className="text-xs text-[var(--t-text3)]">{item.partNumber}</div>
                    </td>
                    <td>
                      <span className={clsx('text-sm font-medium', item.quantity <= 0 ? 'text-red-400' : item.quantity <= item.safetyStock ? 'text-red-400' : 'text-amber-400')}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td><span className="text-sm text-[var(--t-text3)]">{item.reorderLevel}</span></td>
                    <td>
                      <span className={clsx('text-xs font-medium', item.quantity <= 0 ? 'text-red-400' : item.quantity <= item.safetyStock ? 'text-red-400' : 'text-amber-400')}>
                        {item.quantity <= 0 ? 'OUT' : item.quantity <= item.safetyStock ? 'CRITICAL' : 'REORDER'}
                      </span>
                    </td>
                  </tr>
                ))}
                {inventory.filter(i => i.quantity <= i.reorderLevel).length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-[var(--t-text3)] text-sm">All stock levels OK</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
