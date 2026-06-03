
import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowRight, ArrowLeft, Plus, Search, Download, HardDriveUpload, HardDriveDownload, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { assetsService, projectsService } from '../../services/firebaseService';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const BASE_LOCATIONS = ['PS Songkhla — Workshop','PS Songkhla — Open Yard','PS Rayong — Base','Main Warehouse'];
const ITEMS_PER_PAGE = 30;

function MovementModal({ type, asset, projects, assets, onClose, onSave }) {
  const isOut = type === 'out';
  const [form, setForm] = useState({
    assetId: asset?.id || '',
    movementType: isOut ? 'Send Out' : 'Receive In',
    fromLocation: isOut ? (asset?.location || '') : '',
    toLocation: isOut ? '' : (asset?.location || ''),
    projectId: asset?.currentProject || asset?.currentProjectId || '', // Use currentProject first
    date: format(new Date(), 'yyyy-MM-dd'),
    technician: '',
    manifestNo: '',
    notes: '',
    newStatus: isOut ? 'In Use' : 'Available',
  });
  
  const selectedAsset = assets.find(a => a.id === form.assetId);

  const save = async () => {
    if (!form.assetId || !form.date) { toast.error('Please select an asset and date.'); return; }
    try {
      const selectedProject = projects.find(p => p.id === form.projectId);
      const update = {
        status: form.newStatus,
        location: isOut ? form.toLocation : form.toLocation || BASE_LOCATIONS[0],
        // This is the HEALING part. Always save the correct ID and Number.
        currentProject: form.projectId, 
        projectNumber: selectedProject?.projectNumber || '',
      };
      // Clean up my old mistake
      if ('currentProjectId' in (asset || {})) {
          update.currentProjectId = null;
      }

      await assetsService.update(form.assetId, update);
      toast.success(isOut ? `Sent out ${selectedAsset.assetNo}` : `Received ${selectedAsset.assetNo}`);
      onSave();
      onClose();
    } catch(e) { console.error(e); toast.error('Save failed'); }
  };

  const availableAssets = isOut
    ? assets.filter(a => a.status === 'Available' || a.status === 'Damaged' || a.status === 'Under Maintenance')
    : assets.filter(a => a.status === 'In Use' || a.status === 'Reserved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-lg animate-fade-in shadow-2xl">
        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">{isOut ? 'Send Out Asset' : 'Receive In Asset'}</h2>
           <button onClick={onClose} className="btn-ghost p-1 text-lg">✕</button>
        </div>
        <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-xs text-[var(--t-text3)] block mb-1">Asset No. *</label>
                    {asset ? 
                        <input disabled value={asset.assetNo || asset.id} className="input-field bg-[var(--t-bg3)]" /> :
                        <select value={form.assetId} onChange={e => setForm({...form, assetId: e.target.value})} className="select-field">
                            <option value="">Select asset...</option>
                            {availableAssets.map(a => <option key={a.id} value={a.id}>{a.assetNo || a.id}</option>)}
                        </select>
                    }
                </div>
                <div>
                    <label className="text-xs text-[var(--t-text3)] block mb-1">Asset Name</label>
                    <input disabled value={selectedAsset?.name || ''} className="input-field bg-[var(--t-bg3)]" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="text-xs text-[var(--t-text3)] block mb-1">Date</label>
                   <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" />
                </div>
                <div>
                   <label className="text-xs text-[var(--t-text3)] block mb-1">Manifest No.</label>
                   <input value={form.manifestNo} onChange={e => setForm({...form, manifestNo: e.target.value})} className="input-field" placeholder="MNF. YYYY-MM-XX" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="text-xs text-[var(--t-text3)] block mb-1">From</label>
                   <input value={isOut ? (selectedAsset?.location || '') : form.fromLocation} onChange={e => setForm({...form, fromLocation: e.target.value})} className="input-field" placeholder={isOut ? '' : "e.g. Supplier X"} disabled={isOut} />
                </div>
                <div>
                   <label className="text-xs text-[var(--t-text3)] block mb-1">To</label>
                    {isOut ? 
                        <input value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="input-field" placeholder={"Project/Site"} /> :
                        <select value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="select-field">
                            <option value="">Select Base...</option>
                            {BASE_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                        </select>
                    }
                </div>
            </div>
            <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Project</label>
                <select value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})} className="select-field">
                     <option value="">Not specified</option>
                     {projects.map(p => {
                         const displayName = p.projectNumber ? `${p.projectNumber}_${p.name}` : p.name;
                         return <option key={p.id} value={p.id}>{displayName}</option>
                     })}
                </select>
            </div>
             <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">New Status</label>
                <select value={form.newStatus} onChange={e => setForm({...form, newStatus: e.target.value})} className="select-field">
                   {isOut 
                     ? <><option value="In Use">In Use</option><option value="Reserved">Reserved</option></>
                     : <><option value="Available">Available</option><option value="Under Maintenance">Under Maintenance</option><option value="Damaged">Damaged</option></>
                   }
                </select>
            </div>
        </div>
        <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex gap-3 justify-end">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={save} className={clsx('btn-primary', !isOut && '!bg-green-700 hover:!bg-green-600')}>
                Confirm {isOut ? 'Send Out' : 'Receive In'}
            </button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="btn-ghost p-2 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" />
            </button>
            {pageNumbers.map(number => (
                <button 
                    key={number} 
                    onClick={() => onPageChange(number)} 
                    className={clsx('px-3 py-1 text-xs rounded-md', currentPage === number ? 'bg-orange-600 text-white font-bold' : 'btn-ghost')}>
                    {number}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn-ghost p-2 disabled:opacity-50">
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function MovementPage() {
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('base');
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const [a, p] = await Promise.all([assetsService.getAll(), projectsService.getAll()]);
    setAssets(a);
    setProjects(p);
    setLoading(false);
    setSelectedAssetIds([]);
    setCurrentPage(1);
  };

  useEffect(() => { load(); }, []);

  // This is the FLEXIBLE display logic, copied from AssetsPage.jsx
  const getProjectDisplay = (asset) => {
      if (!asset) return '';

      // 1. Try to find the full project object via its ID.
      // Asset might store the ID in `currentProject` (correct) or `currentProjectId` (my old mistake).
      const project = projects.find(p => p.id === asset.currentProject || p.id === asset.currentProjectId);
      if (project) {
          return project.projectNumber || project.name; // Return the project number if it exists
      }

      // 2. If no full project found, fall back to displaying whatever is stored directly on the asset.
      // This handles legacy data where only a number string was stored.
      const directData = asset.projectNumber || asset.currentProject;
      if (directData && typeof directData === 'string' && directData.length < 25) { // Heuristic to avoid showing long Firebase IDs
          return directData;
      }

      return ''; // Return blank if no project is associated
  }

  const assetsAtBase = assets.filter(a => a.status === 'Available' || a.status === 'Damaged' || a.status === 'Under Maintenance');
  const assetsInField = assets.filter(a => a.status === 'In Use' || a.status === 'Reserved');

  const filteredAssets = (tab === 'base' ? assetsAtBase : assetsInField)
    .filter(a => {
      const s = search.toLowerCase();
      const projectDisplay = getProjectDisplay(a);

      return !s || 
        a.name?.toLowerCase().includes(s) || 
        (a.assetNo || '')?.toLowerCase().includes(s) || 
        a.location?.toLowerCase().includes(s) ||
        projectDisplay.toLowerCase().includes(s);
    });
  
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);


  useEffect(() => { 
    setCurrentPage(1); 
    setSelectedAssetIds([]);
  }, [tab, search]);

  const handleClearFilters = () => {
      setSearch('');
      setTab('base');
      setCurrentPage(1);
  };

  const isFiltered = search !== '' || tab !== 'base';

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAssetIds(currentItems.map(a => a.id));
    } else {
      setSelectedAssetIds([]);
    }
  };

  const handleRowSelect = (id) => {
    setSelectedAssetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const exportLog = () => {
      const dataToExport = filteredAssets.map(a => {
          return {
            'Asset No': a.assetNo || a.id,
            'Asset Name': a.name,
            Category: a.category,
            Status: a.status,
            Location: a.location,
            'Project': getProjectDisplay(a),
          }
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Equipment Log");
      XLSX.writeFile(workbook, "EquipmentMovementLog.xlsx");
      toast.success('Exported successfully!');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-orange-500" />Equipment Movement</h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">Receive/Send equipment and update status</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedAssetIds.length > 0 ? (
            <div className="flex items-center gap-2 animate-fade-in">
                <span className='text-sm text-[var(--t-text3)]'>{selectedAssetIds.length} items selected</span>
                 <button onClick={() => setModal({ type: 'bulk-out'})} className="btn-primary text-xs">
                    <HardDriveUpload className="w-4 h-4" />Bulk Send Out
                </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
                <button onClick={exportLog} className="btn-secondary text-xs"><Download className="w-4 h-4" />Export</button>
                <button onClick={() => setModal({ type:'in', asset: null })} className="btn-secondary text-xs !bg-green-900/30 !text-green-400 !border-green-700/50">
                    <ArrowLeft className="w-4 h-4" />Receive In
                </button>
                <button onClick={() => setModal({ type:'out', asset: null })} className="btn-primary text-xs">
                    <ArrowRight className="w-4 h-4" />Send Out
                </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-[var(--t-bg2)] border border-[var(--t-border)] rounded-lg p-1 w-fit">
          <button onClick={() => setTab('base')} className={clsx('px-3 py-1.5 rounded-md text-xs transition-all', tab === 'base' ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]')}>
            At Base ({assetsAtBase.length})
          </button>
          <button onClick={() => setTab('field')} className={clsx('px-3 py-1.5 rounded-md text-xs transition-all', tab === 'field' ? 'bg-orange-600 text-white' : 'text-[var(--t-text3)] hover:text-[var(--t-text)]')}>
            In Field ({assetsInField.length})
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--t-text3)]" />
          <input type="text" placeholder="Search Asset No, Name, Location, Project..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        {isFiltered && (
            <button onClick={handleClearFilters} className="btn-secondary text-xs flex items-center gap-1.5">
                <X className="w-4 h-4"/>
                Clear Filter
            </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} checked={currentItems.length > 0 && selectedAssetIds.length === currentItems.length} className="mt-1" /></th>
                <th>Asset No</th><th>Asset Name</th><th>Category</th><th>Status</th><th>Location</th><th>Project</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--t-text3)]">Loading...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-[var(--t-text3)]">No items found</td></tr>
              ) : currentItems.map(asset => {
                  const projectDisplay = getProjectDisplay(asset);
                  const project = projects.find(p => p.projectNumber === projectDisplay || p.name === projectDisplay);
                  return (
                    <tr key={asset.id} className={clsx(selectedAssetIds.includes(asset.id) && 'bg-orange-900/10')}>
                      <td><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => handleRowSelect(asset.id)} className="mt-1" /></td>
                      <td><span className="font-mono text-xs text-[var(--t-text3)]">{asset.assetNo || asset.id}</span></td>
                      <td><div className="font-medium text-sm text-[var(--t-text)] max-w-[180px] truncate">{asset.name}</div></td>
                      <td><span className="text-xs text-[var(--t-text3)]">{asset.category}</span></td>
                      <td>
                        <span className={clsx('badge', asset.status==='Available'?'badge-available':asset.status==='In Use'?'badge-in-use':asset.status==='Damaged'?'badge-damaged':asset.status==='Reserved'?'badge-reserved':'badge-maintenance')}>{asset.status}</span>
                      </td>
                      <td>
                          <div className="text-xs text-[var(--t-text3)] truncate block max-w-[150px]">{asset.location}</div>
                      </td>
                      <td>
                        <div className="text-xs text-cyan-400 font-semibold truncate block max-w-[150px]" title={project?.name || projectDisplay}>
                          {projectDisplay}
                        </div>
                      </td>
                      <td>
                        {asset.status === 'In Use' || asset.status === 'Reserved' ? (
                          <button onClick={() => setModal({ type:'in', asset })} className="btn-action-in">
                            <ArrowLeft className="w-3 h-3" />Receive In
                          </button>
                        ) : (
                          <button onClick={() => setModal({ type:'out', asset })} className="btn-action-out">
                            <ArrowRight className="w-3 h-3" />Send Out
                          </button>
                        )}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t text-xs text-[var(--t-text3)] flex items-center justify-between">
          <span>Showing {indexOfFirstItem + 1}-${Math.min(indexOfLastItem, filteredAssets.length)} of {filteredAssets.length} items</span>
          <Pagination 
            currentPage={currentPage} 
            totalItems={filteredAssets.length} 
            itemsPerPage={ITEMS_PER_PAGE} 
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {modal?.type?.startsWith('bulk') && (
        <BulkMovementModal 
            type={modal.type === 'bulk-in' ? 'in' : 'out'} 
            selectedAssetIds={selectedAssetIds}
            assets={assets}
            projects={projects}
            onClose={() => setModal(null)}
            onSave={load}
        />
      )}

      {modal && !modal.type?.startsWith('bulk') && (
        <MovementModal
          type={modal.type}
          asset={modal.asset}
          projects={projects}
          assets={assets}
          onClose={() => setModal(null)}
          onSave={load}
        />
      )}
    </div>
  );
}
