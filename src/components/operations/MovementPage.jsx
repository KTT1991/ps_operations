import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowRight, ArrowLeft, Plus, Search, CheckCircle, Clock, Download } from 'lucide-react';
import { assetsService, projectsService } from '../../services/firebaseService';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const BASE_LOCATIONS = ['PS Songkhla — Workshop','PS Songkhla — Open Yard','PS Rayong — Base','Main Warehouse'];

function MovementModal({ type, asset, projects, onClose, onSave }) {
  const isOut = type === 'out';
  const [form, setForm] = useState({
    assetId: asset?.id || '',
    movementType: isOut ? 'Send Out' : 'Receive In',
    fromLocation: isOut ? (asset?.location || '') : '',
    toLocation: isOut ? '' : (asset?.location || ''),
    projectId: asset?.currentProject || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    technician: '',
    manifestNo: '',
    notes: '',
    newStatus: isOut ? 'In Use' : 'Available',
  });

  const save = async () => {
    if (!form.assetId || !form.date) { toast.error('กรอก Asset และวันที่ด้วย'); return; }
    try {
      // Update asset status & location
      const update = {
        status: form.newStatus,
        location: isOut ? form.toLocation : form.toLocation || BASE_LOCATIONS[0],
        currentProject: isOut ? form.projectId : '',
      };
      await assetsService.update(form.assetId, update);
      toast.success(isOut ? `ส่งออก ${form.assetId} แล้ว` : `รับเข้า ${form.assetId} แล้ว`);
      onSave();
      onClose();
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-lg animate-fade-in shadow-2xl">
        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            {isOut
              ? <ArrowRight className="w-5 h-5 text-orange-500" />
              : <ArrowLeft  className="w-5 h-5 text-green-500" />
            }
            <h2 className="font-semibold text-sm">
              {isOut ? 'ส่งออกอุปกรณ์ (Send Out)' : 'รับเข้าอุปกรณ์ (Receive In)'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {!asset && (
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Asset ID *</label>
              <input value={form.assetId} onChange={e => setForm({...form, assetId: e.target.value})} className="input-field" placeholder="เช่น PCC-10K-DUALPOT-001" />
            </div>
          )}
          {asset && (
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
              <span className="font-mono text-orange-400">{asset.id}</span>
              <span className="text-[var(--t-text2)] ml-2">{asset.name}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">วันที่ *</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="text-xs text-[var(--t-text3)] block mb-1">Manifest No.</label>
              <input value={form.manifestNo} onChange={e => setForm({...form, manifestNo: e.target.value})} className="input-field" placeholder="MNF. YYYY-MM-XX" />
            </div>
          </div>

          {isOut ? (
            <>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">ส่งไปที่ (Project / Location)</label>
                <input value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="input-field" placeholder="เช่น Flowback Myanmar #FB3" />
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Project No.</label>
                <select value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})} className="select-field">
                  <option value="">ไม่ระบุ</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Status ใหม่</label>
                <select value={form.newStatus} onChange={e => setForm({...form, newStatus: e.target.value})} className="select-field">
                  <option value="In Use">In Use</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">รับเข้าที่ (Base Location)</label>
                <select value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="select-field">
                  {BASE_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Status ใหม่</label>
                <select value={form.newStatus} onChange={e => setForm({...form, newStatus: e.target.value})} className="select-field">
                  <option value="Available">Available</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-[var(--t-text3)] block mb-1">ผู้รับผิดชอบ</label>
            <input value={form.technician} onChange={e => setForm({...form, technician: e.target.value})} className="input-field" placeholder="ชื่อผู้ส่ง/รับ" />
          </div>
          <div>
            <label className="text-xs text-[var(--t-text3)] block mb-1">หมายเหตุ</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="input-field resize-none" />
          </div>
        </div>

        <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
          <button onClick={save} className={clsx('btn-primary', !isOut && '!bg-green-700 hover:!bg-green-600')}>
            {isOut ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isOut ? 'ยืนยันส่งออก' : 'ยืนยันรับเข้า'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MovementPage() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [modal, setModal] = useState(null); // { type:'out'|'in', asset }
  const [tab, setTab] = useState('active'); // active | base

  const load = async () => {
    setLoading(true);
    const [a, p] = await Promise.all([assetsService.getAll(), projectsService.getAll()]);
    setAssets(a); setProjects(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const inField  = assets.filter(a => a.status === 'In Use');
  const atBase   = assets.filter(a => a.status === 'Available');
  const damaged  = assets.filter(a => a.status === 'Damaged');

  const displayed = (tab === 'active' ? [...inField, ...assets.filter(a=>a.status==='Reserved')] : [...atBase, ...damaged])
    .filter(a => {
      const s = search.toLowerCase();
      return (
       !s ||
       a.name?.toLowerCase().includes(s) ||
       (a.assetNo || a.id)?.toLowerCase().includes(s) ||
       a.location?.toLowerCase().includes(s) ||
       a.serialNumber?.toLowerCase().includes(s)
     );
    });

  const exportLog = () => {
    const data = assets.map(a => ({
      'Asset No.': a.assetNo || a.id,
      'Name': a.name,
      'Category': a.category,
      'Status': a.status,
      'Location': a.location,
      'Project': a.currentProject || '',
      'Manifest': a.manifestNo || '',
      'Condition': a.condition,
}));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(8).fill({ wch: 22 });
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment Status');
    XLSX.writeFile(wb, `Equipment_Movement_${format(new Date(),'yyyyMMdd')}.xlsx`);
    toast.success('Export แล้ว');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-orange-500" />
            Equipment Movement
          </h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">รับ-ส่งอุปกรณ์ / อัปเดต Status</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportLog} className="btn-secondary text-xs"><Download className="w-4 h-4" />Export</button>
          <button onClick={() => setModal({ type:'in', asset: null })} className="btn-secondary text-xs !bg-green-900/30 !text-green-400 !border-green-700/50">
            <ArrowLeft className="w-4 h-4" />รับเข้า
          </button>
          <button onClick={() => setModal({ type:'out', asset: null })} className="btn-primary text-xs">
            <ArrowRight className="w-4 h-4" />ส่งออก
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'ออกไปที่ Project', value: inField.length,   color:'text-blue-400',   dot:'bg-blue-500' },
          { label:'Available ที่ Base', value: atBase.length,  color:'text-green-400',  dot:'bg-green-500' },
          { label:'Reserved',          value: assets.filter(a=>a.status==='Reserved').length, color:'text-cyan-400', dot:'bg-cyan-500' },
          { label:'Damaged',           value: damaged.length,  color:'text-red-400',    dot:'bg-red-500' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="flex items-center gap-2 mb-1">
              <div className={clsx('w-2 h-2 rounded-full', k.dot)} />
            </div>
            <div className={clsx('text-2xl font-bold', k.color)}>{k.value}</div>
            <div className="text-xs text-[var(--t-text3)] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-[var(--t-bg2)] border border-[var(--t-border)] rounded-lg p-1 w-fit">
          <button onClick={() => setTab('active')} className={clsx('px-3 py-1.5 rounded-md text-xs transition-all', tab==='active' ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]')}>
            ออกไปที่ Project ({inField.length + assets.filter(a=>a.status==='Reserved').length})
          </button>
          <button onClick={() => setTab('base')} className={clsx('px-3 py-1.5 rounded-md text-xs transition-all', tab==='base' ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]')}>
            อยู่ที่ Base ({atBase.length + damaged.length})
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]" />
          <input type="text" placeholder="ค้นหา Asset ID, ชื่อ, Location..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>ชื่ออุปกรณ์</th>
                <th>Category</th>
                <th>Status</th>
                <th>Location ปัจจุบัน</th>
                <th>Project</th>
                <th>Manifest</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--t-text3)]">กำลังโหลด...</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--t-text3)]">ไม่พบรายการ</td></tr>
              ) : displayed.slice(0,50).map(asset => {
                const isOut = asset.status === 'In Use' || asset.status === 'Reserved';
                return (
                  <tr key={asset.id}>
                    <td><span className="font-mono text-xs text-[var(--t-text3)]">{asset.assetNo || asset.id}</span></td>
                    <td><div className="font-medium text-sm text-[var(--t-text)] max-w-[180px] truncate">{asset.name}</div></td>
                    <td><span className="text-xs text-[var(--t-text3)]">{asset.category}</span></td>
                    <td>
                      <span className={clsx('badge',
                        asset.status==='Available' ? 'badge-available' :
                        asset.status==='In Use' ? 'badge-in-use' :
                        asset.status==='Damaged' ? 'badge-damaged' :
                        asset.status==='Reserved' ? 'badge-reserved' :
                        'badge-maintenance'
                      )}>{asset.status}</span>
                    </td>
                    <td><span className="text-xs text-[var(--t-text3)] truncate block max-w-[150px]">{asset.location}</span></td>
                    <td><span className="text-xs text-[var(--t-text3)]">{asset.currentProject || '—'}</span></td>
                    <td><span className="text-xs font-mono text-[var(--t-text3)]">{asset.manifestNo || '—'}</span></td>
                    <td>
                      {isOut ? (
                        <button onClick={() => setModal({ type:'in', asset })} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-green-900/30 text-green-400 border border-green-700/50 hover:bg-green-900/50 transition-colors">
                          <ArrowLeft className="w-3 h-3" />รับเข้า
                        </button>
                      ) : (
                        <button onClick={() => setModal({ type:'out', asset })} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-orange-900/30 text-orange-400 border border-orange-700/50 hover:bg-orange-900/50 transition-colors">
                          <ArrowRight className="w-3 h-3" />ส่งออก
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t text-xs text-[var(--t-text3)]">
          แสดง {Math.min(displayed.length,50)} จาก {displayed.length} รายการ
          {displayed.length > 50 && ' — ใช้ช่องค้นหาเพื่อกรอง'}
        </div>
      </div>

      {modal && (
        <MovementModal
          type={modal.type}
          asset={modal.asset}
          projects={projects}
          onClose={() => setModal(null)}
          onSave={load}
        />
      )}
    </div>
  );
}
