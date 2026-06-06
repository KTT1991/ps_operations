import { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays, Package, Users, AlertTriangle, CheckCircle, FolderKanban, 
  Clock, Search, Plus, X, ChevronRight, Zap
} from 'lucide-react';
import { assetsService, projectsService, employeesService } from '../../services/firebaseService';
import { format, parseISO, differenceInDays, addDays, isBefore, isAfter, isEqual } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const T = {
  text:'var(--t-text)', text2:'var(--t-text2)', text3:'var(--t-text3)',
  bg:'var(--t-bg)', bg2:'var(--t-bg2)', bg3:'var(--t-bg3)', bg4:'var(--t-bg4)',
  border:'var(--t-border)', border2:'var(--t-border2)',
};

const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const parse = (s) => { try { return s ? parseISO(s) : null; } catch { return null; } };

function isAvailableOn(asset, fromDate, toDate) {
  if (asset.status === 'Available') return { ok: true, reason: 'Available now' };
  if (asset.status === 'Damaged')   return { ok: false, reason: 'Damaged — not deployable' };
  if (asset.status === 'Under Maintenance' || asset.status === 'Calibration') {
    const avail = parse(asset.availableDate || asset.maintenanceDue);
    if (!avail) return { ok: false, reason: 'In maintenance — return date unknown' };
    if (isBefore(avail, fromDate) || isEqual(avail, fromDate))
      return { ok: true, reason: `Returns ${format(avail,'dd MMM')} — before needed` };
    return { ok: false, reason: `Returns ${format(avail,'dd MMM')} — after mobilization` };
  }
  if (asset.status === 'In Use') {
    const avail = parse(asset.availableDate);
    if (!avail) return { ok: false, reason: 'In use — return date unknown' };
    const daysUntil = differenceInDays(avail, today());
    if (isBefore(avail, fromDate) || isEqual(avail, fromDate))
      return { ok: true, reason: `Returns ${format(avail,'dd MMM')} (${daysUntil}d)` };
    return { ok: false, reason: `Returns ${format(avail,'dd MMM')} — ${differenceInDays(avail,fromDate)}d late` };
  }
  return { ok: true, reason: asset.status };
}

function isEmployeeAvailable(emp, fromDate, toDate) {
  // 1. Check for expired certificates for the required period
  const expiredCerts = (emp.certFields || []).filter(c => {
    if (!c.expiry) return false;
    const expiryDate = parse(c.expiry);
    return expiryDate && isBefore(expiryDate, fromDate);
  });
  if (expiredCerts.length > 0) {
    return { ok: false, reason: `Cert expired: ${expiredCerts.map(c => c.label).join(', ')}` };
  }

  // 2. Check for schedule conflicts
  const schedule = (emp.schedule || []).map(s => ({ ...s, startDate: parse(s.startDate), endDate: parse(s.endDate) }));
  const requiredStart = fromDate;
  const requiredEnd = toDate || fromDate;

  const conflictingEntry = schedule.find(entry => {
    if (!entry.startDate) return false;
    const entryEnd = entry.endDate || new Date('2999-12-31');
    const isOverlapping = isBefore(requiredStart, entryEnd) && isAfter(requiredEnd, entry.startDate);
    return isOverlapping;
  });

  if (conflictingEntry) {
    return { 
      ok: false, 
      reason: `${conflictingEntry.type}: ${conflictingEntry.details} (${format(conflictingEntry.startDate, 'dd MMM')} - ${conflictingEntry.endDate ? format(conflictingEntry.endDate, 'dd MMM') : 'Present'})`
    };
  }
  
  // 3. If available, find the next assignment to provide more detail.
  const isSingleDateCheck = isEqual(fromDate, requiredEnd);
  if (isSingleDateCheck) {
    const nextAssignment = schedule
      .filter(entry => entry.startDate && isAfter(entry.startDate, fromDate))
      .sort((a, b) => a.startDate - b.startDate)[0];

    if (nextAssignment) {
      return {
        ok: true,
        reason: `Available until ${format(nextAssignment.startDate, 'dd MMM yyyy')}`
      };
    }
  }

  // 4. If no conflicts found, the employee is available.
  return { ok: true, reason: 'Available' };
}

