import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  X,
  Check,
  FileText
} from 'lucide-react';

import { api } from '../../services/api';
import { downloadOrViewAgendaDocument } from '../../utils/documentUtils';

const formatTimeNice = (val, fallback = '') => {
  if (!val) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = match[2];
      let meridian = match[3] ? match[3].toUpperCase() : null;
      if (!meridian) {
        meridian = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
      }
      return `${String(hours).padStart(2, '0')}:${mins} ${meridian}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return String(val);
};

export default function MemberConclaveHistory({ loggedInMember }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedConclave, setSelectedConclave] = useState(null);
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_member_history_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [industryDistribution, setIndustryDistribution] = useState([]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await api.get('/conclaves');
        const memberUid = loggedInMember?.uid || loggedInMember?.id;

        // Filter ONLY conclaves the member is registered for
        const registeredOnly = (Array.isArray(data) ? data : []).filter(c => c.isRegistered === true);

        // Fetch LIVE referrals from database backend across all conclaves
        const myRefsRes = await api.get('/me/referrals').catch(() => null);
        const liveGiven = Array.isArray(myRefsRes?.given) ? myRefsRes.given : [];
        const liveReceived = Array.isArray(myRefsRes?.received) ? myRefsRes.received : [];
        const allLiveRefs = [...liveGiven, ...liveReceived];

        // Also check local storage backup
        const storedRefs = localStorage.getItem('bni_referrals');
        const localRefs = storedRefs ? JSON.parse(storedRefs) : [];
        const referralsList = [...allLiveRefs, ...localRefs];

        // Industry frequency counter
        const categoryCounts = {};
        let totalMetCount = 0;

        const mapped = registeredOnly.map((c) => {
          // Derive dynamic round details if schedule is available
          let roundDetails = [];
          if (c.schedule?.rounds && Array.isArray(c.participants)) {
            const pObj = c.participants.find((p) => p._originalUid === memberUid);
            if (pObj) {
              const pId = pObj.id;
              roundDetails = c.schedule.rounds.map((r) => {
                const table = r.tables?.find((t) => t.captainId === pId || t.memberIds?.includes(pId));
                const capObj = table ? c.participants.find((p) => p.id === table.captainId) : null;

                // Track categories met
                if (table) {
                  const allTableMemberIds = [table.captainId, ...(table.memberIds || [])].filter(id => id !== pId);
                  allTableMemberIds.forEach(mId => {
                    const seatedPerson = c.participants.find(p => p.id === mId);
                    if (seatedPerson?.businessCategory) {
                      const cat = seatedPerson.businessCategory;
                      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                      totalMetCount++;
                    }
                  });
                }

                return {
                  name: `Round ${r.roundNumber} Seating`,
                  table: table ? `Table ${table.tableNumber}` : 'Unassigned',
                  captain: capObj ? capObj.name : 'Unknown',
                  attendeesCount: table ? (table.memberIds?.length || 0) + 1 : 0
                };
              });
            }
          }

          const formattedStatus = c.status === 'completed'
            ? 'Completed'
            : c.status === 'active' || c.status === 'running'
              ? 'Active'
              : c.status === 'cancelled'
                ? 'Cancelled'
                : 'Registered';

          // Count referrals given by this user for this conclave
          const userReferralsGiven = referralsList.filter(
            r => (r.fromMemberId === memberUid || r.fromMemberId === loggedInMember?.id) &&
              (!r.conclaveId || r.conclaveId === c.id)
          ).length;

          return {
            id: c.id,
            title: c.name || c.title || 'BNI Conclave',
            location: c.venue || c.venueLocation || 'TBD Venue',
            date: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'TBD',
            year: c.date ? new Date(c.date).getFullYear().toString() : 'All',
            startTime: c.startTime,
            endTime: c.endTime,
            status: formattedStatus,
            rounds: c.roundCount || 4,
            agendaDocument: c.agendaDocument || (() => {
              const cached = localStorage.getItem(`bni_agenda_doc_${c.id}`);
              if (cached) {
                try { return JSON.parse(cached); } catch (e) { }
              }
              const allConclavesCached = localStorage.getItem('bni_conclaves');
              if (allConclavesCached) {
                try {
                  const parsed = JSON.parse(allConclavesCached);
                  const found = parsed.find(item => item.id === c.id);
                  if (found && found.agendaDocument) return found.agendaDocument;
                } catch (e) { }
              }
              return null;
            })(),
            details: {
              subtitle: `${c.venueLocation || c.venue || 'TBD Venue'}`,
              rounds: roundDetails.length > 0 ? roundDetails : Array.from({ length: c.roundCount || 4 }, (_, i) => ({
                name: `Round ${i + 1} Seating`,
                table: `Table 0${i + 1}`,
                captain: 'Session Captain',
                attendeesCount: c.personsPerTable || 6
              })),
              contacts: (c.roundCount || 4) * ((c.personsPerTable || 6) - 1),
              referrals: userReferralsGiven,
              recommendation: userReferralsGiven > 0
                ? "High synergy session with active referral flow."
                : (formattedStatus === 'Active'
                  ? "Session in progress. Log referrals given during 1-on-1 meetings."
                  : "Session completed. Log referrals given during meetings.")
            }
          };
        });

        // Compute top 5 industries
        const colors = ["bg-brand-red", "bg-red-700", "bg-red-500", "bg-red-300", "bg-red-200"];
        const topIndustries = Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], idx) => ({
            name,
            count: count,
            percentage: totalMetCount > 0 ? Math.round((count / totalMetCount) * 100) : 0,
            color: colors[idx % colors.length]
          }));

        setIndustryDistribution(topIndustries);
        setConclaves(mapped);
        localStorage.setItem('bni_member_history_cache', JSON.stringify(mapped));
      } catch (err) {
        console.warn('Failed to load conclave history from backend:', err.message);
      }
    }
    loadHistory();
  }, [loggedInMember]);

  // Filtered conclaves list
  const filteredConclaves = conclaves.filter(conclave => {
    const matchesSearch = conclave.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conclave.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'All' ? true : conclave.year === selectedYear;
    const matchesStatus = selectedStatus === 'All' ? true : conclave.status === selectedStatus;
    return matchesSearch && matchesYear && matchesStatus;
  });

  const handleOpenDrawer = (conclave) => {
    if (conclave.status === 'Cancelled') return;
    setSelectedConclave(conclave);
    setShowDrawer(true);
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Conclave History</h1>
        <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Review your participation, connections, and achievements from past conclaves.</p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column: Content (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* KPI Summary Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Conclaves", value: conclaves.length },
              { label: "Rounds Participated", value: conclaves.reduce((acc, c) => acc + (c.rounds || 0), 0) },
              { label: "People Met", value: conclaves.reduce((acc, c) => acc + (c.rounds || 0) * 4, 0) },
              { label: "Business Categories", value: industryDistribution.length }
            ].map((kpi, idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col items-center text-center justify-center min-h-[92px]"
              >
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">{kpi.label}</span>
                <span className="text-xl md:text-2xl font-black text-brand-red mt-1.5 leading-none">{kpi.value}</span>
              </div>
            ))}
          </section>



          {/* Filter Bar */}
          <section className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conclaves..."
                className="w-full h-10 pl-10 pr-4 bg-white border border-zinc-250 rounded-lg text-[12.5px] font-semibold text-zinc-800 placeholder-zinc-400 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-10 px-3.5 bg-white border border-zinc-250 rounded-lg text-[12px] font-black uppercase tracking-wider text-zinc-600 focus:ring-1 focus:ring-brand-red focus:outline-hidden"
              >
                <option value="All">All Years</option>
                <option value="2024">Year: 2024</option>
                <option value="2023">Year: 2023</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-10 px-3.5 bg-white border border-zinc-250 rounded-lg text-[12px] font-black uppercase tracking-wider text-zinc-600 focus:ring-1 focus:ring-brand-red focus:outline-hidden"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Registered">Registered</option>
                <option value="Cancelled">Cancelled</option>
              </select>


            </div>
          </section>

          {/* History Cards List */}
          <section className="space-y-4">
            {filteredConclaves.length > 0 ? (
              filteredConclaves.map((conclave) => (
                <div
                  key={conclave.id}
                  className={`bg-white border border-zinc-200 rounded-xl shadow-2xs hover:shadow-xs transition-smooth group ${conclave.status === 'Cancelled' ? 'opacity-65' : ''
                    }`}
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center gap-5">
                    <div className="w-14 h-14 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0">
                      {conclave.status === 'Cancelled' ? (
                        <X className="w-6 h-6 text-zinc-400" />
                      ) : (
                        <Check className="w-6 h-6 text-brand-red stroke-[2.5]" />
                      )}
                    </div>

                    <div className="flex-grow space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-body-md font-black text-zinc-900 leading-tight group-hover:text-brand-red transition-smooth">
                          {conclave.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-[8.5px] font-black rounded uppercase tracking-wider ${conclave.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-zinc-150 text-zinc-500 border border-zinc-200'
                          }`}>
                          {conclave.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-450 text-[11px] font-semibold leading-none">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          {conclave.location}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          {conclave.date}
                        </span>
                        {(conclave.startTime || conclave.endTime) && (
                          <span className="flex items-center gap-1.5 text-brand-red font-bold">
                            <Clock className="w-3.5 h-3.5 text-brand-red" />
                            {formatTimeNice(conclave.startTime)}{conclave.startTime && conclave.endTime ? ' – ' : ''}{formatTimeNice(conclave.endTime)}
                          </span>
                        )}
                        {conclave.status !== 'Cancelled' && (
                          <span className="flex items-center gap-1.5 text-brand-red font-black">
                            <RefreshCw className="w-3 h-3 animate-spin-slow" />
                            {conclave.rounds}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenDrawer(conclave)}
                      disabled={conclave.status === 'Cancelled'}
                      className={`shrink-0 h-10 px-4.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-smooth ${conclave.status === 'Cancelled'
                        ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-2xs cursor-pointer'
                        }`}
                    >
                      {conclave.status === 'Cancelled' ? 'No Details' : 'View Details'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-zinc-400 font-semibold shadow-2xs">
                No past conclaves found matching your search.
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Sidebar (4 cols) */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Industry Distribution */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h2 className="text-body-md font-black text-zinc-900">Industry Distribution</h2>
            <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">Top industries connected in past seating rounds.</p>

            <div className="space-y-3.5 pt-2">
              {industryDistribution.length > 0 ? (
                industryDistribution.map((ind, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-black text-zinc-755 leading-none">
                      <span>{ind.name}</span>
                      <span className="text-zinc-500 font-extrabold">{ind.count} met ({ind.percentage}%)</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`${ind.color} h-full rounded-full`}
                        style={{ width: `${ind.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 font-semibold py-2">No seating connections recorded yet.</p>
              )}
            </div>
          </section>

          {/* Recent Connections Sidebar */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <h2 className="text-body-sm font-black text-zinc-900">Conclave Roster</h2>
              <span className="text-brand-red font-black text-[9px] uppercase tracking-wider select-none">Live</span>
            </div>

            <div className="space-y-4">
              {conclaves.length > 0 ? (
                conclaves.slice(0, 3).map((c, idx) => (
                  <div key={idx} className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center font-bold text-[10.5px] text-zinc-550 shrink-0 group-hover:border-brand-red/35 transition-smooth select-none">
                      {c.title.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <p className="text-[12.5px] font-black text-zinc-850 group-hover:text-brand-red transition-smooth truncate leading-none">{c.title}</p>
                      <p className="text-[10px] text-zinc-450 font-semibold truncate leading-none mt-1">{c.location} • {c.rounds} Rounds</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 font-semibold py-2 text-center">No past conclaves recorded.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* Detail Drawer Panel & Overlay */}
      {showDrawer && selectedConclave && createPortal(
        <div className="font-sans">
          <div
            onClick={() => setShowDrawer(false)}
            className="fixed inset-0 bg-zinc-950/45 backdrop-blur-xs z-[998] transition-opacity duration-300 animate-fade-in"
          />
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[999] border-l border-zinc-200 flex flex-col animate-slide-left"
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <div>
                <h2 className="text-body-md font-black text-zinc-900 leading-tight">Conclave Details</h2>
                <p className="text-[11px] text-zinc-450 font-semibold mt-0.5">{selectedConclave.details?.subtitle}</p>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-150 p-1.5 rounded-lg transition-smooth cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {/* Published Official Conclave Agenda Document */}
              {selectedConclave.agendaDocument && (
                <div className="bg-gradient-to-r from-emerald-900 to-zinc-950 text-white rounded-xl p-4 shadow-md flex items-center justify-between gap-3 border border-emerald-800/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400/20 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-black tracking-wider uppercase text-emerald-400 block">Official Agenda</span>
                      <h4 className="text-body-xs font-bold text-white truncate block">{selectedConclave.agendaDocument.name || 'Conclave Agenda.pdf'}</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => downloadOrViewAgendaDocument(selectedConclave.agendaDocument)}
                    type="button"
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-black rounded-lg transition-smooth shrink-0 cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              )}

              {/* Round Timeline */}
              <div className="space-y-4">
                <h3 className="text-body-sm font-black text-zinc-900 border-b border-zinc-100 pb-2">Round Timeline</h3>
                <div className="space-y-6 relative pl-4 border-l border-zinc-200 ml-2 pt-1">

                  {selectedConclave.details?.rounds.map((rnd, rIdx) => (
                    <div key={rIdx} className="relative">
                      {/* Circle bullet */}
                      <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-brand-red bg-white"></span>

                      <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[11.5px] font-black text-zinc-800">{rnd.name}</span>
                          {rnd.table && (
                            <span className="px-1.5 py-0.5 bg-zinc-200/60 text-zinc-650 text-[9px] font-black rounded uppercase tracking-wide leading-none">{rnd.table}</span>
                          )}
                        </div>
                        {rnd.captain && (
                          <p className="text-[11px] text-zinc-500 font-semibold">
                            Captain: <strong className="text-zinc-700 font-bold">{rnd.captain}</strong>
                          </p>
                        )}
                        {rnd.type === 'Lunch' && (
                          <p className="text-[11px] text-zinc-400 italic font-semibold">Self-organized table transitions</p>
                        )}
                        {rnd.attendeesCount && (
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1.5">
                              <span className="w-5 h-5 rounded-full bg-zinc-100 border border-white text-[7px] font-bold flex items-center justify-center">AA</span>
                              <span className="w-5 h-5 rounded-full bg-zinc-100 border border-white text-[7px] font-bold flex items-center justify-center">KV</span>
                              <span className="w-5 h-5 rounded-full bg-zinc-100 border border-white text-[7px] font-bold flex items-center justify-center">RS</span>
                            </div>
                            <span className="text-[9.5px] text-zinc-400 font-semibold">+{rnd.attendeesCount - 2} met</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                </div>
              </div>

              {/* Event Impact */}
              <div className="space-y-4">
                <h3 className="text-body-sm font-black text-zinc-900 border-b border-zinc-100 pb-2">Event Impact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-xl text-center">
                    <p className="text-brand-red font-black text-xl leading-none">{selectedConclave.details?.contacts}</p>
                    <p className="text-[9.5px] text-zinc-450 font-bold uppercase tracking-wider mt-2">New Contacts</p>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200/80 p-4 rounded-xl text-center">
                    <p className="text-brand-red font-black text-xl leading-none">{selectedConclave.details?.referrals}</p>
                    <p className="text-[9.5px] text-zinc-450 font-bold uppercase tracking-wider mt-2">Referrals Given</p>
                  </div>
                </div>

                {selectedConclave.details?.recommendation && (
                  <div className="bg-red-50/50 border border-red-100/50 p-4 rounded-xl">
                    <p className="text-brand-red text-[11px] italic font-semibold leading-relaxed">
                      "{selectedConclave.details.recommendation}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
