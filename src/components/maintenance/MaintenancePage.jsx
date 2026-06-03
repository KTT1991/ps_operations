import { useState, useEffect } from 'react';
import { Wrench, Plus, Search, Download, Clock, CheckCircle, XCircle, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { maintenanceService, assetsService, employeesService } from '../../services/firebaseService';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const WORK_TYPES = [
  'Load Test', 'Visual Inspection (VS)', 'MPI',
  'UT (Ultrasonic)', 'Pressure Test', 'Hydrostatic Test (HT)',
  'Functional Test', 'Repair', 'Overhaul', 'Other',
];

const STATUS_OPTIONS = ['Scheduled', 'In Progress', 'Pending Parts', 'Pending Approval', 'Completed', 'Cancelled'];

const STATUS_STYLE = {
  'Completed':        { dot:'bg-green-500',  text:'text-green-500',  Icon: CheckCircle },
  'In Progress':      { dot:'bg-amber-500',  text:'text-amber-500',  Icon: Clock },
  'Scheduled':        { dot:'bg-blue-500',   text:'text-blue-500',   Icon: Clock },
  'Pending Parts':    { dot:'bg-purple-500', text:'text-purple-500', Icon: Clock },
  'Pending Approval': { dot:'bg-cyan-500',   text:'text-cyan-500',   Icon: Clock },
  'Cancelled':        { dot:'bg-slate-500',  text:'text-[var(--t-text3)]', Icon: XCircle },
};

const PRESET_CERT_FIELDS = [
  'Load Test Date', 'VS Date', 'MPI Date', 'HT Date',
  'UT Date', 'Pressure Test Date', 'Re-cert Date',
];

function MaintenanceModal({ record, assets, employees, onClose, onSave }) {
  const [form, setForm] = useState(record ? { ...record } : {
    assetId: '', jobCardNo: '', workTypes: [],
    description: '', technician: '', status: 'Scheduled',
    startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '',
    result: '', remarks: '', cost: '',
  });

  const [certFields, setCertFields] = useState(record?.certFields || []);
  const [certInput, setCertInput] = useState('');
  const [customFields, setCustomFields] = useState(record?.customFields || []);
  const [saving, setSaving] = useState(false);
  
  const selectedAsset = assets.find(a => a.id === form.assetId);

  const toggleWorkType = (t) =>
    setForm(f => ({
      ...f,
      workTypes: f.workTypes?.includes(t)
        ? f.workTypes.filter(x => x !== t)
        : [...(f.workTypes || []), t],
    }));

  const addCertField = (label) => {
    const l = label.trim();
    if (!l || certFields.find(c => c.label === l)) return;
    setCertFields(c => [...c, { label: l, date: '', certNo: '' }]);
    setCertInput('');
  };

  const save = async () => {
    if (!form.assetId) { toast.error('Please select an asset first.'); return; }
    setSaving(true);
    try {
      const data = { ...form, certFields, customFields };
      if (record?.id) {
        await maintenanceService.update(record.id, data);
        toast.success('Updated successfully.');
      } else {
        await maintenanceService.create({ ...data, id: `MNT-${Date.now()}` });
        toast.success('Saved successfully.');
      }
      onSave(); onClose();
    } catch { toast.error('Save failed.'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!record?.id || !confirm('Delete this item?')) return;
    await maintenanceService.delete(record.id);
    toast.success('Deleted successfully.'); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto animate-fade-in shadow-2xl">

        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--t-border)]">
          <h2 className="font-semibold text-sm text-[var(--t-text)]">
            {record ? 'Edit Job Card' : 'Add New Job Card'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">

          <div>
            <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider mb-3">
              Job Information
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs text-[var(--t-text3)] block mb-1">Asset No. *</label>
                    <select value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })} className="select-field">
                      <option value="">Select Asset...</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.assetNo || a.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--t-text3)] block mb-1">Asset Name</label>
                    <input readOnly disabled value={selectedAsset?.name || ''} className="input-field bg-[var(--t-bg3)]"/>
                  </div>
              </div>
             
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Job Card No.</label>
                <input value={form.jobCardNo || ''} onChange={e => setForm({ ...form, jobCardNo: e.target.value })}
                  className="input-field" placeholder="e.g., JC-2026-001" />
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Assigned Technician</label>
                <select value={form.technician || ''} onChange={e => setForm({ ...form, technician: e.target.value })} className="select-field">
                  <option value="">Select...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="select-field">
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Start Date</label>
                <input type="date" value={form.startDate ? format(parseISO(form.startDate), 'yyyy-MM-dd') : ''} onChange={e => setForm({ ...form, startDate: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">End Date</label>
                <input type="date" value={form.endDate ? format(parseISO(form.endDate), 'yyyy-MM-dd') : ''} onChange={e => setForm({ ...form, endDate: e.target.value })} className="input-field" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider mb-2">
              Work Types (multiple selection)
            </div>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPES.map(t => {
                const active = (form.workTypes || []).includes(t);
                return (
                  <button key={t} type="button" onClick={() => toggleWorkType(t)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      active
                        ? 'bg-orange-600 text-white border-orange-500'
                        : 'bg-[var(--t-bg3)] text-[var(--t-text2)] border-[var(--t-border2)] hover:border-orange-400'
                    )}>
                    {active ? '✓ ' : ''}{t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">Work Description / Scope</label>
              <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} className="input-field resize-none"
                placeholder="Describe the work to be done, e.g., perform Load Test as per API 4F..." />
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Test Result</label>
              <select value={form.result || ''} onChange={e => setForm({ ...form, result: e.target.value })} className="select-field">
                <option value="">Not specified</option>
                <option>Pass</option>
                <option>Fail</option>
                <option>Conditional Pass</option>
                <option>Pending Lab Result</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Cost (฿)</label>
              <input type="number" value={form.cost || ''} onChange={e => setForm({ ...form, cost: e.target.value })} className="input-field" placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-[var(--t-text3)] block mb-1">Remarks / Issues</label>
              <textarea value={form.remarks || ''} onChange={e => setForm({ ...form, remarks: e.target.value })}
                rows={2} className="input-field resize-none"
                placeholder="e.g., waiting for Third Party Inspector, waiting for parts from vendor..." />
            </div>
          </div>

          <div className="border-t border-[var(--t-border)] pt-4">
            <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider mb-3">
              Certificate / Test Dates
              <span className="ml-2 normal-case font-normal text-[var(--t-text3)]">Add as needed</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {PRESET_CERT_FIELDS.filter(p => !certFields.find(c => c.label === p)).map(p => (
                <button key={p} type="button" onClick={() => addCertField(p)}
                  className="px-2.5 py-1 text-xs border border-[var(--t-border2)] text-[var(--t-text3)] rounded-lg hover:border-orange-400 hover:text-orange-500 transition-colors">
                  + {p}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-3">
              <input value={certInput} onChange={e => setCertInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCertField(certInput)}
                placeholder="Add other certs, e.g., Coating Inspection Date..."
                className="input-field flex-1 text-xs" />
              <button type="button" onClick={() => addCertField(certInput)} className="btn-secondary text-xs px-3">+ Add</button>
            </div>

            {certFields.length === 0 && (
              <p className="text-xs text-[var(--t-text3)]">None yet — use the buttons above to add.</p>
            )}
            <div className="space-y-2">
              {certFields.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-[var(--t-text2)] w-40 flex-shrink-0 font-medium">{c.label}</span>
                  <input type="date" value={c.date || ''}
                    onChange={e => setCertFields(cf => cf.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                    className="input-field flex-1 text-xs" />
                  <input type="text" placeholder="Cert No." value={c.certNo || ''}
                    onChange={e => setCertFields(cf => cf.map((x, j) => j === i ? { ...x, certNo: e.target.value } : x))}
                    className="input-field w-32 text-xs flex-shrink-0" />
                  <button type="button"
                    onClick={() => setCertFields(cf => cf.filter((_, j) => j !== i))}
                    className="btn-ghost p-1 text-red-400 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--t-border)] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-[var(--t-text3)] uppercase tracking-wider">
                Additional Information (Custom)
              </div>
              <button type="button"
                onClick={() => setCustomFields(f => [...f, { key: '', value: '' }])}
                className="btn-ghost text-xs flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />Add Field
              </button>
            </div>
            {customFields.length === 0 && (
              <p className="text-xs text-[var(--t-text3)]">e.g., SWL, WLL, Test Load, Third Party Inspector etc.</p>
            )}
            <div className="space-y-2">
              {customFields.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input placeholder="Name, e.g., SWL" value={f.key}
                    onChange={e => setCustomFields(cf => cf.map((c, j) => j === i ? { ...c, key: e.target.value } : c))}
                    className="input-field w-36 flex-shrink-0 text-xs" />
                  <input placeholder="Value, e.g., 25 Tons" value={f.value}
                    onChange={e => setCustomFields(cf => cf.map((c, j) => j === i ? { ...c, value: e.target.value } : c))}
                    className="input-field flex-1 text-xs" />
                  <button type="button"
                    onClick={() => setCustomFields(cf => cf.filter((_, j) => j !== i))}
                    className="btn-ghost p-1 text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="sticky bottom-0 modal-bg border-t border-[var(--t-border)] px-5 py-4 flex items-center justify-between">
          <div>
            {record && (
              <button type="button" onClick={del} className="btn-danger text-xs flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" />Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [records, setRecords]     = useState([]);
  const [assets, setAssets]       = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [expanded, setExpanded]   = useState(null); // expanded row id

  const load = async () => {
    setLoading(true);
    const [r, a, e] = await Promise.all([
      maintenanceService.getAll(),
      assetsService.getAll(),
      employeesService.getAll(),
    ]);
    setRecords(r.sort((i,j) => j.id.localeCompare(i.id))); 
    setAssets(a); 
    setEmployees(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const getAsset = id => assets.find(a => a.id === id);
  const getTech  = id => employees.find(e => e.id === id)?.name || id || '—';

  const filtered = records.filter(r => {
    const s = search.toLowerCase();
    const asset = getAsset(r.assetId);
    const m = !s
      || r.jobCardNo?.toLowerCase().includes(s)
      || r.assetId?.toLowerCase().includes(s)
      || asset?.name?.toLowerCase().includes(s)
      || r.description?.toLowerCase().includes(s);
    return m && (statusFilter === 'All' || r.status === statusFilter);
  });
  
  const isFiltered = search !== '' || statusFilter !== 'All';

  const handleClearFilters = () => {
      setSearch('');
      setStatusFilter('All');
  };

  const totalCost = records.reduce((s, r) => s + (Number(r.cost) || 0), 0);

  const exportExcel = () => {
    const data = filtered.map(r => {
      const base = {
        'Job Card No.': r.jobCardNo || '',
        'Asset ID': r.assetId,
        'Asset Name': getAsset(r.assetId)?.name || '',
        'Work Types': (r.workTypes || []).join(', '),
        'Status': r.status,
        'Technician': getTech(r.technician),
        'Start Date': r.startDate || '',
        'End Date': r.endDate || '',
        'Result': r.result || '',
        'Cost (฿)': r.cost || '',
        'Remarks': r.remarks || '',
      };
      (r.certFields || []).forEach(c => { base[c.label] = c.date || ''; base[c.label + ' No.'] = c.certNo || ''; });
      (r.customFields || []).forEach(c => { if (c.key) base[c.key] = c.value || ''; });
      return base;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Maintenance');
    XLSX.writeFile(wb, `Maintenance_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Exported successfully.');
  };

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-500" />
            Maintenance
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--t-text3)' }}>
            {records.length} job cards · {records.filter(r => r.status === 'In Progress').length} in progress
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary text-xs"><Download className="w-4 h-4" />Excel</button>
          <button onClick={() => { setSelected(null); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />New Job Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Job Cards',  value: records.length,                                      color: 'var(--t-text)' },
          { label: 'In Progress',      value: records.filter(r => r.status === 'In Progress').length, color: '#f59e0b' },
          { label: 'Pending',          value: records.filter(r => r.status?.startsWith('Pending')).length, color: '#a855f7' },
          { label: 'Cost MTD',         value: `฿${(totalCost / 1000).toFixed(0)}K`,               color: '#f97316' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs" style={{ color: 'var(--t-text3)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--t-text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search Job Card No., Asset, Description..."
            className="input-field pl-9" />
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {['All', ...STATUS_OPTIONS].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all',
                statusFilter === s
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'bg-[var(--t-bg3)] text-[var(--t-text3)] border-[var(--t-border2)] hover:border-[var(--t-border2)]'
              )}>
              {s}
            </button>
          ))}
          {isFiltered && (
              <button onClick={handleClearFilters} className="btn-secondary text-xs flex items-center gap-1.5">
                  <X className="w-4 h-4"/>
                  Clear Filter
              </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job Card No.</th>
                <th>Asset</th>
                <th>Work Types</th>
                <th>Technician</th>
                <th>Start Date</th>
                <th>Status</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12" style={{ color: 'var(--t-text3)' }}>
                    <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12" style={{ color: 'var(--t-text3)' }}>
                    <Wrench className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    No job cards found
                  </td>
                </tr>
              ) : filtered.map(rec => {
                const sc = STATUS_STYLE[rec.status] || STATUS_STYLE['Scheduled'];
                const Icon = sc.Icon;
                const asset = getAsset(rec.assetId);
                const isExpanded = expanded === rec.id;

                return (
                  <>
                    <tr key={rec.id} className="cursor-pointer" onClick={() => setExpanded(isExpanded ? null : rec.id)}>
                      <td>
                        <span className="font-mono text-xs font-semibold" style={{ color: '#f97316' }}>
                          {rec.jobCardNo || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium text-sm" style={{ color: 'var(--t-text)' }}>
                          {asset?.name?.substring(0, 30) || rec.assetId}
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'var(--t-text3)' }}>{asset?.assetNo || rec.assetId}</div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(rec.workTypes || []).slice(0, 3).map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'var(--t-bg3)', color: 'var(--t-text2)', border: '1px solid var(--t-border2)' }}>
                              {t}
                            </span>
                          ))}
                          {(rec.workTypes || []).length > 3 && (
                            <span className="text-[10px]" style={{ color: 'var(--t-text3)' }}>
                              +{rec.workTypes.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--t-text2)' }}>{getTech(rec.technician)}</td>
                      <td style={{ color: 'var(--t-text3)' }} className="text-xs">{rec.startDate || '—'}</td>
                      <td>
                        <span className={clsx('flex items-center gap-1 text-xs font-medium', sc.text)}>
                          <Icon className="w-3.5 h-3.5" />{rec.status}
                        </span>
                      </td>
                      <td>
                        {rec.result && (
                          <span className={clsx('text-xs font-semibold',
                            rec.result === 'Pass' ? 'text-green-600' :
                            rec.result === 'Fail' ? 'text-red-500' : 'text-amber-500')}>
                            {rec.result}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); setSelected(rec); setShowModal(true); }}
                            className="btn-ghost p-1.5 text-xs">Edit</button>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--t-text3)' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--t-text3)' }} />}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={rec.id + '-detail'} style={{ background: 'var(--t-bg3)' }}>
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">

                            <div className="space-y-2">
                              {rec.description && (
                                <div>
                                  <div className="font-semibold mb-1" style={{ color: 'var(--t-text3)' }}>Work Details</div>
                                  <div style={{ color: 'var(--t-text2)' }}>{rec.description}</div>
                                </div>
                              )}
                              {rec.remarks && (
                                <div>
                                  <div className="font-semibold mb-1" style={{ color: 'var(--t-text3)' }}>Remarks / Issues</div>
                                  <div className="text-amber-600">{rec.remarks}</div>
                                </div>
                              )}
                            </div>

                            {(rec.certFields || []).length > 0 && (
                              <div>
                                <div className="font-semibold mb-2" style={{ color: 'var(--t-text3)' }}>Certificate Dates</div>
                                <div className="space-y-1.5">
                                  {rec.certFields.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                      <span style={{ color: 'var(--t-text3)' }}>{c.label}</span>
                                      <div className="text-right">
                                        <div className="font-medium" style={{ color: 'var(--t-text)' }}>{c.date || '—'}</div>
                                        {c.certNo && <div className="font-mono" style={{ color: 'var(--t-text3)' }}>{c.certNo}</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(rec.customFields || []).filter(c => c.key).length > 0 && (
                              <div>
                                <div className="font-semibold mb-2" style={{ color: 'var(--t-text3)' }}>Additional Information</div>
                                <div className="space-y-1.5">
                                  {rec.customFields.filter(c => c.key).map((c, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                      <span style={{ color: 'var(--t-text3)' }}>{c.key}</span>
                                      <span className="font-medium" style={{ color: 'var(--t-text)' }}>{c.value}</span>
                                    </div>
                                  ))}\
                                </div>
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-[var(--t-border)] text-xs" style={{ color: 'var(--t-text3)' }}>
          {filtered.length} of {records.length} records · Click row to expand details
        </div>
      </div>

      {showModal && (
        <MaintenanceModal
          record={selected}
          assets={assets}
          employees={employees}
          onClose={() => setShowModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}