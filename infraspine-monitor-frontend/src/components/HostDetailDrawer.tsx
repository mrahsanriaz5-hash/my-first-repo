import { useEffect, useState } from 'react';
import { monitorApi } from '../api/monitor.api';
import {
    HardDrive, Layers, Globe, Box, Activity, X, Laptop, Monitor,
    Cpu, Hash, Binary, Zap, ShieldCheck, Database, Info, Terminal, Server
} from 'lucide-react';

interface Drive {
    drive: string;
    totalBytes: number;
    usedBytes: number;
    usedPct: number;
}

interface HostDetailDrawerProps {
    host: any;
    onClose: () => void;
}

const scrollbarStyles = `
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
`;

export default function HostDetailDrawer({ host, onClose }: HostDetailDrawerProps) {
    const [inventory, setInventory] = useState<any>({});

    useEffect(() => {
        async function fetchInventory() {
            if (!host?.hostId) return;
            try {
                const res = await monitorApi.hostInventory(host.hostId);
                setInventory(res?.inventory || {});
            } catch (err) {
                console.error("Fetch Error:", err);
                setInventory({});
            }
        }
        fetchInventory();
    }, [host?.hostId]);

    if (!host) return null;

    const getRAMStats = () => {
        const totalRaw = parseFloat(inventory?.ram);
        if (isNaN(totalRaw) || !totalRaw) return { total: 'N/A', used: 'N/A', free: 'N/A' };
        const totalGB = totalRaw / 1073741824; 
        const usedGB = (totalGB * (host.memUtil || 0)) / 100;
        const freeGB = totalGB - usedGB;
        return { 
            total: `${totalGB.toFixed(1)} GB`, 
            used: `${usedGB.toFixed(1)} GB`,
            free: `${freeGB.toFixed(1)} GB`
        };
    };

    const ramStats = getRAMStats();

    const formatBytes = (bytes: number) => {
        if (!bytes) return '0 GB';
        return (bytes / (1024 ** 3)).toFixed(1) + ' GB';
    };

    const getSoftwareList = (raw: any): string[] => {
        if (!raw) return [];
        let items: string[] = [];
        try {
            if (typeof raw === 'string' && raw.trim().startsWith('[')) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) items = parsed.map((item: any) => item.Name || item.name);
            } else if (typeof raw === 'string') {
                items = raw.split(/[\n,;]+/).map((s: string) => s.trim());
            }
        } catch (e) { items = []; }
        return items.filter(i => i && i !== "{}" && i !== "undefined");
    };

    const softwareItems = [
        ...getSoftwareList(inventory?.softwareBasic),
        ...getSoftwareList(inventory?.softwareFull),
        ...getSoftwareList(inventory?.softwareA),
        ...getSoftwareList(inventory?.softwareB),
        ...getSoftwareList(inventory?.softwareC),
        ...getSoftwareList(inventory?.softwareD),
        ...getSoftwareList(inventory?.softwareE)
    ].filter((v, i, a) => a.indexOf(v) === i);

    const getSoftwareIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('chrome') || n.includes('edge') || n.includes('browser') || n.includes('mozilla') || n.includes('firefox')) return <Globe size={14} className="text-blue-500" />;
        if (n.includes('python') || n.includes('node') || n.includes('java') || n.includes('sql') || n.includes('visual studio') || n.includes('studio') || n.includes('c++')) return <Terminal size={14} className="text-emerald-500" />;
        if (n.includes('security') || n.includes('antivirus') || n.includes('defender') || n.includes('zabbix')) return <ShieldCheck size={14} className="text-rose-500" />;
        if (n.includes('office') || n.includes('word') || n.includes('excel') || n.includes('powerpoint')) return <Box size={14} className="text-orange-600" />;
        if (n.includes('vmware') || n.includes('virtualbox') || n.includes('hyper-v') || n.includes('docker')) return <Server size={14} className="text-fuchsia-500" />;
        return <Layers size={14} className="text-tertiary" />;
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] transition-opacity duration-300" onClick={onClose} />
            <aside className="fixed right-0 top-0 h-full w-[480px] bg-surface-1/90 backdrop-blur-2xl dark:bg-slate-950/90 z-[70] flex flex-col shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.3)] border-l border-border/50 animate-in slide-in-from-right duration-300">

                <div className="px-6 py-4 border-b border-border/50 bg-surface-1/50 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl shadow-inner ${host.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}><Monitor size={20} /></div>
                        <div>
                            <h2 className="text-lg font-bold text-text-primary leading-tight">{host.displayName || 'Unnamed Host'}</h2>
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.15em] mt-1 flex items-center gap-1.5">
                                {host.status === 'online' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> :
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                                {host.status === 'online' ? 'Connected' : 'Offline'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl text-text-tertiary hover:text-text-primary transition-colors"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
                    {/* UPDATED PERFORMANCE TILES */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="panel-card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">CPU Load</span>
                                <Activity size={14} className="text-emerald-500" />
                            </div>
                            <p className="text-xl font-black text-text-primary">{Math.round(host.cpuUtil || 0)}%</p>
                            <div className="w-full bg-surface-2 h-1.5 rounded-full mt-3 overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 transition-all duration-700" style={{width: `${host.cpuUtil}%`}}/></div>
                        </div>
                        <div className="panel-card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Memory</span>
                                <Layers size={14} className="text-blue-500" />
                            </div>
                            <p className="text-xl font-black text-text-primary">{ramStats.total}</p>
                            <div className="w-full bg-surface-2 h-1.5 rounded-full mt-3 mb-2 overflow-hidden shadow-inner"><div className="h-full bg-blue-500 transition-all duration-700" style={{width: `${host.memUtil || 0}%`}}/></div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[9px] font-bold text-text-tertiary">Used: {ramStats.used}</span>
                                <span className="text-[9px] font-bold text-blue-500">Free: {ramStats.free}</span>
                            </div>
                        </div>
                    </div>

                    {/* STORAGE SECTION */}
                    <div className="panel-card p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-3"><HardDrive size={14} className="text-primary" /><span className="text-[11px] font-bold text-text-primary uppercase tracking-widest">Storage Units</span></div>
                        {host.drives?.length ? host.drives.map((drive: Drive, idx: number) => (
                            <div key={idx} className="space-y-1.5 group">
                                <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-text-secondary flex items-center gap-2"><Database size={11} className="text-text-tertiary"/> {drive.drive}</span>
                                    <span className={drive.usedPct > 85 ? 'text-red-500' : 'text-blue-500'}>{drive.usedPct}% Used</span>
                                </div>
                                <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-700 ${drive.usedPct > 85 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${drive.usedPct}%` }} /></div>
                                <div className="flex justify-between text-[9px] font-bold text-text-tertiary px-0.5 tracking-wider"><span>Total: {formatBytes(drive.totalBytes)}</span><span>Free: {formatBytes(drive.totalBytes - drive.usedBytes)}</span></div>
                            </div>
                        )) : <p className="text-xs text-text-tertiary italic">No storage data available.</p>}
                    </div>

                    {/* IP ADDRESS CARD */}
                    <div className="panel-card p-4 flex items-center justify-between hover:border-[var(--accent)] transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300"><Globe size={18} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest leading-none mb-1.5">Network Interface</p>
                                <p className="text-[14px] font-mono font-bold text-text-primary">{inventory?.ipAddress || host.ip || '0.0.0.0'}</p>
                            </div>
                        </div>
                    </div>

                    {/* ENVIRONMENT */}
                    <div className="panel-card p-5 space-y-4 flex flex-col items-start relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><ShieldCheck size={100} /></div>
                        <div className="flex items-center gap-2 border-b border-border/50 pb-3 w-full"><ShieldCheck size={14} className="text-emerald-500" /><span className="text-[11px] font-bold text-text-primary uppercase tracking-widest">OS Environment</span></div>
                        <div className="flex items-start gap-4 z-10">
                            <div className="p-2.5 bg-surface-2/50 rounded-xl text-text-secondary shadow-inner"><Info size={16} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest leading-none mb-1.5">Operating System</p>
                                <p className="text-[14px] font-black text-text-primary leading-tight mb-1">{inventory?.osName || 'Microsoft Windows Server'}</p>
                                <p className="text-[11px] font-bold text-text-secondary font-mono bg-surface-2/50 inline-block px-1.5 py-0.5 rounded shadow-sm border border-border/30">{inventory?.osVersion || 'N/A'} • {inventory?.architecture || 'x64'}</p>
                            </div>
                        </div>
                    </div>

                    {/* HARDWARE */}
                    <div className="panel-card p-5 space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-3"><Laptop size={14} className="text-primary" /><h3 className="text-[11px] font-bold text-text-primary uppercase tracking-widest">Hardware Specifications</h3></div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3"><Zap size={14} className="text-blue-500" /><div><p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-0.5">Vendor & Model</p><p className="text-[13px] font-bold text-text-primary shadow-sm">{inventory?.hardwareManufacturer || 'VMware'} {inventory?.hardwareModel || 'Virtual Platform'}</p></div></div>
                            <div className="flex items-center gap-3"><Cpu size={14} className="text-emerald-500" /><div><p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-0.5">Processor</p><p className="text-[12px] font-bold text-text-secondary leading-tight max-w-[340px] truncate">{inventory?.processor || 'Intel(R) Xeon(R) CPU E5-2600 v4 @ 2.40GHz'}</p></div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                            <div className="flex items-center gap-2"><Hash size={13} className="text-text-tertiary" /><div><p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-0.5">Serial No</p><p className="text-[11px] font-mono font-bold text-text-secondary uppercase">{inventory?.serialNumber || 'N/A'}</p></div></div>
                            <div className="flex items-center gap-2"><Binary size={13} className="text-text-tertiary" /><div><p className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-0.5">MAC Address</p><p className="text-[11px] font-mono font-bold text-text-secondary uppercase">{inventory?.macAddress || 'N/A'}</p></div></div>
                        </div>
                    </div>

                    {/* APPS LIST */}
                    <div className="panel-card overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b border-border/50 bg-surface-2/30 flex justify-between items-center"><div className="flex items-center gap-2.5"><Box size={14} className="text-fuchsia-500" /><span className="text-[11px] font-bold text-text-primary uppercase tracking-widest drop-shadow-sm">Installed Software</span></div><span className="px-2.5 py-0.5 bg-fuchsia-600 text-white rounded-full text-[10px] font-bold shadow-lg shadow-fuchsia-500/20">{softwareItems.length}</span></div>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-border/30">
                            {softwareItems.length > 0 ? softwareItems.map((name, idx) => (
                                <div key={idx} className="px-5 py-3 flex items-center gap-4 hover:bg-surface-2/50 transition-colors group">
                                    <div className="p-1.5 bg-surface-1 rounded-lg border border-border/50 shadow-sm group-hover:scale-110 group-hover:border-primary transition-all">
                                        {getSoftwareIcon(name)}
                                    </div>
                                    <p className="text-[11px] font-bold text-text-secondary group-hover:text-text-primary transition-colors pr-2 leading-snug break-words">{name}</p>
                                </div>
                            )) : (
                                <div className="px-5 py-6 text-center text-text-tertiary text-xs italic">No installed software detected.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-3 border-t border-border/50 bg-surface-1/50 backdrop-blur-sm flex items-center justify-between mt-auto z-10">
                    <div className="flex items-center gap-2.5"><div className="h-1.5 w-1.5 rounded-full bg-[var(--color-online)] animate-pulse shadow-[0_0_8px_var(--color-online)]" /><span className="text-[9px] font-bold text-text-primary uppercase tracking-[0.15em] drop-shadow-sm">{host.status === 'online' ? 'Active Monitoring Core' : 'Monitoring Cached'}</span></div>
                    <span className="text-[10px] font-mono font-bold text-text-tertiary tracking-wider px-1.5 py-0.5 border border-border/50 rounded bg-surface-2/50">ID: {host.hostId?.slice(-6) || 'UNKNOWN'}</span>
                </div>
            </aside>
        </>
    );
}