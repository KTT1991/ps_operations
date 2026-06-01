import { useState, useEffect } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Download, X, Trash2 } from 'lucide-react';
import { projectsService, employeesService } from '../../services/firebaseService';
import { format, addMonths, startOfMonth, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const TYPE_COLORS = {
  Offshore:  '#3b82f6',
  Onshore:   '#22c55e',
  Shutdown:  '#f59e0b',
  Emergency: '#ef4444',
};
const STATUS_CFG = {
  Active:       {dot:'bg-green-500', text:'text-green-600'},
  Planned:      {dot:'bg-purple-400',text:'text-purple-500'},
  Preparing:    {dot:'bg-blue-500',  text:'text-blue-500'},
  Mobilizing:   {dot:'bg-cyan-500',  text:'text-cyan-600'},
  Demobilizing: {dot:'bg-amber-500', text:'text-amber-600'},
  Delayed:      {dot:'bg-red-500',   text:'text-red-600'},
  Completed:    {dot:'bg-slate-400', text:'text-slate-500'},
};
const EMPTY = {
  name:'', clientName:'', type:'Onshore', siteLocation:'', status:'Planned',
  riskLevel:'Medium', mobilizationDate:'', startDate:'', endDate:'',
  demobilizationDate:'', budget:'', description:'',
};

function pct(date, viewStart, totalDays) {
  const ms = date - viewStart;
  return Math.max(0, Math.min(100, (ms / (totalDays * 86400000)) * 100));
}

function ProjectModal({ project, employees, onClose, onSave }) {
  const [form, setForm] = useState(project ? {...project} : {...EMPTY});
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error('กรอก ชื่อ, วันเริ่ม, วันจบ'); return;
    }
    setSaving(true);
    try {
      if (project?.id) {
        await projectsService.update(project.id, form);
        toast.success('แก้ไขแล้ว');
      } else {
        await projectsService.create({...form, id:`PRJ-${Date.now()}`, readiness:0});
        toast.success('เพิ่มแล้ว');
      }
      onSave(); onClose();
    } catch { toast.error('บันทึกไม่สำเร็จ'); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!project?.id || !confirm(`ลบ "${form.name}"?`)) return;
    await projectsService.delete(project.id);
    toast.success('ลบแล้ว'); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl"
        style={{background:'var(--t-bg2)',border:'1px solid var(--t-border)'}}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{background:'var(--t-bg2)',borderBottom:'1px solid var(--t-border)'}}>
          <h2 className="font-semibold text-sm" style={{color:'var(--t-text)'}}>
            {project ? 'Edit Project' : 'Add New Project'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Project Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Client *</label>
              <input value={form.clientName||''} onChange={e=>set('clientName',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Location</label>
              <input value={form.siteLocation||''} onChange={e=>set('siteLocation',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Type</label>
              <select value={form.type} onChange={e=>set('type',e.target.value)} className="select-field">
                {['Offshore','Onshore','Shutdown','Emergency'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)} className="select-field">
                {Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Risk Level</label>
              <select value={form.riskLevel} onChange={e=>set('riskLevel',e.target.value)} className="select-field">
                {['Low','Medium','High'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Project Manager</label>
              <select value={form.projectManager||''} onChange={e=>set('projectManager',e.target.value)} className="select-field">
                <option value="">—</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            {[
              ['mobilizationDate','Mobilization Date'],
              ['startDate','Start Date *'],
              ['endDate','End Date *'],
              ['demobilizationDate','Demob Date'],
            ].map(([k,l])=>(
              <div key={k}>
                <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>{l}</label>
                <input type="date" value={form[k]||''} onChange={e=>set(k,e.target.value)} className="input-field"/>
              </div>
            ))}
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Budget (฿)</label>
              <input type="number" value={form.budget||''} onChange={e=>set('budget',e.target.value)} className="input-field"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Description</label>
              <textarea value={form.description||''} onChange={e=>set('description',e.target.value)}
                rows={2} className="input-field resize-none"/>
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 z-10 flex items-center justify-between px-5 py-4"
          style={{background:'var(--t-bg2)',borderTop:'1px solid var(--t-border)'}}>
          <div>{project&&<button onClick={del} className="btn-danger text-xs flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Delete</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [viewStart, setViewStart] = useState(startOfMonth(new Date()));
  const [viewMonths,setViewMonths]= useState(3);
  const [statusF,   setStatusF]   = useState('All');
  const [typeF,     setTypeF]     = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([projectsService.getAll(), employeesService.getAll()]);
    setProjects(p); setEmployees(e);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const today = new Date(); today.setHours(0,0,0,0);
  const viewEnd   = addMonths(viewStart, viewMonths);
  const totalDays = differenceInDays(viewEnd, viewStart);

  const months = [];
  let m = new Date(viewStart);
  while (m < viewEnd) { months.push(new Date(m)); m = addMonths(m,1); }

  const filtered = projects.filter(p=>{
    if (statusF!=='All' && p.status!==statusF) return false;
    if (typeF!=='All'   && p.type!==typeF)     return false;
    const s = parseISO(p.startDate||p.start||'');
    const e = parseISO(p.endDate||p.end||'');
    if (!s.getTime()||!e.getTime()) return true;
    return s < viewEnd && e > viewStart;
  });

  const exportExcel = () => {
    const data = projects.map(p=>({
      'ID':p.id,'Name':p.name,'Client':p.clientName,'Type':p.type,
      'Status':p.status,'Risk':p.riskLevel,'Location':p.siteLocation||'',
      'Mob':p.mobilizationDate||'','Start':p.startDate||'','End':p.endDate||'',
      'Demob':p.demobilizationDate||'','Budget':p.budget||'','Readiness':p.readiness||0,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(13).fill({wch:18});
    XLSX.utils.book_append_sheet(wb,ws,'Timeline');
    XLSX.writeFile(wb,`Project_Timeline_${format(new Date(),'yyyyMMdd')}.xlsx`);
    toast.success('Exported');
  };

  // Summary
  const counts = {
    all: projects.length,
    active: projects.filter(p=>p.status==='Active').length,
    preparing: projects.filter(p=>['Planned','Preparing','Mobilizing'].includes(p.status)).length,
    delayed: projects.filter(p=>p.status==='Delayed').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-500"/>Project Timeline
          </h1>
          <p className="text-xs mt-1" style={{color:'var(--t-text3)'}}>
            Gantt chart — ข้อมูลเดียวกับ{' '}
            <span className="text-orange-500 cursor-pointer hover:underline" onClick={()=>navigate('/projects')}>
              Project Management
            </span>
            {' '}· คลิกแถวเพื่อแก้ไข
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary text-xs"><Download className="w-4 h-4"/>Excel</button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary">
            <Plus className="w-4 h-4"/>Add Project
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total',     value:counts.all,       color:'var(--t-text)'},
          {label:'Active',    value:counts.active,    color:'#22c55e'},
          {label:'Preparing', value:counts.preparing, color:'#3b82f6'},
          {label:'Delayed',   value:counts.delayed,   color:'#ef4444'},
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="text-2xl font-bold" style={{color:k.color}}>{k.value}</div>
            <div className="text-xs" style={{color:'var(--t-text3)'}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        {/* View range */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{background:'var(--t-bg2)',border:'1px solid var(--t-border)'}}>
          {[3,6,12].map(n=>(
            <button key={n} onClick={()=>setViewMonths(n)}
              className={clsx('px-3 py-1 rounded-md text-xs transition-all',
                viewMonths===n?'bg-orange-600 text-white':'hover:opacity-80')}
              style={viewMonths!==n?{color:'var(--t-text3)'}:{}}>
              {n} Months
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button onClick={()=>setViewStart(addMonths(viewStart,-1))} className="btn-ghost p-1.5">
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center" style={{color:'var(--t-text)'}}>
            {format(viewStart,'MMM yyyy')} — {format(addMonths(viewStart,viewMonths-1),'MMM yyyy')}
          </span>
          <button onClick={()=>setViewStart(addMonths(viewStart,1))} className="btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4"/>
          </button>
          <button onClick={()=>setViewStart(startOfMonth(new Date()))} className="btn-ghost text-xs px-2">Today</button>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5 ml-auto">
          {['All',...Object.keys(STATUS_CFG)].map(s=>(
            <button key={s} onClick={()=>setStatusF(s)}
              className={clsx('px-2.5 py-1 rounded-md text-xs border transition-all',
                statusF===s?'bg-orange-600 text-white border-orange-500':'')}
              style={statusF!==s?{background:'var(--t-bg2)',color:'var(--t-text2)',borderColor:'var(--t-border2)'}:{}}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Type legend + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        {['All',...Object.keys(TYPE_COLORS)].map(t=>{
          const col = TYPE_COLORS[t];
          return (
            <button key={t} onClick={()=>setTypeF(t)}
              className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all',
                typeF===t?'border-orange-500 bg-orange-500/10 text-orange-500':'')}
              style={typeF!==t?{background:'var(--t-bg2)',color:'var(--t-text2)',borderColor:'var(--t-border2)'}:{}}>
              {col&&<span className="w-2 h-2 rounded-full" style={{background:col}}/>}
              {t}
            </button>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs ml-auto" style={{color:'var(--t-text3)'}}>
          <div className="w-3 h-0.5 rounded" style={{background:'#ef4444',opacity:.6}}/>Today
        </div>
      </div>

      {/* Gantt */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{minWidth:820}}>
            {/* Month header */}
            <div className="flex" style={{borderBottom:'1px solid var(--t-border)',background:'var(--t-bg3)'}}>
              <div className="flex-shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                style={{width:208,borderRight:'1px solid var(--t-border)',color:'var(--t-text3)'}}>
                Project
              </div>
              <div className="flex flex-1">
                {months.map((mn,i)=>(
                  <div key={i} className="flex-1 text-center py-2 text-xs font-medium"
                    style={{borderRight:i<months.length-1?'1px solid var(--t-border)':'none',color:'var(--t-text3)'}}>
                    {format(mn,'MMM yy')}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="flex items-center justify-center h-40" style={{color:'var(--t-text3)'}}>
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2"/>
                Loading...
              </div>
            ) : filtered.length===0 ? (
              <div className="flex items-center justify-center h-40" style={{color:'var(--t-text3)'}}>
                <CalendarDays className="w-8 h-8 mr-2 opacity-30"/>No projects in this range
              </div>
            ) : filtered.map(proj=>{
              const sD = parseISO(proj.startDate||proj.start||'');
              const eD = parseISO(proj.endDate||proj.end||'');
              const mD = proj.mobilizationDate ? parseISO(proj.mobilizationDate) : null;
              const dD = proj.demobilizationDate ? parseISO(proj.demobilizationDate) : null;
              const col = TYPE_COLORS[proj.type]||TYPE_COLORS.Onshore;
              const sc  = STATUS_CFG[proj.status]||STATUS_CFG.Planned;
              const todayPct = pct(today, viewStart, totalDays);
              const barL = pct(sD, viewStart, totalDays);
              const barW = pct(eD, viewStart, totalDays) - barL;
              const clampL = Math.max(0, barL);
              const clampW = Math.min(100-clampL, Math.max(barW, 0.5));
              const daysLeft = eD.getTime() ? differenceInDays(eD, today) : null;
              const isDelayed = proj.status==='Delayed';

              let mobBar='', demobBar='';
              if (mD) {
                const mL=pct(mD,viewStart,totalDays), mW=barL-mL;
                if (mW>0.3&&mL>=0) mobBar=`left:${Math.max(0,mL).toFixed(2)}%;width:${Math.min(mW,100-Math.max(0,mL)).toFixed(2)}%`;
              }
              if (dD) {
                const dL=pct(eD,viewStart,totalDays), dW=pct(dD,viewStart,totalDays)-dL;
                if (dW>0.3&&dL<100) demobBar=`left:${dL.toFixed(2)}%;width:${Math.min(dW,100-dL).toFixed(2)}%`;
              }

              return (
                <div key={proj.id}
                  onClick={()=>{setSelected(proj);setShowModal(true);}}
                  className="flex group cursor-pointer"
                  style={{borderBottom:'1px solid var(--t-border)'}}>

                  {/* Info col */}
                  <div className="flex-shrink-0 px-3 py-3 group-hover:opacity-90 transition-opacity"
                    style={{width:208,borderRight:'1px solid var(--t-border)'}}>
                    <div className="font-medium text-xs leading-snug truncate group-hover:text-orange-500 transition-colors"
                      style={{color:'var(--t-text)'}} title={proj.name}>
                      {proj.name}
                    </div>
                    <div className="text-[10px] truncate mt-0.5" style={{color:'var(--t-text3)'}}>{proj.clientName}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={clsx('inline-flex items-center gap-1 text-[10px] font-medium')}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full',sc.dot)}/>
                        <span className={sc.text}>{proj.status}</span>
                      </span>
                      <span className="text-[10px]" style={{color:'var(--t-text3)'}}>{proj.type}</span>
                    </div>
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative" style={{minHeight:56}}>
                    {/* Grid lines */}
                    {months.map((_,i)=> i>0 && (
                      <div key={i} className="absolute top-0 bottom-0 w-px"
                        style={{left:`${(i/months.length)*100}%`,background:'var(--t-border)'}}/>
                    ))}
                    {/* Today line */}
                    {todayPct>0&&todayPct<100&&(
                      <div className="absolute top-0 bottom-0 z-10" style={{left:`${todayPct}%`}}>
                        <div className="w-px h-full opacity-60" style={{background:'#ef4444'}}/>
                        <div className="absolute top-0 left-1 text-[9px] font-medium text-red-500 whitespace-nowrap">Today</div>
                      </div>
                    )}
                    {/* Mob bar */}
                    {mobBar&&(
                      <div className="absolute rounded" style={{
                        [mobBar.split(';')[0].split(':')[0].trim()]: mobBar.split(';')[0].split(':')[1].trim(),
                        [mobBar.split(';')[1].split(':')[0].trim()]: mobBar.split(';')[1].split(':')[1].trim(),
                        top:'50%',transform:'translateY(-175%)',height:5,
                        background:col,opacity:.55,
                      }}/>
                    )}
                    {/* Main bar */}
                    <div className="absolute flex items-center px-1.5 rounded text-[10px] font-medium overflow-hidden select-none"
                      style={{
                        left:`${clampL}%`,width:`${clampW}%`,
                        top:'50%',transform:'translateY(-50%)',height:20,
                        background:isDelayed?'#ef4444':col,
                        color:'#fff',minWidth:2,
                      }}>
                      {clampW>8&&(
                        <span className="truncate">
                          {proj.name.length>16?proj.name.slice(0,14)+'…':proj.name}
                          {isDelayed&&' ⚠'}
                        </span>
                      )}
                    </div>
                    {/* Demob bar */}
                    {demobBar&&(
                      <div className="absolute rounded" style={{
                        [demobBar.split(';')[0].split(':')[0].trim()]: demobBar.split(';')[0].split(':')[1].trim(),
                        [demobBar.split(';')[1].split(':')[0].trim()]: demobBar.split(';')[1].split(':')[1].trim(),
                        top:'50%',transform:'translateY(80%)',height:5,
                        background:col,opacity:.55,
                      }}/>
                    )}
                    {/* Days label */}
                    {daysLeft!==null&&clampW>14&&(
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] opacity-70 text-white z-[5]">
                        {proj.status==='Completed'?'✓':daysLeft<0?`${Math.abs(daysLeft)}d over`:`${daysLeft}d`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between text-xs"
          style={{borderTop:'1px solid var(--t-border)',color:'var(--t-text3)'}}>
          <span>{filtered.length} of {projects.length} projects</span>
          <span>Top bar = Mobilization · Main bar = Active · Bottom bar = Demob</span>
        </div>
      </div>

      {showModal&&(
        <ProjectModal project={selected} employees={employees}
          onClose={()=>setShowModal(false)} onSave={load}/>
      )}
    </div>
  );
}
