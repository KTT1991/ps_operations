import { useState, useEffect } from 'react';
import { FolderKanban, Plus, Search, Download, MapPin, Calendar, Users, Package, ExternalLink, X, Trash2 } from 'lucide-react';
import { projectsService, assetsService, employeesService } from '../../services/firebaseService';
import { exportProjectsToExcel, exportProjectsToPDF } from '../../utils/exportUtils';
import { differenceInDays, parseISO, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  Active:       { dot:'bg-green-500',  text:'text-green-600',  bg:'bg-green-50  border-green-200',  bdark:'bg-green-900/30 border-green-700/50'  },
  Preparing:    { dot:'bg-blue-500',   text:'text-blue-600',   bg:'bg-blue-50   border-blue-200',   bdark:'bg-blue-900/30 border-blue-700/50'    },
  Mobilizing:   { dot:'bg-cyan-500',   text:'text-cyan-700',   bg:'bg-cyan-50   border-cyan-200',   bdark:'bg-cyan-900/30 border-cyan-700/50'    },
  Planned:      { dot:'bg-purple-500', text:'text-purple-600', bg:'bg-purple-50 border-purple-200', bdark:'bg-purple-900/30 border-purple-700/50'},
  Demobilizing: { dot:'bg-amber-500',  text:'text-amber-700',  bg:'bg-amber-50  border-amber-200',  bdark:'bg-amber-900/30 border-amber-700/50'  },
  Delayed:      { dot:'bg-red-500 animate-pulse', text:'text-red-600', bg:'bg-red-50 border-red-200', bdark:'bg-red-900/30 border-red-700/50' },
  Completed:    { dot:'bg-slate-400',  text:'text-slate-500',  bg:'bg-slate-50  border-slate-200',  bdark:'bg-slate-800 border-slate-700'        },
};
const RISK_COLOR = { Low:'text-green-600', Medium:'text-amber-600', High:'text-red-600' };
const RISK_DARK  = { Low:'text-green-400', Medium:'text-amber-400', High:'text-red-400' };

const EMPTY_FORM = {
  name:'', clientName:'', type:'Onshore', siteLocation:'',
  status:'Planned', riskLevel:'Medium', projectManager:'',
  projectNumber:'',  // ← เพิ่มตรงนี้ เช่น "262197"
  mobilizationDate:'', startDate:'', endDate:'', demobilizationDate:'',
  budget:'', description:'',
};

