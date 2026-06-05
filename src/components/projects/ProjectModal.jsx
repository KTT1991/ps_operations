
import { useState } from 'react';
import { X, Trash2, ExternalLink } from 'lucide-react';
import { projectsService } from '../../services/firebaseService';
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

const EMPTY_FORM = {
  name:'', clientName:'', type:'Onshore', siteLocation:'',
  status:'Planned', riskLevel:'Medium', projectManager:'',
  projectNumber:'', 
  mobilizationDate:'', startDate:'', endDate:'', demobilizationDate:'',
  budget:'', description:'',
  genericRequirements: [],
};

export default function ProjectModal({ project, employees, projects, onClose, onViewTimeline }) {
  const [form, setForm] = useState(project ? { ...(project.projectNo ? { ...project, projectNumber: project.projectNo } : project), genericRequirements: project.genericRequirements || [] } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [newReq, setNewReq] = useState({ item: '', quantity: 1, unit: 'ea' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addRequirement = () => {
    if (!newReq.item || !newReq.quantity || !newReq.unit) {
      toast.error('Please fill in all requirement fields.');
      return;
    }
    const updatedReqs = [...(form.genericRequirements || []), newReq];
    set('genericRequirements', updatedReqs);
    setNewReq({ item: '', quantity: 1, unit: 'ea' });
  };

  const save = async () => {
    if (!form.name || !form.clientName) { toast.error('Please enter Project name and Client.'); return; }
    setSaving(true);
    try {
      if (!project?.id) {
        const nameExists = projects.some(p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        if (nameExists) {
          toast.error("A project with this name already exists.");
          setSaving(false);
          return;
        }
      }

      const projectData = { ...form };
      if (!projectData.projectNumber && !project) {
        projectData.projectNumber = `P${new Date().getFullYear().toString().slice(-2)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      }
      delete projectData.projectNo;

      if (project?.id) {
        await projectsService.update(project.id, projectData);
        toast.success('Updated successfully.');
      } else {
        await projectsService.create(projectData);
        toast.success('Project added successfully.');
      }
      onClose();
    } catch(e) { console.error(e); toast.error('Save failed.'); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!project?.id || !confirm(`Delete "${form.name}"?`)) return;
    await projectsService.delete(project.id);
    toast.success('Deleted successfully.'); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative modal-bg border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden">

        <div className="flex-shrink-0 modal-bg flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">
            {project ? 'Edit Project' : 'Add New Project'}
          </h2>
          <div className="flex items-center gap-2">
            {project && onViewTimeline && (
              <button onClick={onViewTimeline}
                className="btn-ghost text-xs flex items-center gap-1" title="View in Timeline">
                <ExternalLink className="w-3.5 h-3.5"/>Timeline
              </button>
            )}
            <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Project Number</label>
              <input
                type="text"
                value={form.projectNumber || ''}
                onChange={e => set('projectNumber', e.target.value)}
                className="input-field"
                placeholder="e.g. 262204"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Project Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} className="input-field"
                placeholder="Ex. Flowback crew PTTEP S1"/>
            </div>
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Client *</label>
              <input value={form.clientName} onChange={e=>set('clientName',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Site Location</label>
              <input value={form.siteLocation} onChange={e=>set('siteLocation',e.target.value)} className="input-field"/>
            </div>
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Type</label>
              <select value={form.type} onChange={e=>set('type',e.target.value)} className="select-field">
                {['Offshore','Onshore','Shutdown','Emergency','Other'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Status</label>
              <select value={form.status} onChange={e=>set('status',e.target.value)} className="select-field">
                {Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Risk Level</label>
              <select value={form.riskLevel} onChange={e=>set('riskLevel',e.target.value)} className="select-field">
                {['Low','Medium','High'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
           <div className="col-span-2">
             <label className="text-xs block mb-1 text-[var(--t-text3)]">Project Manager</label>
             <select value={form.projectManager || ''} onChange={e => set('projectManager', e.target.value)} className="select-field">
                <option value="">Not Assigned</option>
                {employees && employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
             </select>
           </div>

            {[
              ['mobilizationDate','Mobilization Date'],
              ['startDate','Start Date'],
              ['endDate','End Date'],
              ['demobilizationDate','Demobilization Date'],
            ].map(([k,l])=>(
              <div key={k}>
                <label className="text-xs block mb-1 text-[var(--t-text3)]">{l}</label>
                <input type="date" value={form[k]||''} onChange={e=>set(k,e.target.value)} className="input-field"/>
              </div>
            ))}
            <div>
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Budget (฿)</label>
              <input type="number" value={form.budget||''} onChange={e=>set('budget',e.target.value)} className="input-field"/>
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Description</label>
              <textarea value={form.description||''} onChange={e=>set('description',e.target.value)}
                rows={2} className="input-field resize-none"/>
            </div>

            <div className="col-span-2 pt-2 border-t border-[var(--t-border)]">
              <label className="text-xs block mb-2 font-semibold text-[var(--t-text)]">Project Requirements (Soft Booking)</label>
              
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto pr-2">
                {(form.genericRequirements || [])?.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-[var(--t-bg3)]">
                    <span className="flex-1 text-sm font-medium text-[var(--t-text)]">{req.item}</span>
                    <span className="font-bold">{req.quantity}</span>
                    <span className="text-xs text-[var(--t-text3)]">{req.unit}</span>
                    <button onClick={() => {
                      const updatedReqs = form.genericRequirements.filter((_, i) => i !== index);
                      set('genericRequirements', updatedReqs);
                    }} className="btn-ghost p-1 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
                {(!form.genericRequirements || form.genericRequirements.length === 0) && (
                  <p className="text-xs text-center py-3 text-[var(--t-text3)]">No requirements added yet.</p>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs block mb-1 text-[var(--t-text3)]">Item / Description *</label>
                  <input 
                    value={newReq.item}
                    onKeyDown={e => e.key === 'Enter' && addRequirement()}
                    onChange={e => setNewReq(r => ({...r, item: e.target.value}))}
                    className="input-field"
                    placeholder="e.g., 12-inch Pipe, Welder, Crane..."
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1 text-[var(--t-text3)]">Quantity</label>
                  <input 
                    type="number"
                    value={newReq.quantity}
                    onKeyDown={e => e.key === 'Enter' && addRequirement()}
                    onChange={e => setNewReq(r => ({...r, quantity: parseInt(e.target.value, 10) || 1}))}
                    className="input-field w-20"
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1 text-[var(--t-text3)]">Unit</label>
                  <input 
                    value={newReq.unit}
                    onKeyDown={e => e.key === 'Enter' && addRequirement()}
                    onChange={e => setNewReq(r => ({...r, unit: e.target.value}))}
                    className="input-field w-24"
                    placeholder="e.g., ea, piece, day"
                  />
                </div>
                <button onClick={addRequirement} className="btn-secondary h-9">Add</button>
              </div>
            </div>

          </div>
        </div>

        <div className="flex-shrink-0 modal-bg flex items-center justify-between px-5 py-4 border-t">
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
