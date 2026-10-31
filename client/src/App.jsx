import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setHealthData, setHealthError } from './store/slices/systemSlice.js';
import api from './services/api.js';
import {
  ShieldCheck,
  Database,
  Server,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Terminal,
  RefreshCw,
  Users,
  Code2,
  Boxes,
  Zap,
} from 'lucide-react';

export default function App() {
  const dispatch = useDispatch();
  const systemState = useSelector((state) => state.system);
  const [isPinging, setIsPinging] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [healthDetails, setHealthDetails] = useState(null);

  const fetchHealth = async () => {
    setIsPinging(true);
    try {
      const response = await api.get('/health');
      if (response && response.data) {
        setHealthDetails(response.data);
        setServerStatus('online');
        dispatch(setHealthData(response.data));
      } else {
        setServerStatus('offline');
        dispatch(setHealthError('Invalid response'));
      }
    } catch (err) {
      setServerStatus('offline');
      setHealthDetails(null);
      dispatch(setHealthError(err.message || 'Cannot connect to backend'));
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen text-slate-100 p-6 md:p-12 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-10">
        {/* Top Header / Brand */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              Phase 1 Completed: Project Initialization & Environment Setup
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              ExamSphere
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              Cloud-Based Online Examination & Assessment Platform built with enterprise-grade modular monolith architecture.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchHealth}
              disabled={isPinging}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-sm font-medium shadow-lg shadow-blue-600/25 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
              Test API Health
            </button>
          </div>
        </header>

        {/* Live System Diagnostics Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
              <Activity className="w-5 h-5 text-blue-400" />
              Stack & Service Diagnostics
            </h2>
            <span className="text-xs text-slate-500">
              Auto-monitored via REST API health probes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Frontend Card */}
            <div className="glass-panel p-5 rounded-xl space-y-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Running
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Frontend Client</h3>
                <p className="text-xs text-slate-400 mt-1">React 19 + Vite 8 + Tailwind CSS</p>
              </div>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                <span>Redux Toolkit + Router</span>
                <span className="text-slate-300 font-mono">Port 5173</span>
              </div>
            </div>

            {/* Backend API Card */}
            <div className="glass-panel p-5 rounded-xl space-y-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Server className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    serverStatus === 'online'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {serverStatus === 'online' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Listening
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Ready to Launch
                    </>
                  )}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Express API</h3>
                <p className="text-xs text-slate-400 mt-1">Node.js + REST API + Zod</p>
              </div>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                <span>Centralized Error Pipeline</span>
                <span className="text-slate-300 font-mono">Port 5000</span>
              </div>
            </div>

            {/* Database Card */}
            <div className="glass-panel p-5 rounded-xl space-y-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Database className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    healthDetails?.checks?.database?.status === 'healthy'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}
                >
                  {healthDetails?.checks?.database?.status === 'healthy' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5" />
                      Prisma Configured
                    </>
                  )}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">PostgreSQL</h3>
                <p className="text-xs text-slate-400 mt-1">Prisma ORM (Schema Generated)</p>
              </div>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                <span>Docker Engine / Native</span>
                <span className="text-slate-300 font-mono">Port 5432</span>
              </div>
            </div>

            {/* Redis & BullMQ Card */}
            <div className="glass-panel p-5 rounded-xl space-y-3 hover:border-slate-700 transition">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                    healthDetails?.checks?.redis?.status === 'healthy'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}
                >
                  {healthDetails?.checks?.redis?.status === 'healthy' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5" />
                      ioredis Ready
                    </>
                  )}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Redis & BullMQ</h3>
                <p className="text-xs text-slate-400 mt-1">Caching & Background Queues</p>
              </div>
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
                <span>ioredis Lazy Client</span>
                <span className="text-slate-300 font-mono">Port 6379</span>
              </div>
            </div>
          </div>
        </section>

        {/* Roles and Architecture Overview */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Roles Card */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-slate-200">
              <Users className="w-5 h-5 text-indigo-400" />
              Role-Based Access Control (RBAC)
            </h3>
            <p className="text-xs text-slate-400">
              Enforced with RBAC middleware and JWT claims across all endpoints.
            </p>
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-sm font-medium text-slate-200">ADMIN</span>
                </div>
                <span className="text-xs text-slate-400">System Management & Audits</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span className="text-sm font-medium text-slate-200">FACULTY</span>
                </div>
                <span className="text-xs text-slate-400">Exam Authoring & Grading</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-sm font-medium text-slate-200">STUDENT</span>
                </div>
                <span className="text-xs text-slate-400">Timed Exam Attempts & Results</span>
              </div>
            </div>
          </div>

          {/* Architecture Card */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-slate-200">
              <Boxes className="w-5 h-5 text-blue-400" />
              Modular Monolith Structure
            </h3>
            <p className="text-xs text-slate-400">
              Strict separation of concerns using Service & Repository patterns.
            </p>
            <ul className="space-y-2 text-xs text-slate-300 pt-2">
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Controllers delegate to isolated Services</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Repositories abstract Prisma DB operations</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zod request validation schema middleware</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Centralized operational error formatting</span>
              </li>
            </ul>
          </div>

          {/* Quick Start Commands Card */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-slate-200">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Dev Environment Commands
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                <span className="text-slate-500"># Start Postgres & Redis</span>
                <p className="text-blue-400">docker compose up -d</p>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                <span className="text-slate-500"># Verify DB & Redis</span>
                <p className="text-indigo-400">npm --prefix server run test:db</p>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                <span className="text-slate-500"># Run Server Dev</span>
                <p className="text-emerald-400">npm --prefix server run dev</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-800/60">
          ExamSphere Assessment Platform • Phase 1 Environment Verified • Ready for Phase 2 (Authentication & RBAC)
        </footer>
      </div>
    </div>
  );
}
