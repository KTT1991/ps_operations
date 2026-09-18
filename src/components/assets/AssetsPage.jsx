import { useState, useEffect, useMemo } from 'react';
import {
  Package, Plus, Search, Download, Edit, Trash2,
  AlertTriangle, X, ChevronRight
} from 'lucide-react';
import { assetsService, projectsService } from '../../services/firebaseService';
import { exportAssetsToExcel, exportAssetsToPDF } from '../../utils/exportUtils';
import { differenceInDays, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const T = {
  text:'var(--t-text)', text2:'var(--t-text2)', text3:'var(--t-text3)',
  bg:'var(--t-bg)', bg2:'var(--t-bg2)', bg3:'var(--t-bg3)', bg4:'var(--t-bg4)',
  border:'var(--t-border)', border2:'var(--t-border2)',
};

const STATUS_CONFIG = {
  Available:          { cls:'badge-available',   dot:'bg-emerald-500', cardBg:'bg-gradient-to-b from-emerald-50/90 to-white border-emerald-200/90 text-emerald-800' },
  'In Use':           { cls:'badge-in-use',      dot:'bg-sky-500',     cardBg:'bg-gradient-to-b from-sky-50/90 to-white border-sky-200/90 text-sky-800' },
  'Under Maintenance':{ cls:'badge-maintenance', dot:'bg-amber-500',   cardBg:'bg-gradient-to-b from-amber-50/90 to-white border-amber-200/90 text-amber-800' },
  Reserved:           { cls:'badge-reserved',    dot:'bg-cyan-500',    cardBg:'bg-gradient-to-b from-cyan-50/90 to-white border-cyan-200/90 text-cyan-800' },
  Damaged:            { cls:'badge-damaged',     dot:'bg-rose-500',    cardBg:'bg-gradient-to-b from-rose-50/90 to-white border-rose-200/90 text-rose-800' },
  Standby:            { cls:'badge-standby',     dot:'bg-slate-500',   cardBg:'bg-gradient-to-b from-slate-50 to-white border-slate-200/90 text-slate-700' },
  Disposal:           { cls:'badge-standby',     dot:'bg-slate-400',   cardBg:'bg-gradient-to-b from-slate-100 to-white border-slate-200 text-slate-500' },
};

const STATUSES = Object.keys(STATUS_CONFIG);

function DueDateCell({ date }) {
  if (!date) return <span className="text-[var(--t-text3)]">—</span>;
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0)  return <span className="text-red-400 text-xs font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>OVERDUE</span>;
  if (days <= 7)  return <span className="text-red-400 text-xs">{days}d ⚠</span>;
  if (days <= 30) return <span className="text-amber-400 text-xs">{days}d</span>;
  return <span className="text-[var(--t-text3)] text-xs">{date}</span>;
}

