import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowRight, ArrowLeft, Download, HardDriveUpload, HardDriveDownload, ChevronLeft, ChevronRight, X, Loader, Package, Truck } from 'lucide-react';
import { assetsService, projectsService, equipmentHistoryService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const BASE_LOCATIONS = ['PS Songkhla — Workshop','PS Songkhla — Open Yard','PS Rayong — Base','Main Warehouse'];
const ITEMS_PER_PAGE = 30;
const STATUSES = ['Available', 'In Use', 'Under Maintenance', 'Calibration', 'Reserved', 'Damaged', 'Standby', 'Disposal'];

function MovementModal({ type, asset, projects, assets, onClose, onSave }) {
  const { user, isAdmin, isBaseManager } = useAuth();
  const canEdit = isAdmin || isBaseManager;
  const isOut = type === 'out';
  
  const [form, setForm] = useState({
    assetId: asset?.id || '',
    movementType: isOut ? 'Load Out' : 'Load In',
    fromLocation: isOut ? (asset?.location || '') : '',
    toLocation: isOut ? '' : (asset?.location || ''),
    projectId: asset?.currentProject || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    manifestNo: '',
    notes: '',
    newStatus: asset?.status ? (isOut ? 'In Use' : 'Available') : (isOut ? 'In Use' : 'Available'),
  });
  
  const selectedAsset = assets.find(a => a.id === form.assetId);

  const save = async () => {
    if (!canEdit) return toast.error("You don't have permission to perform this action.");
    if (!form.assetId || !form.date) {
      toast.error('Please select an asset and date.');
      return;
    }

    try {
      const selectedProject = projects.find(p => p.id === form.projectId);
      const newLocation = isOut ? form.toLocation : form.toLocation || BASE_LOCATIONS[0];

      const update = {
        status: form.newStatus,
        location: newLocation,
        currentProject: form.projectId,
        projectNumber: selectedProject?.projectNumber || '',
      };

      await assetsService.update(form.assetId, update);

      const changes = [];
      if (selectedAsset.location !== newLocation) {
        changes.push({ field: 'location', oldValue: selectedAsset.location, newValue: newLocation });
      }
      if (selectedAsset.status !== form.newStatus) {
        changes.push({ field: 'status', oldValue: selectedAsset.status, newValue: form.newStatus });
      }

      await equipmentHistoryService.create({
        refId: selectedAsset.id,
        refNo: selectedAsset.assetNo,
        activityType: isOut ? 'Load Out' : 'Load In',
        timestamp: new Date(form.date),
        modifiedBy: user?.displayName || user?.email || 'System',
        changes: changes,
        projectId: form.projectId,
        jobCardNo: form.manifestNo,
        notes: form.notes,
      });

      toast.success(isOut ? `Loaded out ${selectedAsset.assetNo}` : `Loaded in ${selectedAsset.assetNo}`)
      onSave();
      onClose();
    } catch(e) {
      console.error("Failed to save movement: ", e);
      toast.error('Save failed. Check console for details.');
    }
  };

  const availableAssets = isOut
    ? assets.filter(a => a.status === 'Available' || a.status === 'Damaged' || a.status === 'Under Maintenance' || a.status === 'Standby')
    : assets.filter(a => a.status === 'In Use' || a.status === 'Reserved');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative modal-bg border rounded-xl w-full max-w-lg animate-fade-in shadow-2xl overflow-hidden">
        <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">{isOut ? 'Load Out Asset' : 'Load In Asset'}</h2>
           <button onClick={onClose} className="btn-ghost p-1 text-lg">✕</button>
        </div>
        <fieldset disabled={!canEdit} className="contents">
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                   <div>
                      <label className="text-xs text-[var(--t-text3)] block mb-1">Asset No. *</label>
                      {asset ? 
                          <input disabled value={asset.assetNo || asset.id} className="input-field bg-[var(--t-bg3)]" /> :
                          <select value={form.assetId} onChange={e => setForm({...form, assetId: e.target.value})} className="select-field">
                              <option value="">Select asset...</option>
                              {availableAssets.map(a => <option key={a.id} value={a.id}>{a.assetNo || a.id} - {a.name}</option>)}
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
                    <input value={form.manifestNo} onChange={e => setForm({...form, manifestNo: e.target.value})} className="input-field" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-xs text-[var(--t-text3)] block mb-1">{isOut ? 'From (Current Location)' : 'From'}</label>
                      <input value={form.fromLocation} onChange={e => setForm({...form, fromLocation: e.target.value})} className="input-field" />
                  </div>
                  <div>
                      <label className="text-xs text-[var(--t-text3)] block mb-1">{isOut ? 'To (Destination)' : 'To (New Location)'}</label>
                      <input value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="input-field" />
                  </div>
              </div>
              
              <div>
                <label className="text-xs text-[var(--t-text3)] block mb-1">Project</label>
                <select value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})} className="select-field">
                    <option value="">N/A</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                  <label className="text-xs text-[var(--t-text3)] block mb-1">New Status</label>
                  <select value={form.newStatus} onChange={e => setForm({...form, newStatus: e.target.value})} className="select-field">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
              </div>
              
              <div>
                  <label className="text-xs text-[var(--t-text3)] block mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field h-24" placeholder="Add any additional information..."></textarea>
              </div>
          </div>
          {canEdit && (
            <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex gap-3 justify-end">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={save} className={clsx('btn-primary', !isOut && '!bg-green-700 hover:!bg-green-600')}>
                    Confirm {isOut ? 'Load Out' : 'Load In'}
                </button>
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}

function BulkMovementModal({ type, selectedAssetIds, projects, assets, onClose, onSave }) {
    const { user, isAdmin, isBaseManager } = useAuth();
    const canEdit = isAdmin || isBaseManager;
    const isOut = type === 'bulk-out';

    const [form, setForm] = useState({
        toLocation: '',
        projectId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        manifestNo: '',
        notes: '',
        newStatus: isOut ? 'In Use' : 'Available',
    });
    const [isSaving, setIsSaving] = useState(false);

    const selectedAssets = assets.filter(a => selectedAssetIds.includes(a.id));

    const save = async () => {
        if (!canEdit) return toast.error("You don't have permission to perform this action.");
        if (!form.toLocation || !form.date) {
            return toast.error('Please provide a destination/location and a date.');
        }
        setIsSaving(true);
        
        const selectedProject = projects.find(p => p.id === form.projectId);

        const promises = selectedAssets.map(asset => {
            const newLocation = form.toLocation;
            const update = {
                status: form.newStatus,
                location: newLocation,
                currentProject: form.projectId,
                projectNumber: selectedProject?.projectNumber || '',
            };

            const changes = [];
            if (asset.location !== newLocation) {
                changes.push({ field: 'location', oldValue: asset.location, newValue: newLocation });
            }
            if (asset.status !== form.newStatus) {
                changes.push({ field: 'status', oldValue: asset.status, newValue: form.newStatus });
            }

            const history = {
                refId: asset.id,
                refNo: asset.assetNo,
                activityType: isOut ? 'Load Out' : 'Load In',
                timestamp: new Date(form.date),
                modifiedBy: user?.displayName || user?.email || 'System',
                changes: changes,
                projectId: form.projectId,
                jobCardNo: form.manifestNo,
                notes: form.notes,
            };

            return assetsService.update(asset.id, update)
                .then(() => equipmentHistoryService.create(history));
        });

        const results = await Promise.allSettled(promises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.length - successCount;

        if (successCount > 0) {
            toast.success(`Successfully processed ${successCount} assets.`);
        }
        if (failedCount > 0) {
            toast.error(`Failed to process ${failedCount} assets. Check console for details.`);
            console.error("Failed bulk operations:", results.filter(r => r.status === 'rejected'));
        }
        
        setIsSaving(false);
        onSave(); 
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative modal-bg border rounded-xl w-full max-w-2xl animate-fade-in shadow-2xl overflow-hidden">
                <div className="sticky top-0 modal-bg z-10 flex items-center justify-between px-5 py-4 border-b">
                    <h2 className="font-semibold text-sm">{isOut ? 'Bulk Load Out' : 'Bulk Load In'} ({selectedAssets.length} items)</h2>
                    <button onClick={onClose} className="btn-ghost p-1 text-lg">✕</button>
                </div>
                <fieldset disabled={!canEdit || isSaving} className="contents">
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 max-h-[80vh] overflow-y-auto">
                        <div className='md:col-span-2'>
                            <label className="text-xs text-[var(--t-text3)] block mb-1">Selected Assets</label>
                            <div className='bg-[var(--t-bg3)] border rounded-md p-2 h-32 overflow-y-scroll text-xs space-y-1'>
                                {selectedAssets.map(a => <p key={a.id} className='font-mono'>{a.assetNo} - <span className='text-[var(--t-text3)]'>{a.name}</span></p>)}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-[var(--t-text3)] block mb-1">{isOut ? 'To (Destination)' : 'To (New Location at Base)'} *</label>
                            <input value={form.toLocation} onChange={e => setForm({...form, toLocation: e.target.value})} className="input-field" />
                        </div>
                        <div>
                            <label className="text-xs text-[var(--t-text3)] block mb-1">Date *</label>
                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" />
                        </div>
                         <div>
                            <label className="text-xs text-[var(--t-text3)] block mb-1">Manifest No.</label>
                            <input value={form.manifestNo} onChange={e => setForm({...form, manifestNo: e.target.value})} className="input-field" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-[var(--t-text3)] block mb-1">Project</label>
                            <select value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})} className="select-field">
                                <option value="">N/A</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-[var(--t-text3)] block mb-1">New Status</label>
                            <select value={form.newStatus} onChange={e => setForm({...form, newStatus: e.target.value})} className="select-field">
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-[var(--t-text3)] block mb-1">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field h-24" placeholder="Add any additional information for all selected assets..."></textarea>
                        </div>
                    </div>
                    {canEdit && (
                        <div className="sticky bottom-0 modal-bg border-t px-5 py-4 flex gap-3 justify-end">
                            <button onClick={onClose} className="btn-secondary" disabled={isSaving}>Cancel</button>
                            <button onClick={save} disabled={isSaving} className={clsx('btn-primary min-w-[150px]', !isOut && '!bg-green-700 hover:!bg-green-600')}>
                                {isSaving ? <Loader className="w-4 h-4 animate-spin"/> : `Confirm ${isOut ? 'Load Out' : 'Load In'}`}
                            </button>
                        </div>
                    )}
                </fieldset>
            </div>
        </div>
    );
}

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;
    const pageNumbers = Array.from({length: totalPages}, (_, i) => i + 1);

    return (
        <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="btn-ghost p-2 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            {pageNumbers.map(number => <button key={number} onClick={() => onPageChange(number)} className={clsx('px-3 py-1 text-xs rounded-md', currentPage === number ? 'bg-orange-600 text-white font-bold' : 'btn-ghost')}>{number}</button>)}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn-ghost p-2 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
    );
}

