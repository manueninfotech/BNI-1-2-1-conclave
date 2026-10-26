import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Layers,
  CalendarRange,
  Users,
  Clock,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../services/api';
import RecentActivity from '../../admin/RecentActivity';

// "Guntur Region" and "Guntur" are the same region.
const normRegion = (r) => String(r || '').toLowerCase().replace(/\s+region$/, '').trim();
import { formatStatus } from '../../utils/statusUtils';

export default function SuperadminDashboard({ setActiveTab }) {
  const [admins, setAdmins] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_admins_cache');
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) return arr;
      } catch (e) { }
    }
    return [];
  });

  const [regions, setRegions] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_regions_cache');
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) return arr;
      } catch (e) { }
    }
    return [];
  });

  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_conclaves_cache');
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) return arr;
      } catch (e) { }
    }
    return [];
  });

  const [members, setMembers] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_members_cache');
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) return arr;
      } catch (e) { }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(false);
      try {
        const [adminsList, regionsList, conclavesList, membersList] = await Promise.all([
          api.get('/admin/coordinators').catch(() => []),
          api.get('/admin/regions').catch(() => []),
          api.get('/admin/conclaves?global=true').catch(() => []),
          api.get('/admin/users').catch(() => [])
        ]);
        if (Array.isArray(adminsList)) {
          setAdmins(adminsList);
          localStorage.setItem('bni_superadmin_admins_cache', JSON.stringify(adminsList));
        }
        if (Array.isArray(regionsList)) {
          setRegions(regionsList);
          localStorage.setItem('bni_superadmin_regions_cache', JSON.stringify(regionsList));
        }
        if (Array.isArray(conclavesList)) {
          setConclaves(conclavesList);
          localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(conclavesList));
        }
        if (Array.isArray(membersList)) {
          setMembers(membersList);
          localStorage.setItem('bni_superadmin_members_cache', JSON.stringify(membersList));
        }
      } catch (err) {
        console.error("Failed to load superadmin dashboard metrics:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Aggregate KPIs
  const totalAdminsCount = admins.length;
  const totalRegionsCount = regions.length;
  const totalConclavesCount = conclaves.length;
  const totalMembersCount = members.length;

  // Distribution helpers
  const conclavesPerRegion = regions.map(reg => {
    const count = conclaves.filter(c => normRegion(c.region) === normRegion(reg.name)).length;
    return { name: reg.name, count };
  });

  const adminsPerRegion = regions.map(reg => {
    const count = admins.filter(a => normRegion(a.region) === normRegion(reg.name)).length;
    return { name: reg.name, count };
  });

  const parseDate = (val) => {
    if (!val) return 'Recently';
    if (typeof val.toDate === 'function') {
      return val.toDate().toLocaleDateString();
    }
    if (val._seconds !== undefined) {
      return new Date(val._seconds * 1000).toLocaleDateString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
  };


  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Welcome Banner */}
      <div>
        <h1 className="text-2xl font-black text-zinc-955 tracking-tight">Superadmin Dashboard</h1>
        <p className="text-xs text-zinc-500 font-semibold mt-1">Global BNI Conclave directory network oversight &amp; regional admin statistics.</p>
      </div>

      {/* KPI Cards Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total BNI Regions", value: totalRegionsCount, sub: "Active regions globally", Icon: Layers, tab: "admins" },
          { label: "Regional Admins", value: totalAdminsCount, sub: "Created login profiles", Icon: Award, tab: "admins" },
          { label: "All-Time Conclaves", value: totalConclavesCount, sub: "Aggregated conclave events", Icon: CalendarRange, tab: "conclaves" },
          { label: "Total Network Members", value: totalMembersCount, sub: "Registered across regions", Icon: Users, tab: "members" }
        ].map((kpi, idx) => {
          const Icon = kpi.Icon;
          return (
            <div
              key={idx}
              onClick={() => setActiveTab && setActiveTab(kpi.tab)}
              className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-md hover:border-zinc-300 transition-smooth cursor-pointer flex flex-col justify-between min-h-[110px]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[9.5px] font-black text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
                <Icon className="w-4.5 h-4.5 text-zinc-450 shrink-0" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-brand-red leading-none">{kpi.value}</span>
                <span className="text-[10px] text-zinc-450 font-semibold block mt-1">{kpi.sub}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Distributions & Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Conclaves distribution list */}
        <section className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Conclaves per Region</h2>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Events count grouped by BNI region.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              {conclavesPerRegion.map((item, idx) => {
                const percentage = totalConclavesCount > 0 ? (item.count / totalConclavesCount) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11.5px] font-bold text-zinc-700">
                      <span className="truncate">{item.name}</span>
                      <span className="text-zinc-850 font-black shrink-0">{item.count} conclaves</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-red rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab('conclaves')}
            className="w-full text-center text-[10px] font-black text-zinc-500 uppercase tracking-wider hover:text-zinc-800 pt-5 mt-4 border-t border-zinc-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All Conclaves</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </section>

        {/* Admins distribution list */}
        <section className="lg:col-span-6 bg-white border border-zinc-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Admins per Region</h2>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Number of administrative profiles assigned.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              {adminsPerRegion.map((item, idx) => {
                const percentage = totalAdminsCount > 0 ? (item.count / totalAdminsCount) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11.5px] font-bold text-zinc-700">
                      <span className="truncate">{item.name}</span>
                      <span className="text-zinc-850 font-black shrink-0">{item.count} admins</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-red rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab('admins')}
            className="w-full text-center text-[10px] font-black text-zinc-500 uppercase tracking-wider hover:text-zinc-800 pt-5 mt-4 border-t border-zinc-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <span>Manage Admins &amp; Regions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </section>

      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Active Conclaves List */}
        <section className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Active Conclaves</h2>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Conclaves currently running or scheduled for today.</p>
            </div>

            <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden">
              {conclaves.filter(c => ['active', 'running', 'registrationopen', 'registration open'].includes(c.status?.toLowerCase().replace(/[\s_-]/g, ''))).map(conclave => (
                <div key={conclave.id} className="p-3.5 bg-white hover:bg-zinc-50/50 transition-colors flex justify-between items-center text-body-sm">
                  <div className="space-y-1">
                    <p className="font-black text-zinc-800 leading-none">{conclave.name || conclave.title || 'Unnamed Conclave'}</p>
                    <div className="flex gap-2 items-center text-[10px] text-zinc-450 font-semibold mt-1">
                      <span>{conclave.region || conclave.location || 'Global'}</span>
                      <span>•</span>
                      <span>{Math.ceil((conclave.registrationCount || conclave.membersCount || 0) / (conclave.personsPerTable || 7)) || 1} tables</span>
                      <span>•</span>
                      <span>{conclave.registrationCount || conclave.membersCount || 0} checked in</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider whitespace-nowrap ${
                    ['active', 'running'].includes(conclave.status?.toLowerCase()) ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {formatStatus(conclave.status)}
                  </span>
                </div>
              ))}
              {conclaves.filter(c => ['active', 'running', 'registration open', 'registrationopen'].includes(c.status?.toLowerCase().replace(/[\s_-]/g, ''))).length === 0 && (
                <p className="text-[11.5px] text-zinc-500 font-semibold p-4 text-center">No active conclaves currently running.</p>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveTab && setActiveTab('conclaves')}
            className="w-full text-center text-[10px] font-black text-zinc-500 uppercase tracking-wider hover:text-zinc-800 pt-4 mt-3 border-t border-zinc-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All Conclaves</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </section>

        {/* Global Activity Feed Logs */}
        <section className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Recent Activity</h2>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">The latest changes across all regions.</p>
            </div>

            <RecentActivity onSeeAll={() => setActiveTab && setActiveTab('activity')} />
          </div>
        </section>

      </div>

    </div>
  );
}