function ProjectModal({ project, employees, onClose, onSave, onViewTimeline }) {
  const [form, setForm] = useState(project ? { ...project } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name || !form.clientName) { toast.error('กรอกชื่อ Project และ Client'); return; }
    setSaving(true);
    try {
      if (project?.id) {
        await projectsService.update(project.id, form);
        toast.success('แก้ไขแล้ว');
      } else {
        await projectsService.create({ ...form, id:`PRJ-${Date.now()}`, readiness:0 });
        toast.success('เพิ่ม Project แล้ว');
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
          <div className="flex items-center gap-2">
            {project && (
              <button onClick={onViewTimeline}
                className="btn-ghost text-xs flex items-center gap-1" title="ดูใน Timeline">
                <ExternalLink className="w-3.5 h-3.5"/>Timeline
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Project Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} className="input-field"
                placeholder="Ex. Offshore Platform A — Annual Inspection 2026"/>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Client *</label>
              <input value={form.clientName} onChange={e=>set('clientName',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Site Location</label>
              <input value={form.siteLocation} onChange={e=>set('siteLocation',e.target.value)} className="input-field"/>
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
             <input
               type="text"
               value={form.projectManager || ''}
               onChange={e => set('projectManager', e.target.value)}
               className="input-field"
               placeholder="Enter Project Manager name"
  />
</div>
           {/* ← เพิ่มตรงนี้ */}
           <div>
             <label className="text-xs block mb-1" style={{color:'var(--t-text3)'}}>Project Number</label>
             <input
               type="text"
               value={form.projectNumber || ''}
               onChange={e => set('projectNumber', e.target.value)}
               className="input-field"
               placeholder="เช่น 262197"
             />
           </div>

            {[
              ['mobilizationDate','Mobilization Date'],
              ['startDate','Start Date'],
              ['endDate','End Date'],
              ['demobilizationDate','Demobilization Date'],
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
                rows={3} className="input-field resize-none"/>
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

function ProjectCard({ project, assets, employees, onEdit }) {
  const cfg = STATUS_CFG[project.status] || STATUS_CFG.Planned;
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const pm = employees.find(e=>e.id===project.projectManager);
  const actualEquip = assets.filter(a => a.currentProject === project.id).length;
  const actualTech  = employees.filter(e => e.currentProject === project.id).length;

  return (
    <div className="card hover:border-[var(--t-border2)] transition-all cursor-pointer"
      style={{borderLeft:`3px solid ${cfg.dot.replace('bg-','').includes('animate') ? '#ef4444' : ''}`}}
      onClick={onEdit}>

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono" style={{color:'var(--t-text3)'}}>{project.id}</span>
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',cfg.bdark)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>
                <span className={cfg.text}>{project.status}</span>
              </span>
              <span className="text-xs" style={{color:'var(--t-text3)'}}>{project.type}</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug" style={{color:'var(--t-text)'}}>{project.name}</h3>
            <p className="text-xs mt-0.5" style={{color:'var(--t-text3)'}}>{project.clientName}</p>
          </div>
          <span className={clsx('text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded',
            project.riskLevel==='High'?'text-red-400 bg-red-900/20':
            project.riskLevel==='Medium'?'text-amber-400 bg-amber-900/20':
            'text-green-400 bg-green-900/20')}>
            {project.riskLevel}
          </span>
        </div>

        {/* Meta */}
        <div className="space-y-1 mb-3">
          {project.siteLocation && (
            <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--t-text3)'}}>
              <MapPin className="w-3 h-3 flex-shrink-0"/>
              <span className="truncate">{project.siteLocation}</span>
            </div>
          )}
          {(project.startDate||project.endDate) && (
            <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--t-text3)'}}>
              <Calendar className="w-3 h-3 flex-shrink-0"/>
              <span>{project.startDate} → {project.endDate}</span>
              {daysLeft!==null && (
                <span className={clsx('ml-auto font-semibold',
                  daysLeft<0?'text-red-500':daysLeft<14?'text-amber-500':'')}>
                  {daysLeft<0?`${Math.abs(daysLeft)}d over`:`${daysLeft}d left`}
                </span>
              )}
            </div>
          )}
          {pm && (
            <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--t-text3)'}}>
              <Users className="w-3 h-3 flex-shrink-0"/>
              <span>PM: {pm.name}</span>
            </div>
          )}
        </div>

        {/* Readiness */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5" style={{color:'var(--t-text3)'}}>
            <span>Readiness</span>
            <span className="font-semibold" style={{color:
              (project.readiness||0)>=80?'#22c55e':
              (project.readiness||0)>=60?'#f59e0b':'#ef4444'}}>
              {project.readiness||0}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{
              width:`${project.readiness||0}%`,
              background:(project.readiness||0)>=80?'#22c55e':(project.readiness||0)>=60?'#f59e0b':'#ef4444'
            }}/>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            {Icon:Package, label:'Equipment',   value:actualEquip||'—'},
            {Icon:Users,   label:'Technicians', value:actualTech||'—'}, 
            {Icon:Calendar,label:'Budget', value:project.budget?`฿${(project.budget/1000000).toFixed(1)}M`:'—'},
          ].map(({Icon,label,value})=>(
            <div key={label} className="rounded-lg p-2 text-center" style={{background:'var(--t-bg3)'}}>
              <Icon className="w-3 h-3 mx-auto mb-1" style={{color:'var(--t-text3)'}}/>
              <div className="font-bold" style={{color:'var(--t-text)'}}>{value}</div>
              <div className="text-[10px]" style={{color:'var(--t-text3)'}}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects,  setProjects]  = useState([]);
  const [assets,    setAssets]    = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [statusF,   setStatusF]   = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [p,a,e] = await Promise.all([
      projectsService.getAll(),
      assetsService.getAll(),
      employeesService.getAll(),
    ]);
    setProjects(p); setAssets(a); setEmployees(e);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const filtered = projects.filter(p=>{
    const s = search.toLowerCase();
    const m = !s||p.name?.toLowerCase().includes(s)||p.clientName?.toLowerCase().includes(s)||p.siteLocation?.toLowerCase().includes(s);
    return m&&(statusF==='All'||p.status===statusF);
  });

  const handleViewTimeline = () => { navigate('/timeline'); };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-orange-500"/>Project Management
          </h1>
          <p className="text-xs mt-1" style={{color:'var(--t-text3)'}}>
            {projects.filter(p=>p.status==='Active').length} active ·{' '}
            {projects.filter(p=>p.status==='Planned').length} planned
            <span className="ml-2 text-orange-500 cursor-pointer hover:underline" onClick={()=>navigate('/timeline')}>
              → ดู Timeline
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>navigate('/timeline')} className="btn-secondary text-xs flex items-center gap-1">
            <ExternalLink className="w-4 h-4"/>Timeline View
          </button>
          <button onClick={()=>exportProjectsToExcel(filtered)} className="btn-secondary text-xs">
            <Download className="w-4 h-4"/>Excel
          </button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary">
            <Plus className="w-4 h-4"/>Add Project
          </button>
        </div>
      </div>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-2">
        {['All',...Object.keys(STATUS_CFG)].map(s=>{
          const count = s==='All' ? projects.length : projects.filter(p=>p.status===s).length;
          const cfg = STATUS_CFG[s];
          return (
            <button key={s} onClick={()=>setStatusF(s)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusF===s
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'border-[var(--t-border2)] hover:border-[var(--t-border2)]'
              )}
              style={statusF!==s?{background:'var(--t-bg2)',color:'var(--t-text2)'}:{}}>
              {cfg && <span className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>}
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'var(--t-text3)'}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="ค้นหา Project, Client, Location..."
          className="input-field pl-9"/>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(proj=>(
            <ProjectCard key={proj.id} project={proj} assets={assets} employees={employees}
              onEdit={()=>{setSelected(proj);setShowModal(true);}}/>
          ))}
          {filtered.length===0&&(
            <div className="col-span-3 text-center py-16" style={{color:'var(--t-text3)'}}>
              <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-20"/>ไม่พบ Project
            </div>
          )}
        </div>
      )}

      {showModal&&(
        <ProjectModal
          project={selected}
          employees={employees}
          onClose={()=>setShowModal(false)}
          onSave={load}
          onViewTimeline={handleViewTimeline}
        />
      )}
    </div>
  );
}
