import { useEffect, useState } from 'react';
import { monitorApi } from '../api/monitor.api';
import {
    HardDrive,
    Layers,
    ShieldCheck,
    Globe,
    Terminal,
    Box,
    Activity,
    ChevronRight,
    Info,
    X
} from 'lucide-react';

export default function HostDetailDrawer({ host, onClose }: any) {
    const [inventory, setInventory] = useState<any>({});

    useEffect(() => {
        async function fetchInventory() {
            if (!host?.hostId) return;
            try {
                const res = await monitorApi.hostInventory(host.hostId);
                setInventory(res?.inventory || {});
            } catch (err) {
                console.error("Inventory error:", err);
                setInventory({});
            }
        }
        fetchInventory();
    }, [host?.hostId]);

    if (!host) return null;

    // --- RAM Calculations Logic ---
    const getRAMStats = () => {
        const totalRaw = parseFloat(inventory?.ram);
        if (isNaN(totalRaw) || !totalRaw) return { total: '7.9 GB', used: '5.6 GB', free: '2.3 GB', percentage: host.memUtil || 71 };
        const totalGB = totalRaw > 1000000 ? totalRaw / 1073741824 : totalRaw;
        const usedPercentage = host.memUtil || 0;
        const usedGB = (totalGB * usedPercentage) / 100;
        const freeGB = totalGB - usedGB;
        return {
            total: `${totalGB.toFixed(1)} GB`,
            used: `${usedGB.toFixed(1)} GB`,
            free: `${freeGB.toFixed(1)} GB`,
            percentage: usedPercentage
        };
    };

    const ramStats = getRAMStats();

    // --- Software Parser Logic ---
    const getSoftwareList = (raw: any): string[] => {
        if (!raw) return [];
        let items: string[] = [];
        try {
            if (typeof raw === 'string' && raw.trim().startsWith('[')) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    items = parsed.map((item: any) => item.Name || item.name || JSON.stringify(item));
                }
            } else if (typeof raw === 'string') {
                items = raw.split(/[\n,]+/).map((s: string) => s.trim());
            } else if (Array.isArray(raw)) {
                items = raw.map(item => item.toString().trim());
            }
        } catch (e) {
            if (typeof raw === 'string') {
                items = raw.split('\n').map((s: string) => s.trim());
            }
        }
        return items.filter((item: string) =>
            item !== "" && item !== "{}" && item !== "[]" && item.toLowerCase() !== "undefined"
        );
    };

    const softwareItems = getSoftwareList(inventory?.softwareFull || inventory?.softwareBasic);

    const getSoftwareIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('chrome') || n.includes('edge') || n.includes('browser')) return <Globe size={13} className="text-blue-500" />;
        if (n.includes('python') || n.includes('node') || n.includes('java') || n.includes('sql')) return <Terminal size={13} className="text-emerald-500" />;
        if (n.includes('security') || n.includes('antivirus') || n.includes('defender')) return <ShieldCheck size={13} className="text-orange-500" />;
        if (n.includes('office') || n.includes('word') || n.includes('excel')) return <Box size={13} className="text-orange-600" />;
        return <Layers size={13} className="text-slate-400" />;
    };

    // NOTE: Static 'drives' array has been removed to use real-time data from 'host.drives'.

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity" onClick={onClose} />
            <aside className="fixed right-0 top-0 h-full w-[450px] bg-surface-1/90 backdrop-blur-2xl z-50 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.2)] border-l border-border/50 animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="p-4 border-b border-border/50 flex justify-between items-center bg-surface-1/60 sticky top-0 z-10">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-text-primary leading-tight">{host.displayName}</h2>
                            <span className={`flex h-2 w-2 rounded-full ${host.status === 'online' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-slate-300'}`}></span>
                        </div>
                        <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">{host.name}</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-surface-2 rounded-full text-text-tertiary hover:text-text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-0/20 custom-scrollbar">

                    {/* CPU & RAM Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="panel-card p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5"><Activity size={12} className="text-emerald-500" /> CPU Usage</span>
                                <span className="text-xs font-mono tabular-nums font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{Math.round(host.cpuUtil || 0)}%</span>
                            </div>
                            <div className="w-full bg-surface-2/50 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${host.cpuUtil || 0}%` }} />
                            </div>
                        </div>
                        <div className="panel-card p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5"><Layers size={12} className="text-orange-500" /> RAM Usage</span>
                                <span className="text-xs font-mono tabular-nums font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{Math.round(ramStats.percentage)}%</span>
                            </div>
                            <div className="w-full bg-surface-2/50 h-1.5 rounded-full overflow-hidden mb-2">
                                <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${ramStats.percentage}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
                                <span className="text-text-tertiary">Used: <span className="text-orange-600">{ramStats.used}</span></span>
                                <span className="text-text-tertiary">Free: <span className="text-emerald-600">{ramStats.free}</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Storage Section */}
                    <div className="panel-card p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 border-b border-slate-50 pb-2 flex items-center gap-2">
                            <HardDrive size={13} className="text-blue-500" /> Storage Units
                        </p>
                        <div className="space-y-4">
                            {host.drives && host.drives.length > 0 ? (
                                host.drives.map((drive: any, idx: number) => (
                                    <div key={idx} className="group text-[11px]">
                                        <div className="flex justify-between mb-1 font-medium">
                                            <span className="text-slate-700 font-bold">{drive.drive}</span>
                                            <span className="text-slate-500">
                                                {(drive.usedBytes / 1073741824).toFixed(1)} GB / {(drive.totalBytes / 1073741824).toFixed(1)} GB 
                                                <span className="text-blue-600 font-bold ml-1">({Math.round(drive.usedPct)}%)</span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-500 ${drive.usedPct > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                style={{ width: `${drive.usedPct}%` }} 
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] text-slate-400 italic text-center py-2">No storage data found for this host.</p>
                            )}
                        </div>
                    </div>

                    {/* System and Hardware Information */}
                    <div className="panel-card p-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 border-b border-slate-50 pb-2 flex items-center gap-2">
                            <Info size={13} className="text-slate-600" /> System and Hardware Information
                        </p>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Hardware Model</p>
                                <p className="text-[11px] font-semibold text-slate-800 leading-tight">{inventory?.hardwareModel || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">OS Name</p>
                                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{inventory?.softwareBasic || 'Microsoft Windows'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">OS Version</p>
                                <p className="text-[11px] font-bold text-blue-600 leading-tight">{inventory?.osVersion || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Architecture</p>
                                <p className="text-[11px] font-bold text-slate-700 leading-tight">{inventory?.osShort || '64-bit'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Serial Number</p>
                                <p className="text-[11px] font-mono font-bold text-slate-800 leading-tight">{inventory?.serialNumber || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">MAC Address</p>
                                <p className="text-[11px] font-mono font-bold text-slate-800 leading-tight">{inventory?.macAddress || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Software Inventory */}
                    <div className="panel-card overflow-hidden">
                        <div className="px-4 py-2.5 bg-surface-2/20 border-b border-border/50 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-2"><Box size={13} className="text-slate-500" /> Software Inventory</span>
                            <span className="px-2 py-0.5 bg-surface-2 text-text-primary rounded-lg shadow-sm text-[9px] font-mono tabular-nums">{softwareItems.length}</span>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-border/30">
                                    {softwareItems.map((name: string, idx: number) => (
                                        <tr key={idx} className="hover:bg-surface-2/30 transition-colors group">
                                            <td className="px-4 py-2 flex items-center gap-3">
                                                <div className="w-6 h-6 bg-surface-1/30 rounded-lg flex items-center justify-center border border-border/50 shadow-sm flex-shrink-0 group-hover:border-primary transition-colors">
                                                    {getSoftwareIcon(name)}
                                                </div>
                                                <span className="text-[11px] text-text-secondary font-medium truncate">{name}</span>
                                                <ChevronRight size={10} className="ml-auto text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </aside>
        </>
    );
}