function StatusBadge({ gap, exists }) {
  if (!exists) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
        <X className="w-3.5 h-3.5"/>
        <span>Not in Stock</span>
      </div>
    );
  }
  if (gap <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
        <CheckCircle className="w-3.5 h-3.5"/>
        <span>Sufficient</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
      <AlertTriangle className="w-3.5 h-3.5"/>
      <span>Shortfall: {gap}</span>
    </div>
  );
}

function GapAnalysis({ project, assets, employees, onGoToProjects }) {
  if (!project) return null;

  const mobDate = useMemo(() => parse(project.mobilizationDate || project.startDate), [project]);
  const endDate = useMemo(() => parse(project.endDate || project.mobilizationDate || project.startDate), [project]);

  const checks = useMemo(() => {
    if (!mobDate) return { analysis: [], overallReadiness: 0, totalShortfall: 0 };
    
    const genericReqs = project.genericRequirements || [];
    if (genericReqs.length === 0) return { analysis: [], overallReadiness: 100, totalShortfall: 0 };

    const employeePositions = [...new Set(employees.map(e => e.position).filter(Boolean))];

    const analysis = genericReqs.map(req => {
      const lowerReqItem = req.item.toLowerCase();
      const isManpower = employeePositions.map(p=>p.toLowerCase()).includes(lowerReqItem);
      
      if (isManpower) {
        const matchingEmployees = employees.filter(e => e.position.toLowerCase() === lowerReqItem);
        const availableEmployees = matchingEmployees.filter(e => isEmployeeAvailable(e, mobDate, endDate).ok);
        return {
          type: 'Manpower',
          name: req.item,
          unit: req.unit,
          required: req.quantity,
          available: availableEmployees.length,
          gap: Math.max(0, req.quantity - availableEmployees.length),
          exists: true
        };
      } else {
        const matchingAssets = assets.filter(a => 
          a.category?.toLowerCase() === lowerReqItem || 
          a.name?.toLowerCase() === lowerReqItem
        );
        const availableAssets = matchingAssets.filter(a => isAvailableOn(a, mobDate, endDate).ok);
        const existsInStock = matchingAssets.length > 0;
        return {
          type: 'Equipment',
          name: req.item,
          unit: req.unit,
          required: req.quantity,
          available: availableAssets.length,
          gap: Math.max(0, req.quantity - availableAssets.length),
          exists: existsInStock
        };
      }
    });

    const totalRequired = analysis.reduce((sum, item) => sum + item.required, 0);
    const totalFulfilled = analysis.reduce((sum, item) => sum + (item.required - item.gap), 0);
    const overallReadiness = totalRequired > 0 ? Math.round((totalFulfilled / totalRequired) * 100) : 100;
    const totalShortfall = analysis.reduce((sum, item) => sum + item.gap, 0);

    return { analysis, overallReadiness, totalShortfall };
  }, [project, assets, employees, mobDate, endDate]);
  
  const { analysis, overallReadiness, totalShortfall } = checks;

  if (!mobDate) {
    return (
      <div className="text-center py-6">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" style={{color: T.text3}}/>
        <h3 className="font-semibold" style={{color: T.text}}>No Mobilization Date</h3>
        <p className="text-xs mt-1 mb-4" style={{color:T.text3}}>
          Please set a Mobilization or Start Date for this project to run the analysis.
        </p>
        <button onClick={onGoToProjects} className="btn-secondary text-xs">Edit Project</button>
      </div>
    );
  }

  if (!project.genericRequirements || project.genericRequirements.length === 0) {
    return (
       <div className="text-center py-6">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{color: T.text3}}/>
            <h3 className="font-semibold" style={{color: T.text}}>No Requirements Found</h3>
            <p className="text-xs mt-1 mb-4" style={{color:T.text3}}>
                This project doesn't have any requirements specified yet.<br/>You can add them in the Project Management page.
            </p>
            <button onClick={onGoToProjects} className="btn-secondary text-xs flex items-center gap-2 mx-auto">
                <FolderKanban className="w-3.5 h-3.5" />
                Go to Project Management
            </button>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-lg"
        style={{background: totalShortfall === 0 ?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)',
          border:`1px solid ${totalShortfall === 0 ? 'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`}}>
        {totalShortfall === 0
          ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0"/>
          : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0"/>}
        <div>
          <div className="text-sm font-semibold" style={{color: totalShortfall === 0 ? '#22c55e':'#ef4444'}}>
            {totalShortfall === 0 ? 'All requirements met' : `${totalShortfall} total unit(s) shortfall`}
          </div>
          <div className="text-xs mt-0.5" style={{color:T.text3}}>
            Mobilization: {format(mobDate,'dd MMM yyyy')} · Overall readiness: {overallReadiness}%
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold" style={{color: overallReadiness >= 80 ? '#22c55e' : overallReadiness >= 50 ? '#f59e0b' : '#ef4444'}}>
            {overallReadiness}%
          </div>
          <div className="w-20 progress-bar mt-1">
            <div className="progress-fill" style={{width:`${overallReadiness}%`,
              background: overallReadiness >= 80 ? '#22c55e' : overallReadiness >= 50 ? '#f59e0b' : '#ef4444'}}/>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Requirement</th>
              <th className="text-center">Required</th>
              <th className="text-center">Available</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {analysis.map((item, index) => (
              <tr key={index}>
                <td>
                  <div className="font-semibold text-xs capitalize" style={{color: T.text}}>{item.name}</div>
                  <div className="text-[10px]" style={{color: T.text3}}>{item.type}</div>
                </td>
                <td className="text-center text-xs">{item.required} {item.unit}</td>
                <td className="text-center text-xs">{item.available} {item.unit}</td>
                <td><StatusBadge gap={item.gap} exists={item.exists} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function AssetAvailabilityTable({ assets, searchDate }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const assetCategories = useMemo(() => ['All', ...new Set(assets.map(a => a.category).filter(Boolean))], [assets]);
  const assetStatuses = ['All', 'Available', 'In Use', 'Under Maintenance', 'Calibration', 'Damaged'];

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
        if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
        if (statusFilter !== 'All' && a.status !== statusFilter) return false;
        if (search) {
            const lowerSearch = search.toLowerCase();
            return a.name?.toLowerCase().includes(lowerSearch) ||
                   a.id?.toLowerCase().includes(lowerSearch) ||
                   a.location?.toLowerCase().includes(lowerSearch);
        }
        return true;
    });
  }, [assets, search, categoryFilter, statusFilter]);

  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const paginatedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAssets, currentPage]);

  const rows = useMemo(() => paginatedAssets.map(a => {
    const avail = isAvailableOn(a, searchDate, searchDate);
    const daysUntilAvail = a.availableDate
      ? differenceInDays(parseISO(a.availableDate), today())
      : null;
    return { ...a, avail, daysUntilAvail };
  }), [paginatedAssets, searchDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
              <label className="text-xs block mb-1" style={{color:T.text3}}>Search Name/ID</label>
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.text3 }} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder={`Search ${assets.length} assets...`}
                  className="input-field pl-9" />
              </div>
          </div>
          <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Category</label>
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="select-field w-44">
                  {assetCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
          </div>
          <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Status</label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="select-field w-44">
                  {assetStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
          </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Asset</th><th>Category</th><th>Status</th><th>Location</th><th>Available Date</th><th>On {format(searchDate,'dd MMM')}?</th></tr>
            </thead>
            <tbody>
              {rows.map(a=>(
                <tr key={a.id}>
                  <td>
                    <div className="text-xs font-semibold" style={{color:T.text}}>{a.name?.substring(0,35)}</div>
                    <div className="text-[10px] font-mono" style={{color:T.text3}}>{a.id}</div>
                  </td>
                  <td className="text-xs" style={{color:T.text2}}>{a.category}</td>
                  <td>
                    <span className={clsx('badge', a.status==='Available'?'badge-available':
                      a.status==='In Use'?'badge-in-use':a.status==='Damaged'?'badge-damaged':'badge-maintenance')}>
                      {a.status}
                    </span>
                  </td>
                  <td className="text-xs" style={{color:T.text3}}>{a.location?.substring(0,25)}</td>
                  <td className="text-xs" style={{color:a.daysUntilAvail!==null&&a.daysUntilAvail<=7?'#f59e0b':T.text2}}>
                    {a.availableDate || (a.status==='Available'?'Now':'—')}
                    {a.daysUntilAvail!==null && a.daysUntilAvail>=0 && (
                      <span className="ml-1" style={{color:T.text3}}>(+{a.daysUntilAvail}d)</span>
                    )}
                  </td>
                  <td>
                    <div className={clsx('flex items-center gap-1 text-xs font-medium',
                      a.avail.ok?'text-green-600':'text-red-500')}>
                      {a.avail.ok
                        ? <CheckCircle className="w-3.5 h-3.5"/>
                        : <AlertTriangle className="w-3.5 h-3.5"/>}
                      {a.avail.ok ? 'Available' : 'Unavailable'}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{color:T.text3}}>{a.avail.reason}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between text-xs" style={{borderTop:`1px solid ${T.border}`,color:T.text3}}>
          <span>Showing {rows.length} of {filteredAssets.length} assets</span>
          <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost p-1 disabled:opacity-50">
                  Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="btn-ghost p-1 disabled:opacity-50">
                  Next
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CertStatusCell({ cert }) {
  if (!cert || !cert.expiry) {
    return <span className="text-xs" style={{color:T.text3}}>N/A</span>;
  }
  const days = differenceInDays(parseISO(cert.expiry), today());
  const color = days < 0 ? '#ef4444' : days < 30 ? '#f59e0b' : '#22c55e';
  const text = days < 0 ? `EXPIRED` : `in ${days}d`;

  return (
    <div>
      <div className="text-xs font-medium" style={{color}}>{format(parseISO(cert.expiry), 'dd MMM yyyy')}</div>
      <div className="text-[10px]" style={{color}}>{text}</div>
    </div>
  );
}

function EmployeeAvailabilityTable({ employees, searchDate }) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const departments = useMemo(() => ['All', ...new Set(employees.map(e => e.department).filter(Boolean))], [employees]);
  const availabilities = ['All', 'Available', 'Assigned', 'On Leave', 'Training'];

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (departmentFilter !== 'All' && e.department !== departmentFilter) return false;
      if (availabilityFilter !== 'All' && e.availability !== availabilityFilter) return false;
      if (search) {
          const lowerSearch = search.toLowerCase();
          return e.name?.toLowerCase().includes(lowerSearch) ||
                 e.position?.toLowerCase().includes(lowerSearch);
      }
      return true;
    });
  }, [employees, search, departmentFilter, availabilityFilter]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);


  const rows = useMemo(() => paginatedEmployees.map(e => {
    const avail = isEmployeeAvailable(e, searchDate, searchDate);
    const allCerts = e.certFields || [];
    
    const bosietCert = allCerts.find(c => c.label.toLowerCase() === 'bosiet');
    const medicalCert = allCerts.find(c => c.label.toLowerCase() === 'medical');
    
    const otherCerts = allCerts.filter(c => c.label.toLowerCase() !== 'bosiet' && c.label.toLowerCase() !== 'medical');

    const expiredCerts = otherCerts.filter(c => c.expiry && isBefore(parseISO(c.expiry), searchDate));
    const expiringSoon = otherCerts.filter(c => {
        if (!c.expiry) return false;
        const d = differenceInDays(parseISO(c.expiry), today());
        return d >= 0 && d <= 30;
    });

    return { ...e, avail, expiredCerts, expiringSoon, bosietCert, medicalCert };
  }), [paginatedEmployees, searchDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
              <label className="text-xs block mb-1" style={{color:T.text3}}>Search Name/Position</label>
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: T.text3 }} />
                  <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder={`Search ${employees.length} employees...`}
                  className="input-field pl-9" />
              </div>
          </div>
          <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Department</label>
              <select value={departmentFilter} onChange={e => { setDepartmentFilter(e.target.value); setCurrentPage(1); }} className="select-field w-44">
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
          </div>
          <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Availability</label>
              <select value={availabilityFilter} onChange={e => { setAvailabilityFilter(e.target.value); setCurrentPage(1); }} className="select-field w-44">
                  {availabilities.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
          </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>BOSIET</th>
                <th>Medical</th>
                <th>Other Certs</th>
                <th>On {format(searchDate,'dd MMM')}?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(emp=>{
                const currentAssignment = (emp.schedule || []).find(s => !s.endDate);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="text-xs font-semibold" style={{color:T.text}}>{emp.name}</div>
                      <div className="text-[10px]" style={{color:T.text3}}>{emp.department}</div>
                    </td>
                    <td className="text-xs" style={{color:T.text2}}>{emp.position}</td>
                    <td><CertStatusCell cert={emp.bosietCert} /></td>
                    <td><CertStatusCell cert={emp.medicalCert} /></td>
                    <td>
                      {emp.expiredCerts.length > 0 && (
                        <div className="text-[10px] text-red-500">
                          Expired: {emp.expiredCerts.map(c=>c.label).join(', ')}
                        </div>
                      )}
                      {emp.expiringSoon.length > 0 && (
                        <div className="text-[10px] text-amber-500">
                          Expiring: {emp.expiringSoon.map(c=>c.label).join(', ')}
                        </div>
                      )}
                      {emp.expiredCerts.length===0 && emp.expiringSoon.length===0 && (
                        <span className="text-[10px] text-green-500">OK</span>
                      )}
                    </td>
                    <td>
                      <div className={clsx('flex items-center gap-1 text-xs font-medium',
                        emp.avail.ok?'text-green-600':'text-red-500')}>
                        {emp.avail.ok ? <CheckCircle className="w-3.5 h-3.5"/> : <AlertTriangle className="w-3.5 h-3.5"/>}
                        {emp.avail.ok ? 'Available' : 'Unavailable'}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{color:T.text3}}>{emp.avail.reason}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between text-xs" style={{borderTop:`1px solid ${T.border}`,color:T.text3}}>
          <span>Showing {rows.length} of {filteredEmployees.length} employees</span>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost p-1 disabled:opacity-50">
                  Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="btn-ghost p-1 disabled:opacity-50">
                  Next
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResourcePlanningPage() {
  const [assets,    setAssets]    = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const navigate = useNavigate();

  const [tab,       setTab]       = useState('manpower');
  const [searchDate,setSearchDate]= useState(format(addDays(today(),7),'yyyy-MM-dd'));
  const [selProject,setSelProject]= useState('');

  useEffect(()=>{
    (async()=>{
      const [a,p,e] = await Promise.all([assetsService.getAll(),projectsService.getAll(),employeesService.getAll()]);
      setAssets(a); setProjects(p); setEmployees(e);
      const plannedOrPreparing = p.find(x=>x.status==='Preparing'||x.status==='Planned');
      if(plannedOrPreparing) setSelProject(plannedOrPreparing.id);
      else if (p.length > 0) setSelProject(p[0].id);
      setLoading(false);
    })();
  },[]);

  const parsedDate = useMemo(()=>{ try{ return parseISO(searchDate); }catch{ return today(); } },[searchDate]);
  const selProj = projects.find(p=>p.id===selProject);

  const tabs = [
    { id:'checker',   label:'Project Gap Analysis', icon: Zap },
    { id:'equipment', label:'Equipment Availability',    icon: Package },
    { id:'manpower',  label:'Manpower Availability',     icon: Users },
  ];

  const handleGoToProjects = () => {
    const projPath = selProj ? `/projects?edit=${selProj.id}` : '/projects';
    navigate(projPath);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-orange-500"/>Resource Planning & Availability
        </h1>
        <p className="text-xs mt-1" style={{color:T.text3}}>
          Perform gap analysis for projects and check overall resource availability.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{background:T.bg2,border:`1px solid ${T.border}`}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              tab===t.id?'bg-orange-600 text-white':'')}
            style={tab!==t.id?{color:T.text3}:{}}>
            <t.icon className="w-3.h-3.5"/>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : tab === 'checker' ? (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{color:T.text3}}>
              Select Project
            </div>
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {projects
                .filter(p=>['Planned','Preparing','Mobilizing','Active'].includes(p.status))
                .map(p=>{
                  const mobDate = parse(p.mobilizationDate||p.startDate);
                  const daysUntilMob = mobDate ? differenceInDays(mobDate, today()) : null;
                  return (
                    <button key={p.id} onClick={()=>setSelProject(p.id)}
                      className={clsx('w-full text-left rounded-lg px-3 py-2.5 text-xs transition-all border',
                        selProject===p.id?'border-orange-500 bg-orange-500/10':'')}
                      style={selProject!==p.id?{background:T.bg2,borderColor:T.border}:{}}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="font-semibold truncate" style={{color:T.text}}>{p.name?.substring(0,30)}</div>
                        {selProject===p.id&&<ChevronRight className="w-3 h-3 text-orange-500 flex-shrink-0 mt-0.5"/>}
                      </div>
                      <div className="mt-1 flex items-center gap-2" style={{color:T.text3}}>
                        <span>{p.clientName}</span>
                        {daysUntilMob!==null&&(
                          <span className={clsx('font-medium ml-auto',
                            daysUntilMob<0?'text-red-500':daysUntilMob<14?'text-amber-500':'text-green-600')}>
                            {daysUntilMob<0?`${Math.abs(daysUntilMob)}d over`:`Mob in ${daysUntilMob}d`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5" style={{color:T.text3}}>
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
                          p.status==='Active'?'bg-green-500/15 text-green-600':
                          p.status==='Preparing'?'bg-blue-500/15 text-blue-500':
                          'bg-purple-500/15 text-purple-500')}>
                          {p.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-2 card p-5">
            {selProj ? (
              <>
                <div className="mb-4">
                  <h2 className="font-semibold text-sm" style={{color:T.text}}>{selProj.name}</h2>
                  <p className="text-xs mt-0.5" style={{color:T.text3}}>
                    {selProj.clientName} · {selProj.siteLocation} · Mob: {selProj.mobilizationDate||selProj.startDate||'TBD'}
                  </p>
                </div>
                <GapAnalysis
                  project={selProj}
                  assets={assets}
                  employees={employees}
                  onGoToProjects={handleGoToProjects}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-sm text-center" style={{color:T.text3}}>
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <h3 className="font-semibold" style={{color: T.text}}>Project Gap Analysis</h3>
                <p>Select a project from the list on the left to perform a gap analysis on its requirements.</p>
              </div>
            )}
          </div>
        </div>

      ) : tab === 'equipment' ? (

        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Check availability on date:</label>
              <input type="date" value={searchDate} onChange={e=>setSearchDate(e.target.value)} className="input-field w-44"/>
            </div>
            <div className="text-xs px-3 py-2 rounded-lg mt-4" style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.text3}}>
              {differenceInDays(parsedDate,today())} days from today
            </div>
          </div>
          <AssetAvailabilityTable assets={assets} searchDate={parsedDate}/>
        </div>

      ) : (

        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="text-xs block mb-1" style={{color:T.text3}}>Check availability on date:</label>
              <input type="date" value={searchDate} onChange={e=>setSearchDate(e.target.value)} className="input-field w-44"/>
            </div>
            <div className="text-xs px-3 py-2 rounded-lg mt-4" style={{background:T.bg2,border:`1px solid ${T.border}`,color:T.text3}}>
              {differenceInDays(parsedDate,today())} days from today
            </div>
          </div>
          <EmployeeAvailabilityTable employees={employees} searchDate={parsedDate}/>
        </div>

      )}
    </div>
  );
}
