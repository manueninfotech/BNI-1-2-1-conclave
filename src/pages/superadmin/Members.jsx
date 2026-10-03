import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MapPin,
  Eye,
} from 'lucide-react';
import { api } from '../../services/api';

export default function SuperadminMembers({ searchQuery }) {
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [activeMember, setActiveMember] = useState(null);

  // Lock background body scroll when drawer or modal is open
  useEffect(() => {
    if (activeMember) {
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [activeMember]);

  const [referrals, setReferrals] = useState(() => {
    const stored = localStorage.getItem('bni_referrals');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('bni_referrals');
      if (stored) {
        setReferrals(JSON.parse(stored));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const [members, setMembers] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_members_cache');
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

  const [conclaves, setConclaves] = useState([]);
  const [selectedConclaveId, setSelectedConclaveId] = useState('');
  const [selectedConclaveAllowAdd, setSelectedConclaveAllowAdd] = useState(false);

  useEffect(() => {
    async function loadMembersAndRegions() {
      setIsLoading(false);
      try {
        const [membersData, regionsData, conclavesData] = await Promise.all([
          api.get('/admin/users').catch(() => []),
          api.get('/admin/regions').catch(() => []),
          api.get('/admin/conclaves?global=true').catch(() => [])
        ]);
        if (Array.isArray(membersData)) {
          setMembers(membersData);
          localStorage.setItem('bni_superadmin_members_cache', JSON.stringify(membersData));
        }
        if (Array.isArray(regionsData)) {
          setRegions(regionsData);
          localStorage.setItem('bni_superadmin_regions_cache', JSON.stringify(regionsData));
        }
        if (Array.isArray(conclavesData) && conclavesData.length > 0) {
          setConclaves(conclavesData);
          setSelectedConclaveId(conclavesData[0].id);
          setSelectedConclaveAllowAdd(Boolean(conclavesData[0].allowAdminAddMembers));
        }
      } catch (err) {
        console.error("Failed to load global members/regions/conclaves:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMembersAndRegions();
  }, []);

  const handleConclaveSelect = (cId) => {
    setSelectedConclaveId(cId);
    const target = conclaves.find(c => c.id === cId);
    if (target) {
      setSelectedConclaveAllowAdd(Boolean(target.allowAdminAddMembers));
    }
  };

  const selectedConclaveObj = conclaves.find(c => c.id === selectedConclaveId);
  const isSelectedConclaveLocked = Boolean(selectedConclaveObj?.isScheduleLocked || selectedConclaveObj?.status === 'locked');

  const handleToggleSelectedConclaveAdd = async () => {
    if (!selectedConclaveId || isSelectedConclaveLocked) return;
    const nextVal = !selectedConclaveAllowAdd;
    try {
      await api.put(`/admin/conclaves/${selectedConclaveId}/permissions`, { allowAdminAddMembers: nextVal });
      setSelectedConclaveAllowAdd(nextVal);
      setConclaves(prev => prev.map(c => c.id === selectedConclaveId ? { ...c, allowAdminAddMembers: nextVal } : c));
    } catch (err) {
      console.error("Failed to update conclave permission:", err);
    }
  };

  const [roleChangeTarget, setRoleChangeTarget] = useState(null);

  const handleSaveRole = (id, isCaptain) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, isCaptain } : m));
    setActiveMember(prev => prev && prev.id === id ? { ...prev, isCaptain } : prev);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const membersPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRegion]);

  // Filter list
  const filteredMembers = members.filter(member => {
    if (member.email === 'superadmin@bni.com') return false;

    const q = searchQuery ? searchQuery.toLowerCase() : '';
    const name = member.name || '';
    const company = member.company || '';
    const category = member.category || '';
    const chapter = member.chapter || '';
    const matchesSearch =
      name.toLowerCase().includes(q) ||
      company.toLowerCase().includes(q) ||
      category.toLowerCase().includes(q) ||
      chapter.toLowerCase().includes(q);

    const reg = member.region ? (typeof member.region === 'object' ? (member.region.place || 'Global BNI Network') : member.region) : (member.location ? (typeof member.location === 'object' ? (member.location.place || 'Global BNI Network') : member.location) : 'Global BNI Network');
    const matchesRegion = selectedRegion === 'All' ? true : reg === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const totalPages = Math.ceil(filteredMembers.length / membersPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * membersPerPage,
    currentPage * membersPerPage
  );

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 relative">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-zinc-955 tracking-tight">Global Members Directory</h1>
          <p className="text-xs text-zinc-500 font-semibold">Directory index of all registered BNI members across regional databases.</p>
        </div>

        {/* Superadmin Conclave Member Add Permission Control */}
        {conclaves.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-white border border-zinc-200 rounded-xl px-3.5 py-2 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-zinc-400">Conclave:</span>
              <select
                value={selectedConclaveId}
                onChange={(e) => handleConclaveSelect(e.target.value)}
                className="h-8 px-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-hidden cursor-pointer"
              >
                {conclaves.map(c => (
                  <option key={c.id} value={c.id}>{c.name || 'Unnamed Conclave'}</option>
                ))}
              </select>
            </div>
            <div className="w-px h-5 bg-zinc-200 hidden sm:block" />
            <div className={`flex items-center gap-2.5 ${isSelectedConclaveLocked ? 'opacity-60' : ''}`}>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-zinc-400">Admin Member Add</span>
                <span className={`text-[11px] font-black ${isSelectedConclaveLocked ? 'text-zinc-500' : selectedConclaveAllowAdd ? 'text-emerald-600' : 'text-zinc-500'}`}>
                  {isSelectedConclaveLocked ? 'Locked (OFF)' : selectedConclaveAllowAdd ? 'Allowed (ON)' : 'Restricted (OFF)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                disabled={isSelectedConclaveLocked}
                aria-checked={!isSelectedConclaveLocked && selectedConclaveAllowAdd}
                onClick={handleToggleSelectedConclaveAdd}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !isSelectedConclaveLocked && selectedConclaveAllowAdd ? 'bg-emerald-600' : 'bg-zinc-300'
                } ${isSelectedConclaveLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                title={isSelectedConclaveLocked ? "Schedule is generated and locked - Member additions closed" : selectedConclaveAllowAdd ? "Click to restrict admins from adding members" : "Click to allow admins to add members"}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !isSelectedConclaveLocked && selectedConclaveAllowAdd ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Row */}
      <section className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white border border-zinc-200 rounded-xl p-4.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-455 uppercase tracking-widest shrink-0">Filter Region:</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="h-9 px-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-body-sm font-bold text-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-brand-red focus:border-brand-red cursor-pointer"
          >
            <option value="All">All Regions</option>
            {regions.map(reg => (
              <option key={reg.id} value={reg.name}>{reg.name}</option>
            ))}
          </select>
        </div>

        <span className="text-[11px] font-bold text-zinc-455 text-right sm:text-left whitespace-nowrap">
          Showing {filteredMembers.length} of {members.length} Members
        </span>
      </section>

      {/* Members Table */}
      <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-455 uppercase tracking-wider">
                <th className="p-4 pl-6">Member Name</th>
                <th className="p-4">Role</th>
                <th className="p-4">Business Category</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Company</th>
                <th className="p-4">BNI Chapter</th>
                <th className="p-4">Region</th>
                <th className="p-4 text-center">Given</th>
                <th className="p-4 text-center">Taken</th>
                <th className="p-4 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-[12.5px] font-semibold text-zinc-700">
              {paginatedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="p-4 pl-6">
                    <button
                      onClick={() => setActiveMember(member)}
                      className="font-black text-zinc-900 text-left cursor-pointer"
                    >
                      {member.name}
                    </button>
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {member.isCaptain ? (
                      <span
                        onClick={() => setRoleChangeTarget({ id: member.id, name: member.name, isCaptain: member.isCaptain })}
                        className="px-2.5 py-0.5 border border-brand-red/35 text-brand-red bg-brand-red/5 font-extrabold rounded-md text-[9px] uppercase tracking-wide cursor-pointer hover:bg-brand-red hover:text-white transition-smooth whitespace-nowrap select-none"
                        title="Click to change member role"
                      >
                        Captain
                      </span>
                    ) : (
                      <span
                        onClick={() => setRoleChangeTarget({ id: member.id, name: member.name, isCaptain: member.isCaptain })}
                        className="px-2.5 py-0.5 border border-zinc-200 text-zinc-550 bg-zinc-50 font-semibold rounded-md text-[9px] uppercase tracking-wide cursor-pointer hover:bg-zinc-200 hover:text-zinc-800 transition-smooth whitespace-nowrap select-none"
                        title="Click to change member role"
                      >
                        Member
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 bg-red-50 text-brand-red text-[10px] font-bold rounded-full uppercase tracking-wider whitespace-nowrap">
                      {member.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-zinc-900 font-bold leading-tight select-all">{member.email}</span>
                      <span className="text-[10px] text-zinc-455 font-semibold mt-0.5 select-all">{member.mobile}</span>
                    </div>
                  </td>
                  <td className="p-4 text-zinc-500 font-bold">{member.company}</td>
                  <td className="p-4 text-zinc-500">{member.chapter}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-550 text-[10px] font-bold rounded-full whitespace-nowrap">
                      {typeof member.region === 'object' ? (member.region.place || 'Global BNI Network') : (member.region || 'Global BNI Network')}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold text-zinc-800">
                    {referrals.filter(r => r.fromMemberId === member.id).length}
                  </td>
                  <td className="p-4 text-center font-bold text-zinc-800">
                    {referrals.filter(r => r.toMemberId === member.id).length}
                  </td>
                  <td className="p-4 text-right pr-6">
                    <button
                      onClick={() => setActiveMember(member)}
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
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4 flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-semibold">
              Showing {((currentPage - 1) * membersPerPage) + 1} to {Math.min(currentPage * membersPerPage, filteredMembers.length)} of {filteredMembers.length} members
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 font-bold text-xs rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-smooth cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 font-bold text-xs rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-smooth cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Member detail drawer portaled to document.body */}
      {createPortal(
        <>
          <div
            onClick={() => setActiveMember(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${
              activeMember ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          />
          <div
            className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[480px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${
              activeMember ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}
          >
            {activeMember && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveMember(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-section-heading font-extrabold text-zinc-950">Member Details</h3>
                    </div>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
                  {/* Member Overview Card */}
                  <div className="flex items-center gap-3.5 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <div className="w-12 h-12 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center font-black text-[13px] shrink-0">
                      {activeMember.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13.5px] font-black text-zinc-900 leading-none truncate">{activeMember.name}</h3>
                      <p className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider mt-1.5 truncate">{activeMember.company}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {activeMember.isCaptain ? (
                          <span className="px-2.5 py-0.5 border border-brand-red/35 text-brand-red bg-brand-red/5 font-extrabold rounded-md text-[9px] uppercase tracking-wide whitespace-nowrap">
                            Captain
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 border border-zinc-200 text-zinc-550 bg-zinc-50 font-semibold rounded-md text-[9px] uppercase tracking-wide whitespace-nowrap">
                            Member
                          </span>
                        )}
                        <span className="px-2 py-0.5 border border-zinc-200 text-zinc-500 bg-white font-semibold rounded-md text-[9px] uppercase tracking-wide whitespace-nowrap">
                          Sent: {referrals.filter(r => r.fromMemberId === activeMember.id).length}
                        </span>
                        <span className="px-2 py-0.5 border border-zinc-200 text-zinc-500 bg-white font-semibold rounded-md text-[9px] uppercase tracking-wide whitespace-nowrap">
                          Taken: {referrals.filter(r => r.toMemberId === activeMember.id).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Business & Region */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Business category</span>
                      <span className="text-body-sm font-bold text-brand-red mt-1 block truncate uppercase tracking-wider">{activeMember.category}</span>
                    </div>
                    <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">BNI Region node</span>
                      <span className="text-body-sm font-bold text-zinc-800 mt-1 block truncate">
                        {typeof activeMember.region === 'object' ? (activeMember.region.place || 'Global BNI Network') : (activeMember.region || 'Global BNI Network')}
                      </span>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-3.5 pt-1">
                    <h4 className="text-[11px] font-black text-zinc-450 uppercase tracking-widest px-0.5">Contact Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Email Address</span>
                        <span className="text-body-sm font-bold text-zinc-800 mt-1 block truncate select-all">{activeMember.email}</span>
                      </div>
                      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Mobile Number</span>
                        <span className="text-body-sm font-bold text-zinc-800 mt-1 block select-all">{activeMember.mobile}</span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-3.5 pt-1">
                    <div className="flex justify-between items-center text-body-sm">
                      <span className="text-zinc-450 font-bold">BNI Chapter</span>
                      <span className="text-zinc-800 font-black">{activeMember.chapter}</span>
                    </div>
                    <div className="flex justify-between items-center text-body-sm">
                      <span className="text-zinc-455 font-bold">Active Table Seating</span>
                      <span className="text-brand-red font-black flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        Table 05 (Floor 1)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-body-sm">
                      <span className="text-zinc-455 font-bold">Membership tier</span>
                      <span className="text-zinc-800 font-black">Platinum tier</span>
                    </div>
                  </div>

                  {/* Past Conclave matches logs */}
                  <div className="space-y-3 pt-1">
                    <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-0.5">Recent Seating History</h4>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
                      {Array.isArray(activeMember.seatingHistory) && activeMember.seatingHistory.length > 0 ? (
                        activeMember.seatingHistory.map((history, idx) => (
                          <div key={idx} className="p-3.5 bg-white hover:bg-zinc-50/50 transition-colors text-body-sm">
                            <div className="flex justify-between items-start">
                              <p className="font-black text-zinc-800">{history.title || history.conclaveName || 'Conclave'}</p>
                              <span className="text-[9px] text-zinc-400 font-semibold">{history.date}</span>
                            </div>
                            <p className="text-[10px] text-zinc-450 font-semibold mt-1">Seated at {history.table || 'Table'} {history.captain ? `(Captain: ${history.captain})` : ''}</p>
                          </div>
                        ))
                      ) : (
                        <p className="p-4 text-center text-[10.5px] text-zinc-400 font-semibold bg-white">No past seating history logged for this member.</p>
                      )}
                    </div>
                  </div>

                  {/* Referral history logs */}
                  <div className="space-y-3 pt-1">
                    <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-0.5">Referral History</h4>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
                      {referrals.filter(r => r.fromMemberId === activeMember.id || r.toMemberId === activeMember.id).length === 0 ? (
                        <p className="p-4 text-center text-[10.5px] text-zinc-400 font-semibold bg-white">No referrals logged for this member.</p>
                      ) : (
                        referrals.filter(r => r.fromMemberId === activeMember.id || r.toMemberId === activeMember.id).map(ref => {
                          const isGiven = ref.fromMemberId === activeMember.id;
                          return (
                            <div key={ref.id} className="p-3.5 bg-white hover:bg-zinc-50/50 transition-colors text-body-sm">
                              <div className="flex justify-between items-start">
                                <p className="font-black text-zinc-800">
                                  {isGiven ? `Given to: ${ref.toName}` : `Received from: ${ref.fromName}`}
                                </p>
                                <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded border ${ref.status === 'Connected'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                                    : ref.status === 'Closed'
                                      ? 'bg-zinc-150 text-zinc-650 border-zinc-250'
                                      : 'bg-amber-50 text-amber-700 border-amber-150'
                                  }`}>
                                  {ref.status}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold text-zinc-550 mt-1 italic">"{ref.description}"</p>
                              <span className="text-[8px] text-zinc-455 font-extrabold uppercase mt-1 block">{ref.date}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-zinc-100 bg-white flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setRoleChangeTarget({ id: activeMember.id, name: activeMember.name, isCaptain: activeMember.isCaptain });
                      setActiveMember(null);
                    }}
                    className="flex-1 py-2.5 px-4 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer text-center"
                  >
                    Change Role
                  </button>
                  <button
                    onClick={() => setActiveMember(null)}
                    className="flex-1 py-2.5 px-4 bg-brand-red hover:bg-red-750 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer text-center shadow-xs"
                  >
                    Close View
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Role Change Modal portaled to document.body */}
      {roleChangeTarget && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-6">
          <div
            onClick={() => setRoleChangeTarget(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
          />
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] relative z-10 overflow-hidden animate-fade-in flex flex-col">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-body-md font-black text-zinc-900 leading-tight">Change Member Role</h3>
              <button
                onClick={() => setRoleChangeTarget(null)}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-455 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1">
                <p className="text-caption font-bold text-zinc-400 uppercase tracking-wide">Member</p>
                <p className="text-[13px] font-black text-zinc-900 leading-none">{roleChangeTarget.name}</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-455 uppercase tracking-widest">Select New Role</label>
                <select
                  value={roleChangeTarget.isCaptain ? 'Captain' : 'Member'}
                  onChange={(e) => setRoleChangeTarget(prev => ({ ...prev, isCaptain: e.target.value === 'Captain' }))}
                  className="w-full h-10 px-2.5 border border-zinc-250 bg-white rounded-lg text-body-sm font-bold text-zinc-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="Member">Regular Member</option>
                  <option value="Captain">Table Captain</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setRoleChangeTarget(null)}
                  className="flex-1 py-2 px-4 border border-zinc-250 text-zinc-700 font-bold rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleSaveRole(roleChangeTarget.id, roleChangeTarget.isCaptain);
                    setRoleChangeTarget(null);
                  }}
                  className="flex-1 py-2 px-4 bg-brand-red hover:bg-red-750 text-white font-bold rounded-lg shadow-sm transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
