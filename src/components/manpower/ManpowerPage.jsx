import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Download, AlertTriangle, X, Trash2, History, Briefcase, Coffee, Wrench, BadgeCheck, UserCheck, Edit, MapPin, Calendar, Clock, LayoutGrid, List } from 'lucide-react';
import { employeesService, projectsService, manpowerHistoryService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { exportManpowerToExcel } from '../../utils/exportUtils';
import { differenceInDays, parseISO, format, isAfter, isBefore } from 'date-fns';
import { isEqual } from 'lodash';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const T = {
  text:'var(--t-text)', text2:'var(--t-text2)', text3:'var(--t-text3)',
  bg:'var(--t-bg)', bg2:'var(--t-bg2)', bg3:'var(--t-bg3)', bg4:'var(--t-bg4)',
  border:'var(--t-border)', border2:'var(--t-border2)',
};

const AVAILABILITY_CONFIG = {
  Available:    { color:'text-emerald-700', bg:'bg-emerald-50 border border-emerald-200', dot:'bg-emerald-500', cardBg:'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 border-emerald-200/90' },
  Onshore:      { color:'text-sky-700',     bg:'bg-sky-50 border border-sky-200',         dot:'bg-sky-500', cardBg:'bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 border-sky-200/90' },
  Offshore:     { color:'text-cyan-700',    bg:'bg-cyan-50 border border-cyan-200',       dot:'bg-cyan-500', cardBg:'bg-gradient-to-br from-cyan-50/90 via-white to-cyan-50/40 border-cyan-200/90' },
  Maintenance:  { color:'text-orange-700',  bg:'bg-orange-50 border border-orange-200',   dot:'bg-orange-500', cardBg:'bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40 border-orange-200/90' },
  Standby:      { color:'text-slate-600',   bg:'bg-slate-100 border border-slate-200',     dot:'bg-slate-500', cardBg:'bg-gradient-to-br from-slate-50 via-white to-slate-100/60 border-slate-200/90' },
  'On Leave':   { color:'text-amber-800',   bg:'bg-amber-50 border border-amber-200',     dot:'bg-amber-500', cardBg:'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border-amber-200/90' },
  Training:     { color:'text-purple-700',  bg:'bg-purple-50 border border-purple-200',   dot:'bg-purple-500', cardBg:'bg-gradient-to-br from-purple-50/90 via-white to-purple-50/40 border-purple-200/90' },
};

const SCHEDULE_TYPE_CONFIG = {
    Assignment:  { icon: Briefcase, color: 'text-blue-600' },
    Maintenance: { icon: Wrench,    color: 'text-orange-600' },
    Standby:     { icon: Clock,     color: 'text-slate-600' },
    Leave:       { icon: Coffee,    color: 'text-amber-600' },
    Training:    { icon: Users,     color: 'text-purple-600' },
};

const LOCATION_OPTIONS = ['Onshore', 'Offshore', 'Yard', 'Home', 'Training Center', 'Other'];
const DEFAULT_CERTS = ['BOSIET', 'H2S Safety', 'Medical', 'Offshore Survival', 'CompEx', 'CSWIP', 'PMP'];

function EmployeeModal({ employee, employees, projects, onClose }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(employee ? {
    ...employee,
    empNo: employee.empNo || (employee.id && !/^[A-Za-z0-9_-]{18,}$/.test(employee.id) ? employee.id : '')
  } : {
    empNo: '',
    name:'', position:'', department:'', email:'', phone:'',
    availability:'Available', utilization:0,
    currentProject:'', certifications:'', skills:'', notes:'',
    schedule: [],
  });
  const [certs, setCerts] = useState(employee?.certFields || []);
  const [newCertLabel, setNewCertLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState(null);
  const [scheduleEntryForm, setScheduleEntryForm] = useState({
      type: 'Assignment',
      projectId: '',
      details: '',
      location: 'Onshore',
      startDate: '',
      endDate: '',
  });

  const isScheduleFormInvalid = scheduleEntryForm.type === 'Assignment'
    ? !scheduleEntryForm.projectId || !scheduleEntryForm.details || !scheduleEntryForm.startDate || !scheduleEntryForm.endDate
    : !scheduleEntryForm.details || !scheduleEntryForm.startDate || !scheduleEntryForm.endDate;

  const handleFormChange = (e) => setForm(f => ({...f, [e.target.name]: e.target.value}));

  const addCert = (label) => {
      const l = label.trim();
      if (!l || certs.find(c => c.label === l)) return;
      setCerts(c => [...c, {label: l, expiry: '', certNo: ''}]);
      setNewCertLabel('');
  }

  const updateCert = (index, field, value) => setCerts(c => c.map((cert, i) => i === index ? {...cert, [field]: value} : cert));

  const handleEditSchedule = (index) => {
    setEditingScheduleIndex(index);
    setScheduleEntryForm(form.schedule[index]);
  };

  const handleCancelEdit = () => {
    setEditingScheduleIndex(null);
    setScheduleEntryForm({ type: 'Assignment', projectId: '', details: '', location:'Onshore', startDate: '', endDate: '' });
  }

  const handleScheduleSubmit = () => {
    let entryData = { ...scheduleEntryForm };
    if (scheduleEntryForm.type === 'Assignment') {
        const selectedProject = projects.find(p => p.id === scheduleEntryForm.projectId);
        if (selectedProject) {
            entryData.projectNo = selectedProject.projectNo;
            entryData.projectName = selectedProject.name;
        }
    }

    let updatedSchedule;
    if (editingScheduleIndex !== null) {
        updatedSchedule = form.schedule.map((item, index) =>
            index === editingScheduleIndex ? entryData : item
        );
    } else {
        updatedSchedule = [...(form.schedule || []), entryData];
    }
    
    setForm(f => ({ ...f, schedule: updatedSchedule.sort((a, b) => isAfter(parseISO(a.startDate), parseISO(b.startDate)) ? -1 : 1) }));
    handleCancelEdit();
  };

  const removeScheduleEntry = (indexToRemove) => {
    setForm(f => ({ ...f, schedule: f.schedule.filter((_, idx) => idx !== indexToRemove) }));
    if (editingScheduleIndex === indexToRemove) {
        handleCancelEdit();
    }
  }
  
  const relevantSchedules = useMemo(() => {
    if (!form.schedule?.length) return [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const scheduleWithOriginalIndex = form.schedule.map((s, i) => ({ ...s, originalIndex: i }));

    const currentAndUpcoming = [];
    const past = [];

    scheduleWithOriginalIndex.forEach(s => {
      if (s.endDate && s.endDate < todayStr) {
        past.push(s);
      } else {
        currentAndUpcoming.push(s);
      }
    });

    const DISPLAY_PAST_COUNT = 2;
    return [...currentAndUpcoming.reverse(), ...past.slice(0, DISPLAY_PAST_COUNT)];
  }, [form.schedule]);

  const viewFullHistory = () => {
    if (!employee?.name) return;
    navigate(`/history?search=${encodeURIComponent(employee.name)}`);
    onClose();
  };


  const getChanges = (original, updated, updatedCerts) => {
    const changes = [];
    const simpleFields = ['name', 'empNo', 'position', 'department', 'availability'];
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
      if (!employee?.id) {
        const nameExists = employees.some(e => e.name.trim().toLowerCase() === form.name.trim().toLowerCase());
        if (nameExists) {
          toast.error("An employee with this name already exists.");
          setSaving(false);
          return;
        }
      }

      const finalData = { ...form, certFields: certs };
      let docId = employee?.id;
      let isNew = !docId;

      if (isNew) {
        const newEmployee = await employeesService.create(finalData);
        docId = newEmployee.id;
        toast.success('Employee added!');
      } else {
        await employeesService.update(docId, finalData);
        toast.success('Employee updated!');
      }
      
      try {
          const changes = isNew ? [{ field: 'profile', oldValue: 'N/A', newValue: 'Created' }] : getChanges(employee, finalData, certs);
          if (changes.length > 0) {
              await manpowerHistoryService.create({
                  refId: docId,
                  refNo: finalData.name,
                  activityType: isNew ? 'Create Profile' : 'Update Profile',
                  timestamp: new Date(),
                  modifiedBy: user?.displayName || user?.email || 'System',
                  changes: changes,
              });
          }
      } catch (historyError) {
          console.error("Failed to log history:", historyError);
          toast.error("Couldn't log history, but main data was saved.");
      }

      onClose();
    } catch (e) { 
        toast.error('Failed to save employee data.'); 
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
        onClose();
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
          <div className="p-3 sm:p-5 space-y-6">
              <fieldset disabled={!isAdmin} className="contents">
                  <div>
                      <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase mb-3">Basic Information</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Employee ID</label>
                               <input name="empNo" value={form.empNo || ''} onChange={handleFormChange} placeholder="e.g. PS-SKL-008 or ID from HR" className="input-field font-sans" />
                          </div>
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Full Name *</label>
                               <input name="name" value={form.name} onChange={handleFormChange} className="input-field" />
                          </div>
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Position *</label>
                               <input name="position" value={form.position} onChange={handleFormChange} className="input-field" />
                          </div>
                          <div>
                               <label className="text-xs block mb-1 text-[var(--t-text3)]">Department</label>
                               <input name="department" value={form.department} onChange={handleFormChange} className="input-field" />
                          </div>
                      </div>
                  </div>

                   <div>
                      <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase mb-3">Status & Certifications</h3>
                      <div className="space-y-3">
                          <div>
                              <label className="text-xs block mb-1 text-[var(--t-text3)]">Availability</label>
                              <select name="availability" value={form.availability} onChange={handleFormChange} className="select-field">
                                  {Object.keys(AVAILABILITY_CONFIG).map(s => <option key={s}>{s}</option>)}
                              </select>
                          </div>
                          
                          <div className="border-y border-[var(--t-border)] py-3">
                            <div className="flex flex-wrap gap-1.5 mb-2">
                               {DEFAULT_CERTS.filter(dc => !certs.find(c => c.label === dc)).map(dc => 
                                 <button key={dc} onClick={() => addCert(dc)} className="btn-secondary text-xs">+ {dc}</button>
                               )}
                            </div>
                            <div className="flex gap-2 mb-3">
                                 <input value={newCertLabel} onChange={e => setNewCertLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCert(newCertLabel)} placeholder="Or add custom cert..." className="input-field text-sm flex-1" />
                                 <button onClick={() => addCert(newCertLabel)} className="btn-secondary text-xs">Add</button>
                            </div>
                            <div className="space-y-2">
                                {certs.map((c, i) => (
                                    <div key={i} className="p-2 rounded-md bg-[var(--t-bg3)] grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                                        <div className="text-xs font-medium text-[var(--t-text2)] sm:border-none border-b border-[var(--t-border)] pb-1 sm:pb-0">{c.label}</div>
                                        <input type="date" value={c.expiry || ''} onChange={e => updateCert(i, 'expiry', e.target.value)} className="input-field text-sm" />
                                        <input value={c.certNo || ''} onChange={e => updateCert(i, 'certNo', e.target.value)} placeholder="Cert No." className="input-field text-sm" />
                                        <button type="button" onClick={() => setCerts(certs.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-red-400 sm:ml-0 -ml-1 justify-self-start sm:justify-self-center"><X className="w-3.5 h-3.5"/></button>
                                    </div>
                                ))}
                            </div>
                          </div>
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-semibold text-[var(--t-text3)] uppercase">Schedule History</h3>
                        {employee?.id && (
                            <button onClick={viewFullHistory} className="btn-link text-xs flex items-center gap-1">
                                View Full History <History className="w-3.5 h-3.5"/>
                            </button>
                        )}
                      </div>
                      <div className="space-y-3">
                           <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                              {relevantSchedules.map((s) => {
                                const mainDetail = s.type === 'Assignment' ? `${s.projectNo} - ${s.projectName}` : s.details;
                                const subDetail = s.type === 'Assignment' ? s.details : null;
                                  return (
                                      <div key={s.originalIndex} className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--t-bg3)]">
                                          <div className="flex-1">
                                              <div className="flex items-center justify-between">
                                                  <div className={clsx('text-xs font-semibold', SCHEDULE_TYPE_CONFIG[s.type]?.color)}>{s.type}</div>
                                                  <div className="text-xs text-cyan-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</div>
                                              </div>
                                              <div className="font-medium text-xs mt-0.5 truncate">{mainDetail}</div>
                                              {subDetail && <p className="text-xs text-gray-400 mt-0.5">{subDetail}</p>}
                                              <div className="font-sans text-xs text-[var(--t-text3)] mt-1">{s.startDate}{s.endDate && ` → ${s.endDate}`}</div>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <button type="button" onClick={() => handleEditSchedule(s.originalIndex)} className="btn-ghost p-1 text-amber-400"><Edit className="w-3.5 h-3.5"/></button>
                                            <button type="button" onClick={() => removeScheduleEntry(s.originalIndex)} className="btn-ghost p-1 text-red-400"><X className="w-3.5 h-3.5"/></button>
                                          </div>
                                      </div>
                                  );
                              })}
                              {form.schedule?.length > relevantSchedules.length && (
                                <div className="text-center text-xs text-[var(--t-text3)] py-2">
                                    +{form.schedule.length - relevantSchedules.length} more entries in full history.
                                </div>
                              )}
                          </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-3 p-3 border rounded-lg">
                               <div className="sm:col-span-2">
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Type</label>
                                   <select value={scheduleEntryForm.type} onChange={e => setScheduleEntryForm({...scheduleEntryForm, type: e.target.value, projectId: ''})} className="select-field text-sm">
                                       {Object.keys(SCHEDULE_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
                                   </select>
                               </div>

                              {scheduleEntryForm.type === 'Assignment' ? (
                                  <>
                                      <div className="sm:col-span-2">
                                          <label className="text-xs block mb-1 text-[var(--t-text3)]">Project *</label>
                                          <select value={scheduleEntryForm.projectId} onChange={e => setScheduleEntryForm({...scheduleEntryForm, projectId: e.target.value})} className="select-field text-sm">
                                              <option value="">Select Project</option>
                                              {projects.map(p => <option key={p.id} value={p.id}>{p.projectNo ? `${p.projectNo} - ${p.name}` : p.name}</option>)}
                                          </select>
                                      </div>
                                      <div className="sm:col-span-2">
                                          <label className="text-xs block mb-1 text-[var(--t-text3)]">Notes / Role *</label>
                                          <input value={scheduleEntryForm.details} onChange={e => setScheduleEntryForm({...scheduleEntryForm, details: e.target.value})} placeholder="e.g., Onshore Supervisor" className="input-field text-sm" />
                                      </div>
                                  </>
                              ) : (
                                  <div className="sm:col-span-2">
                                       <label className="text-xs block mb-1 text-[var(--t-text3)]">Details *</label>
                                       <input value={scheduleEntryForm.details} onChange={e => setScheduleEntryForm({...scheduleEntryForm, details: e.target.value})} placeholder="e.g., Annual Leave" className="input-field text-sm" />
                                  </div>
                              )}
                               
                               <div className="sm:col-span-2">
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Location</label>
                                   <select value={scheduleEntryForm.location} onChange={e => setScheduleEntryForm({...scheduleEntryForm, location: e.target.value})} className="select-field text-sm">
                                       {LOCATION_OPTIONS.map(l => <option key={l}>{l}</option>)}
                                   </select>
                               </div>

                               <div>
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">Start Date *</label>
                                   <input type="date" value={scheduleEntryForm.startDate} onChange={e => setScheduleEntryForm({...scheduleEntryForm, startDate: e.target.value})} className="input-field text-sm" />
                               </div>
                               <div>
                                   <label className="text-xs block mb-1 text-[var(--t-text3)]">End Date *</label>
                                   <input type="date" value={scheduleEntryForm.endDate} onChange={e => setScheduleEntryForm({...scheduleEntryForm, endDate: e.target.value})} className="input-field text-sm" />
                               </div>
                               <div className="sm:col-span-2 mt-1 flex flex-col sm:flex-row gap-2">
                                    <button 
                                        onClick={handleScheduleSubmit} 
                                        disabled={isScheduleFormInvalid}
                                        className={clsx("btn-primary w-full text-xs", { "opacity-50 cursor-not-allowed": isScheduleFormInvalid })}
                                    >
                                        {editingScheduleIndex !== null ? 'Update Schedule' : 'Add to Schedule'}
                                    </button>
                                    {editingScheduleIndex !== null && (
                                        <button onClick={handleCancelEdit} type="button" className="btn-secondary w-full text-xs">Cancel Edit</button>
                                    )}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className='sm:col-span-2'>
                           <label className="text-xs block mb-1 text-[var(--t-text3)]">Type</label>
                           <select value={newEntry.type} onChange={e => setNewEntry(s => ({...s, type: e.target.value, projectId: ''}))} className="select-field text-sm">
                               {Object.keys(SCHEDULE_TYPE_CONFIG).map(t => <option key={t}>{t}</option>)}
                           </select>
                        </div>

                        {newEntry.type === 'Assignment' ? (
                          <>
                            <div className='sm:col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Project *</label>
                                <select value={newEntry.projectId} onChange={e => setNewEntry(s => ({...s, projectId: e.target.value}))} className="select-field text-sm">
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.projectNo ? `${p.projectNo} - ${p.name}` : p.name}</option>)}
                                </select>
                            </div>
                            <div className='sm:col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Notes / Role *</label>
                                <input value={newEntry.details} onChange={e => setNewEntry(s => ({...s, details: e.target.value}))} className="input-field text-sm" placeholder='e.g., Onshore Supervisor' />
                            </div>
                          </>
                        ) : (
                           <div className='sm:col-span-2'>
                                <label className="text-xs block mb-1 text-[var(--t-text3)]">Details *</label>
                                <input value={newEntry.details} onChange={e => setNewEntry(s => ({...s, details: e.target.value}))} className="input-field text-sm" placeholder='e.g., Annual Leave' />
                           </div>
                        )}

                        <div className="sm:col-span-2">
                           <label className="text-xs block mb-1 text-[var(--t-text3)]">Location</label>
                           <select value={newEntry.location} onChange={e => setNewEntry(s => ({...s, location: e.target.value}))} className="select-field text-sm">
                               {LOCATION_OPTIONS.map(l => <option key={l}>{l}</option>)}
                           </select>
                        </div>
                        
                        <div>
                             <label className="text-xs block mb-1 text-[var(--t-text3)]">Start Date *</label>
                             <input type="date" value={newEntry.startDate} onChange={e => setNewEntry(s => ({...s, startDate: e.target.value}))} className="input-field text-sm" />
                        </div>
                        <div>
                             <label className="text-xs block mb-1 text-[var(--t-text3)]">End Date *</label>
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
    if (selectionMode) onSelect(emp.id);
    else if (isAdmin) onClick();
  };

  const latestActivity = useMemo(() => {
    const schedules = emp.schedule || [];
    if (!schedules.length) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const current = schedules.find(s => s.startDate <= todayStr && s.endDate >= todayStr);
    if (current) return current;
    return schedules[0]; // The list is pre-sorted with the latest startDate first
  }, [emp.schedule]);
  
  const Icon = latestActivity ? (SCHEDULE_TYPE_CONFIG[latestActivity.type]?.icon || Briefcase) : Briefcase;

  return (
    <div onClick={handleClick} 
        className={clsx("rounded-xl p-4 space-y-3 transition-all relative bg-gradient-to-b from-white via-slate-50/40 to-slate-100/70 border shadow-xs hover:shadow-md",
            isSelected ? 'border-orange-500 ring-2 ring-orange-500/50' : (isAdmin ? 'border-slate-200/90 hover:border-slate-400 cursor-pointer' : 'border-slate-200/90 cursor-default')
        )}>
        {selectionMode && <div className='absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-orange-500 text-white shadow-xs'><UserCheck className='w-3 h-3'/></div>}
        <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                    {emp.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                    <div className="font-semibold text-sm text-slate-800">{emp.name}</div>
                    <div className="text-xs text-slate-500">{emp.position}</div>
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs', cfg.bg, cfg.color)}>
                    <div className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />{emp.availability}
                </span>
                {hasCritical && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </div>
        </div>
         <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>{emp.department}</span>
        </div>

        {latestActivity && (
            <div className="border border-slate-200/70 bg-slate-50/70 rounded-lg p-2.5 space-y-1.5 text-xs">
                 <div className={clsx('font-bold capitalize', SCHEDULE_TYPE_CONFIG[latestActivity.type]?.color)}>{latestActivity.type}</div>
                 <div className='flex items-center gap-2 text-slate-700'>
                    <Icon className={clsx("w-3.5 h-3.5 flex-shrink-0", SCHEDULE_TYPE_CONFIG[latestActivity.type]?.color || 'text-slate-500')}/>
                    <div className='truncate font-medium'>
                        {latestActivity.type === 'Assignment' ? (
                             <><span className='font-sans text-slate-500'>{latestActivity.projectNo}</span> {latestActivity.projectName}</>
                        ) : (
                             <>{latestActivity.details}</>
                        )}
                    </div>
                 </div>
                 <div className='flex items-center gap-2 text-slate-500 font-sans'>
                    <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"/>
                    {latestActivity.startDate && latestActivity.endDate ? (
                        <span>{format(parseISO(latestActivity.startDate), 'dd MMM yyyy')} → {format(parseISO(latestActivity.endDate), 'dd MMM yyyy')}</span>
                    ) : null}
                 </div>
            </div>
        )}
    </div>
  );
}

function EmployeeTable({ employees, onEdit, onSelect, selectionMode, selectedEmpIds }) {
    const { isAdmin } = useAuth();
    
    const EmployeeRow = ({ emp }) => {
        const cfg = AVAILABILITY_CONFIG[emp.availability] || AVAILABILITY_CONFIG.Available;
        const hasCritical = (emp.certFields || []).some(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) < 30);

        const latestActivity = useMemo(() => {
            const schedules = emp.schedule || [];
            if (!schedules.length) return null;
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const current = schedules.find(s => s.startDate <= todayStr && s.endDate >= todayStr);
            if (current) return current;
            return schedules[0];
        }, [emp.schedule]);

        const Icon = latestActivity ? (SCHEDULE_TYPE_CONFIG[latestActivity.type]?.icon || Briefcase) : null;

        const handleClick = () => {
            if (selectionMode) onSelect(emp.id);
            else if (isAdmin) onEdit(emp);
        };
        
        const isSelected = selectedEmpIds.includes(emp.id);

        return (
            <tr 
                onClick={handleClick} 
                className={clsx("transition-all", 
                    isSelected ? 'bg-orange-500/10' : 'hover:bg-orange-50/30',
                    (isAdmin || selectionMode) && 'cursor-pointer'
                )}
            >
                {selectionMode && (
                    <td className="p-3 pl-4">
                        <div 
                            className={clsx('w-5 h-5 rounded-md flex items-center justify-center border', 
                            isSelected ? 'bg-orange-500 border-orange-400' : 'border-slate-300 bg-slate-100')}
                        >
                            {isSelected && <UserCheck className='w-3 h-3 text-white'/>}
                        </div>
                    </td>
                )}
                <td className="p-3 pl-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
                            {emp.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-slate-800">{emp.name}</div>
                            <div className="text-xs text-slate-500">{emp.position}</div>
                        </div>
                    </div>
                </td>
                <td className="p-3 text-xs text-slate-600 font-medium">{emp.department}</td>
                <td className="p-3">
                     <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.bg, cfg.color)}>
                        <div className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />{emp.availability}
                    </span>
                </td>
                <td className="p-3 text-xs">
                    {latestActivity && Icon ? (
                        <div className='flex items-center gap-2'>
                            <Icon className={clsx("w-4 h-4 flex-shrink-0", SCHEDULE_TYPE_CONFIG[latestActivity.type]?.color || 'text-slate-500')}/>
                            <div className='flex flex-col'>
                                <span className={clsx('font-semibold', SCHEDULE_TYPE_CONFIG[latestActivity.type]?.color)}>{latestActivity.type}</span>
                                <span className="text-slate-600 truncate">
                                    {latestActivity.type === 'Assignment' 
                                        ? <><span className='font-sans text-slate-500'>{latestActivity.projectNo}</span> {latestActivity.projectName}</>
                                        : latestActivity.details
                                    }
                                </span>
                            </div>
                        </div>
                    ) : <span className="text-slate-400">No activity</span>}
                </td>
                 <td className="p-3 text-xs text-slate-600 font-sans">
                    {latestActivity?.startDate && latestActivity?.endDate ? (
                        <span>{format(parseISO(latestActivity.startDate), 'dd MMM yyyy')} → {format(parseISO(latestActivity.endDate), 'dd MMM yyyy')}</span>
                    ) : null}
                </td>
                <td className="p-3 text-center">
                    {hasCritical && <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" title="Certificate expiring soon"/>}
                </td>
            </tr>
        )
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                        {selectionMode && <th className="p-3 pl-4 font-semibold"></th>}
                        <th className="p-3 pl-4 font-semibold">Employee</th>
                        <th className="p-3 font-semibold">Department</th>
                        <th className="p-3 font-semibold">Availability</th>
                        <th className="p-3 font-semibold">Latest Activity</th>
                        <th className="p-3 font-semibold">Period</th>
                        <th className="p-3 text-center font-semibold">Certs</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {employees.map(emp => <EmployeeRow key={emp.id} emp={emp} />)}
                </tbody>
            </table>
        </div>
    )
}

export default function ManpowerPage() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [availFilter, setAvailFilter] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // Default to 'table'
  const [editModal, setEditModal] = useState({isOpen: false, employee: null});
  const [bulkModal, setBulkModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);

  useEffect(() => {
    setLoading(true);
    const unsubEmployees = employeesService.subscribe(data => {
      setEmployees(data.sort((a,b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    const unsubProjects = projectsService.subscribe(data => {
      setProjects(data.sort((a,b) => (a.projectNo || a.id).localeCompare(b.projectNo || b.id)));
    });

    return () => {
      unsubEmployees();
      unsubProjects();
    };
  }, []);
  
  const getKpiCount = (status) => {
    if (status === 'Maintenance') {
      return employees.filter(e => e.availability === status && e.position !== 'Base Tech & Ops Assistant').length;
    }
    return employees.filter(e => e.availability === status).length;
  };

  const filtered = useMemo(() => employees.filter(e => {
    const s = search.toLowerCase();
    const searchMatch = !s || e.name?.toLowerCase().includes(s) || e.position?.toLowerCase().includes(s);
    if (!searchMatch) return false;

    if (availFilter === 'All') return true;
    if (availFilter === 'Maintenance') {
      return e.availability === 'Maintenance' && e.position !== 'Base Tech & Ops Assistant';
    }
    return e.availability === availFilter;
  }), [employees, search, availFilter]);

  const handleSelectEmployee = (id) => {
      setSelectedEmpIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  const handleClearFilters = () => {
      setSearch('');
      setAvailFilter('All');
  };
  
  const handleOpenEditModal = (employee) => {
      setEditModal({isOpen: true, employee});
  };

  const isFiltered = search !== '' || availFilter !== 'All';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2"><Users className="w-5 h-5 text-orange-500" />Manpower & Resources</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start">
            {selectionMode ? (
                <div className="flex items-center gap-2 animate-fade-in flex-wrap">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {Object.entries(AVAILABILITY_CONFIG).map(([status, cfg]) => (
          <button key={status} onClick={()=>setAvailFilter(availFilter===status?'All':status)}
            className={clsx('text-left transition-all p-3.5 rounded-xl border flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer',
              cfg.cardBg,
              availFilter===status ? 'ring-2 ring-orange-500 border-orange-500 shadow-sm' : 'hover:border-slate-400'
            )}>
            <div className="flex items-center justify-between mb-2">
              <div className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
              {availFilter === status && <span className="text-[10px] font-bold text-orange-600 bg-orange-100/80 px-1.5 py-0.2 rounded">ACTIVE</span>}
            </div>
            <div className={clsx('text-2xl font-extrabold', cfg.color)}>{getKpiCount(status)}</div>
            <div className="text-xs text-slate-600 font-medium mt-1">{status}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]" />
          <input type="text" placeholder={`Search ${filtered.length} employees...`} value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--t-border)] bg-white">
            <button onClick={() => setViewMode('card')} className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'card' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-slate-900')}><LayoutGrid className='w-4 h-4'/></button>
            <button onClick={() => setViewMode('table')} className={clsx('p-1.5 rounded-md transition-colors', viewMode === 'table' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-slate-900')}><List className='w-4 h-4'/></button>
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
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <EmployeeCard 
                key={emp.id} 
                emp={emp} 
                onClick={() => handleOpenEditModal(emp)} 
                onSelect={handleSelectEmployee}
                selectionMode={selectionMode}
                isSelected={selectedEmpIds.includes(emp.id)}
            />
          ))}
        </div>
      ) : (
        <EmployeeTable 
            employees={filtered} 
            onEdit={handleOpenEditModal} 
            onSelect={handleSelectEmployee}
            selectionMode={selectionMode}
            selectedEmpIds={selectedEmpIds}
        />
      )}

      {filtered.length===0 && !loading && (
        <div className="text-center py-16 text-[var(--t-text3)] col-span-1 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />No employees found
        </div>
      )}

      {editModal.isOpen && (
        <EmployeeModal 
            employee={editModal.employee} 
            employees={employees} 
            projects={projects} 
            onClose={()=>setEditModal({isOpen:false, employee:null})} 
        />
      )}
      {bulkModal && (
          <BulkScheduleModal 
            selectedEmpIds={selectedEmpIds} 
            employees={employees} 
            projects={projects}
            onClose={() => setBulkModal(false)} 
        />
      )}
    </div>
  );
}