export default function MovementPage() {
  const { isAdmin, isBaseManager } = useAuth();
  const canEdit = isAdmin || isBaseManager;
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ assetNo: '', name: '', type: '', location: '' });
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
    setSelectedAssetIds([]); // Clear selection on full reload
  };

  useEffect(() => { load(); }, []);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTabChange = (newTab) => {
    if (tab === newTab) return;
    setTab(newTab);
  };

  const getProjectDisplay = (asset) => {
      if (!asset) return '';
      const project = projects.find(p => p.id === asset.currentProject);
      if (project) return project.projectNumber || project.name;
      const directData = asset.projectNumber || asset.currentProject;
      if (directData && typeof directData === 'string' && directData.length < 25) return directData;
      return '';
  }

  const assetsAtBase = assets.filter(a => a.status === 'Available' || a.status === 'Damaged' || a.status === 'Under Maintenance' || a.status === 'Standby');
  const assetsInField = assets.filter(a => a.status === 'In Use' || a.status === 'Reserved');

  const assetsForCurrentTab = tab === 'base' ? assetsAtBase : assetsInField;
  const filteredAssets = assetsForCurrentTab.filter(a => {
      return (
        (!filters.assetNo || (a.assetNo || '').toLowerCase().includes(filters.assetNo.toLowerCase())) &&
        (!filters.name || (a.name || '').toLowerCase().includes(filters.name.toLowerCase())) &&
        (!filters.type || (a.category || '').toLowerCase().includes(filters.type.toLowerCase())) &&
        (!filters.location || (a.location || '').toLowerCase().includes(filters.location.toLowerCase()))
      );
    });
  
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredAssets.slice(indexOfFirstItem, indexOfLastItem);

  // On TAB change, reset context: filters, selections, and page.
  useEffect(() => {
    setFilters({ assetNo: '', name: '', type: '', location: '' });
    setSelectedAssetIds([]);
    setCurrentPage(1);
  }, [tab]);

  // On FILTER change, just reset the page number. Keep selections.
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleClearFilters = () => { setFilters({ assetNo: '', name: '', type: '', location: '' }); };
  const isFiltered = Object.values(filters).some(v => v !== '');

  const handleSelectAll = (e) => {
    const visibleIds = currentItems.map(a => a.id);
    if (e.target.checked) {
      // Add all visible items to the selection, avoiding duplicates.
      setSelectedAssetIds(prev => [...new Set([...prev, ...visibleIds])]);
    } else {
      // Remove all visible items from the selection.
      setSelectedAssetIds(prev => prev.filter(id => !visibleIds.includes(id)));
    }
  };

  const handleRowSelect = (id) => {
    setSelectedAssetIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const exportLog = () => {
      const dataToExport = filteredAssets.map(a => ({ 'Asset No': a.assetNo || a.id, 'Asset Name': a.name, Category: a.category, Status: a.status, Location: a.location, 'Project': getProjectDisplay(a) }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Equipment Log");
      XLSX.writeFile(workbook, "EquipmentMovementLog.xlsx");
      toast.success('Exported successfully!');
  };
  
  const isAllVisibleSelected = currentItems.length > 0 && currentItems.every(item => selectedAssetIds.includes(item.id));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-orange-500" />Equipment Movement</h1>
          <p className="text-[var(--t-text3)] text-sm mt-1">Load In/Load Out equipment and update status</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {selectedAssetIds.length > 0 ? (
              <div className="flex items-center gap-2 animate-fade-in">
                  <span className='text-sm text-[var(--t-text3)]'>{selectedAssetIds.length} items selected</span>
                   {tab === 'base' ?
                      <button onClick={() => setModal({ type: 'bulk-out'})} className="btn-primary text-xs"><HardDriveUpload className="w-4 h-4" />Bulk Load Out</button>
                    : <button onClick={() => setModal({ type: 'bulk-in'})} className="btn-secondary text-xs !bg-green-900/30 !text-green-400 !border-green-700/50"><HardDriveDownload className="w-4 h-4" />Bulk Load In</button>
                   }
              </div>
            ) : (
              <div className="flex items-center gap-2">
                  <button onClick={exportLog} className="btn-secondary text-xs"><Download className="w-4 h-4" />Export</button>
                  <button onClick={() => setModal({ type:'in', asset: null })} className="btn-secondary text-xs !bg-green-900/30 !text-green-400 !border-green-700/50"><ArrowLeft className="w-4 h-4" />Load In</button>
                  <button onClick={() => setModal({ type:'out', asset: null })} className="btn-primary text-xs"><ArrowRight className="w-4 h-4" />Load Out</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--t-border)] flex items-center">
            <button 
                onClick={() => handleTabChange('base')} 
                className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-150',
                    tab === 'base' 
                        ? 'text-orange-500 border-orange-500' 
                        : 'text-[var(--t-text3)] border-transparent hover:text-[var(--t-text)]'
                )}
            >
                <Package className="w-4 h-4" /> 
                <span>Equipment at Base</span>
                <span className="bg-[var(--t-bg3)] text-xs font-mono px-1.5 py-0.5 rounded-full">{assetsAtBase.length}</span>
            </button>
            <button 
                onClick={() => handleTabChange('field')} 
                className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-150',
                    tab === 'field' 
                        ? 'text-orange-500 border-orange-500' 
                        : 'text-[var(--t-text3)] border-transparent hover:text-[var(--t-text)]'
                )}
            >
                <Truck className="w-4 h-4" />
                <span>Equipment in Field</span>
                <span className="bg-[var(--t-bg3)] text-xs font-mono px-1.5 py-0.5 rounded-full">{assetsInField.length}</span>
            </button>
        </div>

         <div className="p-4 border-b flex items-center justify-between">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-grow">
            <input name="assetNo" value={filters.assetNo} onChange={handleFilterChange} placeholder="Asset No." className="input-field" />
            <input name="name" value={filters.name} onChange={handleFilterChange} placeholder="Asset Name" className="input-field" />
            <input name="type" value={filters.type} onChange={handleFilterChange} placeholder="Category/Type" className="input-field" />
            <input name="location" value={filters.location} onChange={handleFilterChange} placeholder="Location" className="input-field" />
          </div>
          {isFiltered && <button onClick={handleClearFilters} className="text-xs text-orange-500 hover:underline mt-0 ml-4">Clear Filters</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={handleSelectAll} checked={isAllVisibleSelected} className="mt-1" /></th>
                <th>Asset No</th><th>Asset Name</th><th>Category</th><th>Status</th><th>Location</th><th>Project</th>
                {canEdit && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="text-center py-10 text-[var(--t-text3)]">Loading...</td></tr>
              ) : currentItems.length === 0 ? (
                <tr><td colSpan={canEdit ? 8 : 7} className="text-center py-10 text-[var(--t-text3)]">No items found for current filters</td></tr>
              ) : currentItems.map(asset => {
                  const projectDisplay = getProjectDisplay(asset);
                  const project = projects.find(p => p.projectNumber === projectDisplay || p.name === projectDisplay);
                  return (
                    <tr key={asset.id} className={clsx(selectedAssetIds.includes(asset.id) && 'bg-orange-900/10')}>
                      <td><input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => handleRowSelect(asset.id)} className="mt-1" /></td>
                      <td><span className="font-mono text-xs text-[var(--t-text3)]">{asset.assetNo || asset.id}</span></td>
                      <td><div className="font-medium text-xs text-[var(--t-text)] max-w-[180px] truncate">{asset.name}</div></td>
                      <td><span className="text-xs text-[var(--t-text3)]">{asset.category}</span></td>
                      <td><span className={clsx('badge', asset.status==='Available'?'badge-available':asset.status==='In Use'?'badge-in-use':asset.status==='Damaged'?'badge-damaged':asset.status==='Reserved'?'badge-reserved':'badge-maintenance')}>{asset.status}</span></td>
                      <td><div className="text-xs text-[var(--t-text3)] truncate block max-w-[150px]">{asset.location}</div></td>
                      <td><div className="text-xs text-cyan-400 font-semibold truncate block max-w-[150px]" title={project?.name || projectDisplay}>{projectDisplay}</div></td>
                      {canEdit && (
                        <td>
                          {asset.status === 'In Use' || asset.status === 'Reserved' ? (
                            <button onClick={() => setModal({ type:'in', asset })} className="btn-action-in"><ArrowLeft className="w-3 h-3" />Load In</button>
                          ) : (
                            <button onClick={() => setModal({ type:'out', asset })} className="btn-action-out"><ArrowRight className="w-3 h-3" />Load Out</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t text-xs text-[var(--t-text3)] flex items-center justify-between">
          <span>Showing {indexOfFirstItem + 1}-${Math.min(indexOfLastItem, filteredAssets.length)} of {filteredAssets.length} items</span>
          <Pagination currentPage={currentPage} totalItems={filteredAssets.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
        </div>
      </div>

      {modal && !modal.type?.startsWith('bulk') && (
        <MovementModal type={modal.type} asset={modal.asset} projects={projects} assets={assets} onClose={() => setModal(null)} onSave={load} />
      )}

      {modal && modal.type?.startsWith('bulk') && (
        <BulkMovementModal 
            type={modal.type} 
            selectedAssetIds={selectedAssetIds}
            projects={projects}
            assets={assets}
            onClose={() => setModal(null)} 
            onSave={load} 
        />
      )}

    </div>
  );
}
