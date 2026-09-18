import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertTriangle, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { assetsService } from '../../services/firebaseService';
import { realAssets } from '../../data/assetData';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const encodeAssetId = (assetId) =>
  encodeURIComponent(assetId);

const ASSET_COLUMNS = [
  { key: 'id',           label: 'ASSET NO.',        required: true },
  { key: 'name',         label: 'DESCRIPTION',      required: true },
  { key: 'category',     label: 'TYPE',             required: false },
  { key: 'status',       label: 'STATUS',           required: false },
  { key: 'location',     label: 'STATUS LOCATION',  required: false },
  { key: 'currentProject', label: 'Project No.',    required: false },
  { key: 'manufacturer', label: 'VENDOR',           required: false },
  { key: 'serialNumber', label: 'MANUFACTURE ASSET NO.', required: false },
  { key: 'manifestNo',   label: 'Manifest No.',     required: false },
  { key: 'maintenanceDue', label: 'MAINTENANCE DUE', required: false },
  { key: 'notes',        label: 'NOTES',            required: false },
];

export default function BulkImportPage() {
  const [tab, setTab] = useState('upload'); // upload | preloaded | results
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef();

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setPreview(rows.slice(0, 10));
      toast.success(`Found ${rows.length} rows — showing first 10`);
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const header = ASSET_COLUMNS.map(c => c.label);
    const sample = [
      ['PCC-NEW-001','New Equipment Name','CCU','Available','PS Songkhla','','Vendor Name','SN-001','','2026-12-31','Remarks'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...sample]);
    ws['!cols'] = ASSET_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Import Template');
    XLSX.writeFile(wb, 'OGS_Asset_Import_Template.xlsx');
    toast.success('Template downloaded successfully');
  };

  const importPreloaded = async () => {
    if (!confirm(`Import ${realAssets.length} assets from your dataset?`)) return;
    setImporting(true);
    let success = 0, failed = 0, errs = [];
    const batchSize = 50;
    for (let i = 0; i < realAssets.length; i += batchSize) {
      const batch = realAssets.slice(i, i + batchSize);
      for (const asset of batch) {
        try {
          const firestoreId = encodeAssetId(asset.id);

          await assetsService.create({
             ...asset,
            assetNo: asset.id, // Retain real Asset No.
            id: asset.id
            .replaceAll('/', '_')
            .replaceAll('"', '')
            .replaceAll(' ', '-')
      });
          success++;
        } catch (err) {
          failed++;
          errs.push(`${asset.id}: ${err.message}`);
        }
      }
    }
    setResults({ success, failed, total: realAssets.length });
    setErrors(errs);
    setTab('results');
    setImporting(false);
    toast.success(`Successfully imported ${success} items`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="section-title flex items-center gap-2">
          <Upload className="w-5 h-5 text-orange-500" />
          Bulk Import Assets
        </h1>
        <p className="text-[var(--t-text3)] text-sm mt-1">Bulk import equipment and assets from Excel files</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--t-bg2)] border border-[var(--t-border)] rounded-lg p-1 w-fit">
        {[
          { id: 'upload',     label: 'Upload New Excel' },
          { id: 'preloaded',  label: `Use Preloaded Data (${realAssets.length} items)` },
          { id: 'results',    label: 'Import Results', disabled: !results },
        ].map(t => (
          <button key={t.id} onClick={() => !t.disabled && setTab(t.id)} disabled={t.disabled}
            className={clsx('px-3 py-1.5 rounded-md text-xs transition-all',
              tab === t.id ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]',
              t.disabled && 'opacity-40 cursor-not-allowed'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === 'upload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Drop zone */}
            <div
              className="card border-dashed border-2 border-slate-600 hover:border-orange-500 transition-colors p-10 text-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => e.preventDefault()}
            >
              <FileSpreadsheet className="w-10 h-10 text-[var(--t-text3)] mx-auto mb-3" />
              <div className="text-sm font-medium text-[var(--t-text2)]">Click or drag Excel spreadsheet here</div>
              <div className="text-xs text-[var(--t-text3)] mt-1">.xlsx, .xls — use template format below</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>

            {/* Template download */}
            <div className="card p-6 flex flex-col gap-3">
              <div className="font-medium text-[var(--t-text)] text-sm">Supported Columns</div>
              <div className="space-y-1.5">
                {ASSET_COLUMNS.map(c => (
                  <div key={c.key} className="flex items-center gap-2 text-xs">
                    <span className={clsx('w-1.5 h-1.5 rounded-full', c.required ? 'bg-orange-500' : 'bg-slate-600')} />
                    <span className="font-sans text-[var(--t-text3)]">{c.label}</span>
                    {c.required && <span className="text-orange-400">*</span>}
                  </div>
                ))}
              </div>
              <button onClick={downloadTemplate} className="btn-secondary mt-2">
                <Download className="w-4 h-4" />Download Template
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="card overflow-hidden">
              <div className="card-header flex items-center justify-between">
                <span className="font-medium text-[var(--t-text)] text-sm">Preview (First 10 Rows)</span>
                <button onClick={() => setPreview([])} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead><tr>{Object.keys(preview[0]).slice(0,8).map(k => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => (
                    <tr key={i}>{Object.values(row).slice(0,8).map((v, j) => <td key={j} className="truncate max-w-[120px]">{String(v)}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preloaded tab */}
      {tab === 'preloaded' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 border border-emerald-500 bg-white rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold text-[var(--t-text)]">Dataset Ready to Import</div>
                <div className="text-sm text-[var(--t-text3)] mt-1">
                  File <span className="font-sans text-orange-600">PS_SKL_Asset_Equipment_List_updated_on_21-May-2026.xlsx</span> parsed
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Assets',  value: realAssets.length,                                           color: 'text-[var(--t-text)]' },
                { label: 'In Use',        value: realAssets.filter(a=>a.status==='In Use').length,             color: 'text-blue-600' },
                { label: 'Available',     value: realAssets.filter(a=>a.status==='Available').length,          color: 'text-emerald-600' },
                { label: 'Categories',    value: new Set(realAssets.map(a=>a.category)).size,                  color: 'text-orange-600' },
              ].map(k => (
                <div key={k.label} className="bg-[var(--t-bg3)] border border-[var(--t-border)] rounded-lg p-3">
                  <div className={clsx('text-2xl font-bold', k.color)}>{k.value}</div>
                  <div className="text-xs text-[var(--t-text3)] mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Category breakdown */}
            <div>
              <div className="text-xs font-medium text-[var(--t-text3)] uppercase tracking-wider mb-2">Asset Categories</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[...new Set(realAssets.map(a=>a.category))].map(cat => (
                  <div key={cat} className="flex items-center justify-between text-xs bg-[var(--t-bg3)] border border-[var(--t-border)] rounded px-2.5 py-1.5">
                    <span className="text-[var(--t-text2)] truncate">{cat}</span>
                    <span className="font-bold text-[var(--t-text)] ml-2">{realAssets.filter(a=>a.category===cat).length}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--t-border)]">
              <p className="text-xs text-[var(--t-text3)] mb-3">
                Connects to Firestore database to persist imported assets. In demo mode, sample items are loaded locally.
              </p>
              <button onClick={importPreloaded} disabled={importing} className="btn-primary">
                {importing ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing...</>
                ) : (
                  <><Upload className="w-4 h-4" />Import {realAssets.length} Assets into Database</>
                )}
              </button>
            </div>
          </div>

          {/* Sample preview */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <span className="font-medium text-[var(--t-text)] text-sm">Data Preview (First 10 Items)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Asset No.</th><th>Description</th><th>Category</th><th>Status</th><th>Location</th><th>Project</th><th>Vendor</th></tr></thead>
                <tbody>
                  {realAssets.slice(0,10).map(a => (
                    <tr key={a.id}>
                      <td><span className="font-sans text-xs text-[var(--t-text3)]">{a.id}</span></td>
                      <td><span className="font-medium text-[var(--t-text)] text-sm">{a.name}</span></td>
                      <td><span className="text-xs text-[var(--t-text3)]">{a.category}</span></td>
                      <td><span className={clsx('badge', a.status==='Available' ? 'badge-available' : 'badge-in-use')}>{a.status}</span></td>
                      <td><span className="text-xs text-[var(--t-text3)] truncate block max-w-[140px]">{a.location}</span></td>
                      <td><span className="text-xs text-[var(--t-text3)]">{a.currentProject || '—'}</span></td>
                      <td><span className="text-xs text-[var(--t-text3)] truncate block max-w-[100px]">{a.manufacturer}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Results tab */}
      {tab === 'results' && results && (
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white border-2 border-emerald-500 rounded-xl shadow-xs">
              <div className="text-3xl font-bold text-emerald-600">{results.success}</div>
              <div className="text-sm text-[var(--t-text3)] mt-1">Success</div>
            </div>
            <div className="text-center p-4 bg-white border-2 border-red-500 rounded-xl shadow-xs">
              <div className="text-3xl font-bold text-red-600">{results.failed}</div>
              <div className="text-sm text-[var(--t-text3)] mt-1">Failed</div>
            </div>
            <div className="text-center p-4 bg-white border-2 border-slate-300 rounded-xl shadow-xs">
              <div className="text-3xl font-bold text-[var(--t-text)]">{results.total}</div>
              <div className="text-sm text-[var(--t-text3)] mt-1">Total</div>
            </div>
          </div>
          {errors.length > 0 && (
            <div className="bg-white border-2 border-red-500 rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />Failed Records
              </div>
              {errors.map((e, i) => <div key={i} className="text-xs text-red-700 font-sans">{e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
