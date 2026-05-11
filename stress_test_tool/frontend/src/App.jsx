import React, { useState } from 'react';
import BackendStress from './components/BackendStress';

import StressReport from './components/StressReport';
import { Activity, Zap, FileText } from 'lucide-react';

function App() {
    const [activeTab, setActiveTab] = useState('backend');
    const [reports, setReports] = useState([]);

    const addReport = (report) => {
        setReports(prev => [report, ...prev]);
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                        System Stress Diagnostics
                    </h1>
                    <p className="text-gray-400">Advanced Load Testing & Performance Analysis Tool</p>
                </div>

                {/* Tabs */}
                <div className="flex justify-center gap-4 bg-gray-900/50 p-2 rounded-lg backdrop-blur-sm border border-gray-800 w-fit mx-auto">
                    <button
                        onClick={() => setActiveTab('backend')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md transition-all ${activeTab === 'backend'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        <Activity className="w-4 h-4" />
                        Backend Stress
                    </button>

                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md transition-all ${activeTab === 'reports'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        Reports ({reports.length})
                    </button>
                </div>

                {/* Content Area */}
                <div className="min-h-[600px]">
                    {activeTab === 'backend' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <BackendStress onReport={addReport} />
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <StressReport reports={reports} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
