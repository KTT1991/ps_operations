
import { useState } from 'react';
import { X, Trash2, ExternalLink } from 'lucide-react';
import { projectsService } from '../../services/firebaseService';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  Active:       { dot:'bg-emerald-500', text:'text-emerald-700', bg:'bg-emerald-50 border border-emerald-200', bdark:'bg-emerald-50 border border-emerald-200' },
  Preparing:    { dot:'bg-sky-500',     text:'text-sky-700',     bg:'bg-sky-50 border border-sky-200',         bdark:'bg-sky-50 border border-sky-200' },
  Mobilizing:   { dot:'bg-cyan-500',    text:'text-cyan-700',    bg:'bg-cyan-50 border border-cyan-200',       bdark:'bg-cyan-50 border border-cyan-200' },
  Planned:      { dot:'bg-purple-500',  text:'text-purple-700',  bg:'bg-purple-50 border border-purple-200',   bdark:'bg-purple-50 border border-purple-200' },
  Demobilizing: { dot:'bg-amber-500',   text:'text-amber-800',   bg:'bg-amber-50 border border-amber-200',     bdark:'bg-amber-50 border border-amber-200' },
  Delayed:      { dot:'bg-rose-500 animate-pulse', text:'text-rose-700', bg:'bg-rose-50 border border-rose-200', bdark:'bg-rose-50 border border-rose-200' },
  Completed:    { dot:'bg-slate-400',   text:'text-slate-600',   bg:'bg-slate-100 border border-slate-200',     bdark:'bg-slate-100 border border-slate-200' },
};

const EMPTY_FORM = {
  name:'', clientName:'', type:'Onshore', siteLocation:'',
  status:'Planned', riskLevel:'Medium', projectManager:'',
  projectNo:'', 
  mobilizationDate:'', startDate:'', endDate:'', demobilizationDate:'',
  budget:'', description:'',
  genericRequirements: [],
};

export default function ProjectModal({ project, employees, projects = [], readOnly = false, onClose, onViewTimeline, onSave }) {
  const [form, setForm] = useState(() => {
    if (project) {
      return {
        ...EMPTY_FORM,
        ...project,
        projectNo: project.projectNo || '',
        genericRequirements: project.genericRequirements || [],
      };
    }
    return { ...EMPTY_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
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
    if (readOnly) {
      toast.error("You don't have permission to edit projects.");
      return;
    }
    setAttemptedSubmit(true);
    const trimmedProjectNo = form.projectNo?.trim();
    const trimmedName = form.name?.trim();
    const trimmedClient = form.clientName?.trim();

    // Required projectNo
    if (!trimmedProjectNo) {
      toast.error('Please specify a Project Number (Project No.). It cannot be empty.');
      return;
    }

    if (!trimmedName || !trimmedClient) { 
      toast.error('Please specify Project Name and Client.'); 
      return; 
    }

    const currentId = project?.id || form.id;
    const projectList = Array.isArray(projects) ? projects : [];
    const projectNoExists = projectList.some(p => 
      p &&
      p.id !== currentId &&
      p.projectNo && 
      p.projectNo.toString().trim().toLowerCase() === trimmedProjectNo.toLowerCase()
    );

    if (projectNoExists) {
      toast.error(`Project Number "${trimmedProjectNo}" already exists. Please use a unique number.`);
      return;
    }

    setSaving(true);
    try {
      const projectData = {
        ...form,
        projectNo: trimmedProjectNo,
        name: trimmedName,
        clientName: trimmedClient,
        siteLocation: form.siteLocation?.trim() || '',
        description: form.description?.trim() || '',
        updatedAt: new Date().toISOString(),
      };

      if (project?.id) {
        await projectsService.update(project.id, projectData);
        toast.success('Project details saved successfully');
      } else {
        projectData.id = trimmedProjectNo;
        projectData.createdAt = new Date().toISOString();
        await projectsService.create(projectData);
        toast.success('New project created successfully');
      }

      if (typeof onSave === 'function') {
        onSave(projectData);
      }
      onClose();
    } catch(e) {
      console.error('Error saving project:', e);
      toast.error(`Error: ${e.message || 'Please check input data'}`);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (readOnly) {
      toast.error("You don't have permission to delete projects.");
      return;
    }
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
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">
              {readOnly ? 'Project Details' : (project ? 'Edit Project' : 'Add New Project')}
            </h2>
            {readOnly && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                View Only
              </span>
            )}
          </div>
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
          <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold block mb-1 text-[var(--t-text2)]">
                Project Number (Project No.) <span className="text-rose-500 font-bold">* Required</span>
              </label>
              <input
                type="text"
                required
                value={form.projectNo || ''}
                onChange={e => set('projectNo', e.target.value)}
                className={clsx(
                  "input-field font-sans",
                  attemptedSubmit && !form.projectNo?.trim() && "border-rose-400 bg-rose-50/30 ring-1 ring-rose-400"
                )}
                placeholder="e.g. 262204 or PRJ-001"
              />
              {attemptedSubmit && !form.projectNo?.trim() && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  * Please specify a Project Number (cannot be empty)
                </p>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold block mb-1 text-[var(--t-text2)]">
                Client <span className="text-rose-500 font-bold">*</span>
              </label>
              <input 
                value={form.clientName} 
                onChange={e=>set('clientName',e.target.value)} 
                className={clsx(
                  "input-field",
                  attemptedSubmit && !form.clientName?.trim() && "border-rose-400 bg-rose-50/30"
                )}
                placeholder="e.g. PTTEP, Thai Oil, Chevron"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-semibold block mb-1 text-[var(--t-text2)]">
                Project Name <span className="text-rose-500 font-bold">*</span>
              </label>
              <input 
                value={form.name} 
                onChange={e=>set('name',e.target.value)} 
                className={clsx(
                  "input-field",
                  attemptedSubmit && !form.name?.trim() && "border-rose-400 bg-rose-50/30"
                )}
                placeholder="e.g. Offshore Platform A - Annual Shutdown"
              />
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
              <label className="text-xs block mb-1 text-[var(--t-text3)]">Budget (THB)</label>
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
                    {!readOnly && (
                      <button onClick={() => {
                        const updatedReqs = form.genericRequirements.filter((_, i) => i !== index);
                        set('genericRequirements', updatedReqs);
                      }} className="btn-ghost p-1 text-red-500 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                ))}
                {(!form.genericRequirements || form.genericRequirements.length === 0) && (
                  <p className="text-xs text-center py-3 text-[var(--t-text3)]">No requirements added yet.</p>
                )}
              </div>

              {!readOnly && (
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
              )}
            </div>

          </div>
          </fieldset>
        </div>

        <div className="flex-shrink-0 modal-bg flex items-center justify-between px-5 py-4 border-t">
          <div>
            {!readOnly && project && (
              <button onClick={del} className="btn-danger text-xs flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5"/>Delete
              </button>
            )}
            {readOnly && (
              <span className="text-xs text-slate-400">View Only Mode — User / Storeman cannot edit projects</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && (
              <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving...':'Save'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
