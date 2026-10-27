import React, { useState } from 'react';
import { ApiConnectionStatus, UserRole } from '../types';
import { AuthModal } from './AuthModal';
import { AlertCircle, RefreshCw, LogIn, LogOut, User, Menu, X } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  apiStatus: ApiConnectionStatus;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currentUserEmail: string | null;
  onSignOut: () => void;
  onRefreshHealth: () => void;
  wakingElapsed?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  apiStatus,
  userRole,
  setUserRole,
  currentUserEmail,
  onSignOut,
  onRefreshHealth,
  wakingElapsed,
}) => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-zinc-800 bg-black/90 backdrop-blur-md sticky top-0 z-50">
      {/* Honesty Banner */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-4 py-1.5 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-teal-400 font-medium">
            Seeded demo brand
          </span>
          <span className="hidden sm:inline text-zinc-500">
            {currentUserEmail ? `Account: ${currentUserEmail}` : 'Guest demo — data is shared demo data'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="hidden sm:inline">
            {currentUserEmail ? 'Role:' : 'Demo Persona (Guest):'}
          </span>
          <div className="inline-flex rounded-md border border-zinc-800 p-0.5 bg-zinc-900">
            <button
              onClick={() => setUserRole('creator')}
              className={`px-2 py-0.5 text-xs rounded transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                userRole === 'creator'
                  ? 'bg-teal-500 text-black font-semibold shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Creator
            </button>
            <button
              onClick={() => setUserRole('reviewer')}
              className={`px-2 py-0.5 text-xs rounded transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
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
        <div className="flex items-center gap-4 sm:gap-8">
          {/* Mobile menu toggle for 375px screens (Blocker 7) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div
            onClick={() => {
              setActiveTab('home');
              setMobileMenuOpen(false);
            }}
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
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'home'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'vault'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Brand Vault
            </button>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'submit'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Submit
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'report'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Report
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'review'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === 'insights'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Insights
            </button>
          </nav>
        </div>


        {/* Right Header Elements */}
        <div className="flex flex-wrap items-center gap-2">
          {/* API Health */}
          <div
            title="API Connection Status"
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border bg-zinc-950 border-zinc-800 transition-colors"
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
                {wakingElapsed !== undefined && wakingElapsed > 0
                  ? `Waking up server... ${wakingElapsed}s elapsed, retrying...`
                  : 'Waking up server... please wait, retrying...'}
              </span>
            )}
            {apiStatus === 'blocked_by_client' && (
              <span className="flex items-center gap-1.5 text-red-400 font-medium max-w-xs sm:max-w-md truncate">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Connection blocked by browser extension — disable ad blocker / Brave Shield for this site, then click Retry
              </span>
            )}
            {apiStatus === 'cors_error' && (
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Connection blocked (CORS) — check FRONTEND_URL in Render
              </span>
            )}
            {apiStatus === 'offline' && (
              <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                API offline — local demo mode
              </span>
            )}
          </div>

          {/* Retry Connection Button */}
          {apiStatus !== 'connected' && (
            <button
              onClick={onRefreshHealth}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-black transition-all shadow-md active:scale-95"
              title="Re-run health check immediately"
            >
              <RefreshCw className="h-3 w-3" />
              Retry connection
            </button>
          )}

          {/* User Auth Buttons */}

          {currentUserEmail ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                <User className="h-3 w-3 text-teal-400" />
                {currentUserEmail.split('@')[0]}
              </span>
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-white font-medium transition-colors"
            >
              <LogIn className="h-3 w-3 text-teal-400" />
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation Drawer (Blocker 7 for 375px screens) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-black/95 px-4 pt-2 pb-4 space-y-1">
          {[
            { id: 'home', label: 'Home' },
            { id: 'vault', label: 'Brand Vault' },
            { id: 'submit', label: 'Submit' },
            { id: 'report', label: 'Report' },
            { id: 'review', label: 'Review' },
            { id: 'insights', label: 'Insights' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none ${
                activeTab === item.id
                  ? 'bg-zinc-800 text-teal-400 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={() => setAuthModalOpen(false)}
      />
    </header>
  );
};
