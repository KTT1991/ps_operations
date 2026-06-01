import { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays, Package, Users, AlertTriangle, CheckCircle,
  Clock, Search, Plus, X, ChevronRight, Zap
} from 'lucide-react';
import { assetsService, projectsService, employeesService } from '../../services/firebaseService';
import { format, parseISO, differenceInDays, addDays, isWithinInterval, isBefore, isAfter } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const T = {
  text:'var(--t-text)', text2:'var(--t-text2)', text3:'var(--t-text3)',
  bg:'var(--t-bg)', bg2:'var(--t-bg2)', bg3:'var(--t-bg3)', bg4:'var(--t-bg4)',
  border:'var(--t-border)', border2:'var(--t-border2)',
};

// ── helpers ──────────────────────────────────────────────────────────────
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const parse = (s) => { try { return s ? parseISO(s) : null; } catch { return null; } };

function isAvailableOn(asset, fromDate, toDate) {
  // Asset is available if:
  // 1. status = Available, OR
  // 2. availableFrom <= fromDate (returns before we need it)
  if (asset.status === 'Available') return { ok: true, reason: 'Available now' };
  if (asset.status === 'Damaged')   return { ok: false, reason: 'Damaged — not deployable' };
  if (asset.status === 'Under Maintenance' || asset.status === 'Calibration') {
    const avail = parse(asset.availableDate || asset.maintenanceDue);
    if (!avail) return { ok: false, reason: 'In maintenance — return date unknown' };
    if (isBefore(avail, fromDate) || avail.getTime() === fromDate.getTime())
      return { ok: true, reason: `Returns ${format(avail,'dd MMM')} — before needed` };
    return { ok: false, reason: `Returns ${format(avail,'dd MMM')} — after mobilization` };
  }
  if (asset.status === 'In Use') {
    const avail = parse(asset.availableDate);
    if (!avail) return { ok: false, reason: 'In use — return date unknown' };
    const daysUntil = differenceInDays(avail, today());
    if (isBefore(avail, fromDate) || avail.getTime() === fromDate.getTime())
      return { ok: true, reason: `Returns ${format(avail,'dd MMM')} (${daysUntil}d)` };
    return { ok: false, reason: `Returns ${format(avail,'dd MMM')} — ${differenceInDays(avail,fromDate)}d late` };
  }
  return { ok: true, reason: asset.status };
}

function isEmployeeAvailable(emp, fromDate, toDate, allProjects) {
  if (emp.availability === 'Available') return { ok: true, reason: 'Available' };
  if (emp.availability === 'On Leave')  return { ok: false, reason: 'On Leave' };
  if (emp.availability === 'Training')  return { ok: false, reason: 'In Training' };

  // Check cert expiry
  const expiredCerts = (emp.certFields || []).filter(c => {
    if (!c.expiry) return false;
    return isBefore(parseISO(c.expiry), fromDate);
  });
  if (expiredCerts.length > 0)
    return { ok: false, reason: `Cert expired: ${expiredCerts.map(c=>c.label).join(', ')}` };

  // Check if assigned to overlapping project
  if (emp.currentProject) {
    const proj = allProjects.find(p => p.id === emp.currentProject);
    if (proj && proj.endDate) {
      const projEnd = parseISO(proj.endDate);
      if (isAfter(projEnd, fromDate))
        return { ok: false, reason: `On ${proj.name?.substring(0,25)} until ${format(projEnd,'dd MMM')}` };
    }
    return { ok: false, reason: `Assigned to ${emp.currentProject}` };
  }

  return { ok: true, reason: emp.availability };
}

