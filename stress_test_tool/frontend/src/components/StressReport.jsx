import React from 'react';
import { FileText, Check, AlertTriangle, Clock, Server, Monitor } from 'lucide-react';

const StressReport = ({ reports }) => {
    if (!reports || reports.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800 border-dashed">
                <FileText className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No Reports Generated</h3>
                <p className="text-gray-500">Run a stress test to see results here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reports.map((report, index) => (
                <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-all shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${report.type.includes('Backend') ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                {report.type.includes('Backend') ? <Server className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">{report.type}</h3>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(report.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div className="text-xs font-mono text-gray-500 bg-gray-950 px-2 py-1 rounded">
                            ID: {String(Math.random()).slice(2, 8)}
                        </div>
                    </div>

                    <div className="bg-gray-950/50 rounded-lg p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(report.metrics).map(([key, value]) => {
                            if (key === 'settings') return null;
                            if (typeof value === 'object') return null;
                            return (
                                <div key={key}>
                                    <span className="text-xs text-gray-500 uppercase block mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span className="text-lg font-mono font-bold text-white max-w-[100%] truncate block" title={value}>
                                        {value}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StressReport;
