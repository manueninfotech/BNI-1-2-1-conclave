import React, { useState, useEffect } from 'react';
import {
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Search,
  X,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

export default function Referrals({ loggedInUser, userType, conclaveSyncData }) {
  const [referrals, setReferrals] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('received'); // 'received' or 'sent'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
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
  }, [isModalOpen]);



  // Form states
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [referralType, setReferralType] = useState('Inside');
  const [description, setDescription] = useState('');

  // Load referrals on mount, fetch live database records
  useEffect(() => {
    const activeConclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;
    const loadRefs = async () => {
      try {
        let combined = [];

        // 1. Fetch member's referrals across ALL conclaves (completed & active)
        const myRefs = await api.get('/me/referrals').catch(() => null);
        if (myRefs && (Array.isArray(myRefs.given) || Array.isArray(myRefs.received))) {
          const myUid = loggedInUser?.uid || loggedInUser?.id;
          const myName = loggedInUser?.name || 'Member';
          const givenList = (myRefs.given || []).map(r => ({
            id: r.id,
            conclaveId: r.conclaveId,
            conclaveName: r.conclaveName,
            fromUserId: myUid,
            fromMemberId: myUid,
            fromName: myName,
            toUserId: r.otherUserId,
            toMemberId: r.otherUserId,
            toName: r.otherName || 'Recipient',
            notes: r.notes,
            description: r.notes,
            status: r.status || 'Pending',
            outcome: r.outcome || 'open',
            closedAmount: r.closedAmount || 0,
            outcomeNote: r.outcomeNote || '',
            roundNumber: r.roundNumber || 1,
            timestamp: r.createdAt
          }));
          const recvList = (myRefs.received || []).map(r => ({
            id: r.id,
            conclaveId: r.conclaveId,
            conclaveName: r.conclaveName,
            fromUserId: r.otherUserId,
            fromMemberId: r.otherUserId,
            fromName: r.otherName || 'Giver',
            toUserId: myUid,
            toMemberId: myUid,
            toName: myName,
            notes: r.notes,
            description: r.notes,
            status: r.status || 'Pending',
            outcome: r.outcome || 'open',
            closedAmount: r.closedAmount || 0,
            outcomeNote: r.outcomeNote || '',
            roundNumber: r.roundNumber || 1,
            timestamp: r.createdAt
          }));
          combined = [...givenList, ...recvList];
        }

        // 2. Fetch active conclave referrals if available and filter ONLY for current logged-in member
        if (activeConclaveId) {
          const liveRefs = await api.get(`/conclaves/${activeConclaveId}/referrals`).catch(() => []);
          if (Array.isArray(liveRefs)) {
            const existingIds = new Set(combined.map(r => r.id));
            const myUid = loggedInUser?.uid || loggedInUser?.id;
            const myEmail = (loggedInUser?.email || '').toLowerCase();
            const myName = (loggedInUser?.name || '').toLowerCase();

            liveRefs.forEach(r => {
              if (existingIds.has(r.id)) return;

              const fromUser = String(r.fromUserId || r.fromMemberId || '').toLowerCase();
              const toUser = String(r.toUserId || r.toMemberId || '').toLowerCase();
              const fromName = String(r.fromName || '').toLowerCase();
              const toName = String(r.toName || '').toLowerCase();

              const isMine = (myUid && (fromUser === String(myUid).toLowerCase() || toUser === String(myUid).toLowerCase())) ||
                (uids.has(fromUser) || uids.has(toUser));

              if (isMine) {
                combined.push(r);
              }
            });
          }
        }

        if (combined.length > 0) {
          setReferrals(combined);
          localStorage.setItem('bni_referrals', JSON.stringify(combined));
        }
      } catch (err) {
        console.warn("Failed to fetch live referrals:", err.message);
      }
    };
    loadRefs();
    const interval = setInterval(loadRefs, 4000);
    return () => clearInterval(interval);
  }, [conclaveSyncData?.conclaveStatus?.id, conclaveSyncData?.conclaveId, loggedInUser]);

  if (!loggedInUser) {
    return (
      <div className="p-8 text-center text-zinc-500 font-semibold bg-white rounded-xl border border-zinc-200">
        Loading user session...
      </div>
    );
  }

  const myUid = loggedInUser?.uid || loggedInUser?.id || loggedInUser?._originalUid;
  const uids = new Set([
    loggedInUser?.uid,
    loggedInUser?.id,
    loggedInUser?._originalUid
  ].filter(Boolean).map(id => String(id).toLowerCase()));

  const cleanMyName = (loggedInUser?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Merge backend newReferralsReceived from conclaveSyncData if available
  const backendReceived = (conclaveSyncData?.newReferralsReceived || []).map(r => ({
    id: r.id,
    fromMemberId: r.fromUserId,
    fromUserId: r.fromUserId,
    fromName: r.giverName || 'Member',
    toMemberId: myUid,
    toUserId: myUid,
    toName: loggedInUser?.name,
    description: r.notes || 'Referral lead shared during seating round',
    status: r.status || 'Pending',
    date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  }));

  const map = new Map();
  // 1. Put cached referrals first
  referrals.forEach(item => map.set(item.id, item));

  // 2. Put live backend referrals so live DB status ('Connected') ALWAYS overwrites local cache
  backendReceived.forEach(item => {
    const existing = map.get(item.id);
    const liveStatus = item.status && item.status !== 'Pending' ? item.status : (existing?.status || item.status || 'Pending');
    map.set(item.id, existing ? { ...existing, ...item, status: liveStatus } : item);
  });
  const uniqueReferrals = Array.from(map.values());

  // Filter partners list for manual referral form
  const membersData = conclaveSyncData?.members || conclaveSyncData?.registrants || [];
  const captainsData = conclaveSyncData?.captains || [];
  const allPartners = [
    ...membersData.map(m => ({ ...m, isCaptain: false })),
    ...captainsData.map(c => ({ ...c, isCaptain: true }))
  ].filter(p => !uids.has(p.id) && !uids.has(p.uid));


  const filteredPartners = allPartners.filter(p =>
    p.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  // Calculate statistics with strict UID/email matching (no fuzzy "member" substring matching)
  const givenReferrals = uniqueReferrals.filter(r => {
    const fromId = String(r.fromMemberId || r.fromUserId || '').toLowerCase();
    const myUidStr = String(myUid || '').toLowerCase();
    if (fromId && myUidStr && fromId === myUidStr) return true;
    if (r.fromMemberId && uids.has(r.fromMemberId)) return true;
    if (r.fromUserId && uids.has(r.fromUserId)) return true;
    return false;
  });

  const receivedReferrals = uniqueReferrals.filter(r => {
    const toId = String(r.toMemberId || r.toUserId || '').toLowerCase();
    const myUidStr = String(myUid || '').toLowerCase();
    if (toId && myUidStr && toId === myUidStr) return true;
    if (r.toMemberId && uids.has(r.toMemberId)) return true;
    if (r.toUserId && uids.has(r.toUserId)) return true;
    return false;
  });

  const connectedCount = uniqueReferrals.filter(r => {
    const fromId = String(r.fromMemberId || r.fromUserId || '').toLowerCase();
    const toId = String(r.toMemberId || r.toUserId || '').toLowerCase();
    const isMine = (fromId && uids.has(fromId)) || (toId && uids.has(toId));
    const st = String(r.status || '').toLowerCase();
    const out = String(r.outcome || '').toLowerCase();
    const isConnected = st === 'connected' || st === 'closed' || st === 'completed' || out === 'accepted' || out === 'closed';
    return isMine && isConnected;
  }).length;

  const currentList = activeSubTab === 'received' ? receivedReferrals : givenReferrals;

  const handleSendReferral = (e) => {
    e.preventDefault();
    if (!selectedRecipient) {
      setToast({ type: 'error', message: 'Please select a recipient' });
      return;
    }
    if (!description.trim()) {
      setToast({ type: 'error', message: 'Please enter a description' });
      return;
    }

    const newReferral = {
      id: `REF-${Date.now()}`,
      fromMemberId: loggedInUser?.id,
      fromName: loggedInUser?.name,
      toMemberId: selectedRecipient.id,
      toName: selectedRecipient.name,
      referralType: referralType,
      description: description,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0]
    };

    const updatedList = [newReferral, ...referrals];
    setReferrals(updatedList);

    // Show toast and reset form
    setToast({ type: 'success', message: `Referral sent successfully to ${selectedRecipient.name}!` });
    setIsModalOpen(false);
    setSelectedRecipient(null);
    setRecipientSearch('');
    setDescription('');
    setReferralType('Inside');
  };

  const handleUpdateStatus = async (refId, newStatus) => {
    const exists = referrals.some(r => r.id === refId);
    let updated;
    if (exists) {
      updated = referrals.map(r => r.id === refId ? { ...r, status: newStatus } : r);
    } else {
      const targetFromUnique = uniqueReferrals.find(r => r.id === refId);
      if (targetFromUnique) {
        updated = [{ ...targetFromUnique, status: newStatus }, ...referrals];
      } else {
        updated = referrals;
      }
    }
    setReferrals(updated);
    try {
      localStorage.setItem('bni_referrals', JSON.stringify(updated));
    } catch { }

    const targetRef = updated.find(r => r.id === refId);
    const activeConclaveId = targetRef?.conclaveId || conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;
    if (targetRef && activeConclaveId) {
      try {
        await api.post(`/conclaves/${activeConclaveId}/sync`, {
          referrals: [{
            id: targetRef.id,
            fromUserId: targetRef.fromUserId || targetRef.fromMemberId || 'member',
            toUserId: targetRef.toUserId || targetRef.toMemberId || 'recipient',
            fromName: targetRef.fromName || '',
            toName: targetRef.toName || '',
            status: newStatus,
            notes: targetRef.description || targetRef.notes || '',
            roundNumber: Number(targetRef.roundNumber || 1),
            timestamp: targetRef.createdAt || targetRef.timestamp || new Date().toISOString()
          }]
        });
      } catch (err) {
        console.warn("Status sync failed:", err.message);
      }
    }

    setToast({ type: 'success', message: `Referral marked as ${newStatus}!` });
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">

      {/* Header section with Send Referral button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[20px] font-black text-zinc-955 leading-tight">Referral Exchange</h2>
          <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Track your business referrals inside the conclave network. Send referrals directly from table member cards.</p>
        </div>
      </div>

      {/* KPI Stats Strip (Feedback UI & Typography) */}
      <div className="bg-white border border-zinc-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 grid grid-cols-1 sm:grid-cols-3 shadow-xs">
        <div className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Referrals Given</span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-950 tabular-nums">{givenReferrals.length}</span>
            <span className="text-xs font-semibold text-zinc-400">sent</span>
          </div>
          <div className="text-[10px] font-bold text-[#00875A]">Passed to partners</div>
        </div>

        <div className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Referrals Received</span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-950 tabular-nums">{receivedReferrals.length}</span>
            <span className="text-xs font-semibold text-zinc-400">received</span>
          </div>
          <div className="text-[10px] font-bold text-sky-700">Received leads</div>
        </div>

        <div className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider">Connected / Closed</span>
          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-brand-red tabular-nums">{connectedCount}</span>
            <span className="text-xs font-semibold text-zinc-400">deals</span>
          </div>
          <div className="text-[10px] font-bold text-brand-red">Successful conversions</div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
        <div className="flex border-b border-zinc-200 bg-zinc-50/60 p-1.5">
          <button
            onClick={() => setActiveSubTab('received')}
            className={`flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer ${activeSubTab === 'received'
              ? 'bg-white text-brand-red shadow-2xs border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-800'
              }`}
          >
            Received Referrals ({receivedReferrals.length})
          </button>
          <button
            onClick={() => setActiveSubTab('sent')}
            className={`flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer ${activeSubTab === 'sent'
              ? 'bg-white text-brand-red shadow-2xs border border-zinc-200/80'
              : 'text-zinc-500 hover:text-zinc-800'
              }`}
          >
            Sent Referrals ({givenReferrals.length})
          </button>
        </div>

        {/* Referrals list */}
        <div className="p-5">
          {currentList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[12.5px] font-black text-zinc-800">No referral slips found</p>
                <p className="text-[10.5px] text-zinc-450 font-semibold mt-1">
                  {activeSubTab === 'received'
                    ? "You haven't received any referral slips yet."
                    : "You haven't sent any referral slips yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentList.map(ref => (
                <div
                  key={ref.id}
                  className="p-4 border border-zinc-200 bg-zinc-50/20 hover:bg-zinc-50/60 rounded-xl transition-all shadow-3xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Sender/Recipient and Type */}
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-zinc-100 text-zinc-700 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-3xs">
                          {activeSubTab === 'received' ? (ref.fromName || 'M').split(' ').map(n => n[0]).join('') : (ref.toName || 'M').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-zinc-850">
                            {activeSubTab === 'received' ? `From: ${ref.fromName || 'Member'}` : `To: ${ref.toName || 'Member'}`}
                          </p>
                          <span className="text-[8.5px] text-zinc-400 font-extrabold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" /> {ref.date || 'Today'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Message */}
                    <p className="text-[11.5px] font-semibold text-zinc-650 leading-relaxed italic">
                      "{ref.description || ref.notes || 'Referral lead'}"
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 ml-auto">
                    {(() => {
                      const st = (ref.status || '').toLowerCase();
                      const out = (ref.outcome || '').toLowerCase();
                      const isClosed = st === 'connected' || st === 'closed' || st === 'completed' || out === 'closed';
                      const isAccepted = out === 'accepted';

                      if (isClosed) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {ref.closedAmount > 0 ? `Closed (₹${ref.closedAmount.toLocaleString()})` : 'Completed'}
                            </span>
                            {activeSubTab === 'received' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(ref.id, 'Pending')}
                                title="Revert to Pending"
                                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[9px] font-extrabold transition-smooth cursor-pointer"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (isAccepted) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" /> Accepted
                            </span>
                            {activeSubTab === 'received' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(ref.id, 'Connected')}
                                className="px-2.5 py-1 bg-brand-red text-white hover:bg-red-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-3xs flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Mark Complete
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (activeSubTab === 'received') {
                        return (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(ref.id, 'Connected')}
                            className="px-3 py-1 bg-brand-red text-white hover:bg-red-700 rounded-lg text-[9px] font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-3xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Mark Complete
                          </button>
                        );
                      }

                      return (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wider">
                          Pending
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Send Referral Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-zinc-250 w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col">

            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-150 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <Send className="w-4.5 h-4.5 text-brand-red" />
                <h3 className="text-body-md font-black text-zinc-950 uppercase tracking-wide">Send Referral Slip</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSendReferral} className="p-5 space-y-4">

              {/* Recipient Selection */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">BNI Recipient</label>

                {selectedRecipient ? (
                  <div className="p-2.5 border border-brand-red bg-red-50/5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-brand-red text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                        {selectedRecipient.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-[11.5px] font-extrabold text-zinc-900 leading-none">{selectedRecipient.name}</p>
                        <p className="text-[9px] text-zinc-450 font-bold mt-0.5">{selectedRecipient.category} ({selectedRecipient.chapter})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipient(null)}
                      className="text-[9px] font-extrabold text-brand-red hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={recipientSearch}
                        onChange={(e) => {
                          setRecipientSearch(e.target.value);
                          setShowRecipientDropdown(true);
                        }}
                        onFocus={() => setShowRecipientDropdown(true)}
                        placeholder="Search BNI member or category..."
                        className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-[11px] font-semibold text-zinc-750 focus:outline-none focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/10 transition-smooth placeholder-zinc-400 bg-zinc-50/30"
                      />
                    </div>

                    {showRecipientDropdown && recipientSearch.trim() && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-zinc-200 bg-white rounded-lg shadow-xl z-20 divide-y divide-zinc-50">
                        {filteredPartners.length === 0 ? (
                          <p className="p-3 text-center text-[10.5px] text-zinc-400 font-semibold">No members found.</p>
                        ) : (
                          filteredPartners.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedRecipient(p);
                                setShowRecipientDropdown(false);
                              }}
                              className="w-full text-left p-2.5 hover:bg-zinc-50 flex items-center gap-2 transition-smooth cursor-pointer"
                            >
                              <div className="w-6 h-6 bg-zinc-100 text-zinc-650 rounded-full flex items-center justify-center text-[8.5px] font-bold">
                                {p.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className="text-[11.5px] font-bold text-zinc-800 leading-none">{p.name}</p>
                                <p className="text-[9px] text-zinc-450 mt-0.5">{p.category} • {p.chapter} ({p.isCaptain ? 'Captain' : 'Member'})</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Referral Type Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Referral Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReferralType('Inside')}
                    className={`py-2 px-3 text-[11px] font-bold rounded-lg border transition-smooth cursor-pointer ${referralType === 'Inside'
                      ? 'border-brand-red bg-red-50/5 text-brand-red'
                      : 'border-zinc-200 hover:border-zinc-300 text-zinc-500'
                      }`}
                  >
                    Inside (Direct business)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferralType('Outside')}
                    className={`py-2 px-3 text-[11px] font-bold rounded-lg border transition-smooth cursor-pointer ${referralType === 'Outside'
                      ? 'border-brand-red bg-red-50/5 text-brand-red'
                      : 'border-zinc-200 hover:border-zinc-300 text-zinc-500'
                      }`}
                  >
                    Outside (External client)
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Details & Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the referral. What does the client need? How should the member follow up?"
                  rows="3"
                  className="w-full p-3 border border-zinc-200 rounded-lg text-[11.5px] font-semibold text-zinc-750 focus:outline-none focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/10 transition-smooth placeholder-zinc-450 bg-zinc-50/30 resize-none leading-relaxed"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-lg text-[11.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Referral Slip
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          {toast.type === 'success' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></span>
          )}
          <div>
            <p className="font-bold text-white">{toast.type === 'success' ? 'Success!' : 'Alert'}</p>
            <p className="text-zinc-400 mt-0.5">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-zinc-500 hover:text-white font-extrabold shrink-0 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}
