import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Filter,
  Check,
  Sparkles,
  Info,
  CalendarRange,
  CreditCard
} from 'lucide-react';
import SearchableDropdown from '../../components/SearchableDropdown';
import { api } from '../../services/api';
import { generateUpiUri, generateQrCodeUrl } from '../../utils/paymentUtils';


const formatDateNice = (val, fallback = 'TBD') => {
  if (!val) return fallback;
  let d;
  if (typeof val === 'object' && (val.seconds !== undefined || val._seconds !== undefined)) {
    d = new Date((val.seconds ?? val._seconds) * 1000);
  } else {
    d = new Date(val);
  }
  return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

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

export default function Registrations({ loggedInMember }) {
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_conclaves');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });

  const [member, setMember] = useState(loggedInMember || null);

  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [showRegisteredOnly, setShowRegisteredOnly] = useState(false);
  const [toast, setToast] = useState(null);

  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [selectedConclaveForReg, setSelectedConclaveForReg] = useState(null);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isRegModalOpen) {
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
  }, [isRegModalOpen]);


  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    category: '',
    chapter: '',
    region: '',
    state: '',
    country: '',
    mealPreference: 'Veg',
    needsAccommodation: 'No',
    specialInstructions: '',
    utrNumber: ''
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [memberData, conclavesData] = await Promise.all([
          api.get('/me').catch(() => null),
          api.get('/conclaves').catch(() => [])
        ]);

        if (memberData) {
          setMember(memberData);
          localStorage.setItem('bni_logged_member', JSON.stringify(memberData));
        }

        const mappedConclaves = (Array.isArray(conclavesData) ? conclavesData : []).map((c) => {
          let st = c.status ? (c.status.toLowerCase() === 'running' ? 'Running' : c.status.toLowerCase() === 'completed' ? 'Completed' : c.status.toLowerCase().includes('closed') ? 'Registration Closed' : c.status.toLowerCase().includes('open') ? 'Registration Open' : c.status) : 'Upcoming';
          if (st === 'Running' && (!c.currentRound || Number(c.currentRound) === 0)) {
            const startD = c.date ? new Date(c.date) : (c.startDate ? new Date(c.startDate) : null);
            if (startD && !isNaN(startD.getTime())) {
              const startDateTime = new Date(startD);
              if (c.startTime) {
                const match = String(c.startTime).match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
                if (match) {
                  let h = parseInt(match[1], 10);
                  const m = parseInt(match[2], 10);
                  const meridian = match[3]?.toUpperCase();
                  if (meridian === 'PM' && h < 12) h += 12;
                  if (meridian === 'AM' && h === 12) h = 0;
                  startDateTime.setHours(h, m, 0, 0);
                }
              }
              if (new Date() < startDateTime) {
                st = 'Registration Closed';
              }
            }
          }
          return {
            ...c,
            name: c.name || c.title || 'BNI Conclave',
            venue: c.venue || c.venueLocation || 'TBD Venue',
            region: c.region || 'BNI Region',
            startDate: c.date || c.startDate || null,
            status: st,
            memberCount: c.memberCount || c.registrationCount || 0,
          };
        });
        setConclaves(mappedConclaves);
        localStorage.setItem('bni_conclaves', JSON.stringify(mappedConclaves));
      } catch (err) {
        console.warn('Failed to load member registration data from backend:', err.message);
      }
    }

    loadData();
  }, []);

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Get distinct regions from conclaves list
  const regions = useMemo(() => {
    const list = new Set(conclaves.map(c => c.region).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [conclaves]);

  // All calendar months
  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get distinct years from conclaves list
  const years = useMemo(() => {
    const list = new Set();
    conclaves.forEach(c => {
      if (c.startDate) {
        const date = new Date(c.startDate);
        list.add(date.getFullYear().toString());
      }
    });
    const sorted = Array.from(list).sort();
    return ['All', ...sorted];
  }, [conclaves]);

  // Handle registration action
  const handleRegister = (conclave) => {
    setSelectedConclaveForReg(conclave);
    setRegForm({
      name: member?.name || '',
      email: member?.email || '',
      phone: member?.phone || '',
      company: member?.company || '',
      category: member?.category || '',
      chapter: member?.chapter || '',
      region: member?.region || conclave?.region || 'Global',
      state: member?.state || conclave?.state || 'Andhra Pradesh',
      country: member?.country || conclave?.country || 'India',
      mealPreference: 'Veg',
      tshirtSize: 'L',
      needsAccommodation: 'No',
      specialInstructions: ''
    });
    setIsRegModalOpen(true);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConclaveForReg) return;

    const conclaveId = selectedConclaveForReg.id;
    const conclaveName = selectedConclaveForReg.name;
    const registeredIds = member?.conclaveIds || [];
    if (registeredIds.includes(conclaveId)) return;

    try {
      const res = await api.post(`/conclaves/${conclaveId}/register`, regForm);
      if (res && res.alreadyRegistered) {
        showToastMessage(`You are already registered for ${conclaveName}.`, 'info');
      }
    } catch (err) {
      console.error("Backend registration error:", err.message);
      showToastMessage(err.message || "Failed to register for conclave.", 'error');
      setIsRegModalOpen(false);
      return;
    }

    // 1. Update Member conclaveIds
    const updatedMember = {
      ...member,
      conclaveIds: [...registeredIds, conclaveId]
    };
    setMember(updatedMember);
    localStorage.setItem('bni_logged_member', JSON.stringify(updatedMember));

    const updatedConclaves = conclaves.map(c => {
      if (c.id === conclaveId) {
        return { ...c, isRegistered: true, memberCount: (c.memberCount || 0) + 1 };
      }
      return c;
    });
    setConclaves(updatedConclaves);
    localStorage.setItem('bni_conclaves', JSON.stringify(updatedConclaves));

    const allRegistrations = JSON.parse(localStorage.getItem('bni_conclave_registrations') || '[]');
    allRegistrations.push({
      conclaveId,
      memberId: member?.email || 'unknown',
      ...regForm,
      registeredAt: new Date().toISOString()
    });
    localStorage.setItem('bni_conclave_registrations', JSON.stringify(allRegistrations));

    window.dispatchEvent(new Event('storage'));
    setIsRegModalOpen(false);
    showToastMessage(`Successfully registered for ${conclaveName}!`);
  };

  // Handle deregistration action
  const handleDeregister = async (conclaveId, conclaveName) => {
    try {
      await api.delete(`/conclaves/${conclaveId}/register`);
    } catch (err) {
      console.warn("Backend deregistration warning:", err.message);
    }

    const registeredIds = member?.conclaveIds || [];
    const updatedMember = {
      ...member,
      conclaveIds: registeredIds.filter(id => id !== conclaveId)
    };
    setMember(updatedMember);
    localStorage.setItem('bni_logged_member', JSON.stringify(updatedMember));

    const updatedConclaves = conclaves.map(c => {
      if (c.id === conclaveId) {
        return { ...c, isRegistered: false, memberCount: Math.max(0, (c.memberCount || 1) - 1) };
      }
      return c;
    });
    setConclaves(updatedConclaves);
    localStorage.setItem('bni_conclaves', JSON.stringify(updatedConclaves));

    const allRegistrations = JSON.parse(localStorage.getItem('bni_conclave_registrations') || '[]');
    const filteredRegs = allRegistrations.filter(r => r.conclaveId !== conclaveId);
    localStorage.setItem('bni_conclave_registrations', JSON.stringify(filteredRegs));

    window.dispatchEvent(new Event('storage'));
    showToastMessage(`Cancelled registration for ${conclaveName}.`, 'warning');
  };

  // Helper to determine if current member is registered for a conclave
  const isConclaveRegistered = (c) => {
    const localRegs = JSON.parse(localStorage.getItem('bni_conclave_registrations') || '[]');
    const isLocallyRegistered = localRegs.some(r => r.conclaveId === c.id);
    return Boolean(
      c.isRegistered ||
      c.registered ||
      (member?.conclaveIds || []).includes(c.id) ||
      isLocallyRegistered
    );
  };

  // Filtered conclaves list
  const filteredConclaves = useMemo(() => {
    return conclaves.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.region.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRegion = regionFilter === 'All' || c.region === regionFilter;
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesRegistered = !showRegisteredOnly || isConclaveRegistered(c);

      const matchesMonth = monthFilter === 'All' || (() => {
        if (!c.startDate) return false;
        const date = new Date(c.startDate);
        const monthName = date.toLocaleString('default', { month: 'long' });
        return monthName === monthFilter;
      })();

      const matchesYear = yearFilter === 'All' || (() => {
        if (!c.startDate) return false;
        const date = new Date(c.startDate);
        return date.getFullYear().toString() === yearFilter;
      })();

      return matchesSearch && matchesRegion && matchesStatus && matchesRegistered && matchesMonth && matchesYear;
    });
  }, [conclaves, searchTerm, regionFilter, statusFilter, monthFilter, yearFilter, showRegisteredOnly, member]);

  // Calculations for quick stats
  const registeredCount = useMemo(() => {
    return conclaves.filter(c => isConclaveRegistered(c)).length;
  }, [conclaves, member]);

  const upcomingCount = useMemo(() => {
    return conclaves.filter(c => c.status === 'Running' || c.status === 'Upcoming').length;
  }, [conclaves]);


  return (
    <div className="space-y-6 sm:space-y-8 font-sans pb-10">

      {/* Toast feedback alerts */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-55 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-200 animate-slide-up ${toast.type === 'warning' ? 'bg-amber-655 border-amber-500' : 'bg-zinc-900 border-zinc-800'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${toast.type === 'warning' ? 'bg-white' : 'bg-brand-red'}`}></span>
          <p>{toast.message}</p>
        </div>
      )}

      {/* Header section */}
      <div>
        <h2 className="text-[20px] font-black text-zinc-955 leading-tight">Conclave Registrations</h2>
        <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">
          Browse and register for networking conclaves
        </p>
      </div>

      {/* Quick stats panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-zinc-450 uppercase tracking-wide">All Conclaves</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-zinc-900 leading-none">{conclaves.length}</span>
            <span className="p-2 bg-red-50 text-brand-red rounded-lg border border-red-100">
              <CalendarRange className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-zinc-455 uppercase tracking-wide">My Registrations</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-zinc-900 leading-none">
              {registeredCount} <span className="text-zinc-400 text-xs font-semibold">Chapter Events</span>
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-zinc-455 uppercase tracking-wide">Upcoming & Live</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-2xl font-black text-zinc-900 leading-none">{upcomingCount}</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Filter and search bar controls */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-3xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">

        {/* Search input field */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-55 border border-zinc-200 rounded-lg text-[11px] placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/10 transition-smooth font-semibold text-zinc-700"
            placeholder="Search conclaves, venues, or regions..."
          />
        </div>

        {/* Filters and toggle group */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Region filter dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-zinc-400" />
            <SearchableDropdown
              label="Region"
              options={regions}
              value={regionFilter}
              onChange={setRegionFilter}
              placeholder="Search region..."
            />
          </div>

          {/* Month filter dropdown */}
          <SearchableDropdown
            label="Month"
            options={['All', ...monthsList]}
            value={monthFilter}
            onChange={setMonthFilter}
            placeholder="Search month..."
          />

          {/* Year filter dropdown */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="bg-zinc-55 border border-zinc-200 rounded-lg py-1.5 px-3 text-[11px] font-bold text-zinc-700 focus:outline-none cursor-pointer hover:bg-zinc-100 transition-smooth"
          >
            <option value="All">All Years</option>
            {years.filter(y => y !== 'All').map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-55 border border-zinc-200 rounded-lg py-1.5 px-3 text-[11px] font-bold text-zinc-700 focus:outline-none cursor-pointer hover:bg-zinc-100 transition-smooth"
          >
            <option value="All">All Status</option>
            <option value="Running">Running</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Completed">Completed</option>
          </select>

          {/* Registered checkbox toggle button */}
          <button
            onClick={() => setShowRegisteredOnly(!showRegisteredOnly)}
            className={`py-1.5 px-3 rounded-lg border text-[11px] font-extrabold transition-smooth cursor-pointer ${showRegisteredOnly
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-black shadow-2xs'
              : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'
              }`}
          >
            {showRegisteredOnly ? 'Showing Registered' : 'Show Registered Only'}
          </button>
        </div>
      </div>

      {/* Conclaves card grid listing */}
      {filteredConclaves.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-zinc-50 border border-zinc-200 rounded-full flex items-center justify-center mx-auto text-zinc-400">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[12.5px] font-black text-zinc-800">No conclaves match your filters</p>
            <p className="text-[10.5px] text-zinc-455 font-semibold mt-1">
              Try adjusting your search criteria or choosing a different region filter.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredConclaves.map(c => {
            const localRegs = JSON.parse(localStorage.getItem('bni_conclave_registrations') || '[]');
            const isLocallyRegistered = localRegs.some(r => r.conclaveId === c.id);
            const isRegistered = Boolean(
              c.isRegistered ||
              c.registered ||
              (member?.conclaveIds || []).includes(c.id) ||
              isLocallyRegistered
            );
            const isFull = (c.memberCount || 0) >= (c.memberLimit || 500);
            const isCompleted = (c.status || '').toLowerCase() === 'completed' || (c.status || '').toLowerCase() === 'ended';
            const isDraft = (c.status || '').toLowerCase() === 'draft';
            const percentFilled = Math.min(100, Math.round(((c.memberCount || 0) / (c.memberLimit || 500)) * 100));

            // Registration window dates logic - normalise both sides to YYYY-MM-DD
            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
            const normaliseDate = (val) => {
              if (!val) return null;
              if (typeof val === 'object' && (val.seconds !== undefined || val._seconds !== undefined)) {
                return new Date((val.seconds ?? val._seconds) * 1000).toLocaleDateString('en-CA');
              }
              // Slice ISO string or plain date to just YYYY-MM-DD
              return String(val).slice(0, 10);
            };
            const regStartStr = normaliseDate(c.regStartDate);
            const regEndStr = normaliseDate(c.regEndDate);
            const isBeforeReg = regStartStr && todayStr < regStartStr;
            const isAfterReg = regEndStr && todayStr > regEndStr;

            return (
              <div
                key={c.id}
                className={`bg-white rounded-xl border transition-smooth p-5 flex flex-col justify-between shadow-2xs hover:shadow-sm ${isRegistered
                  ? 'border-emerald-250 bg-emerald-50/10'
                  : 'border-zinc-200'
                  }`}
              >
                <div>

                  {/* Top line tags: status & region */}
                  <div className="flex justify-between items-start gap-3">
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${c.status === 'Running'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      : c.status === 'Upcoming'
                        ? 'bg-amber-50 text-amber-800 border border-amber-100'
                        : c.status === 'Completed'
                          ? 'bg-zinc-100 text-zinc-650 border border-zinc-200'
                          : 'bg-zinc-50 text-zinc-400 border border-zinc-200/50'
                      }`}>
                      {c.status}
                    </span>

                    <span className="px-2 py-0.5 bg-zinc-50 text-zinc-600 border border-zinc-200/80 rounded text-[9px] font-extrabold uppercase tracking-wide">
                      {c.region}
                    </span>

                    {c.paymentDetails?.registrationFee > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-black uppercase tracking-wide">
                        Fee: ₹{c.paymentDetails.registrationFee}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-zinc-50 text-zinc-600 border border-zinc-200 rounded text-[9px] font-bold uppercase tracking-wide">
                        Free Entry
                      </span>
                    )}
                  </div>

                  {/* Title and description */}
                  <div className="mt-3.5">
                    <h4 className="text-[14px] font-black text-zinc-955 tracking-tight leading-snug">{c.name}</h4>
                    <p className="text-[10.5px] text-zinc-450 font-semibold mt-1 leading-relaxed line-clamp-2">
                      {c.description}
                    </p>
                  </div>

                  {/* Metadata fields: venue & dates */}
                  <div className="mt-4 space-y-2 border-t border-b border-zinc-100 py-3 text-[10.5px] font-bold text-zinc-655">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{c.dateRange || 'Dates to be announced'}</span>
                    </div>
                    {(c.startTime || c.endTime) && (
                      <div className="flex items-center gap-2 text-zinc-655 font-bold">
                        <Clock className="w-3.5 h-3.5 text-brand-red shrink-0" />
                        <span>Timing: {formatTimeNice(c.startTime)} – {formatTimeNice(c.endTime)}</span>
                      </div>
                    )}
                    {(c.regStartDate || c.regEndDate) && (
                      <div className="flex items-center gap-2 text-zinc-500 font-semibold">
                        <CalendarRange className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Reg Period: {formatDateNice(c.regStartDate, 'Open')} → {formatDateNice(c.regEndDate, 'Close')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{c.venue}</span>
                    </div>
                  </div>

                </div>

                {/* Call-to-action registration action button */}
                <div className="mt-5 pt-3 border-t border-zinc-100/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <span className="text-[10px] font-extrabold text-zinc-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                        {isRegistered ? 'Registered (Completed)' : 'Event Completed'}
                      </span>
                    ) : isRegistered ? (
                      <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        You are registered
                      </span>
                    ) : isBeforeReg ? (
                      <span className="text-[10px] font-extrabold text-amber-600 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-amber-500" />
                        Opens {formatDateNice(c.regStartDate)}
                      </span>
                    ) : isAfterReg ? (
                      <span className="text-[10px] font-extrabold text-zinc-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                        Closed {formatDateNice(c.regEndDate)}
                      </span>
                    ) : isFull ? (
                      <span className="text-[10px] font-extrabold text-brand-red flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-brand-red" />
                        Fully Booked
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold text-zinc-400">
                        Open for registrations
                      </span>
                    )}
                  </div>

                  <div>
                    {isCompleted ? (
                      <button
                        disabled
                        className="py-1.5 px-3 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed opacity-60"
                      >
                        {isRegistered ? 'Attended' : 'Completed'}
                      </button>
                    ) : isRegistered ? (
                      <button
                        onClick={() => handleDeregister(c.id, c.name)}
                        className="py-1.5 px-3 border border-red-200 text-brand-red rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-50 transition-smooth cursor-pointer"
                      >
                        Cancel Seat
                      </button>
                    ) : isBeforeReg ? (
                      <button
                        disabled
                        className="py-1.5 px-3 bg-zinc-100 text-zinc-400 border border-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed opacity-60"
                      >
                        Soon
                      </button>
                    ) : isAfterReg ? (
                      <button
                        disabled
                        className="py-1.5 px-3 bg-zinc-100 text-zinc-350 border border-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed opacity-60"
                      >
                        Closed
                      </button>
                    ) : isFull ? (
                      <button
                        disabled
                        className="py-1.5 px-3 bg-zinc-100 text-zinc-350 border border-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed opacity-60"
                      >
                        No Seats
                      </button>
                    ) : isDraft ? (
                      <button
                        disabled
                        className="py-1.5 px-3 bg-zinc-55 text-zinc-400 border border-zinc-200 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed opacity-60"
                      >
                        Closed
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegister(c)}
                        className="py-1.5 px-4.5 bg-brand-red hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-smooth cursor-pointer shadow-sm"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MEMBER REGISTRATION FORM MODAL */}
      {isRegModalOpen && selectedConclaveForReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleRegisterSubmit} className="w-full max-w-lg bg-white rounded-xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">

            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-zinc-950 text-[13.5px]">Conclave Registration Form</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">{selectedConclaveForReg.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegModalOpen(false)}
                className="p-1.5 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-750 transition-smooth cursor-pointer border-0 bg-transparent"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Event Info Brief */}
              <div className="bg-zinc-50 border border-zinc-150 p-3 rounded-lg flex flex-col gap-1 text-[11px] font-semibold text-zinc-650">
                <div className="flex justify-between">
                  <span className="text-zinc-400 uppercase font-extrabold text-[9px]">Venue Location</span>
                  <span className="text-zinc-800 font-bold text-right truncate max-w-[250px]">{selectedConclaveForReg.venue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 uppercase font-extrabold text-[9px]">Date Schedule</span>
                  <span className="text-zinc-800 font-bold">{selectedConclaveForReg.dateRange}</span>
                </div>
                {(selectedConclaveForReg.startTime || selectedConclaveForReg.endTime) && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400 uppercase font-extrabold text-[9px]">Timing</span>
                    <span className="text-zinc-800 font-bold">
                      {formatTimeNice(selectedConclaveForReg.startTime)} – {formatTimeNice(selectedConclaveForReg.endTime)}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[10px] font-black text-brand-red uppercase tracking-wider border-b border-zinc-100 pb-1 mt-1">
                Attendee Information
              </div>

              {/* Grid 1: Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Full Name *</label>
                  <input
                    value={regForm.name}
                    onChange={(e) => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Chapter Name *</label>
                  <input
                    value={regForm.chapter}
                    onChange={(e) => setRegForm(prev => ({ ...prev, chapter: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Email Address *</label>
                  <input
                    value={regForm.email}
                    onChange={(e) => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="email"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Phone Number *</label>
                  <input
                    value={regForm.phone}
                    onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Company Name</label>
                  <input
                    value={regForm.company}
                    onChange={(e) => setRegForm(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-455 block mb-1">Category / Industry</label>
                  <input
                    value={regForm.category}
                    onChange={(e) => setRegForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Region *</label>
                  <input
                    value={regForm.region}
                    onChange={(e) => setRegForm(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    placeholder="e.g. Guntur Region"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">State</label>
                  <input
                    value={regForm.state}
                    onChange={(e) => setRegForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    placeholder="e.g. Andhra Pradesh"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Country</label>
                  <input
                    value={regForm.country}
                    onChange={(e) => setRegForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 font-medium text-zinc-800"
                    type="text"
                    placeholder="e.g. India"
                  />
                </div>
              </div>

              <div className="text-[10px] font-black text-brand-red uppercase tracking-wider border-b border-zinc-100 pb-1 mt-3">
                Conclave Preferences
              </div>

              {/* Grid 2: Preferences */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Meal Preference</label>
                  <select
                    value={regForm.mealPreference}
                    onChange={(e) => setRegForm(prev => ({ ...prev, mealPreference: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Jain">Jain</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Accommodation?</label>
                  <select
                    value={regForm.needsAccommodation}
                    onChange={(e) => setRegForm(prev => ({ ...prev, needsAccommodation: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9.5px] font-bold uppercase text-zinc-450 block mb-1">Special Requirements / Notes</label>
                <textarea
                  value={regForm.specialInstructions}
                  onChange={(e) => setRegForm(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-[11.5px] focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 min-h-[50px] font-medium text-zinc-700"
                  placeholder="Allergies, access needs, or pairing request notes..."
                />
              </div>

              {/* Registration Fee & UPI Payment Section */}
              {selectedConclaveForReg?.paymentDetails && (
                <div className="border-t border-zinc-100 pt-3 space-y-3 bg-zinc-50/60 p-3.5 rounded-xl border border-zinc-200/70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-brand-red" />
                      <span className="text-xs font-black text-zinc-900">Registration Payment Details</span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Fee: ₹{selectedConclaveForReg.paymentDetails.registrationFee || 0}
                    </span>
                  </div>

                  {/* UPI QR Code - Auto-generated from upiId or qrCodeUrl, text details remain hidden */}
                  {(() => {
                    const details = selectedConclaveForReg.paymentDetails || {};
                    let qrUrl = details.qrCodeUrl;
                    if (!qrUrl && details.upiId) {
                      const uri = generateUpiUri({
                        upiId: details.upiId,
                        name: details.accountHolderName || selectedConclaveForReg.name,
                        amount: details.registrationFee,
                        note: `${selectedConclaveForReg.name} Registration`
                      });
                      qrUrl = generateQrCodeUrl(uri, 500);
                    }

                    if (qrUrl) {
                      return (
                        <div className="p-4 bg-white rounded-xl border border-zinc-200 space-y-2 shadow-sm">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              Scan to Pay via Any UPI App
                            </span>
                            <div className="p-3 bg-white rounded-xl border-2 border-zinc-200 shadow-md">
                              <img
                                src={qrUrl}
                                alt="Scan UPI QR Code"
                                className="w-48 h-48 object-contain block"
                              />
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium text-center">Point your phone camera / UPI app at the QR code to pay</p>
                          </div>
                        </div>
                      );
                    }

                    if (details.registrationFee > 0) {
                      return (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center space-y-1">
                          <p className="text-[11px] font-bold text-amber-800">Payment QR not available yet</p>
                          <p className="text-[10px] text-amber-600">Please contact the conclave organiser for payment details.</p>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* UTR / Transaction Reference ID Input */}
                  <div>
                    <label className="text-[9.5px] font-bold uppercase text-zinc-650 block mb-1">
                      Payment Transaction Ref / UTR Number
                    </label>
                    <input
                      value={regForm.utrNumber}
                      onChange={(e) => setRegForm(prev => ({ ...prev, utrNumber: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-250 rounded-lg text-[11.5px] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none bg-white font-mono uppercase text-zinc-800"
                      placeholder="e.g. 423512984512 or UTR Ref"
                      type="text"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRegModalOpen(false)}
                className="px-4 py-2 border border-zinc-150 bg-white text-zinc-750 font-bold text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer"
              >
                Confirm Registration
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
