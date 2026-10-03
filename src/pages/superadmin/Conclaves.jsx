import React, { useState, useEffect } from 'react';
import {
  Eye,
  ArrowLeft,
  User,
  MapPin
} from 'lucide-react';
import { api } from '../../services/api';

export default function SuperadminConclaves({ searchQuery }) {
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [activeConclave, setActiveConclave] = useState(null);
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [regions, setRegions] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_regions_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [conclavesList, regionsList] = await Promise.all([
          api.get('/admin/conclaves?global=true').catch(() => []),
          api.get('/admin/regions').catch(() => [])
        ]);
        if (Array.isArray(conclavesList)) {
          setConclaves(conclavesList);
          localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(conclavesList));
        }
        if (Array.isArray(regionsList)) {
          setRegions(regionsList);
          localStorage.setItem('bni_superadmin_regions_cache', JSON.stringify(regionsList));
        }
      } catch (err) {
        console.error("Failed to load conclaves/regions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (activeConclave) {
    return (
      <ConclaveDetailView
        conclave={activeConclave}
        setConclaves={setConclaves}
        onBack={() => setActiveConclave(null)}
      />
    );
  }

  // Dynamic Region list from both regions collection and all conclaves
  const allAvailableRegions = React.useMemo(() => {
    const map = new Map();
    (regions || []).forEach(reg => {
      const name = (typeof reg === 'string' ? reg : reg.name)?.trim();
      if (name) map.set(name.toLowerCase(), name);
    });
    (conclaves || []).forEach(c => {
      const r = (c.region || '').trim();
      if (r && !map.has(r.toLowerCase())) {
        map.set(r.toLowerCase(), r);
      }
    });
    return Array.from(map.values()).sort();
  }, [regions, conclaves]);

  // Filter lists
  const conclavesList = Array.isArray(conclaves) ? conclaves : [];
  const filteredConclaves = conclavesList.filter(conclave => {
    const q = searchQuery ? searchQuery.toLowerCase().trim() : '';
    const title = conclave.name || conclave.title || '';
    const venue = conclave.venueLocation || conclave.venue || '';
    const regionName = conclave.region || '';
    const matchesSearch = !q || title.toLowerCase().includes(q) || venue.toLowerCase().includes(q) || regionName.toLowerCase().includes(q);
    
    // Status filter matching
    let matchesStatus = true;
    if (selectedStatus !== 'All') {
      const s = (conclave.status || '').toLowerCase().trim();
      if (selectedStatus === 'Active') {
        matchesStatus = s === 'active' || s === 'running' || s === 'registrationopen';
      } else if (selectedStatus === 'Upcoming') {
        matchesStatus = s === 'upcoming' || s === 'registrationnotopen' || s === 'registrationclosed';
      } else if (selectedStatus === 'Completed') {
        matchesStatus = s === 'completed';
      } else {
        matchesStatus = s === selectedStatus.toLowerCase().trim();
      }
    }

    // Region filter matching (normalized, trimming whitespace)
    let matchesRegion = true;
    if (selectedRegion !== 'All') {
      const normSelected = selectedRegion.trim().toLowerCase().replace(/\s+region$/, '');
      const normConclave = (conclave.region || '').trim().toLowerCase().replace(/\s+region$/, '');
      matchesRegion = normSelected === normConclave || normConclave.includes(normSelected) || normSelected.includes(normConclave);
    }

    return matchesSearch && matchesStatus && matchesRegion;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 relative">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-zinc-955 tracking-tight">Global Conclaves</h1>
          <p className="text-xs text-zinc-500 font-semibold">Oversight of conclaves created across all regions and administrator hubs.</p>
        </div>
      </div>

      {/* Filter Row */}
      <section className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white border border-zinc-200 rounded-xl p-4.5 shadow-2xs">
        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {['All', 'Active', 'Completed', 'Upcoming'].map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer ${selectedStatus === status
                ? 'bg-brand-red text-white'
                : 'bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-800'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-450 uppercase tracking-widest shrink-0">Filter Region:</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="h-9 px-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body-sm font-bold text-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-brand-red focus:border-brand-red cursor-pointer"
          >
            <option value="All">All Regions</option>
            {allAvailableRegions.map(regName => (
              <option key={regName} value={regName}>{regName}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Conclaves Table */}
      <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-450 uppercase tracking-wider">
                <th className="p-4 pl-6">Conclave Title</th>
                <th className="p-4">Region</th>
                <th className="p-4">Creator</th>
                <th className="p-4">Venue</th>
                <th className="p-4 text-center">Tables Count</th>
                <th className="p-4 text-center">Members Checked In</th>
                <th className="p-4 text-center">Admin Member Add</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-[12.5px] font-semibold text-zinc-700">
              {filteredConclaves.map((conclave) => (
                <tr key={conclave.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="p-4 pl-6">
                    <button
                      onClick={() => setActiveConclave(conclave)}
                      className="font-black text-zinc-900 text-left cursor-pointer"
                    >
                      {conclave.name || conclave.title || 'Unnamed Conclave'}
                    </button>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-550 text-[10px] font-bold rounded-full whitespace-nowrap">
                      {conclave.region || 'Global'}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500">{conclave.coordinator || conclave.creator || 'Admin'}</td>
                  <td className="p-4 text-zinc-500 truncate max-w-[160px]">{conclave.venueLocation || conclave.venue || 'TBD Venue'}</td>
                  <td className="p-4 text-center font-bold text-zinc-800">{Math.ceil((conclave.registrationCount || conclave.membersCount || 0) / (conclave.personsPerTable || 7)) || 1} tables</td>
                  <td className="p-4 text-center font-bold text-zinc-800">{conclave.registrationCount || conclave.membersCount || 0} members</td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        disabled={conclave.isScheduleLocked || conclave.status === 'locked'}
                        aria-checked={!(conclave.isScheduleLocked || conclave.status === 'locked') && Boolean(conclave.allowAdminAddMembers)}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (conclave.isScheduleLocked || conclave.status === 'locked') return;
                          const newVal = !conclave.allowAdminAddMembers;
                          try {
                            await api.put(`/admin/conclaves/${conclave.id}/permissions`, { allowAdminAddMembers: newVal });
                            setConclaves(prev => {
                              const updated = prev.map(c => c.id === conclave.id ? { ...c, allowAdminAddMembers: newVal } : c);
                              localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(updated));
                              return updated;
                            });
                          } catch (err) {
                            console.error("Failed to update permission:", err);
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          !(conclave.isScheduleLocked || conclave.status === 'locked') && conclave.allowAdminAddMembers ? 'bg-emerald-600' : 'bg-zinc-300'
                        } ${conclave.isScheduleLocked || conclave.status === 'locked' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title={conclave.isScheduleLocked || conclave.status === 'locked' ? 'Schedule is locked - Member additions closed' : conclave.allowAdminAddMembers ? "Click to revoke admin member addition" : "Click to allow admin member addition"}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            !(conclave.isScheduleLocked || conclave.status === 'locked') && conclave.allowAdminAddMembers ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`text-[10px] font-black uppercase tracking-wider ${
                        conclave.isScheduleLocked || conclave.status === 'locked'
                          ? 'text-zinc-400'
                          : conclave.allowAdminAddMembers ? 'text-emerald-700' : 'text-zinc-400'
                      }`}>
                        {conclave.isScheduleLocked || conclave.status === 'locked' ? 'LOCKED' : conclave.allowAdminAddMembers ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${conclave.status?.toLowerCase() === 'completed'
                      ? 'bg-zinc-100 text-zinc-550 border border-zinc-200'
                      : conclave.status?.toLowerCase() === 'active' || conclave.status?.toLowerCase() === 'running'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                        : 'bg-red-50 text-brand-red border border-red-100'
                      }`}>
                      {conclave.status}
                    </span>
                  </td>
                  <td className="p-4 text-right pr-6">
                    <button
                      onClick={() => setActiveConclave(conclave)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

function ConclaveDetailView({ conclave, setConclaves, onBack }) {
  const derivedTables = conclave.tablesCount || Math.ceil((conclave.registrationCount || conclave.membersCount || 0) / (conclave.personsPerTable || 7)) || 1;

  // Use real schedule data from the conclave
  const scheduleRound0 = conclave.schedule?.rounds?.[0];
  const participantsMap = new Map(
    (conclave.participants || []).map(p => [p.id, p])
  );
  const realTables = (scheduleRound0?.tables || []).map(t => {
    const captain = participantsMap.get(t.captainId);
    const members = (t.memberIds || []).map(id => participantsMap.get(id)).filter(Boolean);
    return { id: `tbl-${t.tableNumber}`, number: String(t.tableNumber).padStart(2, '0'), captain: captain?.name || 'Captain', members };
  });

  const hasSchedule = realTables.length > 0;
  const roundCount = conclave.roundCount || conclave.scheduleSummary?.roundCount || 0;
  const currentRound = conclave.currentRound || 0;

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-body-sm font-black text-zinc-500 uppercase tracking-wider hover:text-zinc-800 transition-smooth cursor-pointer self-start">
          <ArrowLeft className="w-4 h-4" />
          Back to Conclaves
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-zinc-955 tracking-tight">{conclave.name || conclave.title || 'Unnamed Conclave'}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${conclave.status?.toLowerCase() === 'completed' ? 'bg-zinc-150 text-zinc-550 border border-zinc-200' : conclave.status?.toLowerCase() === 'active' || conclave.status?.toLowerCase() === 'running' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-red-50 text-brand-red border border-red-100'}`}>{conclave.status}</span>
            </div>
            <p className="text-xs text-zinc-500 font-semibold flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              {conclave.venueLocation || conclave.venue || 'TBD Venue'}
              <span className="text-zinc-300">•</span>
              <span>Region: {conclave.region || 'Global'}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Created By</span>
            <span className="text-body-sm font-black text-zinc-900 flex items-center sm:justify-end gap-1.5 mt-1">
              <User className="w-4 h-4 text-zinc-400" />
              {conclave.coordinator || conclave.creator || 'Admin'}
            </span>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Assigned Stations</span>
          <span className="text-2xl font-black text-brand-red block mt-2">{derivedTables} Tables</span>
          <span className="text-[10px] text-zinc-455 font-semibold block mt-1">Structured 1-to-1 rooms</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Total Registered</span>
          <span className="text-2xl font-black text-brand-red block mt-2">{conclave.registrationCount || conclave.membersCount || 0} Members</span>
          <div className="w-full bg-zinc-150 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((conclave.registrationCount || conclave.membersCount || 0) / (derivedTables * (conclave.personsPerTable || 7))) * 100)}%` }} />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Table Captains</span>
          <span className="text-2xl font-black text-brand-red block mt-2">{derivedTables} Assigned</span>
          <span className="text-[10px] text-zinc-450 font-semibold block mt-1">One per table</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Round Progress</span>
          <span className="text-2xl font-black text-brand-red block mt-2">{currentRound}/{roundCount || '?'}</span>
          <span className="text-[10px] text-zinc-455 font-semibold block mt-1">Rounds completed</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs p-5">
            <div className="mb-4">
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Active Seating Map</h2>
              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Round 1 seat assignments and table captain details.</p>
            </div>
            {!hasSchedule ? (
              <div className="py-12 text-center">
                <p className="text-zinc-400 text-sm font-semibold">No schedule generated yet.</p>
                <p className="text-zinc-400 text-xs mt-1">Generate a schedule from the admin panel to see seating assignments here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {realTables.map((table) => (
                  <div key={table.id} className="border border-zinc-200 rounded-xl overflow-hidden shadow-3xs flex flex-col bg-zinc-50/20">
                    <div className="bg-zinc-50 p-3 border-b border-zinc-200 flex justify-between items-center">
                      <span className="text-xs font-black text-zinc-900">Table {table.number}</span>
                      <span className="text-[10px] font-bold text-zinc-550">Captain: <strong className="font-extrabold text-zinc-800">{table.captain}</strong></span>
                    </div>
                    <div className="p-3.5 divide-y divide-zinc-200 space-y-2.5">
                      {table.members.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 font-semibold py-2">No members assigned</p>
                      ) : table.members.map((member, mIdx) => (
                        <div key={mIdx} className="pt-2.5 first:pt-0 flex justify-between items-start text-body-sm gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-800 leading-tight truncate">{member.name}</p>
                            <p className="text-[9.5px] text-zinc-450 font-semibold leading-normal truncate">{member.businessName || ''}</p>
                          </div>
                          <span className="px-1.5 py-0.5 bg-red-50 text-brand-red rounded text-[8.5px] font-extrabold uppercase tracking-wide leading-none shrink-0">{member.businessCategory || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs p-5">
            <div className="mb-4">
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Schedule &amp; Rounds</h2>
              <p className="text-[10px] text-zinc-455 font-semibold mt-0.5">{roundCount} total rounds configured.</p>
            </div>
            {roundCount === 0 ? (
              <p className="text-sm text-zinc-400 font-semibold py-4 text-center">No rounds scheduled yet.</p>
            ) : (
              <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
                {Array.from({ length: roundCount }, (_, i) => i + 1).map((rNum) => (
                  <div key={rNum} className="p-3.5 flex justify-between items-center text-body-sm bg-white">
                    <p className="font-black text-zinc-800 leading-tight">Round {rNum}</p>
                    <span className={`text-[9px] border font-bold px-2.5 py-0.5 rounded-full ${rNum < currentRound ? 'bg-zinc-50 border-zinc-200 text-zinc-550' : rNum === currentRound ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                      {rNum < currentRound ? 'Done' : rNum === currentRound ? 'Active' : 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs p-5">
            <div className="mb-4">
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Conclave Details</h2>
            </div>
            <div className="space-y-2.5 text-body-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Persons/Table</span>
                <span className="font-black text-zinc-800">{conclave.personsPerTable || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Total Rounds</span>
                <span className="font-black text-zinc-800">{roundCount || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-semibold">Registration</span>
                <span className={`font-black ${conclave.isRegistrationOpen ? 'text-emerald-600' : 'text-zinc-500'}`}>
                  {conclave.isRegistrationOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t border-zinc-100">
                <div>
                  <span className="text-zinc-800 font-bold block text-[11px]">Admin Member Add</span>
                  <span className="text-[10px] text-zinc-450 font-semibold">Allow regional admins to add &amp; import</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    disabled={conclave.isScheduleLocked || conclave.status === 'locked'}
                    aria-checked={!(conclave.isScheduleLocked || conclave.status === 'locked') && Boolean(conclave.allowAdminAddMembers)}
                    onClick={async () => {
                      if (conclave.isScheduleLocked || conclave.status === 'locked') return;
                      const newVal = !conclave.allowAdminAddMembers;
                      try {
                        await api.put(`/admin/conclaves/${conclave.id}/permissions`, { allowAdminAddMembers: newVal });
                        conclave.allowAdminAddMembers = newVal;
                        setConclaves(prev => {
                          const updated = prev.map(c => c.id === conclave.id ? { ...c, allowAdminAddMembers: newVal } : c);
                          localStorage.setItem('bni_superadmin_conclaves_cache', JSON.stringify(updated));
                          return updated;
                        });
                      } catch (err) {
                        console.error("Failed to update permission:", err);
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      !(conclave.isScheduleLocked || conclave.status === 'locked') && conclave.allowAdminAddMembers ? 'bg-emerald-600' : 'bg-zinc-300'
                    } ${conclave.isScheduleLocked || conclave.status === 'locked' ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={conclave.isScheduleLocked || conclave.status === 'locked' ? 'Schedule is locked - Member additions closed' : conclave.allowAdminAddMembers ? 'Click to revoke admin member addition' : 'Click to allow admin member addition'}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        !(conclave.isScheduleLocked || conclave.status === 'locked') && conclave.allowAdminAddMembers ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-[10.5px] font-black uppercase ${
                    conclave.isScheduleLocked || conclave.status === 'locked'
                      ? 'text-zinc-400'
                      : conclave.allowAdminAddMembers ? 'text-emerald-600' : 'text-zinc-400'
                  }`}>
                    {conclave.isScheduleLocked || conclave.status === 'locked' ? 'LOCKED' : conclave.allowAdminAddMembers ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}