function AssetModal({ asset, onClose, onSave }) {
  const [form, setForm] = useState(asset || {
    name:'', serialNumber:'', type:'', category:'', manufacturer:'',
    model:'', status:'Available', location:'', condition:'Good',
    maintenanceDue:'', certificationExpiry:'', purchaseCost:'', notes:'',
  });
  const [customFields, setCustomFields] = useState(asset?.customFields || []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) { toast.error('Please enter the asset name.'); return; }
    setSaving(true);
    try {
      const data = { ...form, customFields };
      if (asset?.id) { await assetsService.update(asset.id, data); toast.success('Updated successfully.'); }
      else { await assetsService.create({ ...data, id: `AST-${Date.now()}` }); toast.success('Added successfully.'); }
      onSave(); onClose();
    } catch { toast.error('Save failed.'); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!asset?.id || !confirm(`Delete ${form.name}?`)) return;
    await assetsService.delete(asset.id);
    toast.success('Deleted successfully.'); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative modal-bg border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl">
        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">{asset?'Edit Asset':'Add New Asset'}</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Status pills */}
          <div>
            <label className="text-xs text-[var(--t-text3)] block mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s=>(
                <button key={s} type="button" onClick={()=>setForm({...form,status:s})}
                  className={clsx('px-3 py-1 rounded-full text-xs transition-all border',
                    form.status===s?'bg-orange-600 text-white border-orange-500':'bg-[var(--t-bg3)] text-[var(--t-text3)] border-[var(--t-border2)] hover:border-slate-500')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">Asset Name *</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="input-field"/>
            </div>
            {[
              ['assetNo','Asset No.'],['serialNumber','Serial / Mfr. No.'],
              ['type','Type'],['category','Category'],
              ['manufacturer','Manufacturer / Vendor'],['model','Model'],
              ['location','Location'],['condition','Condition'],
              ['maintenanceDue','Maintenance Due','date'],
              ['certificationExpiry','Cert Expiry','date'],
              ['purchaseCost','Purchase Cost','number'],
              ['currentProject','Current Project'],
            ].map(([key,label,type='text'])=>(
              <div key={key}>
                <label className="text-xs text-[var(--t-text3)] block mb-1">{label}</label>
                <input type={type} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})} className="input-field"/>
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">Notes</label>
              <textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} className="input-field resize-none"/>
            </div>
          </div>

          {/* Custom Fields */}
          <div className="border-t border-[var(--t-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider">Custom Fields</div>
              <button onClick={()=>setCustomFields(f=>[...f,{key:'',value:''}])} className="btn-ghost text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5"/>Add Field
              </button>
            </div>
            {customFields.length===0&&<p className="text-xs text-slate-600">Click &quot;+ Add Field&quot; to add more information, e.g., SWL, WLL, Test Pressure.</p>}
            <div className="space-y-2">
              {customFields.map((f,i)=>(
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Field name, e.g., SWL, WLL" value={f.key}
                    onChange={e=>setCustomFields(cf=>cf.map((c,j)=>j===i?{...c,key:e.target.value}:c))}
                    className="input-field w-40 flex-shrink-0 text-xs"/>
                  <input placeholder="Value, e.g., 25 Tons" value={f.value}
                    onChange={e=>setCustomFields(cf=>cf.map((c,j)=>j===i?{...c,value:e.target.value}:c))}
                    className="input-field flex-1 text-xs"/>
                  <button onClick={()=>setCustomFields(cf=>cf.filter((_,j)=>j!==i))} className="btn-ghost p-1 text-red-400">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex items-center justify-between">
          <div>{asset&&<button onClick={del} className="btn-danger text-xs flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Delete</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const [assets, setAssets]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [catFilter, setCat]       = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 50;

  const load = async () => {
  setLoading(true);
  const [a, p] = await Promise.all([
    assetsService.getAll(),
    projectsService.getAll(),
  ]);
  setAssets(a);
  setProjects(p);
  setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const categories = useMemo(()=>['All',...new Set(assets.map(a=>a.category).filter(Boolean))],[assets]);

  const filtered = useMemo(()=>assets.filter(a=>{
    const s = search.toLowerCase();
    const m = !s||
       a.name?.toLowerCase().includes(s)||
      (a.assetNo || a.id)?.toLowerCase().includes(s)||
       a.location?.toLowerCase().includes(s)||
       a.serialNumber?.toLowerCase().includes(s);
    return m&&(statusFilter==='All'||a.status===statusFilter)&&(catFilter==='All'||a.category===catFilter);
  }),[assets,search,statusFilter,catFilter]);

  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const totalPages = Math.ceil(filtered.length/PER_PAGE);

  const statusCounts = useMemo(()=>{
    const c={};
    STATUSES.forEach(s=>{ c[s]=assets.filter(a=>a.status===s).length; });
    return c;
  },[assets]);
  
  const handleEdit = (asset) => {
    setSelected(asset);
    setShowModal(true);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500"/>Asset Management
          </h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">
            {assets.length} assets · {assets.filter(a=>a.status==='Available').length} available · {assets.filter(a=>a.status==='In Use').length} in use
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start">
          <button onClick={()=>exportAssetsToExcel(filtered)} className="btn-secondary text-xs"><Download className="w-4 h-4"/>Excel</button>
          <button onClick={()=>exportAssetsToPDF(filtered)} className="btn-secondary text-xs"><Download className="w-4 h-4"/>PDF</button>
          <button onClick={()=>{setSelected(null);setShowModal(true);}} className="btn-primary"><Plus className="w-4 h-4"/>Add Asset</button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {STATUSES.map(s=>{
          const cfg=STATUS_CONFIG[s];
          return (
            <button key={s} onClick={()=>{setStatus(statusFilter===s?'All':s);setPage(1);}}
              className={clsx('text-center py-2.5 px-1.5 rounded-xl border transition-all text-xs cursor-pointer shadow-2xs hover:shadow-xs',
                cfg.cardBg,
                statusFilter===s ? 'ring-2 ring-orange-500 border-orange-500 shadow-sm' : 'hover:border-slate-400')}>
              <div className={clsx('w-2 h-2 rounded-full mx-auto mb-1',cfg.dot)}/>
              <div className="font-extrabold text-sm">{statusCounts[s]||0}</div>
              <div className="text-[10px] leading-tight mt-0.5 truncate font-medium text-slate-500">{s}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]"/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder={`Search ${filtered.length} assets...`} className="input-field pl-9"/>
        </div>
        <select value={catFilter} onChange={e=>{setCat(e.target.value);setPage(1);}} className="select-field sm:w-52">
          {categories.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : paged.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No assets found.</div>
        ) : (
          paged.map(asset => {
            const cfg=STATUS_CONFIG[asset.status]||STATUS_CONFIG.Standby;
            const proj = projects.find(p => p.id === asset.currentProject);
            const projName = proj ? (proj.projectNumber || proj.name?.split('_')[0] || asset.currentProject) : (asset.projectNumber || asset.currentProject || '—');

            return (
              <div key={asset.id} className="bg-gradient-to-b from-white via-slate-50/40 to-slate-100/70 border border-slate-200/90 rounded-xl p-4 space-y-2.5 text-xs shadow-xs hover:shadow-md transition-all">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-sm text-slate-800 pr-2">{asset.name}</div>
                  <span className={cfg.cls}><div className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>{asset.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/60">
                  <div><span className="text-slate-400">Asset No:</span> {asset.assetNo || asset.id}</div>
                  <div><span className="text-slate-400">Category:</span> {asset.category}</div>
                  <div><span className="text-slate-400">Location:</span> {asset.location}</div>
                  <div><span className="text-slate-400">Project:</span> {projName}</div>
                </div>
                 <div className="flex justify-between items-center pt-2 border-t border-slate-200/70">
                    <div className="text-xs text-slate-500 font-medium"><span>Maint. Due:</span> <DueDateCell date={asset.maintenanceDue}/></div>
                    <button onClick={() => handleEdit(asset)} className="btn-secondary py-1 px-2.5 text-xs cursor-pointer">Edit</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Asset No.</th><th>Description</th><th>Category</th><th>Status</th><th>Location</th><th>Project</th><th>Maint. Due</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading?(
                <tr><td colSpan={8} className="text-center py-12 text-[var(--t-text3)]">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/>Loading {assets.length>0?`${assets.length} assets`:'...'}
                </td></tr>
              ):paged.length===0?(
                <tr><td colSpan={8} className="text-center py-12 text-[var(--t-text3)]"><Package className="w-10 h-10 mx-auto mb-2 opacity-20"/>No assets found</td></tr>
              ):paged.map(asset=>{
                const cfg=STATUS_CONFIG[asset.status]||STATUS_CONFIG.Standby;
                return (
                  <tr key={asset.id}>
                    <td><span className="font-sans text-xs text-[var(--t-text3)]">{asset.assetNo || asset.id}</span></td>
                    <td>
                      <div className="font-medium text-xs max-w-[200px] truncate">{asset.name}</div>
                      {asset.serialNumber&&<div className="text-xs text-[var(--t-text3)] font-sans">{asset.serialNumber}</div>}
                    </td>
                    <td><span className="text-xs text-[var(--t-text3)]">{asset.category||asset.type}</span></td>
                    <td><span className={cfg.cls}><div className={clsx('w-1.5 h-1.5 rounded-full',cfg.dot)}/>{asset.status}</span></td>
                    <td><span className="text-xs text-[var(--t-text3)] block max-w-[140px] truncate">{asset.location}</span></td>
                   <td>
                    <span className="text-xs text-[var(--t-text3)]">
                    {(() => {
                        const proj = projects.find(p => p.id === asset.currentProject);
                        if (proj) {
                        const num = proj.projectNumber || proj.name?.split('_')[0];
                       return num || asset.currentProject;
                    }
                          return asset.projectNumber || asset.currentProject || '—';
                       })()}
                    </span>
                    </td>
                    <td><DueDateCell date={asset.maintenanceDue}/></td>
                    <td>
                      <button onClick={()=>{setSelected(asset);setShowModal(true);}} className="btn-ghost p-1.5" title="Edit">
                        <Edit className="w-3.5 h-3.5"/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-[var(--t-text3)]">
          <span>Showing {Math.min((page-1)*PER_PAGE+1, filtered.length)}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-ghost px-2 py-1 disabled:opacity-40">‹</button>
              <span>Page {page} / {totalPages}</span>
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="btn-ghost px-2 py-1 disabled:opacity-40">›</button>
            </div>
          )}
        </div>
      </div>

      {showModal&&<AssetModal asset={selected} onClose={()=>setShowModal(false)} onSave={load}/>}
    </div>
  );
}
