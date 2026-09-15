import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Clock,
  Download,
  Plus,
  Trash2,
  FileText,
  Upload,
  Eye,
  Edit3,
  CreditCard,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import { ResponsiveContainer, BarChart, Bar, XAxis } from 'recharts';
import SearchableDropdown from '../components/SearchableDropdown';
import { api } from '../services/api';
import { extractTextFromPdfDataUrl } from '../utils/documentUtils';
import { generateUpiUri, generateQrCodeUrl } from '../utils/paymentUtils';

const parseDate = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val._seconds !== undefined) {
    return new Date(val._seconds * 1000);
  }
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000);
  }
  if (val && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const getDateSortValue = (val) => {
  const d = parseDate(val);
  return d ? d.getTime() : 0;
};

const formatDateForInput = (val) => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  const d = parseDate(val);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateNice = (val, fallback = 'TBD') => {
  const d = parseDate(val);
  if (!d) return fallback;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const safeRenderString = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object' && (val._seconds !== undefined || val.seconds !== undefined)) {
    const d = parseDate(val);
    return d ? d.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : fallback;
  }
  if (typeof val === 'object') return fallback;
  return String(val);
};

const formatTimeForInput = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{1}:\d{2}$/.test(trimmed)) return `0${trimmed}`;
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = match[2];
      const meridian = match[3].toUpperCase();
      if (meridian === 'PM' && hours < 12) hours += 12;
      if (meridian === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${mins}`;
    }
  }
  const d = parseDate(val);
  if (d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  return '';
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
  const d = parseDate(val);
  if (d) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return String(val);
};

export default function Conclaves({ searchQuery, setActiveTab, loggedInAdmin }) {
  const [conclaves, setConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_admin_conclaves_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.map(c => ({
            ...c,
            startDate: formatDateForInput(c.startDate || c.date)
          }));
        }
      } catch (e) { }
    }
    return [];
  });
  const [isLoadingConclaves, setIsLoadingConclaves] = useState(true);

  useEffect(() => {
    async function loadConclaves() {
      try {
        const data = await api.get('/admin/conclaves?global=true');
        const mapped = data.map(c => {
          let state = c.state;
          let country = c.country;
          if (!state || !country) {
            const r = (c.region || "").toLowerCase();
            if (r.includes("guntur")) {
              state = "Andhra Pradesh";
              country = "India";
            } else if (r.includes("london")) {
              state = "Greater London";
              country = "United Kingdom";
            } else if (r.includes("singapore")) {
              state = "Central Region";
              country = "Singapore";
            } else if (r.includes("south")) {
              state = "Tamil Nadu";
              country = "India";
            } else {
              state = c.state || '';
              country = c.country || '';
            }
          }

          const venue = c.venueLocation || c.venue || 'N/A';
          const venueShort = venue.split(',')[0] || 'N/A';
          const startDate = formatDateForInput(c.date || c.startDate);
          const dateRange = (typeof c.dateRange === 'string' && c.dateRange) ? c.dateRange : (c.date ? safeRenderString(c.date, 'TBD') : 'TBD');
          const coordinator = c.coordinator || c.creator || loggedInAdmin?.name || 'Admin';

          let status = c.status;
          const s = (c.status || '').toLowerCase().replace(/_/g, '');
          if (s === 'running' || s === 'active') status = 'Running';
          else if (s === 'completed') status = 'Completed';
          else if (s === 'cancelled') status = 'Cancelled';
          else if (s === 'draft') status = 'Draft';
          else status = 'Upcoming';

          const currentR = Number(c.currentRound) || 0;
          const totalR = Number(c.roundCount) || 5;
          const isCompleted = s === 'completed' || s === 'finished';
          const isRunning = s === 'running' || s === 'active';
          const hasSchedule = Boolean(c.scheduleSummary || c.schedule);

          let progress = 0;
          if (isCompleted) {
            progress = 100;
          } else if (isRunning) {
            progress = totalR > 0 ? Math.min(95, Math.max(20, Math.round((currentR / totalR) * 100))) : 50;
          } else if (hasSchedule) {
            progress = 30; // Schedule generated & ready for rounds
          } else {
            progress = 0;
          }

          return {
            ...c,
            state,
            country,
            venue,
            venueShort,
            startDate,
            dateRange,
            startTime: formatTimeForInput(c.startTime),
            endTime: formatTimeForInput(c.endTime),
            coordinator,
            status,
            memberCount: c.registrationCount ?? c.memberCount ?? 0,
            memberLimit: c.memberLimit || 100,
            captainCount: c.captainCount || 0,
            captainLimit: c.captainLimit || 12,
            progress
          };
        });
        setConclaves(mapped);
        localStorage.setItem('bni_admin_conclaves_cache', JSON.stringify(mapped));
      } catch (err) {
        console.error("Failed to load conclaves from API:", err);
      } finally {
        setIsLoadingConclaves(false);
      }
    }
    loadConclaves();
  }, []);

  useEffect(() => {
    if (conclaves && conclaves.length > 0) {
      localStorage.setItem('bni_conclaves', JSON.stringify(conclaves));
      window.dispatchEvent(new Event('storage'));
    }
  }, [conclaves]);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== null) {
      setSearchTerm(searchQuery);
    }
  }, [searchQuery]);

  const searchVal = searchTerm;
  const [statusFilter, setStatusFilter] = useState('All');
  const [venueFilter, setVenueFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('DateDesc');
  const [selectedConclave, setSelectedConclave] = useState(null);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (selectedConclave) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedConclave]);
  const [viewScope, setViewScope] = useState('global'); // 'region' or 'global' - default to global so all conclaves are visible

  // Checked rows
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [agendaUploadTarget, setAgendaUploadTarget] = useState(null);
  const [isUploadingAgenda, setIsUploadingAgenda] = useState(false);
  const [agendaInputText, setAgendaInputText] = useState('');

  useEffect(() => {
    if (agendaUploadTarget) {
      const stored = localStorage.getItem(`bni_agenda_text_${agendaUploadTarget.id}`) ||
        agendaUploadTarget.agendaText ||
        '';
      setAgendaInputText(stored);
    } else {
      setAgendaInputText('');
    }
  }, [agendaUploadTarget]);

  const handleSaveAgendaText = async () => {
    if (!agendaUploadTarget) return;
    try {
      const textVal = agendaInputText.trim();
      localStorage.setItem(`bni_agenda_text_${agendaUploadTarget.id}`, textVal);
      localStorage.setItem('bni_conclave_agenda_text', textVal);

      // Dynamically generate a brand-new PDF containing ONLY the new text
      const freshPdfDataUrl = createFreshAgendaPdfDataUrl(textVal, agendaUploadTarget.name);
      const newAgendaDoc = {
        name: `${agendaUploadTarget.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}_Official_Agenda.pdf`,
        dataUrl: freshPdfDataUrl,
        type: 'application/pdf',
        size: '1.0 MB',
        uploadedAt: new Date().toISOString()
      };

      localStorage.setItem(`bni_agenda_doc_${agendaUploadTarget.id}`, JSON.stringify(newAgendaDoc));
      localStorage.setItem('bni_conclave_agenda_doc', JSON.stringify(newAgendaDoc));

      setConclaves(prev => prev.map(c => c.id === agendaUploadTarget.id ? { ...c, agendaText: textVal, agendaDocument: newAgendaDoc } : c));
      if (selectedConclave && selectedConclave.id === agendaUploadTarget.id) {
        setSelectedConclave(prev => ({ ...prev, agendaText: textVal, agendaDocument: newAgendaDoc }));
      }

      // Sync with backend if API is live
      try {
        await api.post(`/admin/conclaves/${agendaUploadTarget.id}/agenda-document`, { agendaDocument: newAgendaDoc });
      } catch (e) { }

      showToast('New Agenda Published 🎉', 'Brand new PDF document and schedule published for Members & Captains.');
      setAgendaUploadTarget(null);
    } catch (err) {
      showToast('Save Failed', 'Could not save agenda text.');
    }
  };

  // Lock background body scroll when any modal is open
  useEffect(() => {
    if (isAddModalOpen || isEditModalOpen || deleteTarget || isBulkDeleteOpen || agendaUploadTarget) {
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
  }, [isAddModalOpen, isEditModalOpen, deleteTarget, isBulkDeleteOpen, agendaUploadTarget]);

  const handleAgendaFileUpload = async (e, conclaveId) => {
    const file = e.target.files?.[0];
    if (!file || !conclaveId) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('File Too Large', 'Please select an agenda document under 25MB.');
      return;
    }

    setIsUploadingAgenda(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const extractedPdfText = extractTextFromPdfDataUrl(reader.result);

        const fileObj = {
          name: file.name,
          dataUrl: reader.result,
          rawText: extractedPdfText,
          agendaText: extractedPdfText,
          type: file.type || 'application/pdf',
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadedAt: new Date().toISOString()
        };

        if (extractedPdfText) {
          localStorage.setItem(`bni_agenda_text_${conclaveId}`, extractedPdfText);
          localStorage.setItem('bni_conclave_agenda_text', extractedPdfText);
        }

        const res = await api.post(`/admin/conclaves/${conclaveId}/agenda-document`, { agendaDocument: fileObj });

        const updatedDoc = res?.agendaDocument || fileObj;

        // Update local state and local storage cache
        setConclaves(prev => prev.map(c => c.id === conclaveId ? { ...c, agendaDocument: updatedDoc, agendaText: extractedPdfText || c.agendaText } : c));
        localStorage.setItem(`bni_agenda_doc_${conclaveId}`, JSON.stringify(updatedDoc));
        localStorage.setItem('bni_conclave_agenda_doc', JSON.stringify(updatedDoc));
        if (selectedConclave && selectedConclave.id === conclaveId) {
          setSelectedConclave(prev => ({ ...prev, agendaDocument: updatedDoc }));
        }

        showToast('Agenda Published 🎉', `Official document "${file.name}" uploaded and published for Members & Captains.`);
        setAgendaUploadTarget(null);
      } catch (err) {
        showToast('Upload Error', err.message || 'Failed to upload agenda document.');
      } finally {
        setIsUploadingAgenda(false);
      }
    };
    reader.readAsDataURL(file);
  };



  // Form states
  const [formData, setFormData] = useState({
    name: '',
    venue: '',
    venueShort: '',
    dateRange: '',
    startDate: '',
    endDate: '',
    regStartDate: new Date().toISOString().slice(0, 10),
    regEndDate: '',
    memberLimit: 500,
    captainLimit: 20,
    status: 'Draft',
    region: '',
    coordinator: '',
    description: '',
    state: '',
    country: '',
    registrationFee: 0,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    upiId: '',
    upiQrImageUrl: ''
  });

  const [toast, setToast] = useState(null);
  const showToast = (title, desc) => {
    setToast({ title, desc });
    setTimeout(() => setToast(null), 3000);
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Get distinct states and countries - exclude blank/N/A values
  const statesList = useMemo(() => {
    const list = new Set(conclaves.map(c => c.state).filter(v => v && v !== 'N/A'));
    return ['All', ...Array.from(list).sort()];
  }, [conclaves]);

  const countriesList = useMemo(() => {
    const list = new Set(conclaves.map(c => c.country).filter(v => v && v !== 'N/A'));
    return ['All', ...Array.from(list).sort()];
  }, [conclaves]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [searchVal, statusFilter, venueFilter, stateFilter, countryFilter, sortBy, viewScope]);

  // Filtered & Sorted conclaves
  const filteredConclaves = useMemo(() => {
    const q = (searchVal || '').trim().toLowerCase();

    let result = conclaves.filter(c => {
      const matchesSearch = !q || (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.venue && c.venue.toLowerCase().includes(q)) ||
        (c.coordinator && c.coordinator.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.region && c.region.toLowerCase().includes(q)) ||
        (c.status && c.status.toLowerCase().includes(q))
      );

      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesVenue = venueFilter === 'All' || c.venueShort === venueFilter;
      const adminReg = (loggedInAdmin?.region || loggedInAdmin?.scope || '').toLowerCase().trim();
      const concReg = (c.region || '').toLowerCase().trim();

      // In global mode show every conclave; in region mode filter by admin's region
      const matchesViewScope = viewScope === 'global'
        ? true
        : (!adminReg || adminReg === 'global' || adminReg.includes('global') || concReg.includes(adminReg) || adminReg.includes(concReg));
      const matchesState = stateFilter === 'All' || c.state === stateFilter;
      const matchesCountry = countryFilter === 'All' || c.country === countryFilter;

      return matchesSearch && matchesStatus && matchesVenue && matchesViewScope && matchesState && matchesCountry;
    });

    // Sorting logic - guard against undefined fields & object timestamps
    if (sortBy === 'NameAsc') {
      result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    } else if (sortBy === 'Capacity') {
      result.sort((a, b) => (Number(b.memberLimit) || 0) - (Number(a.memberLimit) || 0));
    } else { // DateDesc
      result.sort((a, b) => {
        const timeA = getDateSortValue(a.startDate || a.date);
        const timeB = getDateSortValue(b.startDate || b.date);
        return timeB - timeA;
      });
    }

    return result;
  }, [conclaves, searchVal, statusFilter, venueFilter, stateFilter, countryFilter, sortBy, loggedInAdmin, viewScope]);

  // Paginated list
  const paginatedConclaves = useMemo(() => {
    const totalPages = Math.ceil(filteredConclaves.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredConclaves.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredConclaves, currentPage, itemsPerPage]);

  const toggleRow = (id, e) => {
    e.stopPropagation();
    const updated = new Set(selectedRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRows(updated);
  };

  const toggleSelectAll = () => {
    const hisCreatedConclaves = filteredConclaves.filter(c => c.coordinator === loggedInAdmin?.name);
    if (selectedRows.size === hisCreatedConclaves.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(hisCreatedConclaves.map(c => c.id)));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setVenueFilter('All');
    setStateFilter('All');
    setCountryFilter('All');
    setSortBy('DateDesc');
    setSelectedRows(new Set());
  };

  // CSV Export
  const handleExport = () => {
    if (filteredConclaves.length === 0) {
      showToast('No conclaves to export', 'error');
      return;
    }
    const headers = ['ID', 'Conclave Name', 'Venue', 'Date Range', 'Members Ratio', 'Captains Ratio', 'Status', 'Coordinator'];
    const rows = filteredConclaves.map(c => [
      c.id,
      `"${c.name}"`,
      `"${c.venue}"`,
      `"${c.dateRange}"`,
      `"${c.memberCount}/${c.memberLimit}"`,
      `"${c.captainCount}/${c.captainLimit}"`,
      c.status,
      c.coordinator
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bni_conclaves_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Completed', `Successfully exported ${filteredConclaves.length} conclave entries.`);
  };

  const handleBulkExport = () => {
    const selectedList = conclaves.filter(c => selectedRows.has(c.id));
    if (selectedList.length === 0) return;
    const headers = ['ID', 'Conclave Name', 'Venue', 'Date Range', 'Members Ratio', 'Captains Ratio', 'Status', 'Coordinator'];
    const rows = selectedList.map(c => [
      c.id,
      `"${c.name}"`,
      `"${c.venue}"`,
      `"${c.dateRange}"`,
      `"${c.memberCount}/${c.memberLimit}"`,
      `"${c.captainCount}/${c.captainLimit}"`,
      c.status,
      c.coordinator
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selected_conclaves_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Selected', `Successfully exported ${selectedList.length} conclaves.`);
  };

  const handleDateChange = (field, val) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: val };
      const start = updated.startDate ? new Date(updated.startDate) : null;
      const end = updated.endDate ? new Date(updated.endDate) : null;

      let formattedRange = '';
      if (start && !isNaN(start.getTime())) {
        const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (end && !isNaN(end.getTime()) && updated.startDate !== updated.endDate) {
          const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          formattedRange = `${startStr} - ${endStr}`;
        } else {
          formattedRange = startStr;
        }
      }
      if (formattedRange) {
        updated.dateRange = formattedRange;
      }
      return updated;
    });
  };

  const openAddModal = () => {
    const defaultReg = loggedInAdmin?.region || loggedInAdmin?.scope || '';
    const defaultCoord = loggedInAdmin?.name || 'Administrator';
    setFormData({
      name: '',
      venue: '',
      venueShort: '',
      dateRange: '',
      startDate: '',
      endDate: '',
      startTime: '09:00',
      endTime: '17:00',
      regStartDate: new Date().toISOString().slice(0, 10),
      regEndDate: '',
      memberLimit: 100,
      captainLimit: 12,
      status: 'Upcoming',
      region: defaultReg,
      coordinator: defaultCoord,
      description: '',
      registrationFee: 0,
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      accountHolderName: '',
      upiId: '',
      upiQrImageUrl: ''
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.venue) {
      showToast('Validation Error', 'Please fill in all mandatory fields.');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        venueLocation: formData.venue,
        date: formData.startDate || new Date().toISOString(),
        endDate: formData.endDate || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        regStartDate: formData.regStartDate || undefined,
        regEndDate: formData.regEndDate || undefined,
        dateRange: formData.dateRange || 'TBD',
        region: formData.region || loggedInAdmin?.region || loggedInAdmin?.scope || '',
        coordinator: formData.coordinator || loggedInAdmin?.name || 'Administrator',
        personsPerTable: Number(formData.personsPerTable) || 7,
        roundCount: Number(formData.roundCount) || 4,
        memberLimit: Number(formData.memberLimit) || 100,
        captainLimit: Number(formData.captainLimit) || 12,
        paymentDetails: {
          registrationFee: Number(formData.registrationFee) || 0,
          bankName: (formData.bankName || '').trim(),
          accountNumber: (formData.accountNumber || '').trim(),
          ifscCode: (formData.ifscCode || '').trim(),
          accountHolderName: (formData.accountHolderName || '').trim(),
          upiId: (formData.upiId || '').trim(),
          upiQrImageUrl: (formData.upiQrImageUrl || '').trim(),
        }
      };

      await api.post('/admin/conclaves', payload);
      showToast('Conclave Created', `"${formData.name}" has been successfully added.`);
      setIsAddModalOpen(false);

      const freshData = await api.get('/admin/conclaves?global=true');
      if (Array.isArray(freshData)) {
        setConclaves(freshData.map(c => ({
          ...c,
          venue: c.venueLocation || c.venue || 'N/A',
          venueShort: (c.venueLocation || c.venue || 'N/A').split(',')[0],
          dateRange: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'TBD',
          startDate: formatDateForInput(c.date || c.startDate),
          startTime: formatTimeForInput(c.startTime),
          endTime: formatTimeForInput(c.endTime),
          coordinator: c.coordinator || loggedInAdmin?.name || 'Admin',
          status: c.status || 'Upcoming',
          memberCount: c.registrationCount ?? c.memberCount ?? 0,
          memberLimit: c.memberLimit ?? 100,
          captainCount: c.captainCount || 0,
          captainLimit: c.captainLimit ?? 12,
          progress: c.status === 'Completed' ? 100 : c.status === 'Running' ? 80 : c.status === 'Upcoming' ? 40 : 5
        })));
      }
    } catch (err) {
      console.error("Failed to create conclave:", err);
      showToast('Creation Error', err.message || 'Failed to create conclave.');
    }
  };

  const openEditModal = (c) => {
    const pay = c.paymentDetails || {};
    setFormData({
      id: c.id,
      name: c.name || '',
      venue: c.venue || c.venueLocation || '',
      venueShort: c.venueShort || '',
      dateRange: c.dateRange || '',
      startDate: formatDateForInput(c.startDate || c.date),
      endDate: formatDateForInput(c.endDate),
      startTime: formatTimeForInput(c.startTime) || '09:00',
      endTime: formatTimeForInput(c.endTime) || '17:00',
      regStartDate: formatDateForInput(c.regStartDate),
      regEndDate: formatDateForInput(c.regEndDate),
      memberCount: c.memberCount || 0,
      memberLimit: c.memberLimit ?? 100,
      captainCount: c.captainCount || 0,
      captainLimit: c.captainLimit ?? 12,
      status: c.status || 'Upcoming',
      region: c.region || '',
      coordinator: c.coordinator || '',
      description: c.description || '',
      registrationFee: pay.registrationFee || 0,
      bankName: pay.bankName || '',
      accountNumber: pay.accountNumber || '',
      ifscCode: pay.ifscCode || '',
      accountHolderName: pay.accountHolderName || '',
      upiId: pay.upiId || '',
      upiQrImageUrl: pay.upiQrImageUrl || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        venueLocation: formData.venue,
        region: formData.region || loggedInAdmin?.region || loggedInAdmin?.scope || '',
        coordinator: formData.coordinator || loggedInAdmin?.name || 'Administrator',
        status: formData.status,
        dateRange: formData.dateRange,
        date: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        regStartDate: formData.regStartDate || undefined,
        regEndDate: formData.regEndDate || undefined,
        memberLimit: Number(formData.memberLimit) || 100,
        captainLimit: Number(formData.captainLimit) || 12,
        description: formData.description,
        paymentDetails: {
          registrationFee: Number(formData.registrationFee) || 0,
          bankName: (formData.bankName || '').trim(),
          accountNumber: (formData.accountNumber || '').trim(),
          ifscCode: (formData.ifscCode || '').trim(),
          accountHolderName: (formData.accountHolderName || '').trim(),
          upiId: (formData.upiId || '').trim(),
          upiQrImageUrl: (formData.upiQrImageUrl || '').trim(),
        }
      };
      await api.put(`/admin/conclaves/${formData.id}`, payload);
      showToast('Conclave Updated', `Successfully updated conclave profile data.`);
      setIsEditModalOpen(false);

      const freshData = await api.get('/admin/conclaves?global=true');
      if (Array.isArray(freshData)) {
        setConclaves(freshData.map(c => ({
          ...c,
          venue: c.venueLocation || c.venue || 'N/A',
          venueShort: (c.venueLocation || c.venue || 'N/A').split(',')[0],
          dateRange: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'TBD',
          startDate: formatDateForInput(c.date || c.startDate),
          startTime: formatTimeForInput(c.startTime),
          endTime: formatTimeForInput(c.endTime),
          coordinator: c.coordinator || loggedInAdmin?.name || 'Admin',
          status: c.status || 'Upcoming',
          progress: c.status === 'Completed' ? 100 : c.status === 'Running' ? 60 : 0
        })));
      }
    } catch (err) {
      console.error("Failed to update conclave:", err);
      showToast('Update Error', err.message || 'Failed to update conclave.');
    }
  };

  // KPI aggregates
  const runningCount = conclaves.filter(c => c.status === 'Running').length;
  const upcomingCount = conclaves.filter(c => c.status === 'Upcoming').length;
  const completedCount = conclaves.filter(c => c.status === 'Completed').length;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in">

      {/* Breadcrumbs & Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-955 font-extrabold tracking-tight">Conclave Management</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Create and manage BNI conclave schedules and lifecycle events.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Export
          </button>
          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Conclave
          </button>
        </div>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex border-b border-zinc-200 -mt-2">
        <button
          onClick={() => setViewScope('region')}
          className={`px-4 py-2 text-body-sm font-black uppercase tracking-wider border-b-2 transition-smooth cursor-pointer -mb-px ${viewScope === 'region'
            ? 'border-brand-red text-brand-red font-extrabold'
            : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
        >
          My Region
        </button>
        <button
          onClick={() => setViewScope('global')}
          className={`px-4 py-2 text-body-sm font-black uppercase tracking-wider border-b-2 transition-smooth cursor-pointer -mb-px ${viewScope === 'global'
            ? 'border-brand-red text-brand-red font-extrabold'
            : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
        >
          Global Network
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Portfolios</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{conclaves.length}</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Running Now</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-brand-red leading-none">{runningCount}</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Upcoming Seminars</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{upcomingCount}</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Completed Runs</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="bg-white border border-zinc-200/80 p-3.5 flex flex-col lg:flex-row gap-3 items-center justify-between rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm placeholder-zinc-400 focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth bg-zinc-50/20"
              placeholder="Search conclaves, venues or region..."
              type="text"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <SearchableDropdown
              label="Status"
              options={['All', 'Upcoming', 'Running', 'Completed']}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Search status..."
            />

            <SearchableDropdown
              label="State"
              options={statesList}
              value={stateFilter}
              onChange={setStateFilter}
              placeholder="Search state..."
            />

            <SearchableDropdown
              label="Country"
              options={countriesList}
              value={countryFilter}
              onChange={countryFilter === 'All' ? setCountryFilter : (val) => {
                setCountryFilter(val);
                // When selecting a country, reset state filter if it doesn't belong to it (optional check)
              }}
              placeholder="Search country..."
            />
          </div>
        </div>
        <button
          onClick={handleResetFilters}
          className="text-label-md font-bold text-brand-red hover:underline px-4 cursor-pointer shrink-0 transition-smooth text-button"
        >
          Reset Filters
        </button>
      </div>

      {/* Conclaves list table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-label-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-4 w-12 text-center">
                  <input
                    checked={filteredConclaves.length > 0 && selectedRows.size === filteredConclaves.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                    type="checkbox"
                  />
                </th>
                <th className="px-5 py-4">Conclave Name</th>
                <th className="px-5 py-4">Region</th>
                <th className="px-5 py-4">Coordinator</th>
                <th className="px-5 py-4">Date Schedule</th>
                <th className="px-5 py-4">Venue Location</th>
                <th className="px-5 py-4 text-center">Members</th>
                <th className="px-5 py-4 text-center">Captains</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Progress</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-table-text">
              {filteredConclaves.length === 0 ? (
                <tr>
                  <td colSpan="11" className="p-8 text-center text-zinc-400 font-medium">
                    No conclaves found matching the filter tags.
                  </td>
                </tr>
              ) : (
                paginatedConclaves.map((conclave) => {
                  const isSuperadmin = loggedInAdmin?.role === 'superadmin';
                  const adminReg = (loggedInAdmin?.region || loggedInAdmin?.scope || '').toLowerCase().trim();
                  const concReg = (conclave.region || '').toLowerCase().trim();
                  const matchesRegion = Boolean(adminReg && concReg && (adminReg.includes(concReg) || concReg.includes(adminReg)));
                  const isHisCreated = isSuperadmin || matchesRegion;
                  return (
                    <tr
                      key={conclave.id}
                      onClick={() => setSelectedConclave(conclave)}
                      className="group cursor-pointer"
                    >
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          checked={selectedRows.has(conclave.id)}
                          onChange={(e) => toggleRow(conclave.id, e)}
                          disabled={!isHisCreated}
                          className={`rounded border-zinc-300 text-brand-red focus:ring-brand-red w-4 h-4 ${!isHisCreated ? 'cursor-not-allowed opacity-30 bg-zinc-100' : 'cursor-pointer'
                            }`}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-body-sm font-bold text-zinc-900 transition-smooth leading-tight">{safeRenderString(conclave.name)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-555 text-[10px] font-bold rounded-full whitespace-nowrap">
                          {safeRenderString(conclave.region, 'Global')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-red/10 text-brand-red font-bold text-[10px] flex items-center justify-center shrink-0">
                            {safeRenderString(conclave.coordinatorAvatar, 'A')}
                          </div>
                          <span className="font-semibold text-zinc-700">{safeRenderString(conclave.coordinator)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-650">{safeRenderString(conclave.dateRange, 'TBD')}</div>
                        {(conclave.startTime || conclave.endTime) && (
                          <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-brand-red shrink-0" />
                            <span>
                              {formatTimeNice(conclave.startTime)}
                              {conclave.startTime && conclave.endTime ? ' – ' : ''}
                              {formatTimeNice(conclave.endTime)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-zinc-650">{safeRenderString(conclave.venueShort, 'N/A')}</td>
                      <td className="px-5 py-4 text-center font-bold text-zinc-800">
                        {conclave.memberCount}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-zinc-800">
                        {conclave.captainCount}
                      </td>
                      <td className="px-5 py-4">
                        {conclave.status === 'Running' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Running
                          </span>
                        ) : conclave.status === 'Upcoming' ? (
                          <span className="inline-flex items-center gap-1 text-brand-red bg-red-50 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span> Upcoming
                          </span>
                        ) : conclave.status === 'Draft' ? (
                          <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> Completed
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden border border-zinc-200/10">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart layout="vertical" data={[{ value: conclave.progress }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <XAxis type="number" domain={[0, 100]} hide />
                                <Bar dataKey="value" fill={conclave.status === 'Completed' ? '#3f3f46' : conclave.status === 'Draft' ? '#a1a1aa' : '#af101a'} radius={[2, 2, 2, 2]} background={{ fill: '#f4f4f5' }} barSize={6} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-600">{conclave.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedConclave(conclave)}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-smooth cursor-pointer"
                            title="View Conclave Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setAgendaUploadTarget(conclave)}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 transition-smooth cursor-pointer"
                            title="Upload Agenda Document"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => isHisCreated && openEditModal(conclave)}
                            disabled={!isHisCreated}
                            className={`p-1.5 rounded-lg transition-smooth ${!isHisCreated ? 'text-zinc-300 cursor-not-allowed opacity-40' : 'hover:bg-zinc-100 text-zinc-500 hover:text-brand-red cursor-pointer'
                              }`}
                            title="Edit Conclave Profile"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => isHisCreated && setDeleteTarget(conclave)}
                            disabled={!isHisCreated}
                            className={`p-1.5 rounded-lg transition-smooth ${!isHisCreated ? 'text-zinc-300 cursor-not-allowed opacity-40' : 'hover:bg-red-50 text-zinc-400 hover:text-brand-red cursor-pointer'
                              }`}
                            title="Delete Conclave"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredConclaves.length}
          onPageChange={setCurrentPage}
          label="conclaves"
        />
      </div>

      {/* Conclave Details Drawer */}
      {createPortal(
        <>
          <div
            onClick={() => setSelectedConclave(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${selectedConclave ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
          />

          <div className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[440px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${selectedConclave ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}>
            {selectedConclave && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConclave(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-section-heading font-extrabold text-zinc-950">Conclave Details</h3>
                    </div>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">

                  {/* Conclave Top Overview Card */}
                  <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-700 text-[10px] font-extrabold rounded uppercase tracking-wider">
                        {selectedConclave.region || 'Global'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        selectedConclave.status === 'Running' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        selectedConclave.status === 'Upcoming' ? 'bg-red-50 text-brand-red border border-red-200' :
                        'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}>
                        {selectedConclave.status || 'Upcoming'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-base font-black text-zinc-900 leading-snug">{safeRenderString(selectedConclave.name)}</h4>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">{safeRenderString(selectedConclave.venue || selectedConclave.venueLocation, 'Venue TBD')}</p>
                    </div>
                    <div className="pt-2 border-t border-zinc-200/60 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-bold uppercase text-[9px]">Date:</span>
                        <span>{safeRenderString(selectedConclave.dateRange, 'TBD')}</span>
                      </div>
                      {(selectedConclave.startTime || selectedConclave.endTime) && (
                        <div className="flex items-center gap-1.5 text-brand-red font-bold">
                          <Clock className="w-3.5 h-3.5 text-brand-red shrink-0" />
                          <span>
                            {formatTimeNice(selectedConclave.startTime)}
                            {selectedConclave.startTime && selectedConclave.endTime ? ' – ' : ''}
                            {formatTimeNice(selectedConclave.endTime)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment & Bank Details in Drawer */}
                  {selectedConclave.paymentDetails && (
                    <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-brand-red" />
                          <span className="text-xs font-black text-zinc-900">Payment & Bank Details</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Fee: ₹{selectedConclave.paymentDetails.registrationFee || 0}
                        </span>
                      </div>

                      {selectedConclave.paymentDetails.upiId && (
                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-zinc-200">
                          <img
                            src={generateQrCodeUrl(generateUpiUri({
                              upiId: selectedConclave.paymentDetails.upiId,
                              name: selectedConclave.paymentDetails.accountHolderName || selectedConclave.name,
                              amount: selectedConclave.paymentDetails.registrationFee,
                              note: `${selectedConclave.name} Registration`
                            }), 120)}
                            alt="UPI QR Code"
                            className="w-14 h-14 bg-white p-1 rounded border border-zinc-200 shrink-0"
                          />
                          <div>
                            <span className="text-[9px] font-extrabold uppercase text-zinc-400">UPI ID</span>
                            <p className="text-xs font-black text-zinc-900 font-mono mt-0.5">{selectedConclave.paymentDetails.upiId}</p>
                            <p className="text-[10px] text-zinc-500 font-medium">{selectedConclave.paymentDetails.accountHolderName || 'BNI Chapter Account'}</p>
                          </div>
                        </div>
                      )}

                      {selectedConclave.paymentDetails.bankName && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className="text-zinc-400 font-bold uppercase text-[9px] block">Bank Name</span>
                            <span className="font-bold text-zinc-800">{selectedConclave.paymentDetails.bankName}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-bold uppercase text-[9px] block">Account Number</span>
                            <span className="font-bold text-zinc-800 font-mono">{selectedConclave.paymentDetails.accountNumber || '—'}</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 font-bold uppercase text-[9px] block">IFSC Code</span>
                            <span className="font-bold text-zinc-800 font-mono">{selectedConclave.paymentDetails.ifscCode || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Registration Window Info */}
                  {(selectedConclave.regStartDate || selectedConclave.regEndDate) && (
                    <div className="space-y-2 border-l-2 border-brand-red pl-3 py-0.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Registration Period</span>
                      <span className="text-body-sm font-semibold text-zinc-755 block">
                        {formatDateNice(selectedConclave.regStartDate)}
                        <span className="text-zinc-400 mx-2">→</span>
                        {formatDateNice(selectedConclave.regEndDate)}
                      </span>
                    </div>
                  )}

                  {/* Grid Metadata */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Region Group</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">
                        {selectedConclave.region || '—'}
                      </span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Coordinator</span>
                      <div className="flex items-center gap-2 mt-1">
                        {Boolean(selectedConclave.coordinator) && (
                          <div className="w-5 h-5 rounded-full bg-brand-red/10 text-brand-red font-bold text-[9px] flex items-center justify-center shrink-0">
                            {safeRenderString(selectedConclave.coordinator, 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                        )}
                        <span className="text-body-sm font-bold text-zinc-800">{safeRenderString(selectedConclave.coordinator, '—')}</span>
                      </div>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Registered Members</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">
                        {selectedConclave.memberCount ?? selectedConclave.registrationCount ?? 0}
                        {selectedConclave.memberLimit ? <span className="text-zinc-400 font-medium"> / {selectedConclave.memberLimit}</span> : null}
                      </span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Captains Checked</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">
                        {selectedConclave.captainCount ?? 0}
                        {selectedConclave.captainLimit ? <span className="text-zinc-400 font-medium"> / {selectedConclave.captainLimit}</span> : null}
                      </span>
                    </div>
                  </div>

                  {/* Timeline list */}
                  {selectedConclave.timeline && selectedConclave.timeline.length > 0 && (
                    <div className="space-y-3.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block border-b border-zinc-100 pb-1.5">Activity Timeline</span>
                      <div className="relative pl-3 space-y-5 border-l border-zinc-100 ml-1.5 mt-2">
                        {selectedConclave.timeline.map((t, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[17.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-brand-red' : 'bg-zinc-350'
                              }`} />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-body-sm font-bold text-zinc-800 leading-tight">{t.event}</span>
                              <span className="text-[9px] text-zinc-500 font-semibold">{t.date} • {t.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 border-t border-zinc-100 bg-white flex gap-2 shrink-0 shadow-lg">
                  {(() => {
                    const isSuperadmin = loggedInAdmin?.role === 'superadmin';
                    const adminReg = (loggedInAdmin?.region || loggedInAdmin?.scope || '').toLowerCase().trim();
                    const concReg = (selectedConclave?.region || '').toLowerCase().trim();
                    const matchesRegion = Boolean(adminReg && concReg && (adminReg.includes(concReg) || concReg.includes(adminReg)));
                    const canEditSelected = isSuperadmin || matchesRegion;
                    return (
                      <button
                        onClick={() => {
                          if (!canEditSelected) return;
                          openEditModal(selectedConclave);
                          setSelectedConclave(null);
                        }}
                        disabled={!canEditSelected}
                        className={`flex-1 py-2.5 rounded-lg text-button font-bold transition-smooth shadow-sm ${!canEditSelected
                          ? 'bg-zinc-100 text-zinc-350 border border-zinc-200/60 cursor-not-allowed opacity-50'
                          : 'bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 cursor-pointer'
                          }`}
                      >
                        Edit Conclave
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => {
                      if (setActiveTab) {
                        setActiveTab('reports');
                      } else {
                        showToast('Fetching reports...', 'Starting file generation.');
                      }
                      setSelectedConclave(null);
                    }}
                    className="flex-1 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                  >
                    View Reports
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* CREATE MODAL */}
      {isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleAddSubmit} className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-zinc-950 text-body-sm">Create New Conclave</h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 transition-smooth cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[60vh] md:max-h-[65vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Conclave Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    placeholder="Annual Global Summit"
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Coordinator Name *</label>
                  <input
                    value={formData.coordinator}
                    onChange={(e) => setFormData(prev => ({ ...prev, coordinator: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    placeholder="Vikram Malhotra"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Venue Location *</label>
                  <input
                    value={formData.venue}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value, venueShort: e.target.value.split(',')[0] }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    placeholder="V Convention, Guntur"
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Region Group *</label>
                  <input
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    placeholder="Guntur Central"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Date Schedule Text</label>
                  <input
                    value={formData.dateRange}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    placeholder="Nov 12 - Nov 14, 2024"
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Start Date</label>
                  <input
                    value={formData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">End Date</label>
                  <input
                    value={formData.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Start Time</label>
                  <input
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="time"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">End Time</label>
                  <input
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Registration Open Date</label>
                  <input
                    value={formData.regStartDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, regStartDate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Registration Close Date</label>
                  <input
                    value={formData.regEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, regEndDate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Members Limit</label>
                  <input
                    value={formData.memberLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, memberLimit: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Captains Limit</label>
                  <input
                    value={formData.captainLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, captainLimit: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Lifecycle Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Running">Running</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 min-h-[60px]"
                  placeholder="Details about matching sessions, sectors, coordinator notes..."
                />
              </div>

              {/* Bank Account & UPI Setup */}
              <div className="border-t border-zinc-100 pt-3.5 space-y-3 bg-zinc-50/40 p-3.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-red" />
                  <h4 className="text-[11px] font-extrabold uppercase text-zinc-800 tracking-wider">
                    Registration Fee & Bank Account (UPI)
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Registration Fee (₹)</label>
                    <input
                      value={formData.registrationFee}
                      onChange={(e) => setFormData(prev => ({ ...prev, registrationFee: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-bold text-emerald-700"
                      placeholder="0 for Free"
                      type="number"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">UPI ID (e.g. name@upi)</label>
                    <input
                      value={formData.upiId}
                      onChange={(e) => setFormData(prev => ({ ...prev, upiId: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono text-zinc-800"
                      placeholder="bni.guntur@upi"
                      type="text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Account Holder Name</label>
                    <input
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white"
                      placeholder="BNI Guntur Chapter"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Bank Name</label>
                    <input
                      value={formData.bankName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white"
                      placeholder="HDFC Bank"
                      type="text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Account Number</label>
                    <input
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono"
                      placeholder="50100234567890"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">IFSC Code</label>
                    <input
                      value={formData.ifscCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono uppercase"
                      placeholder="HDFC0001234"
                      type="text"
                    />
                  </div>
                </div>

                {formData.upiId && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={generateQrCodeUrl(generateUpiUri({ upiId: formData.upiId, name: formData.accountHolderName || formData.name, amount: formData.registrationFee, note: `${formData.name || 'Conclave'} Registration` }), 120)}
                        alt="Generated UPI QR Code"
                        className="w-14 h-14 bg-white p-1 rounded border border-zinc-200 shrink-0"
                      />
                      <div>
                        <span className="text-[8.5px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Dynamic QR Preview
                        </span>
                        <p className="text-xs font-black text-zinc-900 mt-1">{formData.upiId}</p>
                        <p className="text-[10px] text-zinc-500 font-semibold">Registration Fee: ₹{formData.registrationFee || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-zinc-100 bg-white text-zinc-700 text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer"
              >
                Create Conclave
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleEditSubmit} className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-zinc-950 text-body-sm">Edit Conclave Profile</h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 transition-smooth cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[60vh] md:max-h-[65vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Conclave Name</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Coordinator Name</label>
                  <input
                    value={formData.coordinator}
                    onChange={(e) => setFormData(prev => ({ ...prev, coordinator: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Venue Location</label>
                  <input
                    value={formData.venue}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value, venueShort: e.target.value.split(',')[0] }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Region Group</label>
                  <input
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="text"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Date Schedule Text</label>
                  <input
                    value={formData.dateRange}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="text"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Start Date</label>
                  <input
                    value={formData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">End Date</label>
                  <input
                    value={formData.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Start Time</label>
                  <input
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="time"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">End Time</label>
                  <input
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Registration Open Date</label>
                  <input
                    value={formData.regStartDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, regStartDate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-455 block mb-1">Registration Close Date</label>
                  <input
                    value={formData.regEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, regEndDate: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Members Limit</label>
                  <input
                    value={formData.memberLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, memberLimit: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Captains Limit</label>
                  <input
                    value={formData.captainLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, captainLimit: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20"
                    type="number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Lifecycle Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Running">Running</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-zinc-50/20 min-h-[60px]"
                />
              </div>

              {/* Bank Account & UPI Setup */}
              <div className="border-t border-zinc-100 pt-3.5 space-y-3 bg-zinc-50/40 p-3.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-red" />
                  <h4 className="text-[11px] font-extrabold uppercase text-zinc-800 tracking-wider">
                    Registration Fee & Bank Account (UPI)
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Registration Fee (₹)</label>
                    <input
                      value={formData.registrationFee}
                      onChange={(e) => setFormData(prev => ({ ...prev, registrationFee: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-bold text-emerald-700"
                      placeholder="0 for Free"
                      type="number"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">UPI ID (e.g. name@upi)</label>
                    <input
                      value={formData.upiId}
                      onChange={(e) => setFormData(prev => ({ ...prev, upiId: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono text-zinc-800"
                      placeholder="bni.guntur@upi"
                      type="text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Account Holder Name</label>
                    <input
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white"
                      placeholder="BNI Guntur Chapter"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Bank Name</label>
                    <input
                      value={formData.bankName}
                      onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white"
                      placeholder="HDFC Bank"
                      type="text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">Account Number</label>
                    <input
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono"
                      placeholder="50100234567890"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-zinc-450 block mb-1">IFSC Code</label>
                    <input
                      value={formData.ifscCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-mono uppercase"
                      placeholder="HDFC0001234"
                      type="text"
                    />
                  </div>
                </div>

                {formData.upiId && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <img
                        src={generateQrCodeUrl(generateUpiUri({ upiId: formData.upiId, name: formData.accountHolderName || formData.name, amount: formData.registrationFee, note: `${formData.name || 'Conclave'} Registration` }), 120)}
                        alt="Generated UPI QR Code"
                        className="w-14 h-14 bg-white p-1 rounded border border-zinc-200 shrink-0"
                      />
                      <div>
                        <span className="text-[8.5px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Dynamic QR Preview
                        </span>
                        <p className="text-xs font-black text-zinc-900 mt-1">{formData.upiId}</p>
                        <p className="text-[10px] text-zinc-500 font-semibold">Registration Fee: ₹{formData.registrationFee || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-zinc-100 bg-white text-zinc-700 text-button rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* REMOVE SINGLE CONCLAVE CONFIRMATION */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Remove Conclave Portfolio</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to permanently delete this conclave workspace? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-[11px] text-zinc-500 font-medium">
              Conclave: <span className="font-bold text-zinc-900">{deleteTarget.name}</span><br />
              Venue: <span className="text-zinc-700 font-bold">{deleteTarget.venue}</span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold border border-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.delete(`/admin/conclaves/${deleteTarget.id}`);
                    showToast('Conclave Removed', `Successfully deleted ${deleteTarget.name}.`);
                    setDeleteTarget(null);
                    const freshData = await api.get('/admin/conclaves?global=true');
                    if (Array.isArray(freshData)) {
                      setConclaves(freshData.map(c => ({
                        ...c,
                        venue: c.venueLocation || c.venue || 'N/A',
                        venueShort: (c.venueLocation || c.venue || 'N/A').split(',')[0],
                        dateRange: c.date ? new Date(c.date).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'TBD',
                        startDate: c.date ? new Date(c.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                        coordinator: c.coordinator || loggedInAdmin?.name || 'Admin',
                        status: c.status || 'Upcoming'
                      })));
                    }
                  } catch (err) {
                    showToast('Delete Error', err.message || 'Failed to delete conclave.');
                  }
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK REMOVE CONFIRMATION */}
      {isBulkDeleteOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Remove Selected Conclaves</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to delete all {selectedRows.size} selected conclaves from the database?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBulkDeleteOpen(false)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold border border-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConclaves(prev => prev.filter(c => !selectedRows.has(c.id)));
                  showToast('Portfolios Deleted', `Deleted ${selectedRows.size} conclaves.`);
                  setSelectedRows(new Set());
                  setIsBulkDeleteOpen(false);
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Agenda Modal */}
      {agendaUploadTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-zinc-200 shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-section-heading font-extrabold text-zinc-950">Upload Agenda Document</h3>
                  <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">{agendaUploadTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAgendaUploadTarget(null)}
                className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Active Agenda Doc info */}
            {agendaUploadTarget.agendaDocument && (
              <div className="bg-emerald-50/70 border border-emerald-150 p-3.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Current Published Document</span>
                    <span className="text-body-xs font-bold text-zinc-900 truncate block">{agendaUploadTarget.agendaDocument.name}</span>
                  </div>
                </div>
                <a
                  href={agendaUploadTarget.agendaDocument.url || agendaUploadTarget.agendaDocument.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200 transition-smooth shrink-0"
                >
                  View
                </a>
              </div>
            )}

            {/* File Upload Box */}
            <div className="border-2 border-dashed border-zinc-200 hover:border-emerald-500 bg-zinc-50/50 hover:bg-emerald-50/20 p-5 rounded-xl text-center transition-smooth group cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.doc"
                onChange={(e) => handleAgendaFileUpload(e, agendaUploadTarget.id)}
                disabled={isUploadingAgenda}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="p-2.5 bg-white text-zinc-600 group-hover:text-emerald-600 rounded-full w-10 h-10 mx-auto shadow-2xs border border-zinc-200 group-hover:border-emerald-200 flex items-center justify-center transition-smooth mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-body-sm font-extrabold text-zinc-900">
                {isUploadingAgenda ? 'Uploading & Publishing File...' : 'Click to select or drag Agenda File'}
              </h4>
              <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">
                Supports PDF, PNG, JPG, or DOCX (Max 25MB)
              </p>
            </div>

            {/* Direct Text Agenda Input Box */}
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <label className="text-[11px] font-black text-zinc-800 uppercase tracking-wider block">
                Or Type / Edit Conclave Agenda Schedule
              </label>
              <textarea
                rows={5}
                value={agendaInputText}
                onChange={(e) => setAgendaInputText(e.target.value)}
                placeholder={`Example:\n09:30 AM - Registration & Welcome Coffee\n10:15 AM - Round 1 Networking Seating\n11:30 AM - High Tea Networking Break\n12:00 PM - Round 2 Networking Seating\n01:15 PM - Executive Business Lunch`}
                className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-[11.5px] font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-brand-red focus:bg-white transition-all resize-y leading-relaxed font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setAgendaUploadTarget(null)}
                disabled={isUploadingAgenda}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-xl transition-smooth cursor-pointer text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAgendaText}
                disabled={isUploadingAgenda || !agendaInputText.trim()}
                className="px-5 py-2 bg-brand-red hover:bg-red-700 text-white text-button rounded-xl transition-smooth cursor-pointer text-xs font-black uppercase tracking-wider shadow-2xs disabled:opacity-50"
              >
                Publish Text Agenda
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Bulk Actions Footer */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white rounded-lg shadow-2xl py-2 px-4 flex items-center gap-3.5 border border-zinc-800 animate-slide-up text-body-sm font-semibold select-none">
          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-zinc-800 px-2 py-0.5 rounded text-zinc-350">{selectedRows.size} Selected</span>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={handleBulkExport}
            className="text-white hover:text-brand-red transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <Download className="w-3.5 h-3.5 animate-bounce-slow" />
            Export Selected
          </button>
          <button
            onClick={() => setIsBulkDeleteOpen(true)}
            className="text-brand-red hover:text-red-400 transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Live Toast Notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
          <div>
            <p className="font-bold">{toast.title}</p>
            <p className="text-zinc-400 font-semibold mt-0.5">{toast.desc}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-white opacity-40 hover:opacity-100 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
