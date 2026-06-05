import { useState, useEffect } from 'react';
import { FolderKanban, Plus, Search, Download, MapPin, Calendar, Users, Package, ExternalLink } from 'lucide-react';
import { projectsService, assetsService, employeesService } from '../../services/firebaseService';
import { exportProjectsToExcel } from '../../utils/exportUtils';
import { differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import ProjectModal from './ProjectModal';

const STATUS_CFG = {
  Active:       { dot:'bg-green-500',  text:'text-green-600',  bdark:'bg-green-900/30 border-green-700/50'  },
  Preparing:    { dot:'bg-blue-500',   text:'text-blue-600',   bdark:'bg-blue-900/30 border-blue-700/50'    },
  Mobilizing:   { dot:'bg-cyan-500',   text:'text-cyan-700',   bdark:'bg-cyan-900/30 border-cyan-700/50'    },
  Planned:      { dot:'bg-purple-500', text:'text-purple-600', bdark:'bg-purple-900/30 border-purple-700/50'},
  Demobilizing: { dot:'bg-amber-500',  text:'text-amber-700',  bdark:'bg-amber-900/30 border-amber-700/50'  },
  Delayed:      { dot:'bg-red-500 animate-pulse', text:'text-red-600', bdark:'bg-red-900/30 border-red-700/50' },
  Completed:    { dot:'bg-slate-400',  text:'text-slate-500',  bdark:'bg-slate-800 border-slate-700'        },
};

function ProjectCard({ project, assets, employees, onEdit }) {
  const cfg = STATUS_CFG[project.status] || STATUS_CFG.Planned;
  const daysLeft = project.endDate ? differenceInDays(parseISO(project.endDate), new Date()) : null;
  const pm = employees.find(e=>e.id===project.projectManager);
  
  // FIX: Compare asset's `currentProject` field with the project's `projectNo` field.
  const assignedEquipment = assets.filter(a => a.currentProject === project.projectNo && a.status === 'In Use').length;
  
  // FIX: Assume employee schedules also use `projectNo` for consistency.
  const assignedManpower = employees.reduce((count, emp) => {
      const isAssigned = (emp.schedule || []).some(s => s.projectId === project.projectNo && s.type === 'Assignment');
      return count + (isAssigned ? 1 : 0);
  }, 0);

  return (
    <div className="card hover:border-slate-600 transition-all cursor-pointer"
      style={{borderLeft:`3px solid ${cfg.dot.includes('red') ? '#ef4444' : ''}`}}
      onClick={onEdit}>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-slate-500">{project.projectNo || project.id}</span>
              <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',cfg.bdark)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>
                {project.status}
              </span>
              <span className="text-xs text-slate-500">{project.type}</span>
            </div>
            <h3 className="font-semibold text-sm leading-snug text-slate-100">{project.name}</h3>
            <p className="text-xs mt-0.5 text-slate-400">{project.clientName}</p>
          </div>
          <span className={clsx('text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded',
            project.riskLevel==='High'?'text-red-400 bg-red-900/20':
            project.riskLevel==='Medium'?'text-amber-400 bg-amber-900/20':
            'text-green-400 bg-green-900/20')}>
            {project.riskLevel} Risk
          </span>
        </div>

        <div className="space-y-1 mb-3 text-slate-400">
          {project.siteLocation && (
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin className="w-3 h-3 flex-shrink-0"/>
              <span className="truncate">{project.siteLocation}</span>
            </div>
          )}
          {(project.startDate||project.endDate) && (
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="w-3 h-3 flex-shrink-0"/>
              <span>{project.startDate || 'N/A'} → {project.endDate || 'N/A'}</span>
              {daysLeft!==null && (
                <span className={clsx('ml-auto font-semibold',
                  daysLeft<0?'text-red-500':daysLeft<14?'text-amber-500':'text-slate-400')}>
                  {daysLeft<0?`${Math.abs(daysLeft)}d over`:`${daysLeft}d left`}
                </span>
              )}
            </div>
          )}
          {pm && (
            <div className="flex items-center gap-1.5 text-xs">
              <Users className="w-3 h-3 flex-shrink-0"/>
              <span>PM: {pm.name}</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5 text-slate-400">
            <span>Readiness</span>
            <span className={clsx('font-semibold', (project.readiness||0)>=80?'text-green-500': (project.readiness||0)>=60?'text-amber-500':'text-red-500')}>
              {project.readiness||0}%
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5">
            <div className={clsx('h-1.5 rounded-full', (project.readiness||0)>=80?'bg-green-500': (project.readiness||0)>=60?'bg-amber-500':'bg-red-500')} style={{width:`${project.readiness||0}%`}}/>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            {Icon:Package, label:'Equipment', value: assignedEquipment},
            {Icon:Users,   label:'Manpower',  value: assignedManpower},
            {Icon:Calendar,label:'Budget',    value: project.budget ? `฿${(project.budget/1000000).toFixed(1)}M` : '—'},
          ].map(({Icon,label,value})=>(
            <div key={label} className="bg-slate-800/50 rounded-lg p-2 text-center">
              <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-slate-500"/>
              <div className="font-bold text-slate-200">{value ?? '—'}</div>
              <div className="text-[10px] text-slate-400">{label}</div>
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
    setProjects(p.sort((x,y) => (x.startDate || '').localeCompare(y.startDate || ''))); 
    setAssets(a); 
    setEmployees(e);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const filtered = projects.filter(p=>{
    const s = search.toLowerCase();
    const pm = employees.find(e=>e.id===p.projectManager);
    const m = !s||p.name?.toLowerCase().includes(s)||p.clientName?.toLowerCase().includes(s)||p.siteLocation?.toLowerCase().includes(s)||p.projectNo?.toLowerCase().includes(s)||pm?.name.toLowerCase().includes(s);
    return m&&(statusF==='All'||p.status===statusF);
  });

  const handleViewTimeline = () => { navigate('/timeline'); };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-orange-500"/>Project Management
          </h1>
          <p className="text-xs mt-1 text-slate-400">
            {projects.filter(p=>p.status==='Active').length} active ·{' '}
            {projects.filter(p=>p.status==='Planned').length} planned
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>navigate('/timeline')} className="btn-secondary text-xs flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5"/>Timeline View
          </button>
          <button onClick={()=>exportProjectsToExcel(filtered, employees)} className="btn-secondary text-xs">
            <Download className="w-4 h-4"/>Excel
          </button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary">
            <Plus className="w-4 h-4"/>Add Project
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All',...Object.keys(STATUS_CFG)].map(s=>{
          const count = s==='All' ? projects.length : projects.filter(p=>p.status===s).length;
          const cfg = STATUS_CFG[s];
          return (
            <button key={s} onClick={()=>setStatusF(s)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                statusF===s
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800 text-slate-300'
              )}>
              {cfg && <span className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>}
              {s} ({count})
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search Project No, Name, Client, PM..."
          className="input-field pl-9"/>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(proj=>(
            <ProjectCard key={proj.id} project={proj} assets={assets} employees={employees}
              onEdit={()=>{setSelected(proj);setShowModal(true);}}/>
          ))}
          {filtered.length===0&&(
            <div className="col-span-4 text-center py-16 text-slate-500">
              <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-20"/>No Projects Found
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
