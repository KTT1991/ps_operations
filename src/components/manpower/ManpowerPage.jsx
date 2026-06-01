import { useState, useEffect } from 'react';
import { Users, Plus, Search, Download, AlertTriangle, X, Trash2 } from 'lucide-react';
import { employeesService, projectsService } from '../../services/firebaseService';
import { exportManpowerToExcel } from '../../utils/exportUtils';
import { differenceInDays, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const AVAILABILITY_CONFIG = {
  Available:  { color:'text-green-400',  bg:'bg-green-900/30 border-green-700/50',  dot:'bg-green-500' },
  Assigned:   { color:'text-blue-400',   bg:'bg-blue-900/30 border-blue-700/50',    dot:'bg-blue-500' },
  'On Leave': { color:'text-amber-400',  bg:'bg-amber-900/30 border-amber-700/50',  dot:'bg-amber-500' },
  Offshore:   { color:'text-cyan-400',   bg:'bg-cyan-900/30 border-cyan-700/50',    dot:'bg-cyan-500' },
  Training:   { color:'text-purple-400', bg:'bg-purple-900/30 border-purple-700/50',dot:'bg-purple-500' },
};

// Default cert types — user can add their own per employee
const DEFAULT_CERTS = ['BOSIET','HUET','H2S Safety','Medical','Offshore Survival','CompEx','CSWIP','PMP'];

function EmployeeModal({ employee, projects, onClose, onSave }) {
  const [form, setForm] = useState(employee || {
    name:'', position:'', department:'', email:'', phone:'',
    availability:'Available', rotation:'Onshore', utilization:0,
    currentProject:'', certifications:'', skills:'', notes:'',
  });
  // Flexible cert fields — list of { label, expiry }
  const [certs, setCerts] = useState(
    employee?.certFields || []
  );
  // Flexible custom fields
  const [customFields, setCustomFields] = useState(employee?.customFields || []);
  const [saving, setSaving] = useState(false);
  const [newCertLabel, setNewCertLabel] = useState('');

  const addCert = (label) => {
    if (!label) return;
    if (certs.find(c => c.label === label)) return;
    setCerts(c => [...c, { label, expiry:'' }]);
    setNewCertLabel('');
  };

  const save = async () => {
    if (!form.name) { toast.error('กรอกชื่อพนักงานด้วย'); return; }
    setSaving(true);
    try {
      const data = {
        ...form,
        certifications: typeof form.certifications === 'string'
          ? form.certifications.split(',').map(s=>s.trim()).filter(Boolean)
          : form.certifications || [],
        skills: typeof form.skills === 'string'
          ? form.skills.split(',').map(s=>s.trim()).filter(Boolean)
          : form.skills || [],
        certFields: certs,
        customFields,
      };
      if (employee?.id) { await employeesService.update(employee.id, data); toast.success('แก้ไขแล้ว'); }
      else { await employeesService.create({ ...data, id:`EMP-${Date.now()}` }); toast.success('เพิ่มพนักงานแล้ว'); }
      onSave(); onClose();
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!employee?.id || !confirm(`ลบ ${form.name}?`)) return;
    await employeesService.delete(employee.id);
    toast.success('ลบแล้ว'); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl">
        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">{employee ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">ชื่อ-นามสกุล *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input-field" />
            </div>
            {[['position','ตำแหน่ง'],['department','แผนก'],['email','Email'],['phone','เบอร์โทร']].map(([k,l])=>(
              <div key={k}>
                <label className="text-xs text-[var(--t-text3)] block mb-1">{l}</label>
                <input type="text" value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} className="input-field" />
              </div>
            ))}
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">สถานะ</label>
              <select value={form.availability} onChange={e=>setForm({...form,availability:e.target.value})} className="select-field">
                {Object.keys(AVAILABILITY_CONFIG).map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Rotation</label>
              <select value={form.rotation} onChange={e=>setForm({...form,rotation:e.target.value})} className="select-field">
                {['Onshore','14/14','21/21','28/28','อื่นๆ'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Project ปัจจุบัน</label>
              <select value={form.currentProject||''} onChange={e=>setForm({...form,currentProject:e.target.value})} className="select-field">
                <option value="">ไม่มี</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.id} — {p.name?.substring(0,28)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Utilization %</label>
              <input type="number" min="0" max="100" value={form.utilization||0} onChange={e=>setForm({...form,utilization:Number(e.target.value)})} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">Skills (คั่นด้วยจุลภาค)</label>
              <input value={Array.isArray(form.skills)?form.skills.join(', '):form.skills||''} onChange={e=>setForm({...form,skills:e.target.value})} className="input-field" placeholder="เช่น Welding, Rigging, NDT" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">หมายเหตุ</label>
              <textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="input-field resize-none" />
            </div>
          </div>

          {/* Flexible Certificates */}
          <div className="border-t border-[var(--t-border)] pt-4">
            <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider mb-3">
              ใบรับรอง / Certificates
              <span className="ml-2 font-normal text-slate-600">(เพิ่มได้ตามจริง)</span>
            </div>

            {/* Quick add buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DEFAULT_CERTS.filter(c => !certs.find(x=>x.label===c)).map(c => (
                <button key={c} onClick={() => addCert(c)}
                  className="px-2 py-0.5 text-xs border border-[var(--t-border2)] text-[var(--t-text3)] rounded-md hover:border-orange-500 hover:text-orange-400 transition-colors">
                  + {c}
                </button>
              ))}
            </div>

            {/* Manual add */}
            <div className="flex gap-2 mb-3">
              <input value={newCertLabel} onChange={e=>setNewCertLabel(e.target.value)} placeholder="ชื่อ Certificate อื่นๆ..."
                onKeyDown={e=>e.key==='Enter'&&addCert(newCertLabel)}
                className="input-field flex-1 text-xs" />
              <button onClick={()=>addCert(newCertLabel)} className="btn-secondary text-xs px-3">+ เพิ่ม</button>
            </div>

            {/* Cert list with expiry dates */}
            {certs.length === 0 && <p className="text-xs text-slate-600">ยังไม่มี certificate — กดปุ่มด้านบนเพื่อเพิ่ม</p>}
            <div className="space-y-2">
              {certs.map((c, i) => {
                const days = c.expiry ? differenceInDays(parseISO(c.expiry), new Date()) : null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0',
                      days === null ? 'bg-slate-600' : days < 0 ? 'bg-red-500' : days < 30 ? 'bg-amber-500' : 'bg-green-500')} />
                    <span className="text-sm text-[var(--t-text2)] w-40 flex-shrink-0">{c.label}</span>
                    <input type="date" value={c.expiry||''} onChange={e=>setCerts(cf=>cf.map((x,j)=>j===i?{...x,expiry:e.target.value}:x))}
                      className="input-field flex-1 text-xs" placeholder="วันหมดอายุ" />
                    {days !== null && (
                      <span className={clsx('text-xs w-20 text-right flex-shrink-0',
                        days < 0 ? 'text-red-400 font-bold' : days < 30 ? 'text-amber-400' : 'text-green-400')}>
                        {days < 0 ? 'EXPIRED' : `${days}d`}
                      </span>
                    )}
                    <button onClick={()=>setCerts(cf=>cf.filter((_,j)=>j!==i))} className="btn-ghost p-1 text-red-400 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Fields */}
          <div className="border-t border-[var(--t-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider">ข้อมูลเพิ่มเติม (Custom)</div>
              <button onClick={() => setCustomFields(f=>[...f,{key:'',value:''}])} className="btn-ghost text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />เพิ่มช่อง
              </button>
            </div>
            {customFields.length===0 && <p className="text-xs text-slate-600">ยังไม่มีช่องเพิ่มเติม</p>}
            <div className="space-y-2">
              {customFields.map((f,i)=>(
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="ชื่อ เช่น Employee ID, Gate Pass" value={f.key}
                    onChange={e=>setCustomFields(cf=>cf.map((c,j)=>j===i?{...c,key:e.target.value}:c))}
                    className="input-field w-40 flex-shrink-0 text-xs" />
                  <input placeholder="ค่า" value={f.value}
                    onChange={e=>setCustomFields(cf=>cf.map((c,j)=>j===i?{...c,value:e.target.value}:c))}
                    className="input-field flex-1 text-xs" />
                  <button onClick={()=>setCustomFields(cf=>cf.filter((_,j)=>j!==i))} className="btn-ghost p-1 text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex items-center justify-between">
          <div>{employee && <button onClick={del} className="btn-danger text-xs flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />ลบ</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'กำลังบันทึก...':'บันทึก'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeCard({ emp, projects, onClick }) {
  const cfg = AVAILABILITY_CONFIG[emp.availability] || AVAILABILITY_CONFIG.Available;
  const project = projects.find(p => p.id === emp.currentProject);
  const certs = emp.certFields || [];
  const hasCritical = certs.some(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) < 30);

  return (
    <div onClick={onClick} className="card hover:border-slate-600 transition-all cursor-pointer p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{background:'rgba(148,163,184,.15)',color:'#94a3b8'}}>
            {emp.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-sm">{emp.name}</div>
            <div className="text-xs text-[var(--t-text3)]">{emp.position}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border', cfg.bg, cfg.color)}>
            <div className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />{emp.availability}
          </span>
          {hasCritical && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--t-text3)]">
        <span>{emp.department}</span><span>{emp.rotation}</span>
      </div>

      {project && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-2.5 py-1.5 text-xs text-blue-400 truncate">
          📍 {project.name?.substring(0,35)}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[var(--t-text3)]">Utilization</span>
          <span className={clsx(emp.utilization>90?'text-red-400':emp.utilization>70?'text-amber-400':'text-green-400')}>{emp.utilization}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{width:`${emp.utilization}%`,background:emp.utilization>90?'#ef4444':emp.utilization>70?'#f59e0b':'#22c55e'}} />
        </div>
      </div>

      {/* Show cert expiry status */}
      {certs.length > 0 && (
        <div className="space-y-1">
          {certs.slice(0,3).map(c => {
            const days = c.expiry ? differenceInDays(parseISO(c.expiry), new Date()) : null;
            return (
              <div key={c.label} className="flex items-center justify-between text-xs">
                <span className="text-[var(--t-text3)]">{c.label}</span>
                {days !== null && (
                  <span className={clsx('font-medium', days<0?'text-red-400':days<30?'text-amber-400':'text-[var(--t-text3)]')}>
                    {days<0?'EXPIRED':`${days}d`}
                  </span>
                )}
              </div>
            );
          })}
          {certs.length > 3 && <div className="text-xs text-slate-600">+{certs.length-3} more...</div>}
        </div>
      )}

      {(emp.skills||[]).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(emp.skills)?emp.skills:emp.skills?.split(',').map(s=>s.trim())||[]).slice(0,3).map(s=>(
            <span key={s} className="px-1.5 py-0.5 bg-[var(--t-bg3)] text-[var(--t-text3)] rounded text-[10px]">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManpowerPage() {
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [availFilter, setAvailFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const [e, p] = await Promise.all([employeesService.getAll(), projectsService.getAll()]);
    setEmployees(e); setProjects(p);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => {
    const s = search.toLowerCase();
    const m = !s || e.name?.toLowerCase().includes(s) || e.position?.toLowerCase().includes(s);
    return m && (availFilter==='All' || e.availability===availFilter);
  });

  // Count cert expiry alerts across all employees
  const expiryAlerts = employees.filter(e => {
    const certs = e.certFields || [];
    return certs.some(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) < 30);
  }).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Manpower & Resources
          </h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">
            {employees.filter(e=>e.availability==='Available').length} available ·{' '}
            {employees.filter(e=>e.availability==='Assigned').length} assigned
            {expiryAlerts>0 && <span className="ml-2 text-amber-400">· ⚠ {expiryAlerts} cert expiry</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportManpowerToExcel(employees)} className="btn-secondary text-xs"><Download className="w-4 h-4" />Excel</button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary"><Plus className="w-4 h-4" />เพิ่มพนักงาน</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(AVAILABILITY_CONFIG).map(([status, cfg]) => (
          <button key={status} onClick={()=>setAvailFilter(availFilter===status?'All':status)}
            className={clsx('kpi-card text-left transition-all', availFilter===status&&'border-orange-500 bg-orange-500/10')}>
            <div className={clsx('w-2 h-2 rounded-full mb-2',cfg.dot)} />
            <div className={clsx('text-2xl font-bold',cfg.color)}>{employees.filter(e=>e.availability===status).length}</div>
            <div className="text-xs text-[var(--t-text3)] mt-0.5">{status}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]" />
        <input type="text" placeholder="ค้นหาชื่อ, ตำแหน่ง, แผนก..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} projects={projects} onClick={()=>{setSelected(emp);setShowModal(true);}} />
          ))}
          {filtered.length===0 && (
            <div className="col-span-4 text-center py-16 text-[var(--t-text3)]">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />ไม่พบพนักงาน
            </div>
          )}
        </div>
      )}

      {showModal && (
        <EmployeeModal employee={selected} projects={projects} onClose={()=>setShowModal(false)} onSave={load} />
      )}
    </div>
  );
}
