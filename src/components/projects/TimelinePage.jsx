import { useState, useEffect } from 'react';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { projectsService, employeesService } from '../../services/firebaseService';
import { format, addMonths, startOfMonth, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ProjectModal from './ProjectModal';

const TYPE_COLORS = {
  Offshore:  '#3b82f6',
  Onshore:   '#22c55e',
  Shutdown:  '#f59e0b',
  Emergency: '#ef4444',
  Other:     '#a855f7',
};
const STATUS_CFG = {
  Active:       {dot:'bg-green-500', text:'text-green-400'},
  Planned:      {dot:'bg-purple-400',text:'text-purple-400'},
  Preparing:    {dot:'bg-blue-500',  text:'text-blue-400'},
  Mobilizing:   {dot:'bg-cyan-500',  text:'text-cyan-400'},
  Demobilizing: {dot:'bg-amber-500', text:'text-amber-400'},
  Delayed:      {dot:'bg-red-500',   text:'text-red-400'},
  Completed:    {dot:'bg-slate-400', text:'text-slate-500'},
};

function pct(date, viewStart, totalDays) {
  if (!date || !date.getTime()) return -1;
  const ms = date - viewStart;
  return Math.max(0, Math.min(100, (ms / (totalDays * 86400000)) * 100));
}

export default function TimelinePage() {
  const [projects,  setProjects]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [viewStart, setViewStart] = useState(startOfMonth(new Date()));
  const [viewMonths,setViewMonths]= useState(6);
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
    const s = p.startDate ? parseISO(p.startDate) : null;
    const e = p.endDate ? parseISO(p.endDate) : null;
    if (!s || !e) return true;
    return s < viewEnd && e > viewStart;
  }).sort((a,b) => parseISO(a.startDate) - parseISO(b.startDate));

  const exportExcel = () => {
    const data = projects.map(p=>{
        const pm = employees.find(e => e.id === p.projectManager);
        const displayName = p.projectNo ? `${p.projectNo}_${p.name}` : p.name;
        return {
            'Project No': p.projectNo || '',
            'Project Name': p.name,
            'Full Project Name': displayName,
            'Client':p.clientName,
            'Type':p.type,
            'Status':p.status,
            'Risk':p.riskLevel,
            'Location':p.siteLocation||'',
            'Project Manager': pm ? pm.name : 'N/A',
            'Mob':p.mobilizationDate||'',
            'Start':p.startDate||'',
            'End':p.endDate||'',
            'Demob':p.demobilizationDate||'',
            'Budget':p.budget||'',
            'Readiness':p.readiness||0,
        };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(15).fill({wch:18});
    XLSX.utils.book_append_sheet(wb,ws,'Timeline');
    XLSX.writeFile(wb,`Project_Timeline_${format(new Date(),'yyyyMMdd')}.xlsx`);
    toast.success('Exported successfully!');
  };

  const counts = {
    all: projects.length,
    active: projects.filter(p=>p.status==='Active').length,
    preparing: projects.filter(p=>['Planned','Preparing','Mobilizing'].includes(p.status)).length,
    delayed: projects.filter(p=>p.status==='Delayed').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-orange-500"/>Project Timeline
          </h1>
          <p className="text-xs mt-1 text-slate-400">
            Gantt chart view · Data is linked with {' '}
            <span className="text-orange-500 cursor-pointer hover:underline" onClick={()=>navigate('/projects')}>
              Project Management
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary text-xs"><Download className="w-4 h-4"/>Excel</button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary">
            <Plus className="w-4 h-4"/>Add Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Total Projects', value:counts.all,       color:'#e2e8f0'},
          {label:'Active Now',    value:counts.active,    color:'#22c55e'},
          {label:'In Preparation', value:counts.preparing, color:'#3b82f6'},
          {label:'Delayed',   value:counts.delayed,   color:'#ef4444'},
        ].map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="text-2xl font-bold" style={{color:k.color}}>{k.value}</div>
            <div className="text-xs text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 w-fit">
          {[3,6,12].map(n=>(
            <button key={n} onClick={()=>setViewMonths(n)}
              className={clsx('px-3 py-1 rounded-md text-xs transition-all',
                viewMonths===n?'bg-orange-600 text-white':'text-slate-300 hover:opacity-80')}>
              {n} Months
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={()=>setViewStart(addMonths(viewStart,-1))} className="btn-ghost p-1.5">
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <span className="text-sm font-medium min-w-[160px] text-center text-slate-200">
            {format(viewStart,'MMM yyyy')} — {format(addMonths(viewStart,viewMonths-1),'MMM yyyy')}
          </span>
          <button onClick={()=>setViewStart(addMonths(viewStart,1))} className="btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4"/>
          </button>
          <button onClick={()=>setViewStart(startOfMonth(new Date()))} className="btn-ghost text-xs px-2">Today</button>
        </div>

        <div className="flex flex-wrap gap-1.5 ml-auto">
          {['All',...Object.keys(STATUS_CFG)].map(s=>(
            <button key={s} onClick={()=>setStatusF(s)}
              className={clsx('px-2.5 py-1 rounded-md text-xs border transition-all',
                statusF===s?'bg-orange-600 text-white border-orange-500':'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {['All',...Object.keys(TYPE_COLORS)].map(t=>{
          const col = TYPE_COLORS[t];
          return (
            <button key={t} onClick={()=>setTypeF(t)}
              className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-all',
                typeF===t?'border-orange-500 bg-orange-900/50 text-orange-400':'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600')}>
              {col&&<span className="w-2 h-2 rounded-full" style={{background:col}}/>}
              {t}
            </button>
          );
        })}
        <div className="flex items-center gap-1.5 text-xs ml-auto text-slate-500">
          <div className="w-3 h-0.5 rounded bg-red-500/70"/>Today
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{minWidth:820, position: 'relative'}}>
            <div className="flex border-b border-slate-700 bg-slate-800">
              <div className="flex-shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-800"
                style={{width:224, borderRight:'1px solid var(--t-border)', position: 'sticky', left: 0, zIndex: 11}}>
                Project
              </div>
              <div className="flex flex-1">
                {months.map((mn,i)=>(
                  <div key={i} className="flex-1 text-center py-2 text-xs font-medium text-slate-400"
                    style={{borderRight:i<months.length-1?'1px solid var(--t-border)':'none'}}>
                    {format(mn,'MMM yy')}
                  </div>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-2"/>
                Loading Projects...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-500">
                <CalendarDays className="w-8 h-8 mr-2 opacity-30"/>No projects found in this date range
              </div>
            ) : filtered.map(proj=>{
              const displayName = proj.projectNo ? `${proj.projectNo}_${proj.name}` : proj.name;
              const sD = parseISO(proj.startDate||'');
              const eD = parseISO(proj.endDate||'');
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
              if (mD && sD.getTime()) {
                const mL=pct(mD,viewStart,totalDays), mW=barL-mL;
                if (mW>0.3&&mL>=0) mobBar=`left:${Math.max(0,mL).toFixed(2)}%;width:${Math.min(mW,100-Math.max(0,mL)).toFixed(2)}%`;
              }
              if (dD && eD.getTime()) {
                const dL=pct(eD,viewStart,totalDays), dW=pct(dD,viewStart,totalDays)-dL;
                if (dW>0.3&&dL<100) demobBar=`left:${dL.toFixed(2)}%;width:${Math.min(dW,100-dL).toFixed(2)}%`;
              }

              return (
                <div key={proj.id}
                  onClick={()=>{setSelected(proj);setShowModal(true);}}
                  className="flex group cursor-pointer border-b border-slate-800">

                  <div className="flex-shrink-0 px-3 py-3 bg-slate-900/90 backdrop-blur-sm group-hover:bg-slate-800/80 transition-colors"
                    style={{width:224,borderRight:'1px solid var(--t-border)', position: 'sticky', left: 0, zIndex: 10}}>
                    <div className="font-medium text-xs leading-snug truncate text-slate-200 group-hover:text-orange-400 transition-colors" title={displayName}>
                      {displayName}
                    </div>
                    <div className="text-[11px] truncate mt-0.5 text-slate-500">{proj.clientName}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={clsx('inline-flex items-center gap-1.5 text-[10px] font-medium', sc.text)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full',sc.dot)}/>
                        {proj.status}
                      </span>
                      {proj.projectNo && <span className="text-[11px] text-slate-500">({proj.projectNo})</span>}
                    </div>
                  </div>

                  <div className="flex-1 relative pr-2 group-hover:bg-slate-800/40" style={{minHeight:56}}>
                    {months.map((_,i)=> i>0 && (
                      <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-700/50"
                        style={{left:`${(i/months.length)*100}%`}}/>
                    ))}
                    {todayPct>0&&todayPct<100&&(
                      <div className="absolute top-0 bottom-0 z-10" style={{left:`${todayPct}%`}}>
                        <div className="w-px h-full bg-red-500/70"/>
                        <div className="absolute -top-1 left-1 text-[9px] font-medium text-red-400 whitespace-nowrap">Today</div>
                      </div>
                    )}
                    {mobBar&&(
                      <div className="absolute rounded opacity-60" style={{
                        [mobBar.split(';')[0].split(':')[0].trim()]: mobBar.split(';')[0].split(':')[1].trim(),
                        [mobBar.split(';')[1].split(':')[0].trim()]: mobBar.split(';')[1].split(':')[1].trim(),
                        top:'50%',transform:'translateY(-175%)',height:5, background:col,
                      }}/>
                    )}
                    { barL >= 0 && (
                        <div className="absolute flex items-center px-1.5 rounded text-[10px] font-medium overflow-hidden select-none z-[5]"
                          style={{
                            left:`${clampL}%`,width:`${clampW}%`,
                            top:'50%',transform:'translateY(-50%)',height:22,
                            background:isDelayed?'#ef4444':col,
                            color: isDelayed ? '#fff' : '#000',
                          }}>
                          {clampW>8&&(
                            <span className="truncate font-bold">
                              {displayName}
                            </span>
                          )}
                        </div>
                    )}
                    {demobBar&&(
                      <div className="absolute rounded opacity-60" style={{
                        [demobBar.split(';')[0].split(':')[0].trim()]: demobBar.split(';')[0].split(':')[1].trim(),
                        [demobBar.split(';')[1].split(':')[0].trim()]: demobBar.split(';')[1].split(':')[1].trim(),
                        top:'50%',transform:'translateY(80%)',height:5, background:col,
                      }}/>
                    )}
                    {daysLeft!==null&&clampW>14&&(
                      <div className={clsx("absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] z-10 font-semibold", isDelayed ? 'text-white' : 'text-black/60')}>
                        {proj.status==='Completed'?'✓':daysLeft<0?`${Math.abs(daysLeft)}d over`:`${daysLeft}d`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-700">
          <span>{filtered.length} of {projects.length} projects shown</span>
          <span>Top bar: Mobilization · Main: Active · Bottom: Demobilization</span>
        </div>
      </div>

      {showModal&&(
        <ProjectModal project={selected} employees={employees}
          onClose={()=>setShowModal(false)} onSave={load}/>
      )}
    </div>
  );
}
