import { useState, useEffect } from 'react';
import { Archive, Plus, Search, Download, AlertTriangle, TrendingDown, Package } from 'lucide-react';
import { inventoryService } from '../../services/firebaseService';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

function StockStatus({ item }) {
  if (item.quantity <= 0) return <span className="text-red-400 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Out of Stock</span>;
  if (item.quantity <= item.safetyStock) return <span className="text-red-400 text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Critical Low</span>;
  if (item.quantity <= item.reorderLevel) return <span className="text-amber-400 text-xs font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3" />Reorder Now</span>;
  return <span className="text-green-400 text-xs font-medium flex items-center gap-1"><Package className="w-3 h-3" />In Stock</span>;
}

function InventoryModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: '', partNumber: '', category: '', quantity: 0, unit: 'pcs',
    safetyStock: 0, reorderLevel: 0, reorderQuantity: 0, unitCost: 0,
    location: '', supplier: '', leadTimeDays: 14,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (item?.id) { await inventoryService.update(item.id, form); toast.success('Updated'); }
      else { await inventoryService.create({ ...form, id: `INV-${Date.now()}` }); toast.success('Created'); }
      onSave(); onClose();
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const fields = [
    [['name', 'Item Name *', 'text'], ['partNumber', 'Part Number', 'text']],
    [['category', 'Category', 'text'], ['unit', 'Unit', 'text']],
    [['quantity', 'Current Qty', 'number'], ['safetyStock', 'Safety Stock', 'number']],
    [['reorderLevel', 'Reorder Level', 'number'], ['reorderQuantity', 'Reorder Qty', 'number']],
    [['unitCost', 'Unit Cost (฿)', 'number'], ['leadTimeDays', 'Lead Time (days)', 'number']],
    [['location', 'Storage Location', 'text'], ['supplier', 'Supplier', 'text']],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900">
          <h2 className="font-semibold text-slate-100">{item ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2>
          <button onClick={onClose} className="btn-ghost p-1">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {fields.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 gap-3">
              {row.map(([key, label, type]) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 block mb-1">{label}</label>
                  <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} className="input-field" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-slate-800 flex gap-3 justify-end sticky bottom-0 bg-slate-900">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [alertFilter, setAlertFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await inventoryService.getAll();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = ['All', ...new Set(items.map(i => i.category).filter(Boolean))];
  const lowStock = items.filter(i => i.quantity <= i.reorderLevel);
  const outOfStock = items.filter(i => i.quantity <= 0);
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    const matchSearch = !s || i.name?.toLowerCase().includes(s) || i.partNumber?.toLowerCase().includes(s) || i.category?.toLowerCase().includes(s);
    const matchCat = catFilter === 'All' || i.category === catFilter;
    const matchAlert = !alertFilter || i.quantity <= i.reorderLevel;
    return matchSearch && matchCat && matchAlert;
  });

  const exportToExcel = () => {
    const data = filtered.map(i => ({
      'Item ID': i.id, 'Name': i.name, 'Part Number': i.partNumber, 'Category': i.category,
      'Qty': i.quantity, 'Unit': i.unit, 'Safety Stock': i.safetyStock, 'Reorder Level': i.reorderLevel,
      'Unit Cost (฿)': i.unitCost, 'Total Value (฿)': i.quantity * i.unitCost,
      'Location': i.location, 'Supplier': i.supplier, 'Lead Time (days)': i.leadTimeDays,
      'Status': i.quantity <= 0 ? 'Out of Stock' : i.quantity <= i.safetyStock ? 'Critical' : i.quantity <= i.reorderLevel ? 'Reorder' : 'OK',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Array(14).fill({ wch: 16 });
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-500" />
            Inventory & Spare Parts
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {items.length} items · {lowStock.length} low stock · {outOfStock.length} out of stock
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="btn-secondary text-xs"><Download className="w-4 h-4" />Excel</button>
          <button onClick={() => { setSelected(null); setShowModal(true); }} className="btn-primary"><Plus className="w-4 h-4" />Add Item</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-2xl font-bold text-slate-200">{items.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Total Items</div>
        </div>
        <div className="kpi-card cursor-pointer" onClick={() => setAlertFilter(!alertFilter)}>
          <div className="text-2xl font-bold text-amber-400">{lowStock.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Low Stock / Reorder</div>
        </div>
        <div className="kpi-card">
          <div className="text-2xl font-bold text-red-400">{outOfStock.length}</div>
          <div className="text-sm text-slate-500 mt-0.5">Out of Stock</div>
        </div>
        <div className="kpi-card">
          <div className="text-2xl font-bold text-green-400">฿{(totalValue / 1000).toFixed(0)}K</div>
          <div className="text-sm text-slate-500 mt-0.5">Total Stock Value</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all',
                catFilter === c ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600')}>
              {c}
            </button>
          ))}
          <button onClick={() => setAlertFilter(!alertFilter)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1',
              alertFilter ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-amber-400 border-slate-700 hover:border-amber-700')}>
            <AlertTriangle className="w-3 h-3" />Alerts Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Part No.</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Safety Stock</th>
                <th>Reorder Lvl</th>
                <th>Unit Cost</th>
                <th>Total Value</th>
                <th>Location</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-slate-500"><Archive className="w-12 h-12 mx-auto mb-2 opacity-30" />No items found</td></tr>
              ) : filtered.map(item => {
                const stockPct = item.reorderLevel > 0 ? Math.min((item.quantity / (item.reorderLevel * 2)) * 100, 100) : 100;
                const stockColor = item.quantity <= 0 ? '#ef4444' : item.quantity <= item.safetyStock ? '#ef4444' : item.quantity <= item.reorderLevel ? '#f59e0b' : '#22c55e';
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium text-slate-100 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.id}</div>
                    </td>
                    <td><span className="font-mono text-xs text-slate-400">{item.partNumber}</span></td>
                    <td><span className="text-sm text-slate-400">{item.category}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress-bar">
                          <div className="progress-fill" style={{ width: `${stockPct}%`, background: stockColor }} />
                        </div>
                        <span className="text-sm font-medium text-slate-200">{item.quantity} <span className="text-xs text-slate-500">{item.unit}</span></span>
                      </div>
                    </td>
                    <td><span className="text-sm text-slate-400">{item.safetyStock}</span></td>
                    <td><span className="text-sm text-slate-400">{item.reorderLevel}</span></td>
                    <td><span className="text-sm text-slate-300">฿{item.unitCost?.toLocaleString()}</span></td>
                    <td><span className="text-sm text-slate-300">฿{(item.quantity * item.unitCost)?.toLocaleString()}</span></td>
                    <td><span className="text-xs text-slate-400">{item.location}</span></td>
                    <td><StockStatus item={item} /></td>
                    <td>
                      <button onClick={() => { setSelected(item); setShowModal(true); }} className="btn-ghost p-1.5 text-xs">Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
          Showing {filtered.length} of {items.length} items · Total value: ฿{totalValue.toLocaleString()}
        </div>
      </div>

      {showModal && <InventoryModal item={selected} onClose={() => setShowModal(false)} onSave={load} />}
    </div>
  );
}
