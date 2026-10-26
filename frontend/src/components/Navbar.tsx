import React from 'react';
import { ApiConnectionStatus, UserRole } from '../types';
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiStatus: ApiConnectionStatus;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  onRefreshHealth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  apiStatus,
  userRole,
  setUserRole,
  onRefreshHealth,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-black/90 backdrop-blur-md sticky top-0 z-50">
      {/* Honesty Banner */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-1.5 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-teal-400 font-medium">
            Seeded demo brand
          </span>
          <span className="hidden sm:inline text-zinc-500">
            Guest demo — data is shared demo data
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span>Demo roles — real accounts are a later phase (Phase 5)</span>
          <div className="inline-flex rounded-md border border-zinc-800 p-0.5 bg-zinc-900">
            <button
              onClick={() => setUserRole('creator')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                userRole === 'creator'
                  ? 'bg-teal-500 text-black font-semibold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Creator
            </button>
            <button
              onClick={() => setUserRole('reviewer')}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                userRole === 'reviewer'
                  ? 'bg-teal-500 text-black font-semibold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Reviewer
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center text-black font-black text-lg group-hover:scale-105 transition-transform">
              BG
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                BrandGate
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-medium -mt-1">
                Pre-Publication Gate
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'home'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'vault'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Brand Vault
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'submit'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Submit
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'report'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Report
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'review'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Review
            </button>
          </nav>
        </div>

        {/* API Status Badge */}
        <div className="flex items-center gap-3">
          <div
            onClick={onRefreshHealth}
            title="Click to re-check API connection"
            className="cursor-pointer flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-colors hover:border-zinc-700"
          >
            {apiStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-teal-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
                API connected
              </span>
            )}
            {apiStatus === 'waking' && (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Waking up server...
              </span>
            )}
            {apiStatus === 'offline' && (
              <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                API offline — local demo mode
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
