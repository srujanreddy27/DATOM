import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Square, Zap, Server, Activity, AlertTriangle, CloudLightning, Database, Globe } from "lucide-react";

// Helper to keep track of request stats
const useStats = () => {
    const [stats, setStats] = useState({
        sent: 0,
        success: 0,
        failed: 0,
        latency: [],
        avgLatency: 0,
        rps: 0
    });
    return [stats, setStats];
};

const BackendStress = ({ onReport }) => {
    const [targetUrl, setTargetUrl] = useState('http://localhost:8000/api/tasks');
    const [concurrency, setConcurrency] = useState(10);
    const [duration, setDuration] = useState(10); // seconds
    const [isRunning, setIsRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [stats, setStats] = useStats();

    const abortControllerRef = useRef(null);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(0);
    const requestCountRef = useRef(0);

    const presets = [
        { label: "Fetch Tasks (GET)", url: "http://localhost:8000/api/tasks" },
        { label: "Fetch Users (GET)", url: "http://localhost:8000/api/users" },
        { label: "Blockchain Config (GET)", url: "http://localhost:8000/api/blockchain/config" },
        { label: "Home Tasks (GET)", url: "http://localhost:8000/api/tasks?limit=6" }
    ];

    const calculateRPS = () => {
        if (!startTimeRef.current) return 0;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        return elapsed > 0 ? (requestCountRef.current / elapsed).toFixed(1) : 0;
    };

    const runTest = async () => {
        setIsRunning(true);
        setStats({
            sent: 0,
            success: 0,
            failed: 0,
            latency: [],
            avgLatency: 0,
            rps: 0
        });
        setTimeLeft(duration);
        startTimeRef.current = Date.now();
        requestCountRef.current = 0;

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Timer for duration
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                const elapsed = (Date.now() - startTimeRef.current) / 1000;
                setStats(prevStats => ({
                    ...prevStats,
                    rps: elapsed > 0 ? (requestCountRef.current / elapsed).toFixed(1) : 0
                }));

                if (prev <= 1) {
                    stopTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Worker function for requests
        const worker = async () => {
            while (!signal.aborted) {
                const start = performance.now();
                try {
                    requestCountRef.current++;
                    setStats(prev => ({ ...prev, sent: prev.sent + 1 }));

                    // Simple GET request to the target
                    await axios.get(targetUrl, { signal });

                    const end = performance.now();
                    const latency = end - start;

                    setStats(prev => {
                        const newLatencies = [...prev.latency, latency].slice(-50); // Keep last 50 for avg
                        const avg = newLatencies.reduce((a, b) => a + b, 0) / newLatencies.length;
                        return {
                            ...prev,
                            success: prev.success + 1,
                            latency: newLatencies,
                            avgLatency: avg.toFixed(2)
                        };
                    });
                } catch (error) {
                    if (axios.isCancel(error) || error.name === 'CanceledError') break;
                    setStats(prev => ({ ...prev, failed: prev.failed + 1 }));

                    // Small delay on error to prevent infinite tight loops if server is down
                    await new Promise(r => setTimeout(r, 100));
                }
            }
        };

        // Spawn workers
        const workers = Array(Number(concurrency)).fill(0).map(() => worker());

        try {
            await Promise.all(workers);
        } catch (e) {
            // Ignore
        }
    };

    const stopTest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setIsRunning(false);

        // Generate report
        if (onReport) {
            onReport({
                type: 'Backend Stress',
                timestamp: new Date().toISOString(),
                metrics: {
                    endpoint: targetUrl,
                    totalRequests: requestCountRef.current,
                    successful: stats.success,
                    failed: stats.failed,
                    avgLatency: stats.avgLatency,
                    rps: stats.rps || calculateRPS(),
                    settings: { concurrency, duration }
                }
            });
        }
    };

    useEffect(() => {
        return () => stopTest();
    }, []);

    return (
        <div className="bg-gray-900 border border-cyan-500/20 rounded-xl overflow-hidden relative shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

            <div className="p-6 border-b border-gray-800 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <CloudLightning className="w-6 h-6 text-cyan-400" />
                    <div>
                        <h2 className="text-xl font-bold text-white">API Load Generator</h2>
                        <p className="text-sm text-cyan-400/60">Stress Test Existing Endpoints</p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${isRunning ? 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                    {isRunning ? 'ATTACKING' : 'IDLE'}
                </div>
            </div>

            <div className="p-6 space-y-8 relative z-10">
                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Target Endpoint</label>
                            <div className="flex gap-2">
                                <input
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    className="flex-1 bg-gray-950/50 border border-gray-700 rounded-md px-3 py-2 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                                    disabled={isRunning}
                                />
                            </div>
                            {/* Presets */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => setTargetUrl(preset.url)}
                                        disabled={isRunning}
                                        className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-cyan-400 border border-gray-700 transition-colors"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase">Concurrency</label>
                                <input
                                    type="number"
                                    value={concurrency}
                                    onChange={(e) => setConcurrency(e.target.value)}
                                    className="w-full bg-gray-950/50 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                    disabled={isRunning}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase">Duration (s)</label>
                                <input
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    className="w-full bg-gray-950/50 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                    disabled={isRunning}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <StatsCard label="RPS" value={stats.rps} icon={Zap} color="text-yellow-400" bg="bg-yellow-400/10" border="border-yellow-400/20" />
                        <StatsCard label="Avg Latency" value={`${stats.avgLatency}ms`} icon={Activity} color="text-cyan-400" bg="bg-cyan-400/10" border="border-cyan-400/20" />
                        <StatsCard label="Success" value={stats.success} icon={Server} color="text-green-400" bg="bg-green-400/10" border="border-green-400/20" />
                        <StatsCard label="Failed" value={stats.failed} icon={AlertTriangle} color="text-red-400" bg="bg-red-400/10" border="border-red-400/20" />
                    </div>
                </div>

                {/* Visualizer */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Latency Visualization</span>
                        <span>Live Stream</span>
                    </div>
                    <div className="h-32 bg-gray-950 rounded-lg border border-gray-800 flex items-end justify-center gap-[2px] p-4 overflow-hidden shadow-inner">
                        {stats.latency.length > 0 ? stats.latency.map((lat, i) => (
                            <div
                                key={i}
                                className="w-2 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all duration-300 hover:opacity-100 opacity-80"
                                style={{ height: `${Math.min((lat / 1000) * 100, 100)}%` }}
                            />
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-700 space-y-2">
                                <Activity className="w-8 h-8 opacity-20" />
                                <span className="text-xs">Waiting for data stream...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Button */}
                <div>
                    {!isRunning ? (
                        <button
                            onClick={runTest}
                            className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-4 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2 group"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            START API STRESS TEST
                        </button>
                    ) : (
                        <button
                            onClick={stopTest}
                            className="w-full bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500 text-red-500 font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Square className="w-5 h-5 fill-current" />
                            STOP TEST ({timeLeft}s)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatsCard = ({ label, value, icon: Icon, color, bg, border }) => (
    <div className={`${bg} ${border} border p-4 rounded-lg flex flex-col items-center justify-center transition-all hover:scale-[1.02]`}>
        <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${color} opacity-80`}>{label}</span>
        </div>
        <span className={`text-2xl font-mono font-bold ${color}`}>{value}</span>
    </div>
);

export default BackendStress;
