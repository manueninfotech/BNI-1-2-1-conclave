import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  Award,
  CalendarRange,
  BarChart3,
  Activity,
  TrendingUp,
  SlidersHorizontal,
  Play,
  LogOut,
  X,
  ChevronDown,
  Settings as SettingsIcon
} from 'lucide-react';

import { api } from '../services/api';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'conclaves', label: 'Conclaves', Icon: CalendarRange },
  { id: 'schedule-gen', label: 'Schedule Generation', Icon: TrendingUp },
  { id: 'schedule-review', label: 'Schedule Review', Icon: SlidersHorizontal },
  { id: 'round-runner', label: 'Round Runner', Icon: Play },
  { id: 'active-users', label: 'Active Users', Icon: Activity },
  { id: 'members', label: 'Members', Icon: Users },
  { id: 'captains', label: 'Captains', Icon: Award },
  { id: 'business-types', label: 'Business Types', Icon: Layers },
  { id: 'reports', label: 'Reports', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

const getStatusDot = (status) => {
  switch (status) {
    case 'Running': return 'bg-emerald-500 animate-pulse';
    case 'Upcoming': return 'bg-amber-400';
    case 'Completed': return 'bg-zinc-300';
    default: return 'bg-zinc-200';
  }
};

export default function Sidebar({ activeTab, setActiveTab, onLogout, isOpen, onClose, selectedConclaveId, setSelectedConclaveId, loggedInAdmin }) {
  const [showConclaveDropdown, setShowConclaveDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [conclaves, setConclaves] = useState([]);

  useEffect(() => {
    async function loadConclaves() {
      try {
        const data = await api.get('/admin/conclaves').catch(() => api.get('/conclaves'));
        if (Array.isArray(data)) {
          const mapped = data.map(c => {
            let status = c.status;
            const s = (c.status || '').toLowerCase();
            if (s.includes('open') || s === 'upcoming' || s === 'draft') status = 'Upcoming';
            else if (s === 'running' || s === 'active') status = 'Running';
            else if (s === 'completed' || s === 'finished' || s === 'ended') status = 'Completed';
            else if (s === 'cancelled') status = 'Cancelled';
            return {
              ...c,
              status
            };
          });
          setConclaves(mapped);
          return;
        }
      } catch (err) {
        console.warn("Sidebar conclave sync failed:", err.message);
      }
    }
    loadConclaves();
  }, []);

  const adminRegion = (loggedInAdmin?.region || '').toLowerCase().replace(/\s+region$/, '').trim();
  const isSuperAdmin = (loggedInAdmin?.role || '').toLowerCase() === 'superadmin' || adminRegion === 'global' || !adminRegion;

  const myConclaves = conclaves.filter(c => {
    if (isSuperAdmin) return true;
    const cRegion = (c.region || '').toLowerCase().replace(/\s+region$/, '').trim();
    return !adminRegion || cRegion === adminRegion || cRegion.includes(adminRegion) || adminRegion.includes(cRegion);
  });

  const activeConclaves = myConclaves.filter(c => c.status === 'Running');
  const selectedConclave = myConclaves.find(c => c.id === selectedConclaveId) || activeConclaves[0] || myConclaves[0] || null;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowConclaveDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] h-screen flex flex-col py-6 bg-zinc-50 border-r border-red-100 text-sidebar font-medium shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-[220px] ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

      {/* Sticky Branding Header (Non-scrolling) */}
      <div className="px-4 mb-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/BNI-Guntur-Logo.png"
            alt="BNI Logo"
            className="h-8 w-auto object-contain shrink-0"
          />
          <div className="border-l-2 border-brand-red/30 pl-3 flex flex-col justify-center min-w-0">
            <h1 className="text-[10px] font-bold text-brand-red leading-tight tracking-tight whitespace-nowrap">1-1-CONCLAVE</h1>
            <p className="text-[9px] text-zinc-500 font-semibold tracking-wider uppercase whitespace-nowrap mt-0.5">Enterprise Admin</p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg hover:bg-zinc-200 text-zinc-550 hover:text-zinc-800 transition-smooth cursor-pointer"
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Conclave Selector */}
      <div className="px-2.5 mb-3 shrink-0 relative" ref={dropdownRef}>
        <button
          onClick={() => setShowConclaveDropdown(!showConclaveDropdown)}
          className="w-full flex items-center gap-2 px-2.5 py-2 bg-white border border-zinc-200 rounded-lg shadow-xs hover:shadow-sm transition-smooth cursor-pointer group"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${selectedConclave ? getStatusDot(selectedConclave.status) : 'bg-zinc-300'}`} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-black text-zinc-800 truncate leading-tight">
              {selectedConclave ? (selectedConclave.name || selectedConclave.title || 'Conclave') : "No Active Conclave"}
            </p>
            <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5 truncate">
              {selectedConclave ? `${selectedConclave.status || 'ACTIVE'} • ${selectedConclave.region || selectedConclave.venueLocation || '—'}` : "N/A • NO REGION"}
            </p>
          </div>
          <ChevronDown className={`w-3 h-3 text-zinc-400 shrink-0 transition-transform ${showConclaveDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showConclaveDropdown && (
          <div className="absolute z-50 top-full mt-1 left-2.5 right-2.5 bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden max-h-[260px] overflow-y-auto animate-fade-in">
            <div className="px-3 py-2 border-b border-zinc-100">
              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Conclaves</p>
            </div>
            {myConclaves.length === 0 ? (
              <div className="px-3 py-3 text-[9px] text-zinc-400 font-semibold text-center">No conclaves found</div>
            ) : myConclaves.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedConclaveId(c.id); setShowConclaveDropdown(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-55 transition-smooth cursor-pointer border-b border-zinc-50 last:border-0 ${c.id === selectedConclaveId ? 'bg-red-50/40' : ''}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(c.status)}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[9.5px] font-bold truncate ${c.id === selectedConclaveId ? 'text-brand-red' : 'text-zinc-700'}`}>{c.name || c.title || 'Conclave'}</p>
                  <p className="text-[7.5px] text-zinc-400 font-semibold mt-0.5 truncate">{c.dateRange || (c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'TBD')}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-lg transition-smooth group cursor-pointer ${isActive
                  ? 'bg-brand-red text-white font-semibold shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-sidebar uppercase tracking-wider text-[10.5px] truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sticky Sidebar Footer (Non-scrolling) - replaced with Logout button */}
      <div className="mt-auto px-2.5 pt-4 border-t border-zinc-200 shrink-0">
        <button
          onClick={() => onLogout && onLogout()}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-smooth text-zinc-650 hover:bg-red-50 hover:text-brand-red group cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px] text-zinc-500 group-hover:text-brand-red shrink-0" />
          <div className="overflow-hidden">
            <p className="text-body-text truncate leading-tight font-extrabold text-zinc-900 group-hover:text-brand-red">Logout</p>
          </div>
        </button>
      </div>

    </aside>
  );
}
