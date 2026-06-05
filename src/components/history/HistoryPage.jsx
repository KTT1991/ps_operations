
import React, { useState, useEffect } from 'react';
import { equipmentHistoryService, employeesService, projectsService, assetsService } from '../../services/firebaseService';
import { Clock, Search, Package, Users, Briefcase, ArrowLeft, ExternalLink, ArrowDownCircle, ArrowUpCircle, Edit3, PlusCircle, Info, ArrowRight, MessageSquare } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function HistoryItem({ item }) {
    const ICONS = {
        'Load In': <ArrowDownCircle className="w-5 h-5 text-green-500" />,
        'Load Out': <ArrowUpCircle className="w-5 h-5 text-red-500" />,
        'Movement In': <ArrowDownCircle className="w-5 h-5 text-green-500" />,
        'Movement Out': <ArrowUpCircle className="w-5 h-5 text-red-500" />,
        'Update': <Edit3 className="w-5 h-5 text-blue-500" />,
        'Creation': <PlusCircle className="w-5 h-5 text-purple-500" />,
    };
    const icon = ICONS[item.activityType] || <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />;
    const date = item.timestamp?.toDate ? format(item.timestamp.toDate(), 'dd MMM yyyy, HH:mm') : 'Invalid Date';

    const renderValue = (value) => {
        if (value === null || value === undefined || value === '') return <span className="text-gray-400 dark:text-gray-500 italic">empty</span>;
        return <span className="truncate max-w-[150px]">{String(value)}</span>;
    };

    return (
        <div className="flex gap-4">
            <div>{icon}</div>
            <div className="flex-1 border-l border-gray-200 dark:border-gray-700 pl-4 pb-6 last:border-l-transparent last:pb-0">
                <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800 dark:text-white capitalize">{item.activityType.toLowerCase()}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{date}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">by {item.modifiedBy}</div>
                {item.changes && item.changes.length > 0 && (
                    <div className="mt-2 text-xs space-y-1.5 bg-gray-100 dark:bg-gray-900/50 p-2 rounded-md border border-gray-200 dark:border-gray-700/50">
                        <div className="font-mono text-gray-500 dark:text-gray-400 text-[11px] uppercase">Record Changes:</div>
                        {item.changes.map((change, idx) => (
                            <div key={idx} className="grid grid-cols-[80px_1fr_20px_1fr] items-center gap-2 font-mono">
                                <span className="font-semibold capitalize text-gray-600 dark:text-gray-300 truncate">{change.field}:</span>
                                <div className="text-red-600/80 dark:text-red-400/80 line-through">{renderValue(change.oldValue)}</div>
                                <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                <div className="text-green-700/90 dark:text-green-400/90">{renderValue(change.newValue)}</div>
                            </div>
                        ))}
                    </div>
                )}
                <div className='mt-2 space-y-1 text-xs'>
                    {item.jobCardNo && <div className="flex items-center gap-2 text-gray-500 font-mono"><span className='font-semibold text-gray-400'>Manifest:</span> {item.jobCardNo}</div>}
                    {item.projectId && <div className="flex items-center gap-2 text-gray-500 font-mono"><span className='font-semibold text-gray-400'>Project:</span> {item.projectId}</div>}
                    {item.notes && <div className="flex items-start gap-2 text-gray-500"><MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"/><span className='italic'>{item.notes}</span></div>}
                </div>
            </div>
        </div>
    );
}

function AssetTimelineView({ asset, allHistory, onBack }) {
    const records = allHistory.filter(h => h.refId === asset.id).sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
    
    const statusColors = {
        'Available': 'text-green-600 dark:text-green-400',
        'In Use': 'text-blue-600 dark:text-blue-400',
        'Reserved': 'text-cyan-600 dark:text-cyan-400',
        'Under Maintenance': 'text-amber-600 dark:text-amber-400',
        'Calibration': 'text-purple-600 dark:text-purple-400',
        'Damaged': 'text-red-600 dark:text-red-400',
    };
    const statusColor = statusColors[asset.status] || 'text-gray-500 dark:text-gray-400';

    return (
        <div className="animate-fade-in">
            <div className='flex items-center gap-3 mb-4'><button onClick={onBack} className='btn-secondary p-2'><ArrowLeft className='w-4 h-4'/></button><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Asset Timeline: <span className='text-orange-500'>{asset.name} ({asset.assetNo})</span></h3></div>
            <div className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                    <div className={clsx("font-semibold", statusColor)}>{asset.status || 'N/A'}</div>
                </div>
                <div><div className="text-xs text-gray-500 dark:text-gray-400">Location</div><div className="font-semibold text-gray-800 dark:text-gray-200">{asset.currentLocation || asset.location || 'Depot'}</div></div>
                <div><div className="text-xs text-gray-500 dark:text-gray-400">Project</div><div className="font-semibold text-gray-800 dark:text-gray-200">{asset.projectNo || 'Unassigned'}</div></div>
            </div>
            <div className="relative">
                 {records.length > 0 ? records.map(item => <HistoryItem key={item.id} item={item} />) : <div className="text-center py-10 text-gray-500 dark:text-gray-400">No history records found.</div>}
            </div>
        </div>
    );
}

function ManpowerTimelineView({ employee, onBack }) {
    const schedule = (employee.schedule || []).sort((a, b) => (parseISO(b.startDate) - parseISO(a.startDate)));
     return (
        <div className="animate-fade-in">
            <div className='flex items-center gap-3 mb-4'><button onClick={onBack} className='btn-secondary p-2'><ArrowLeft className='w-4 h-4'/></button><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Work History: <span className='text-orange-500'>{employee.name}</span></h3></div>
            {schedule.length > 0 ? schedule.map((item, idx) => <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 text-sm">{/* ... schedule item rendering ... */}</div>) : <div className="text-center py-10 text-gray-500 dark:text-gray-400">No schedule records found.</div>}
        </div>
    );
}

function ProjectDetailView({ project, manpower, allHistory, allAssets, onBack }) {
    const projectHistory = (allHistory || [])
        .filter(h => h.projectId === project.id)
        .sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));

    const getAssetName = (refNo) => {
        const asset = allAssets.find(a => a.assetNo === refNo || a.id === refNo);
        return asset ? asset.name : refNo;
    };

    const ProjectHistoryItem = ({ item }) => {
        const ICONS = {
            'Load In': <ArrowDownCircle className="w-5 h-5 text-green-500" />,
            'Load Out': <ArrowUpCircle className="w-5 h-5 text-red-500" />,
        };
        const icon = ICONS[item.activityType] || <Edit3 className="w-5 h-5 text-blue-500" />;
        const date = item.timestamp?.toDate ? format(item.timestamp.toDate(), 'dd MMM yyyy, HH:mm') : 'Invalid Date';

        return (
            <div className="flex gap-4">
                <div>{icon}</div>
                <div className="flex-1 border-l border-gray-200 dark:border-gray-700 pl-4 pb-6 last:border-l-transparent last:pb-0">
                    <div className="flex justify-between items-center">
                         <p className="font-semibold text-gray-800 dark:text-white">
                           {item.refNo} - <span className="text-gray-400 dark:text-gray-500 font-normal">{getAssetName(item.refNo)}</span>
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-shrink-0 ml-2">{date}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.activityType} by {item.modifiedBy}</div>
                    {item.notes && <div className="text-xs italic text-gray-500 mt-1 flex gap-2"><MessageSquare className="w-3 h-3 mt-0.5"/>{item.notes}</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className='flex items-center gap-3 mb-4'>
                <button onClick={onBack} className='btn-secondary p-2'><ArrowLeft className='w-4 h-4'/></button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project History: <span className='text-orange-500'>{project.name}</span></h3>
            </div>
            <div className="space-y-8">
                <div>
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">Equipment Movement History</h4>
                    <div className="max-h-[500px] overflow-y-auto pr-2">
                         {projectHistory.length > 0 ? (
                            projectHistory.map(item => <ProjectHistoryItem key={item.id} item={item} />)
                        ) : (
                            <div className="text-center py-10 text-gray-500 dark:text-gray-400">No equipment history found for this project.</div>
                        )}
                    </div>
                </div>
                <div>
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">Currently Assigned Manpower ({manpower.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {manpower.length > 0
                            ? manpower.map(e => <div key={e.id} className="bg-white dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700 text-sm">{e.name}</div>)
                            : <p className="text-sm text-gray-500 dark:text-gray-400 col-span-full">No manpower currently assigned.</p>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}


const ResultsTable = ({ headers, data, onDrillDown, renderRow }) => (
    <div className="overflow-x-auto animate-fade-in"><table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
        <thead className="text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50"><tr>{headers.map((h,i) => <th key={i} scope="col" className="px-4 py-2">{h}</th>)}</tr></thead>
        <tbody>{data.map(item => renderRow({ item, onDrillDown }))}</tbody>
    </table></div>
);

const AssetRow = ({ item, onDrillDown }) => (<tr key={item.id} onClick={() => onDrillDown(item)} className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><td className="px-4 py-2 font-mono">{item.assetNo}</td><td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td><td className="px-4 py-2">{item.type}</td><td className="px-4 py-2"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', item.status === 'Available' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-200')}>{item.status}</span></td><td className="px-4 py-2 text-right"><ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500"/></td></tr>);
const ManpowerRow = ({ item, onDrillDown }) => (<tr key={item.id} onClick={() => onDrillDown(item)} className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td><td className="px-4 py-2">{item.position}</td><td className="px-4 py-2">{item.department}</td><td className="px-4 py-2 text-right"><ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500"/></td></tr>);
const ProjectRow = ({ item, onDrillDown }) => (<tr key={item.id} onClick={() => onDrillDown(item)} className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><td className="px-4 py-2 font-mono">{item.projectNo}</td><td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.name}</td><td className="px-4 py-2">{item.client}</td><td className="px-4 py-2 text-right"><ExternalLink className="w-4 h-4 text-gray-400 dark:text-gray-500"/></td></tr>);

export default function HistoryPage() {
    const [mode, setMode] = useState('asset');
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState(null);
    const [detailView, setDetailView] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSearched, setIsSearched] = useState(false);

    const [allEquipmentHistory, setAllEquipmentHistory] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [allProjects, setAllProjects] = useState([]);
    const [allAssets, setAllAssets] = useState([]);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            const dataResults = await Promise.allSettled([
                equipmentHistoryService.getAll(),
                employeesService.getAll(),
                projectsService.getAll(),
                assetsService.getAll(),
            ]);

            const [equipHist, employees, projects, assets] = dataResults.map(res => res.status === 'fulfilled' ? res.value : []);

            if (dataResults[3].status === 'rejected') toast.error('Asset data failed to load.');

            setAllEquipmentHistory(equipHist);
            setAllEmployees(employees);
            setAllProjects(projects);
            setAllAssets(assets);
            setLoading(false);
        };
        fetchAllData();
    }, []);

    const handleSearch = () => {
        if (!searchTerm.trim()) return;
        setIsSearched(true);
        setDetailView(null);
        const lowerTerm = searchTerm.toLowerCase();
        let searchResult = [];
        if (mode === 'asset') {
            searchResult = allAssets.filter(a => (a.assetNo?.toLowerCase().includes(lowerTerm)) || (a.name?.toLowerCase().includes(lowerTerm)) || (a.type?.toLowerCase().includes(lowerTerm)));
        } else if (mode === 'manpower') {
            searchResult = allEmployees.filter(e => (e.name?.toLowerCase().includes(lowerTerm)) || (e.position?.toLowerCase().includes(lowerTerm)));
        } else if (mode === 'project') {
            searchResult = allProjects.filter(p => (p.projectNo?.toLowerCase().includes(lowerTerm)) || (p.name?.toLowerCase().includes(lowerTerm)) || (p.client?.toLowerCase().includes(lowerTerm)));
        }
        setResults(searchResult);
    };

    const handleDrillDown = (item) => {
        if (mode === 'project') {
            const assignedManpower = allEmployees.filter(e => e.schedule?.some(s => s.projectNo === item.projectNo && s.type === 'Assignment' && (!s.endDate || isAfter(parseISO(s.endDate), new Date()))));
            setDetailView({ type: 'project_detail', item, related: { manpower: assignedManpower, history: allEquipmentHistory, assets: allAssets } });
        } else if (mode === 'manpower') {
            setDetailView({ type: 'manpower_timeline', item });
        } else {
            setDetailView({ type: 'asset_timeline', item });
        }
    };
    
    const handleTabChange = (newMode) => {
        setMode(newMode);
        setSearchTerm('');
        setResults(null);
        setIsSearched(false);
        setDetailView(null);
    }

    const CurrentView = () => {
        if (detailView) {
            if (detailView.type === 'asset_timeline') return <AssetTimelineView asset={detailView.item} allHistory={allEquipmentHistory} onBack={() => setDetailView(null)} />;
            if (detailView.type === 'manpower_timeline') return <ManpowerTimelineView employee={detailView.item} onBack={() => setDetailView(null)} />;
            if (detailView.type === 'project_detail') return <ProjectDetailView project={detailView.item} manpower={detailView.related.manpower} allHistory={detailView.related.history} allAssets={detailView.related.assets} onBack={() => setDetailView(null)} />;
        }
        if (loading) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">Loading resource data...</div>;
        if (!isSearched) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">Enter a search term to explore resources.</div>;
        if (!results || results.length === 0) return <div className="text-center py-20 text-gray-500 dark:text-gray-400">No results found.</div>;

        if (mode === 'asset') return <ResultsTable headers={['Asset No', 'Name', 'Type', 'Status', '']} data={results} onDrillDown={handleDrillDown} renderRow={AssetRow} />;
        if (mode === 'manpower') return <ResultsTable headers={['Name', 'Position', 'Department', '']} data={results} onDrillDown={handleDrillDown} renderRow={ManpowerRow} />;
        if (mode === 'project') return <ResultsTable headers={['Project No', 'Name', 'Client', '']} data={results} onDrillDown={handleDrillDown} renderRow={ProjectRow} />;
        return null;
    };

    const TABS = [{ id: 'asset', label: 'Asset Explorer', icon: Package }, { id: 'manpower', label: 'Manpower History', icon: Users }, { id: 'project', label: 'Project View', icon: Briefcase }];
    const placeholderText = { asset: "Search Asset No, Name, Type...", manpower: "Search Employee Name, Position...", project: "Search Project No, Name, Client..." }[mode];

    return (
        <div className="p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-full text-gray-900 dark:text-white"><div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-200 mb-4">Resource Explorer</h1>
            <div className="bg-white dark:bg-gray-800/70 p-4 rounded-lg border border-gray-200 dark:border-gray-700/50 mb-6">
                <div className="flex border-b border-gray-200 dark:border-gray-700 -mx-4 px-4">
                    {TABS.map(tab => <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={clsx("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors", mode === tab.id ? 'text-orange-500 border-orange-500' : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-white')}><tab.icon className="w-4 h-4"/>{tab.label}</button>)}
                </div>
                <div className="flex items-center gap-2 pt-4">
                    <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" /><input type="text" placeholder={placeholderText} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSearch()} className="input-field pl-9 w-full" /></div>
                    <button onClick={handleSearch} className="btn-primary min-w-[100px]">Search</button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700/50 min-h-[400px]">
                <CurrentView />
            </div>
        </div></div>
    );
}
