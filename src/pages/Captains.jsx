import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  X,
  Edit2,
  Download,
  Upload,
  FileSpreadsheet,
  Mail,
  Layers,
  Star,
  Eye,
  Edit3,
  Trash2,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import SearchableDropdown from '../components/SearchableDropdown';

import { api } from '../services/api';

export default function Captains({ searchQuery, selectedConclaveId, loggedInAdmin }) {
  const [captains, setCaptains] = useState(() => {
    const cached = localStorage.getItem('bni_admin_captains_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [viewScope, setViewScope] = useState('conclave');

  useEffect(() => {
    async function loadCaptainsData() {
      setIsLoading(false);
      try {
        let rawList = [];
        const allUsers = await api.get('/admin/users').catch(() => []);
        const userMap = new Map();
        if (Array.isArray(allUsers)) {
          allUsers.forEach(u => {
            const uid = u.id || u.uid;
            if (uid) userMap.set(uid, u);
          });
        }

        let targetConclaveId = selectedConclaveId;
        if (viewScope === 'conclave' && !targetConclaveId) {
          const conclavesList = await api.get('/admin/conclaves').catch(() => []);
          if (Array.isArray(conclavesList) && conclavesList.length > 0) {
            targetConclaveId = conclavesList[0].id;
          }
        }

        if (viewScope === 'conclave') {
          if (targetConclaveId) {
            try {
              const res = await api.get(`/admin/conclaves/${targetConclaveId}/registrations`);
              if (res && Array.isArray(res.registrations)) {
                rawList = res.registrations
                  .filter(r => r.role === 'captain' || r.isTableCaptain === true)
                  .map(r => {
                    const uid = r.userId || r.uid || r.id;
                    const master = userMap.get(uid) || {};
                    const userRegion = r.region || master.region || (typeof r.location === 'string' ? r.location : '') || 'Global BNI Network';
                    return {
                      ...master,
                      ...r,
                      id: uid,
                      uid: uid,
                      name: r.name || master.name || master.displayName || 'Captain',
                      email: r.email || master.email || 'n/a',
                      phone: r.phone || master.phone || master.mobile || 'n/a',
                      company: r.company || master.company || master.businessName || 'Self Employed',
                      category: r.category || master.category || master.businessCategory || 'General',
                      chapter: r.chapter || master.chapter || 'N/A',
                      region: userRegion,
                      userRegion: userRegion
                    };
                  });
              }
            } catch { }
          } else {
            rawList = [];
          }
        } else {
          const conclavesList = await api.get('/admin/conclaves?global=true').catch(() => []);
          const captainMap = new Map();

          if (Array.isArray(allUsers)) {
            allUsers.forEach(u => {
              const uid = u.id || u.uid;
              if (uid && (u.role === 'captain' || u.isTableCaptain === true)) {
                captainMap.set(uid, { ...u });
              }
            });
          }

          if (Array.isArray(conclavesList)) {
            await Promise.all(conclavesList.map(async (c) => {
              try {
                const res = await api.get(`/admin/conclaves/${c.id}/registrations`);
                if (res && Array.isArray(res.registrations)) {
                  res.registrations.forEach(r => {
                    if (r.role === 'captain' || r.isTableCaptain === true) {
                      const uid = r.userId || r.uid || r.id;
                      const existing = captainMap.get(uid) || {};
                      const userRegion = r.region || master.region || existing.region || (typeof r.location === 'string' ? r.location : '') || 'Global';
                      captainMap.set(uid, {
                        ...r,
                        ...existing,
                        id: uid,
                        uid: uid,
                        name: existing.name || r.name || existing.displayName || 'Captain',
                        email: existing.email || r.email || 'n/a',
                        phone: existing.phone || r.phone || existing.mobile || 'n/a',
                        company: existing.company || r.company || existing.businessName || 'Self Employed',
                        category: existing.category || r.category || existing.businessCategory || 'General',
                        chapter: existing.chapter || r.chapter || 'N/A',
                        state: existing.state || r.state || '',
                        country: existing.country || r.country || '',
                        userRegion: userRegion
                      });
                    }
                  });
                }
              } catch { }
            }));
          }

          rawList = Array.from(captainMap.values());
        }

        const mapped = rawList.map(r => {
          const displayName = r.name?.trim() || r.email?.split('@')[0] || r.id || 'Captain';
          const fallbackCategory = r.category || r.businessCategory?.trim() || 'General';
          const fallbackCompany = r.company || r.businessName?.trim() || 'Self Employed';

          const resolvedRegion = r.userRegion || r.region || 'Global BNI Network';
          const locStr = typeof r.location === 'object' && r.location !== null
            ? (r.location.place || r.location.city || '')
            : (r.location || r.address || '');
          const fallbackLocation = locStr || (r.chapter ? `${r.chapter}, ${resolvedRegion}` : resolvedRegion);

          const rawStatus = (r.status || '').toLowerCase();
          const isActiveCaptain = rawStatus === 'active' || rawStatus === 'available' || rawStatus === 'confirmed' || r.isActive === true || !r.status;
          const tableStr = r.table || r.assignedTable || (r.tableNumber ? `Table ${r.tableNumber}` : 'Table 1');
          const joinDateFormatted = r.joinDate ? (new Date(r.joinDate).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })) : (r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A');

          return {
            id: r.id || r.uid || `cap_${Math.random()}`,
            name: displayName,
            email: r.email?.trim() || 'n/a',
            phone: r.phone?.trim() || r.mobile?.trim() || 'n/a',
            company: fallbackCompany,
            category: fallbackCategory,
            address: fallbackLocation,
            state: r.state || '',
            country: r.country || '',
            chapter: r.chapter || r.bniChapter || '',
            region: resolvedRegion,
            table: tableStr,
            assignedTable: tableStr,
            joinDate: joinDateFormatted,
            status: isActiveCaptain ? 'Available' : 'Assigned',
            rating: r.rating,
            conclavesCoordinated: r.conclavesCoordinated,
            membersManaged: r.membersManaged,
            avatar: displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'C'
          };
        });
        setCaptains(mapped);
        localStorage.setItem('bni_admin_captains_cache', JSON.stringify(mapped));
      } catch (err) {
        console.error("Failed to load captains from API:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCaptainsData();
  }, [selectedConclaveId, viewScope]);
  const [referrals, setReferrals] = useState(() => {
    const stored = localStorage.getItem('bni_referrals');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('bni_referrals');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setReferrals(prev => (JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev));
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (searchQuery !== undefined && searchQuery !== null) {
      setSearchTerm(searchQuery);
    }
  }, [searchQuery]);

  const searchVal = searchTerm;
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');

  // Selection states
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedCaptain, setSelectedCaptain] = useState(null);

  // Lock background body scroll when drawer is open
  useEffect(() => {
    if (selectedCaptain) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedCaptain]);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Modals & alerts states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCaptain, setEditingCaptain] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Form inputs state
  const [formData, setFormData] = useState({
    name: '',
    status: 'Available',
    category: 'Financial Consultancy',
    email: '',
    table: 'Unassigned',
    chapter: 'Peak Performance'
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getCaptainRegion = (c) => {
    const reg = c?.userRegion || c?.region;
    if (reg && typeof reg === 'string' && reg !== 'Global BNI Network' && reg.trim() !== '') return reg;
    if (c?.chapter && c.chapter.trim() !== '' && c.chapter !== 'N/A') return `${c.chapter} Chapter`;
    if (c?.state && c.state.trim() !== '') return c.state.includes('Region') ? c.state : `${c.state} Region`;
    if (c?.location) {
      if (typeof c.location === 'string' && c.location !== 'Global BNI Network') return c.location;
      if (typeof c.location === 'object' && c.location.place) return c.location.place;
    }
    if (c?.address && typeof c.address === 'string' && c.address !== 'Global BNI Network') return c.address;
    return 'Global';
  };

  // Conclave-specific captains subset
  const conclaveCaptains = useMemo(() => {
    return captains;
  }, [captains]);

  // KPIs
  const totalCaptains = conclaveCaptains.length;
  const availableCount = conclaveCaptains.filter(c => c.status === 'Available').length;
  const assignedCount = conclaveCaptains.filter(c => c.status === 'Assigned').length;
  const busyCount = conclaveCaptains.filter(c => c.status === 'Busy').length;

  // Get distinct filter options dynamically from captain data
  const categoriesList = useMemo(() => {
    const list = new Set(captains.map(c => c.category).filter(v => v && v !== 'N/A' && v !== 'General'));
    return ['All', ...Array.from(list).sort()];
  }, [captains]);

  const statesList = useMemo(() => {
    const list = new Set(captains.map(c => c.state).filter(v => v && v !== 'N/A'));
    return ['All', ...Array.from(list).sort()];
  }, [captains]);

  const countriesList = useMemo(() => {
    const list = new Set(captains.map(c => c.country).filter(v => v && v !== 'N/A'));
    return ['All', ...Array.from(list).sort()];
  }, [captains]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, [searchVal, categoryFilter, statusFilter, stateFilter, countryFilter, viewScope]);

  // Filtered List
  const filteredCaptains = useMemo(() => {
    const q = (searchVal || '').trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];

    return conclaveCaptains.filter(cap => {
      const capText = `${cap.name || ''} ${cap.id || ''} ${cap.email || ''} ${cap.phone || ''} ${cap.company || ''} ${cap.category || ''} ${cap.chapter || ''} ${cap.address || ''}`.toLowerCase();
      const matchesSearch = !q || tokens.every(token => capText.includes(token));

      const matchesCategory = categoryFilter === 'All' || cap.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || cap.status === statusFilter;
      const adminReg = (loggedInAdmin?.region || loggedInAdmin?.scope || '').toLowerCase().trim();
      const capReg = (cap.region || '').toLowerCase().trim();
      const matchesViewScope = viewScope === 'conclave' || viewScope === 'global' || !adminReg || adminReg === 'global' || adminReg.includes('global') || capReg.includes(adminReg) || adminReg.includes(capReg);

      const matchesState = stateFilter === 'All' || cap.state === stateFilter;
      const matchesCountry = countryFilter === 'All' || cap.country === countryFilter;

      return matchesSearch && matchesCategory && matchesStatus && matchesViewScope && matchesState && matchesCountry;
    });
  }, [conclaveCaptains, searchVal, categoryFilter, statusFilter, stateFilter, countryFilter, viewScope]);

  // Paginated List
  const paginatedCaptains = useMemo(() => {
    const totalPages = Math.ceil(filteredCaptains.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredCaptains.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCaptains, currentPage, itemsPerPage]);

  // Checkbox functions
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
    if (selectedRows.size === filteredCaptains.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredCaptains.map(c => c.id)));
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('All');
    setStatusFilter('All');
    setStateFilter('All');
    setCountryFilter('All');
    setSelectedRows(new Set());
  };

  const openAddModal = () => {
    setEditingCaptain(null);
    setFormData({
      name: '',
      status: 'Available',
      category: 'Financial Consultancy',
      email: '',
      table: 'Unassigned',
      chapter: 'Peak Performance'
    });
    setIsFormOpen(true);
  };

  const openEditModal = (captain) => {
    setEditingCaptain(captain);
    setFormData({
      name: captain.name,
      status: captain.status,
      category: captain.category,
      email: captain.email,
      table: captain.table,
      chapter: captain.chapter
    });
    setSelectedCaptain(null); // close drawer
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Please enter the captain name.', 'error');
      return;
    }

    if (editingCaptain) {
      // Edit
      setCaptains(prev => prev.map(c => c.id === editingCaptain.id ? {
        ...c,
        ...formData
      } : c));
      showToast(`Captain "${formData.name}" profiles updated.`, 'success');
    } else {
      // Add
      const newCap = {
        id: `BNI-${Math.floor(1000 + Math.random() * 9000)}-K`,
        name: formData.name,
        status: formData.status,
        category: formData.category,
        email: formData.email || 'n/a',
        table: formData.table,
        joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        chapter: formData.chapter,
        image: null,
        drawerImage: null,
        history: [],
        timeline: [{ event: 'Created Captain assignment', date: new Date().toLocaleDateString(), note: 'Compliance check passed' }],
        conclaveIds: [selectedConclaveId]
      };
      setCaptains(prev => [newCap, ...prev]);
      showToast(`Assigned new captain "${formData.name}".`, 'success');
    }
    setIsFormOpen(false);
  };

  const handleExport = () => {
    if (filteredCaptains.length === 0) {
      showToast('No captains list to export!', 'error');
      return;
    }
    const headers = ['Captain ID', 'Name', 'Availability', 'Category', 'Email', 'Table Assignment', 'Join Date', 'Chapter', 'Region'];
    const rows = filteredCaptains.map(c => [
      c.id,
      `"${c.name}"`,
      c.status,
      `"${c.category}"`,
      c.email,
      `"${c.table}"`,
      c.createdDate || c.joinDate,
      `"${c.chapter}"`,
      `"${getCaptainRegion(c)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bni_captains_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkExport = () => {
    const selectedList = captains.filter(c => selectedRows.has(c.id));
    if (selectedList.length === 0) return;
    const headers = ['Captain ID', 'Name', 'Availability', 'Category', 'Email', 'Table Assignment', 'Join Date', 'Chapter'];
    const rows = selectedList.map(c => [
      c.id,
      `"${c.name}"`,
      c.status,
      `"${c.category}"`,
      c.email,
      `"${c.table}"`,
      c.joinDate,
      `"${c.chapter}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selected_captains_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Successfully exported ${selectedList.length} captains.`, 'success');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length <= 1) return;

      const newCaps = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(col => col.replace(/^["']|["']$/g, '').trim());
        if (columns.length >= 4) {
          const [id, name, status, category, email, tableVal, joinDate, chapter] = columns;
          newCaps.push({
            id: id || `BNI-${Math.floor(1000 + Math.random() * 9000)}-K`,
            name: name || 'Unnamed Captain',
            status: status === 'Assigned' || status === 'Busy' ? status : 'Available',
            category: category || 'Financial Consultancy',
            email: email || 'n/a',
            table: tableVal || 'Unassigned',
            joinDate: joinDate || 'Just now',
            chapter: chapter || 'Peak Performance',
            image: null,
            drawerImage: null,
            history: [],
            timeline: [{ event: 'Imported via CSV file', date: new Date().toLocaleDateString(), note: 'Compliance check passed' }],
            conclaveIds: [selectedConclaveId]
          });
        }
      }

      if (newCaps.length > 0) {
        setCaptains(prev => [...newCaps, ...prev]);
        showToast(`Successfully imported ${newCaps.length} captains from CSV!`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = ['Captain ID', 'Name', 'Category', 'Email', 'Phone', 'Chapter', 'Status'];
    const sampleRow = [
      'CAP-00101',
      '"Vikram Singh"',
      '"Corporate Lawyer"',
      'vikram@lawyers.com',
      '+91 9822233344',
      '"Apex Chapter"',
      'Available'
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bni_captains_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-955 font-extrabold tracking-tight">Captain Management</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Manage table captain assignments and availability.
          </p>
        </div>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex border-b border-zinc-200 -mt-2">
        <button
          onClick={() => setViewScope('conclave')}
          className={`px-4 py-2 text-body-sm font-black uppercase tracking-wider border-b-2 transition-smooth cursor-pointer -mb-px ${viewScope === 'conclave'
            ? 'border-brand-red text-brand-red font-extrabold'
            : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
        >
          This Conclave
        </button>
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

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Captains</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{totalCaptains}</span>
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Available</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{availableCount}</span>
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Assigned Roles</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{assignedCount}</span>
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Busy / On Leave</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{busyCount}</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters & View modes */}
      <div className="bg-white border border-zinc-200/80 p-3.5 flex flex-col lg:flex-row gap-4 items-center justify-between rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm placeholder-zinc-400 focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth bg-zinc-50/20"
              placeholder="Filter by name or ID..."
              type="text"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <SearchableDropdown
              label="Business Type"
              options={categoriesList.length > 1 ? categoriesList : ['All']}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="Search business type..."
            />
            <SearchableDropdown
              label="Availability"
              options={['All', 'Available', 'Assigned', 'Busy']}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Search availability..."
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
              onChange={setCountryFilter}
              placeholder="Search country..."
            />
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={resetFilters}
            className="text-label-md font-bold text-brand-red hover:underline px-2 cursor-pointer transition-smooth text-button"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col gap-6">

        {/* Table view list - full width */}
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100 text-label-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="px-5 py-4 w-12 text-center">
                    <input
                      checked={filteredCaptains.length > 0 && selectedRows.size === filteredCaptains.length}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                      type="checkbox"
                    />
                  </th>
                  <th className="px-5 py-4">Captain</th>
                  <th className="px-5 py-4">Region</th>
                  <th className="px-5 py-4">Classification</th>
                  <th className="px-5 py-4">Contact Info</th>
                  <th className="px-5 py-4">Current Assignment</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">Given</th>
                  <th className="px-5 py-4 text-center">Taken</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-table-text">
                {filteredCaptains.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="p-8 text-center text-zinc-400 font-medium">
                      No captains match the active filters.
                    </td>
                  </tr>
                ) : (
                  paginatedCaptains.map((cap) => (
                    <tr
                      key={cap.id}
                      onClick={() => setSelectedCaptain(cap)}
                      className="group cursor-pointer"
                    >
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          checked={selectedRows.has(cap.id)}
                          onChange={(e) => toggleRow(cap.id, e)}
                          className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                          type="checkbox"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-50 overflow-hidden border border-zinc-150 shrink-0">
                            {cap.image ? (
                              <img className="w-full h-full object-cover" src={cap.image} alt={cap.name} />
                            ) : (
                              <div className="w-full h-full bg-brand-red/10 text-brand-red font-bold text-xs flex items-center justify-center">
                                {cap.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-body-sm font-bold text-zinc-900 transition-smooth leading-tight">{cap.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-550 text-[10px] font-bold rounded-full whitespace-nowrap">
                          {getCaptainRegion(cap)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[10.5px] font-extrabold border border-zinc-200/80">
                          {cap.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-body-sm text-zinc-650 select-all">{cap.email}</td>
                      <td className="px-5 py-4 text-body-sm text-zinc-650 font-semibold">{cap.table}</td>
                      <td className="px-5 py-4">
                        {cap.status === 'Available' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Available
                          </span>
                        ) : cap.status === 'Assigned' ? (
                          <span className="inline-flex items-center gap-1 text-brand-red bg-red-50 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span> Assigned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-450"></span> Busy
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-zinc-800">
                        {referrals.filter(r => r.fromMemberId === cap.id).length}
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-zinc-800">
                        {referrals.filter(r => r.toMemberId === cap.id).length}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCaptain(cap)}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-smooth cursor-pointer"
                            title="View Captain Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(cap)}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-brand-red transition-smooth cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(cap)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-brand-red transition-smooth cursor-pointer"
                            title="Remove Captain"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reusable Pagination */}
        <Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredCaptains.length}
          onPageChange={setCurrentPage}
          label="captains"
        />
      </div>

      {/* Captain Profile Details Drawer Overlay */}
      {createPortal(
        <>
          <div
            onClick={() => setSelectedCaptain(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${selectedCaptain ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
          />

          <div className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[440px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${selectedCaptain ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}>
            {selectedCaptain && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedCaptain(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <h3 className="text-section-heading font-extrabold text-zinc-950">Captain Profile</h3>
                  </div>
                  <button
                    onClick={() => openEditModal(selectedCaptain)}
                    className="p-1.5 hover:bg-zinc-200 rounded-lg text-brand-red hover:bg-brand-red/5 transition-smooth cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">

                  {/* Profile Card Summary */}
                  <div className="flex flex-col items-center gap-3 text-center bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <div className="w-20 h-20 rounded-lg border-2 border-brand-red/20 p-1 bg-white overflow-hidden shrink-0 shadow-sm">
                      {selectedCaptain.image ? (
                        <img className="w-full h-full object-cover rounded-md" src={selectedCaptain.image} alt={selectedCaptain.name} />
                      ) : (
                        <div className="w-full h-full rounded-md bg-brand-red/10 text-brand-red font-bold text-xl flex items-center justify-center">
                          {selectedCaptain.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-headline-md font-bold text-zinc-950 leading-tight">{selectedCaptain.name}</h4>

                      <div className="flex gap-2 mt-2.5 justify-center">
                        {selectedCaptain.status === 'Available' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-md text-[9px] font-extrabold uppercase">
                            Available
                          </span>
                        ) : selectedCaptain.status === 'Assigned' ? (
                          <span className="px-2.5 py-0.5 bg-red-50 text-brand-red border border-red-100 rounded-md text-[9px] font-extrabold uppercase">
                            Assigned
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-500 border border-zinc-100 rounded-md text-[9px] font-semibold uppercase">
                            Busy
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2.5 mt-3 justify-center border-t border-zinc-100 pt-2.5 w-full">
                        <span className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-[9.5px] font-bold text-zinc-650">
                          Sent: {referrals.filter(r => r.fromMemberId === selectedCaptain.id).length}
                        </span>
                        <span className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-[9.5px] font-bold text-zinc-650">
                          Received: {referrals.filter(r => r.toMemberId === selectedCaptain.id).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Info */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Business Type</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">{selectedCaptain.category}</span>
                    </div>
                    <div className="p-3.5 border border-zinc-100 bg-white rounded-lg shadow-sm">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase block">Join Date</span>
                      <span className="text-body-sm font-bold text-zinc-800 block mt-1">{selectedCaptain.joinDate}</span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <section className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Contact Details</h5>
                    <div className="flex items-center gap-3 py-1">
                      <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase block">Email Address</span>
                        <span className="text-body-sm font-bold text-zinc-850 select-all">{selectedCaptain.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-1">
                      <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase block">Table Assignment</span>
                        <span className="text-body-sm font-bold text-zinc-850">{selectedCaptain.table}</span>
                      </div>
                    </div>
                  </section>

                  {/* Activity Timeline */}
                  {selectedCaptain.timeline && selectedCaptain.timeline.length > 0 && (
                    <section className="space-y-3.5">
                      <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Activity Timeline</h5>
                      <div className="relative pl-3 space-y-5 border-l border-zinc-100 ml-1.5 mt-2">
                        {selectedCaptain.timeline.map((t, idx) => (
                          <div key={idx} className="relative">
                            <div className={`absolute -left-[17.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-brand-red' : 'bg-zinc-350'
                              }`} />
                            <div className="flex flex-col gap-0.5">
                              <span className="text-body-sm font-bold text-zinc-800 leading-tight">{t.event}</span>
                              <span className="text-[9px] text-zinc-500 font-semibold">{t.date} • {t.note}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Conclave Rating History Table */}
                  {selectedCaptain.history && selectedCaptain.history.length > 0 && (
                    <section className="space-y-3">
                      <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Conclave History</h5>
                      <div className="border border-zinc-100 rounded-lg overflow-hidden bg-white mt-2">
                        <table className="w-full text-left text-body-sm border-collapse">
                          <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] font-bold text-zinc-450 uppercase">
                            <tr>
                              <th className="px-4 py-2">Conclave</th>
                              <th className="px-4 py-2">Table</th>
                              <th className="px-4 py-2 text-right">Rating</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50 font-semibold text-zinc-650">
                            {selectedCaptain.history.map((hist, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50/20">
                                <td className="px-4 py-2.5 text-zinc-800">{hist.conclave}</td>
                                <td className="px-4 py-2.5 font-mono">{hist.table}</td>
                                <td className="px-4 py-2.5 text-right text-brand-red">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`inline w-3 h-3 ${i < hist.rating ? 'fill-brand-red text-brand-red' : 'text-zinc-200'}`}
                                    />
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {/* Referral History */}
                  <section className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Referral History</h5>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
                      {referrals.filter(r => r.fromMemberId === selectedCaptain.id || r.toMemberId === selectedCaptain.id).length === 0 ? (
                        <p className="p-4 text-center text-[10.5px] text-zinc-400 font-semibold bg-white">No referrals logged for this captain.</p>
                      ) : (
                        referrals.filter(r => r.fromMemberId === selectedCaptain.id || r.toMemberId === selectedCaptain.id).map(ref => {
                          const isGiven = ref.fromMemberId === selectedCaptain.id;
                          return (
                            <div key={ref.id} className="p-3 bg-white hover:bg-zinc-50/50 transition-colors text-body-sm">
                              <div className="flex justify-between items-start">
                                <p className="font-black text-zinc-800 text-[11.5px]">
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
                              <p className="text-[11px] font-semibold text-zinc-555 mt-1 italic font-medium">"{ref.description}"</p>
                              <span className="text-[8px] text-zinc-400 font-extrabold uppercase mt-1 block">{ref.date}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 border-t border-zinc-100 bg-white flex flex-col gap-2 shrink-0 shadow-lg">
                  <button
                    onClick={() => {
                      const assignedTbl = selectedCaptain.table && selectedCaptain.table !== 'Unassigned' ? selectedCaptain.table : 'Assigned Table';
                      setCaptains(prev => prev.map(c => c.id === selectedCaptain.id ? { ...c, status: 'Assigned', table: assignedTbl } : c));
                      setSelectedCaptain(prev => prev ? { ...prev, status: 'Assigned', table: assignedTbl } : null);
                      showToast(`Assigned ${selectedCaptain.name} to ${assignedTbl}.`, 'success');
                    }}
                    className="w-full py-2 bg-brand-red hover:bg-red-700 text-white rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                  >
                    Assign to Current Conclave
                  </button>
                  <button
                    onClick={() => setSelectedCaptain(null)}
                    className="w-full py-2 bg-white border border-zinc-100 text-zinc-650 hover:bg-zinc-50 rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer"
                  >
                    Close Drawer
                  </button>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Add / Assign Captain Form Modal */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
              <h3 className="text-section-heading font-extrabold text-zinc-950">
                {editingCaptain ? 'Edit Captain Profile' : 'Assign New Captain'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-450 hover:text-zinc-700 transition-smooth cursor-pointer font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[60vh] md:max-h-[65vh]">
                <div className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Captain Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="e.g. Marcus Thorne"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Email Address</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="m.thorne@company.com"
                    />
                  </div>

                  {/* Classification */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Business Type Classification</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-medium text-zinc-700 cursor-pointer animate-none"
                    >
                      <option value="Financial Consultancy">Financial Consultancy</option>
                      <option value="Real Estate">Real Estate</option>
                      <option value="Legal Services">Legal Services</option>
                      <option value="IT Services">IT Services</option>
                    </select>
                  </div>

                  {/* BNI Chapter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">BNI Chapter</label>
                    <select
                      value={formData.chapter}
                      onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-medium text-zinc-700 cursor-pointer animate-none"
                    >
                      <option value="Peak Performance">Peak Performance</option>
                      <option value="Apex Chapter">Apex Chapter</option>
                      <option value="Capital Chapter">Capital Chapter</option>
                    </select>
                  </div>

                  {/* Table assignment & availability */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Availability</span>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                      >
                        <option value="Available">Available</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Busy">Busy</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Table Role</span>
                      <input
                        type="text"
                        value={formData.table}
                        onChange={(e) => setFormData({ ...formData, table: e.target.value })}
                        className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                        placeholder="e.g. Table 04"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Static Non-Scrolling Footer Action Buttons */}
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer border border-zinc-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth shadow-md cursor-pointer font-bold text-xs"
                >
                  {editingCaptain ? 'Save Changes' : 'Assign Captain'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Remove Captain</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to remove this captain? They will lose their assigned table role.
                </p>
              </div>
            </div>
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 text-[11px] text-zinc-500 font-medium">
              Captain: <span className="font-bold text-zinc-900">{deleteTarget.name}</span>
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
                onClick={() => {
                  setCaptains(prev => prev.filter(c => c.id !== deleteTarget.id));
                  showToast(`Captain "${deleteTarget.name}" has been removed.`, 'success');
                  setDeleteTarget(null);
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-100 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0 mt-0.5">
                <X className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Remove Selected Captains</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to remove all {selectedRows.size} selected captains? This action is permanent and cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold border border-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptains(prev => prev.filter(c => !selectedRows.has(c.id)));
                  showToast(`Successfully removed ${selectedRows.size} selected captains.`, 'success');
                  setSelectedRows(new Set());
                  setIsBulkDeleteConfirmOpen(false);
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Remove All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Floating Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900 text-white rounded-lg shadow-2xl py-2 px-4 flex items-center gap-3.5 border border-zinc-800 animate-slide-up text-body-sm font-semibold select-none">
          <span className="text-[10px] font-extrabold uppercase tracking-wide bg-zinc-800 px-2 py-0.5 rounded text-zinc-350">{selectedRows.size} Selected</span>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={handleBulkExport}
            className="text-white hover:text-brand-red transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <Upload className="w-3.5 h-3.5" />
            Export Selected
          </button>
          <button
            onClick={() => setIsBulkDeleteConfirmOpen(true)}
            className="text-brand-red hover:text-red-400 transition-smooth flex items-center gap-1.5 cursor-pointer text-button text-[10px]"
          >
            <X className="w-3.5 h-3.5" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          {toast.type === 'success' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