function ConflictBadge({ ok, reason }) {
  return (
    <div className={clsx('flex items-start gap-1.5 text-xs rounded px-2 py-1 mt-1',
      ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500')}
      style={{border:`1px solid ${ok?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`}}>
      {ok
        ? <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0"/>
        : <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0"/>}
      <span>{reason}</span>
    </div>
  );
}

// ── Availability Timeline Bar (mini gantt per resource) ──────────────────
function MiniGantt({ items, viewStart, viewDays, getBar, label }) {
  return (
    <div className="space-y-1">
      {items.slice(0,8).map((item, i) => {
        const bar = getBar(item);
        return (
          <div key={item.id||i} className="flex items-center gap-2">
            <div className="text-xs truncate flex-shrink-0" style={{width:130,color:T.text2}} title={item.name||item[label]}>
              {(item.name||item[label]||'').substring(0,18)}
            </div>
            <div className="flex-1 rounded h-5 relative overflow-hidden" style={{background:T.bg4}}>
              {bar.map((seg,si)=>(
                <div key={si} className="absolute top-0 h-full rounded text-[9px] flex items-center px-1 overflow-hidden"
                  style={{left:`${seg.left}%`,width:`${seg.width}%`,background:seg.color,color:'#fff',minWidth:2}}>
                  {seg.width > 8 && seg.label}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Project Requirement Checker ──────────────────────────────────────────
function ProjectChecker({ project, assets, employees, allProjects }) {
  if (!project) return null;
  const mobDate = parse(project.mobilizationDate || project.startDate);
  const endDate = parse(project.endDate);
  if (!mobDate) return <p className="text-xs" style={{color:T.text3}}>Project has no mobilization date</p>;

  const reqAssets  = (project.requiredEquipment || []);
  const reqEmpIds  = (project.requiredTechnicians || []);

  const assetChecks = reqAssets.map(id => {
    const a = assets.find(x => x.id === id);
    if (!a) return { id, name: id, avail: { ok: false, reason: 'Asset not found in system' } };
    return { id, name: a.name, avail: isAvailableOn(a, mobDate, endDate) };
  });

  const empChecks = reqEmpIds.map(id => {
    const e = employees.find(x => x.id === id);
    if (!e) return { id, name: id, avail: { ok: false, reason: 'Employee not found' } };
    return { id, name: e.name, avail: isEmployeeAvailable(e, mobDate, endDate, allProjects) };
  });

  const allOk = [...assetChecks, ...empChecks].every(c => c.avail.ok);
  const readiness = allOk ? 100
    : Math.round(([...assetChecks,...empChecks].filter(c=>c.avail.ok).length / Math.max([...assetChecks,...empChecks].length,1)) * 100);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 p-3 rounded-lg"
        style={{background:allOk?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)',
          border:`1px solid ${allOk?'rgba(34,197,94,.3)':'rgba(239,68,68,.3)'}`}}>
        {allOk
          ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0"/>
          : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0"/>}
        <div>
          <div className="text-sm font-semibold" style={{color:allOk?'#22c55e':'#ef4444'}}>
            {allOk ? 'All resources available ✓' : `${[...assetChecks,...empChecks].filter(c=>!c.avail.ok).length} conflict(s) detected`}
          </div>
          <div className="text-xs mt-0.5" style={{color:T.text3}}>
            Mobilization: {format(mobDate,'dd MMM yyyy')} · Resource readiness: {readiness}%
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold" style={{color:allOk?'#22c55e':readiness>=60?'#f59e0b':'#ef4444'}}>
            {readiness}%
          </div>
          <div className="w-20 progress-bar mt-1">
            <div className="progress-fill" style={{width:`${readiness}%`,
              background:allOk?'#22c55e':readiness>=60?'#f59e0b':'#ef4444'}}/>
          </div>
        </div>
      </div>

      {/* Equipment */}
      {assetChecks.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
            style={{color:T.text3}}>
            <Package className="w-3.5 h-3.5"/>Equipment ({assetChecks.length})
          </div>
          <div className="space-y-1.5">
            {assetChecks.map(c=>(
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium" style={{color:T.text}}>{c.name}</div>
                  <ConflictBadge ok={c.avail.ok} reason={c.avail.reason}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manpower */}
      {empChecks.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
            style={{color:T.text3}}>
            <Users className="w-3.5 h-3.5"/>Manpower ({empChecks.length})
          </div>
          <div className="space-y-1.5">
            {empChecks.map(c=>(
              <div key={c.id}>
                <div className="text-xs font-medium" style={{color:T.text}}>{c.name}</div>
                <ConflictBadge ok={c.avail.ok} reason={c.avail.reason}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {(assetChecks.length === 0 && empChecks.length === 0) && (
        <p className="text-xs" style={{color:T.text3}}>
          No required equipment or technicians assigned to this project yet.<br/>
          Go to Project Management → assign resources.
        </p>
      )}
    </div>
  );
}

// ── Asset Availability Table ──────────────────────────────────────────────
function AssetAvailabilityTable({ assets, projects, searchDate }) {
  const rows = useMemo(() => assets.map(a => {
    const avail = isAvailableOn(a, searchDate, searchDate);
    const daysUntilAvail = a.availableDate
      ? differenceInDays(parseISO(a.availableDate), today())
      : null;
    return { ...a, avail, daysUntilAvail };
  }), [assets, searchDate]);

  const available = rows.filter(r => r.avail.ok);
  const unavailable = rows.filter(r => !r.avail.ok);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Available on date', value:available.length, color:'#22c55e' },
          { label:'Unavailable',       value:unavailable.length, color:'#ef4444' },
          { label:'Return ≤ 7 days',   value:rows.filter(r=>r.daysUntilAvail!==null&&r.daysUntilAvail>=0&&r.daysUntilAvail<=7).length, color:'#f59e0b' },
        ].map(k=>(
          <div key={k.label} className="kpi-card py-3">
            <div className="text-xl font-bold" style={{color:k.color}}>{k.value}</div>
            <div className="text-xs" style={{color:T.text3}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Asset</th><th>Category</th><th>Status</th><th>Location</th><th>Available Date</th><th>On {format(searchDate,'dd MMM')}?</th></tr>
            </thead>
            <tbody>
              {rows.slice(0,30).map(a=>(
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
        <div className="px-4 py-2.5 text-xs" style={{borderTop:`1px solid ${T.border}`,color:T.text3}}>
          Showing 30 of {rows.length} assets
        </div>
      </div>
    </div>
  );
}

// ── Employee Availability Table ───────────────────────────────────────────
function EmployeeAvailabilityTable({ employees, projects, searchDate }) {
  const rows = useMemo(() => employees.map(e => {
    const avail = isEmployeeAvailable(e, searchDate, searchDate, projects);
    const expiredCerts = (e.certFields||[]).filter(c=>{
      if (!c.expiry) return false;
      return isBefore(parseISO(c.expiry), searchDate);
    });
    const expiringSoon = (e.certFields||[]).filter(c=>{
      if (!c.expiry) return false;
      const d = differenceInDays(parseISO(c.expiry), today());
      return d >= 0 && d <= 30;
    });
    return { ...e, avail, expiredCerts, expiringSoon };
  }), [employees, projects, searchDate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Available on date', value:rows.filter(r=>r.avail.ok).length,       color:'#22c55e' },
          { label:'Assigned / Away',   value:rows.filter(r=>!r.avail.ok).length,      color:'#ef4444' },
          { label:'Cert expiring ≤30d',value:rows.filter(r=>r.expiringSoon.length>0).length, color:'#f59e0b' },
        ].map(k=>(
          <div key={k.label} className="kpi-card py-3">
            <div className="text-xl font-bold" style={{color:k.color}}>{k.value}</div>
            <div className="text-xs" style={{color:T.text3}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Position</th><th>Current Assignment</th><th>Cert Alerts</th><th>On {format(searchDate,'dd MMM')}?</th></tr>
            </thead>
            <tbody>
              {rows.map(emp=>{
                const proj = projects.find(p=>p.id===emp.currentProject);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="text-xs font-semibold" style={{color:T.text}}>{emp.name}</div>
                      <div className="text-[10px]" style={{color:T.text3}}>{emp.department}</div>
                    </td>
                    <td className="text-xs" style={{color:T.text2}}>{emp.position}</td>
                    <td className="text-xs" style={{color:T.text2}}>
                      {proj ? (
                        <span className="text-blue-500">{proj.name?.substring(0,28)}</span>
                      ) : (
                        <span style={{color:T.text3}}>—</span>
                      )}
                    </td>
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
                        <span className="text-[10px] text-green-500">All certs OK</span>
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
        <div className="px-4 py-2.5 text-xs" style={{borderTop:`1px solid ${T.border}`,color:T.text3}}>
          {rows.length} employees
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ResourcePlanningPage() {
  const [assets,    setAssets]    = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const [tab,       setTab]       = useState('checker');   // checker | equipment | manpower
  const [searchDate,setSearchDate]= useState(format(addDays(today(),7),'yyyy-MM-dd'));
  const [selProject,setSelProject]= useState('');

  useEffect(()=>{
    (async()=>{
      const [a,p,e] = await Promise.all([assetsService.getAll(),projectsService.getAll(),employeesService.getAll()]);
      setAssets(a); setProjects(p); setEmployees(e);
      if (p.length>0) setSelProject(p.find(x=>x.status==='Preparing'||x.status==='Planned')?.id || p[0]?.id || '');
      setLoading(false);
    })();
  },[]);

  const parsedDate = useMemo(()=>{ try{ return parseISO(searchDate); }catch{ return today(); } },[searchDate]);
  const selProj = projects.find(p=>p.id===selProject);

  const tabs = [
    { id:'checker',   label:'Project Readiness Checker', icon: Zap },
    { id:'equipment', label:'Equipment Availability',    icon: Package },
    { id:'manpower',  label:'Manpower Availability',     icon: Users },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="section-title flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-orange-500"/>Resource Planning & Availability
        </h1>
        <p className="text-xs mt-1" style={{color:T.text3}}>
          ตรวจสอบ availability ของอุปกรณ์และพนักงาน — conflict detection อัตโนมัติ
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{background:T.bg2,border:`1px solid ${T.border}`}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              tab===t.id?'bg-orange-600 text-white':'')}
            style={tab!==t.id?{color:T.text3}:{}}>
            <t.icon className="w-3.5 h-3.5"/>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : tab === 'checker' ? (

        /* ── PROJECT READINESS CHECKER ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Project selector */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{color:T.text3}}>
              เลือก Project
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

          {/* Checker panel */}
          <div className="lg:col-span-2 card p-5">
            {selProj ? (
              <>
                <div className="mb-4">
                  <h2 className="font-semibold text-sm" style={{color:T.text}}>{selProj.name}</h2>
                  <p className="text-xs mt-0.5" style={{color:T.text3}}>
                    {selProj.clientName} · {selProj.siteLocation} · Mob: {selProj.mobilizationDate||selProj.startDate||'TBD'}
                  </p>
                </div>
                <ProjectChecker
                  project={selProj}
                  assets={assets}
                  employees={employees}
                  allProjects={projects}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm" style={{color:T.text3}}>
                เลือก Project ทางซ้ายเพื่อตรวจสอบ resource availability
              </div>
            )}
          </div>
        </div>

      ) : tab === 'equipment' ? (

        /* ── EQUIPMENT AVAILABILITY ── */
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
          <AssetAvailabilityTable assets={assets} projects={projects} searchDate={parsedDate}/>
        </div>

      ) : (

        /* ── MANPOWER AVAILABILITY ── */
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
          <EmployeeAvailabilityTable employees={employees} projects={projects} searchDate={parsedDate}/>
        </div>

      )}
    </div>
  );
}
