
import { useState, useEffect } from 'react';
import { Users, Plus, Search, Download, AlertTriangle, X, Trash2, History, Briefcase, Coffee, Wrench, BadgeCheck, UserCheck, Edit, MapPin, Calendar } from 'lucide-react';
import { employeesService, projectsService, manpowerHistoryService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { exportManpowerToExcel } from '../../utils/exportUtils';
import { differenceInDays, parseISO, format, isAfter, isBefore } from 'date-fns';
import { isEqual } from 'lodash';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const AVAILABILITY_CONFIG = {
  Available:  { color:'text-green-400',  bg:'bg-green-900/30 border-green-700/50',  dot:'bg-green-500' },
  Assigned:   { color:'text-blue-400',   bg:'bg-blue-900/30 border-blue-700/50',    dot:'bg-blue-500' },
  'On Leave': { color:'text-amber-400',  bg:'bg-amber-900/30 border-amber-700/50',  dot:'bg-amber-500' },
  Offshore:   { color:'text-cyan-400',   bg:'bg-cyan-900/30 border-cyan-700/50',    dot:'bg-cyan-500' },
  Training:   { color:'text-purple-400', bg:'bg-purple-900/30 border-purple-700/50',dot:'bg-purple-500' },
};
const SCHEDULE_TYPE_CONFIG = {
    Assignment: { icon: Briefcase, color: 'text-blue-400' },
    Leave: { icon: Coffee, color: 'text-amber-400' },
    Training: { icon: Users, color: 'text-purple-400' },
    'Standby / Maintenance': { icon: Wrench, color: 'text-slate-400' },
};
const LOCATION_OPTIONS = ['Onshore', 'Offshore', 'Yard', 'Home', 'Training Center', 'Other'];
const DEFAULT_CERTS = ['BOSIET', 'H2S Safety', 'Medical', 'Offshore Survival', 'CompEx', 'CSWIP', 'PMP'];

function EmployeeModal({ employee, projects, onClose, onSave }) {
  const { user, isAdmin } = useAuth(); // Get user and isAdmin flag
  const [form, setForm] = useState(employee || {
    name:'', position:'', department:'', email:'', phone:'',
    availability:'Available', utilization:0,
    currentProject:'', certifications:'', skills:'', notes:'',
    schedule: [],
  });
  const [certs, setCerts] = useState(employee?.certFields || []);
  const [newCertLabel, setNewCertLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({
      type: 'Assignment',
      projectId: '',
      details: '',
      location: 'Onshore',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
  });

  const handleFormChange = (e) => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const addCert = (label) => {
      const l = label.trim();
      if (!l || certs.find(c => c.label === l)) return;
      setCerts(c => [...c, {label: l, expiry: '', certNo: ''}]);
      setNewCertLabel('');
  }

  const updateCert = (index, field, value) => setCerts(c => c.map((cert, i) => i === index ? {...cert, [field]: value} : cert));

  const addScheduleEntry = () => {
    if (!newEntry.startDate || (newEntry.type === 'Assignment' && !newEntry.projectId)) {
        toast.error("Please select a project and a start date.");
        return;
    }
    let entryToAdd = { ...newEntry };
    if (newEntry.type === 'Assignment') {
        const selectedProject = projects.find(p => p.id === newEntry.projectId);
        if (selectedProject) {
            entryToAdd.projectNo = selectedProject.projectNo;
            entryToAdd.projectName = selected.name;
        }
    }
    const updatedSchedule = [...(form.schedule || []), entryToAdd].sort((a, b) => isAfter(parseISO(a.startDate), parseISO(b.startDate)) ? -1 : 1);
    setForm(f => ({ ...f, schedule: updatedSchedule }));
    setNewEntry({ type: 'Assignment', projectId: '', details: '', location:'Onshore', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' });
  }

  const getChanges = (original, updated, updatedCerts) => {
    const changes = [];
    const simpleFields = ['name', 'position', 'department', 'availability'];
    simpleFields.forEach(field => {
      if (original[field] !== updated[field]) {
        changes.push({ field, oldValue: original[field] || 'N/A', newValue: updated[field] });
      }
    });
    if (!isEqual(original.certFields, updatedCerts)) {
      changes.push({ field: 'certifications', oldValue: 'See previous record', newValue: 'Updated' });
    }
    if (!isEqual(original.schedule, updated.schedule)) {
      changes.push({ field: 'schedule', oldValue: 'See previous record', newValue: 'Updated' });
    }
    return changes;
  };

  const saveEmployee = async () => {
    if (!isAdmin) return toast.error("You don't have permission to save.");
    if (!form.name || !form.position) return toast.error('Name and position are required.');
    setSaving(true);
    try {
        const finalData = { ...form, certFields: certs };
        let docId = employee?.id;

        if (docId) {
            const changes = getChanges(employee, finalData, certs);
            if (changes.length > 0) {
              await employeesService.update(docId, finalData);
              await manpowerHistoryService.create({
                refId: docId,
                refNo: finalData.name,
                activityType: 'Update Profile',
                timestamp: new Date(),
                modifiedBy: user?.displayName || user?.email || 'System',
                changes: changes,
              });
              toast.success('Employee updated!');
            } else {
              toast.success('No changes to save.');
            }
        } else {
            const newEmployee = await employeesService.create(finalData);
            docId = newEmployee.id;
            await manpowerHistoryService.create({
              refId: docId,
              refNo: finalData.name,
              activityType: 'Create Profile',
              timestamp: new Date(),
              modifiedBy: user?.displayName || user?.email || 'System',
              changes: [{ field: 'profile', oldValue: 'N/A', newValue: 'Created' }],
            });
            toast.success('Employee added!');
        }
        onSave(); 
        onClose();
    } catch (e) { 
        toast.error('Failed to save.'); 
        console.error(e); 
    }
    finally { setSaving(false); }
  };

  const deleteEmployee = async () => {
    if (!isAdmin) return toast.error("You don't have permission to delete.");
    if (!employee?.id || !confirm('Are you sure you want to delete this employee?')) return;
    try {
        await employeesService.delete(employee.id);
        await manpowerHistoryService.create({
            refId: employee.id,
            refNo: employee.name,
            activityType: 'Delete Profile',
            timestamp: new Date(),
            modifiedBy: user?.displayName || user?.email || 'System',
            changes: [{ field: 'profile', oldValue: 'Active', newValue: 'Deleted' }],
        });
        toast.success('Employee deleted.');
        onSave(); onClose();
    } catch (e) { toast.error('Failed to delete.'); console.error(e); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl">
          <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Edit className="w-4 h-4"/>{employee ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 space-y-6">
              {/* Form content is the same, but read-only if not admin */}
              <fieldset disabled={!isAdmin} className="contents">
                  <div>
                      <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase mb-3">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Full Name *</label>
                               <input name="name" value={form.name} onChange={handleFormChange} className="input-field" />
                          </div>
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Position *</label>
                               <input name="position" value={form.position} onChange={handleFormChange} className="input-field" />
                          </div>
                          <div className="col-span-2">
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Department</label>
                               <input name="department" value={form.department} onChange={handleFormChange} className="input-field" />
                          </div>
                      </div>
                  </div>

                   <div>
                      <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase mb-3">Status & Certifications</h3>
                      <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="text-xs block mb-1 text-[var(--t-text3)]">Availability</label>
                                  <select name="availability" value={form.availability} onChange={handleFormChange} className="select-field">
                                      {Object.keys(AVAILABILITY_CONFIG).map(s => <option key={s}>{s}</option>)}
                                  </select>
                              </div>
                              <div />
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2">
                             {DEFAULT_CERTS.filter(dc => !certs.find(c => c.label === dc)).map(dc => 
                               <button key={dc} onClick={() => addCert(dc)} className="btn-action text-xs">+ {dc}</button>
                             )}
                          </div>
                          
                          <div className="flex gap-2 mb-3">
                               <input value={newCertLabel} onChange={e => setNewCertLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCert(newCertLabel)} placeholder="Or add custom cert..." className="input-field text-sm flex-1" />
                               <button onClick={() => addCert(newCertLabel)} className="btn-secondary text-xs">Add</button>
                          </div>

                          <div className="space-y-2">
                              {certs.map((c, i) => (
                                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                                      <div className="text-xs font-medium text-[var(--t-text2)]">{c.label}</div>
                                      <input type="date" value={c.expiry || ''} onChange={e => updateCert(i, 'expiry', e.target.value)} className="input-field text-sm" />
                                      <input value={c.certNo || ''} onChange={e => updateCert(i, 'certNo', e.target.value)} placeholder="Cert No." className="input-field text-sm" />
                                      <button type="button" onClick={() => setCerts(certs.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-red-400"><X className="w-3.5 h-3.5"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                   <div>
                      <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase mb-3">Schedule History</h3>
                      <div className="space-y-2">
                           <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                              {(form.schedule || []).map((s, i) => {
                                  const detailText = s.projectNo ? `${s.projectNo} - ${s.projectName}` : (s.projectName || s.details);
                                  return (
                                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--t-bg3)]">
                                        <button type="button" onClick={() => setForm(f => ({...f, schedule: f.schedule.filter((_,idx)=>idx!==i)}))} className="btn-ghost p-1 text-red-400 mt-0.5"><X className="w-3.5 h-3.5"/></button>
                                          <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                  <div className={clsx('text-xs font-semibold', SCHEDULE_TYPE_CONFIG[s.type]?.color)}>{s.type}</div>
                                                  <div className="text-xs text-cyan-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</div>
                                              </div>
                                              <div className="font-medium text-xs mt-0.5">{detailText}</div>
                                              {s.details && <p className="text-xs text-gray-400 mt-0.5">{s.details}</p>}
                                              <div className="font-mono text-xs text-[var(--t-text3)] mt-1">{s.startDate}{s.endDate && ` → ${s.endDate}`}</div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                           <div className="grid grid-cols-2 gap-y-2 gap-x-3 p-3 border rounded-lg">
                               <div className="col-span-2">
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Type</label>
                                   <select value={newEntry.type} onChange={e => setNewEntry({...newEntry, type: e.target.value, projectId: ''})} className="select-field text-sm">
                                       {Object.keys(SCHEDULE_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
                                   </select>
                               </div>

                              {newEntry.type === 'Assignment' ? (
                                  <>
                                      <div className="col-span-2">
                                          <label className="text-xs block mb-1 text-[var(--t-text3)]">Project *</label>
                                          <select value={newEntry.projectId} onChange={e => setNewEntry({...newEntry, projectId: e.target.value})} className="select-field text-sm">
                                              <option value="">Select Project</option>
                                              {projects.map(p => <option key={p.id} value={p.id}>{p.projectNo ? `${p.projectNo} - ${p.name}` : p.name}</option>)}
                                          </select>
                                      </div>
                                      <div className="col-span-2">
                                          <label className="text-xs block mb-1 text-[var(--t-text3)]">Notes / Role</label>
                                          <input value={newEntry.details} onChange={e => setNewEntry({...newEntry, details: e.target.value})} placeholder="e.g., Onshore Supervisor" className="input-field text-sm" />
                                      </div>
                                  </>
                              ) : (
                                  <div className="col-span-2">
                                       <label className="text-xs block mb-1 text-[var(--t-text3)]">Details</label>
                                       <input value={newEntry.details} onChange={e => setNewEntry({...newEntry, details: e.target.value})} placeholder="e.g., Annual Leave" className="input-field text-sm" />
                                  </div>
                              )}
                               
                               <div className="col-span-2">
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Location</label>
                                   <select value={newEntry.location} onChange={e => setNewEntry({...newEntry, location: e.target.value})} className="select-field text-sm">
                                       {LOCATION_OPTIONS.map(l => <option key={l}>{l}</option>)}
                                   </select>
                               </div>

                               <div>
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Start Date</label>
                                   <input type="date" value={newEntry.startDate} onChange={e => setNewEntry({...newEntry, startDate: e.target.value})} className="input-field text-sm" />
                               </div>
                               <div>
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">End Date</label>
                                   <input type="date" value={newEntry.endDate} onChange={e => setNewEntry({...newEntry, endDate: e.target.value})} className="input-field text-sm" />
                               </div>
                               <div className="col-span-2 mt-1">
                                   <button onClick={addScheduleEntry} className="btn-secondary w-full text-xs">Add to Schedule</button>
                               </div>
                           </div>
                      </div>
                  </div>
              </fieldset>
          </div>
          {isAdmin && (
            <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex items-center justify-between">
              <div>{employee && <button onClick={deleteEmployee} className="btn-danger text-xs"><Trash2 className="w-4 h-4"/>Delete</button>}</div>
              <div className="flex gap-2">
                  <button onClick={onClose} className="btn-secondary">Cancel</button>
                  <button onClick={saveEmployee} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Employee'}</button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function BulkScheduleModal({ selectedEmpIds, employees, onClose, onSave, projects }) {
    const [newEntry, setNewEntry] = useState({
        type: 'Assignment',
        projectId: '',
        details: '',
        location: 'Onshore',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
    });
    const [saving, setSaving] = useState(false);

    const selectedEmployees = employees.filter(e => selectedEmpIds.includes(e.id));

    const handleSave = async () => {
        if (!newEntry.startDate || (newEntry.type === 'Assignment' && !newEntry.projectId)) {
             toast.error('Please select all required fields.');
             return;
        }
        setSaving(true);
        const toastId = toast.loading(`Updating ${selectedEmployees.length} employees...`);

        let entryToAdd = { ...newEntry };
        if (newEntry.type === 'Assignment') {
            const selectedProject = projects.find(p => p.id === newEntry.projectId);
            if (selectedProject) {
                entryToAdd.projectNo = selectedProject.projectNo;
                entryToAdd.projectName = selectedProject.name;
            }
        }

        try {
            const updates = selectedEmployees.map(emp => {
                const existingSchedule = emp.schedule || [];
                const updatedSchedule = [
                    ...existingSchedule,
                    entryToAdd
                ].sort((a, b) => isAfter(parseISO(a.startDate), parseISO(b.startDate)) ? -1 : 1);

                return employeesService.update(emp.id, { schedule: updatedSchedule });
            });

            await Promise.all(updates);
            toast.success(`${selectedEmployees.length} employees updated successfully!`, { id: toastId });
            onSave();
            onClose();
        } catch (e) {
            console.error('Bulk schedule update failed:', e);
            toast.error('An error occurred. Please try again.', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative modal-bg border rounded-xl w-full max-w-lg animate-fade-in shadow-2xl">
                 <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
                    <h2 className="font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4"/>Bulk Update Schedule</h2>
                    <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-4">
                     <div>
                        <label className="text-xs text-[var(--t-text3)] block mb-2">Applying to {selectedEmployees.length} employees:</label>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
                            {selectedEmployees.map(e => <div key={e.id} className="text-xs text-[var(--t-text2)] p-1.5 rounded-md bg-[var(--t-bg3)]">{e.name}</div>)}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className='col-span-2'>
                           <label className="text-xs block mb-1 text-[var(--t-text3)]">Type</label>
                           <select value={newEntry.type} onChange={e => setNewEntry(s => ({...s, type: e.target.value, projectId: ''}))} className="select-field text-sm">
                               {Object.keys(SCHEDULE_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
                           </select>
                        </div>

                        {newEntry.type === 'Assignment' ? (
                          <>
                            <div className='col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Project *</label>
                                <select value={newEntry.projectId} onChange={e => setNewEntry(s => ({...s, projectId: e.target.value}))} className="select-field text-sm">
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.projectNo ? `${p.projectNo} - ${p.name}` : p.name}</option>)}
                                </select>
                            </div>
                            <div className='col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Notes / Role</label>
                                <input value={newEntry.details} onChange={e => setNewEntry(s => ({...s, details: e.target.value}))} className="input-field text-sm" placeholder='e.g., Onshore Supervisor' />
                            </div>
                          </>
                        ) : (
                           <div className='col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Details</label>
                                <input value={newEntry.details} onChange={e => setNewEntry(s => ({...s, details: e.target.value}))} className="input-field text-sm" placeholder='e.g., Annual Leave' />
                           </div>
                        )}

                        <div className="col-span-2">
                           <label className="text-xs block mb-1 text-[var(--t-text3)]">Location</label>
                           <select value={newEntry.location} onChange={e => setNewEntry(s => ({...s, location: e.target.value}))} className="select-field text-sm">
                               {LOCATION_OPTIONS.map(l => <option key={l}>{l}</option>)}
                           </select>
                        </div>
                        
                        <div>
                             <label className="text-xs block mb-1 text-[var(--t-text3)]">Start Date</label>
                             <input type="date" value={newEntry.startDate} onChange={e => setNewEntry(s => ({...s, startDate: e.target.value}))} className="input-field text-sm" />
                        </div>
                        <div>
                             <label className="text-xs block mb-1 text-[var(--t-text3)]">End Date</label>
                             <input type="date" value={newEntry.endDate} onChange={e => setNewEntry(s => ({...s, endDate: e.target.value}))} className="input-field text-sm" />
                        </div>
                    </div>
                </div>
                <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex items-center justify-end">
                    <div className="flex gap-2">
                        <button onClick={onClose} className="btn-secondary">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : `Add to ${selectedEmployees.length} Schedules`}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmployeeCard({ emp, onClick, onSelect, selectionMode, isSelected }) {
  const { isAdmin } = useAuth();
  const cfg = AVAILABILITY_CONFIG[emp.availability] || AVAILABILITY_CONFIG.Available;
  const hasCritical = (emp.certFields || []).some(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) < 30);

  const handleClick = () => {
    if (selectionMode) {
        onSelect(emp.id);
    } else if (isAdmin) {
        onClick(); // Only allow opening the modal if admin
    }
  };

  // Find the latest assignment
  const latestAssignment = (emp.schedule || [])
    .filter(s => s.type === 'Assignment' && s.endDate)
    .sort((a, b) => isAfter(parseISO(a.endDate), parseISO(b.endDate)) ? -1 : 1)[0];

  return (
    <div onClick={handleClick} 
        className={clsx("card p-4 space-y-3 transition-all relative",
            isSelected ? 'border-orange-500 ring-2 ring-orange-500/50' : (isAdmin ? 'hover:border-slate-600 cursor-pointer' : 'cursor-default')
        )}>
        {selectionMode && <div className='absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-orange-500 text-white'><UserCheck className='w-3 h-3'/></div>}
        <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{background:'rgba(148,163,184,.15)',color:'#94a3b8'}}>
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
            <span>{emp.department}</span>
        </div>

        {latestAssignment && (
            <div className="border-t border-slate-700/50 pt-3 mt-3 space-y-1.5 text-xs">
                 <div className='font-semibold text-slate-400'>Latest Assignment</div>
                 <div className='flex items-center gap-2'>
                    <Briefcase className="w-3.5 h-3.5 text-slate-500 flex-shrink-0"/>
                    <div className='truncate'>
                        <span className='font-mono text-slate-500'>{latestAssignment.projectNo}</span> {latestAssignment.projectName}
                    </div>
                 </div>
                 <div className='flex items-center gap-2'>
                    <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0"/>
                    <span>Return: {format(parseISO(latestAssignment.endDate), 'dd MMM yyyy')}</span>
                 </div>
            </div>
        )}
    </div>
  );
}

export default function ManpowerPage() {
  const { isAdmin } = useAuth(); // Get isAdmin flag
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [availFilter, setAvailFilter] = useState('All');
  const [editModal, setEditModal] = useState({isOpen: false, employee: null});
  const [bulkModal, setBulkModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);

  const load = async () => {
    setLoading(true);
    setSelectionMode(false); setSelectedEmpIds([]);
    const [e, p] = await Promise.all([employeesService.getAll(), projectsService.getAll()]);
    setEmployees(e.sort((a,b) => a.name.localeCompare(b.name))); 
    setProjects(p.sort((a,b) => (a.projectNo || a.id).localeCompare(b.projectNo || b.id)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  
  const handleSelectEmployee = (id) => {
      setSelectedEmpIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  const filtered = employees.filter(e => {
    const s = search.toLowerCase();
    const m = !s || e.name?.toLowerCase().includes(s) || e.position?.toLowerCase().includes(s);
    return m && (availFilter==='All' || e.availability===availFilter);
  });

  const handleClearFilters = () => {
      setSearch('');
      setAvailFilter('All');
  };

  const isFiltered = search !== '' || availFilter !== 'All';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2"><Users className="w-5 h-5 text-orange-500" />Manpower & Resources</h1>
        </div>
        <div className="flex items-center gap-2">
            {selectionMode ? (
                <div className="flex items-center gap-2 animate-fade-in">
                     <span className='text-sm font-medium text-[var(--t-text2)]'>{selectedEmpIds.length} selected</span>
                     <button onClick={() => setBulkModal(true)} disabled={selectedEmpIds.length === 0} className="btn-primary"><Plus className="w-4 h-4"/>Add Schedule</button>
                     <button onClick={() => setSelectedEmpIds([])} className="btn-secondary">Clear</button>
                     <button onClick={() => setSelectionMode(false)} className="btn-secondary"><X className="w-4 h-4"/></button>
                </div>
            ) : (
                <>
                    <button onClick={() => exportManpowerToExcel(employees)} className="btn-secondary text-xs"><Download className="w-4 h-4" />Excel</button>
                    <button onClick={() => setSelectionMode(true)} className="btn-secondary text-xs"><UserCheck className="w-4 h--4"/>Bulk Update</button>
                    {isAdmin && <button onClick={()=>{setEditModal({isOpen:true, employee:null});}} className="btn-primary"><Plus className="w-4 h-4" />Add Employee</button>}
                </>
            )}
        </div>
      </div>

      {/* KPI Cards and Search remain the same */}
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]" />
          <input type="text" placeholder="Search name, position, department..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        {isFiltered && (
            <button onClick={handleClearFilters} className="btn-secondary text-xs flex items-center gap-1.5">
                <X className="w-4 h-4"/>
                Clear Filter
            </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <EmployeeCard 
                key={emp.id} 
                emp={emp} 
                onClick={() => setEditModal({isOpen: true, employee: emp})} 
                onSelect={handleSelectEmployee}
                selectionMode={selectionMode}
                isSelected={selectedEmpIds.includes(emp.id)}
            />
          ))}
          {filtered.length===0 && (
            <div className="col-span-4 text-center py-16 text-[var(--t-text3)]">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />No employees found
            </div>
          )}
        </div>
      )}

      {editModal.isOpen && (
        <EmployeeModal employee={editModal.employee} projects={projects} onClose={()=>setEditModal({isOpen:false, employee:null})} onSave={load} />
      )}
      {bulkModal && (
          <BulkScheduleModal 
            selectedEmpIds={selectedEmpIds} 
            employees={employees} 
            projects={projects}
            onClose={() => setBulkModal(false)} 
            onSave={load} 
        />
      )}
    </div>
  );
}
