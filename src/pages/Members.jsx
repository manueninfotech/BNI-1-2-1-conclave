import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  MapPin,
  Mail,
  Phone,
  Plus,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Eye,
  Edit3,
  Trash2,
  Edit,
  Lock,
  CreditCard
} from 'lucide-react';
import Pagination from '../components/Pagination';
import SearchableDropdown from '../components/SearchableDropdown';
import { api } from '../services/api';

export function resolveLocationDetails(memberOrReg, fallbackRegion = '') {
  let state = (memberOrReg?.state || '').trim();
  let country = (memberOrReg?.country || '').trim();
  const region = (memberOrReg?.region || memberOrReg?.userRegion || fallbackRegion || '').trim();
  const address = (memberOrReg?.address || (typeof memberOrReg?.location === 'string' ? memberOrReg.location : '') || '').trim();
  const combined = `${region} ${address}`.toLowerCase();

  if (!state || state === 'N/A') {
    if (combined.includes('guntur') || combined.includes('vijayawada') || combined.includes('visakhapatnam') || combined.includes('vizag') || combined.includes('tirupati') || combined.includes('amaravati') || combined.includes('andhra')) {
      state = 'Andhra Pradesh';
    } else if (combined.includes('hyderabad') || combined.includes('secunderabad') || combined.includes('warangal') || combined.includes('telangana')) {
      state = 'Telangana';
    } else if (combined.includes('bangalore') || combined.includes('bengaluru') || combined.includes('karnataka') || combined.includes('mysore')) {
      state = 'Karnataka';
    } else if (combined.includes('chennai') || combined.includes('tamil nadu') || combined.includes('coimbatore')) {
      state = 'Tamil Nadu';
    } else if (combined.includes('mumbai') || combined.includes('pune') || combined.includes('maharashtra') || combined.includes('nagpur')) {
      state = 'Maharashtra';
    } else if (combined.includes('delhi') || combined.includes('noida') || combined.includes('gurgaon') || combined.includes('ncr')) {
      state = 'Delhi';
    } else if (combined.includes('ahmedabad') || combined.includes('gujarat') || combined.includes('surat')) {
      state = 'Gujarat';
    } else if (combined.includes('kochi') || combined.includes('kerala') || combined.includes('thiruvananthapuram')) {
      state = 'Kerala';
    } else if (combined.includes('kolkata') || combined.includes('west bengal')) {
      state = 'West Bengal';
    } else if (combined.includes('singapore')) {
      state = 'Central Region';
    } else if (combined.includes('london')) {
      state = 'Greater London';
    } else if (combined.includes('dubai')) {
      state = 'Dubai';
    } else {
      state = 'Andhra Pradesh';
    }
  }

  if (!country || country === 'N/A') {
    if (combined.includes('singapore')) {
      country = 'Singapore';
    } else if (combined.includes('london') || combined.includes('united kingdom') || combined.includes('uk')) {
      country = 'United Kingdom';
    } else if (combined.includes('dubai') || combined.includes('uae') || combined.includes('emirates')) {
      country = 'United Arab Emirates';
    } else if (combined.includes('usa') || combined.includes('united states') || combined.includes('america')) {
      country = 'United States';
    } else if (combined.includes('australia') || combined.includes('sydney')) {
      country = 'Australia';
    } else {
      country = 'India';
    }
  }

  return { state, country };
}

export default function Members({ searchQuery, selectedConclaveId, loggedInAdmin }) {
  const isSuperadmin = useMemo(() => {
    const role = (loggedInAdmin?.role || '').toLowerCase();
    const email = (loggedInAdmin?.email || '').toLowerCase();
    return role === 'superadmin' || email.includes('superadmin');
  }, [loggedInAdmin]);

  const [allowAdminAddMembers, setAllowAdminAddMembers] = useState(false);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [activeConclaveId, setActiveConclaveId] = useState(selectedConclaveId || '');

  useEffect(() => {
    if (selectedConclaveId) {
      setActiveConclaveId(selectedConclaveId);
    }
  }, [selectedConclaveId]);

  // Load conclave permissions
  useEffect(() => {
    let isCancelled = false;
    async function loadPermissions() {
      let targetId = activeConclaveId || selectedConclaveId;
      if (!targetId) {
        try {
          const list = await api.get('/admin/conclaves');
          if (Array.isArray(list) && list.length > 0) {
            targetId = list[0].id;
            if (!isCancelled) setActiveConclaveId(targetId);
          }
        } catch { }
      }
      if (!targetId) return;

      try {
        const res = await api.get(`/admin/conclaves/${targetId}/permissions`);
        if (!isCancelled && res) {
          if (res.allowAdminAddMembers !== undefined) {
            setAllowAdminAddMembers(Boolean(res.allowAdminAddMembers));
          }
          if (res.isScheduleLocked !== undefined) {
            setIsScheduleLocked(Boolean(res.isScheduleLocked));
          }
        }
      } catch (err) {
        console.error("Failed to load conclave permissions:", err);
      }
    }
    loadPermissions();
    return () => {
      isCancelled = true;
    };
  }, [selectedConclaveId, activeConclaveId]);

  // When conclave schedule is generated and locked, even admin cannot add members!
  const canPerformMemberActions = !isScheduleLocked && (isSuperadmin || allowAdminAddMembers);

  const handleToggleAdminPermission = async () => {
    if (isScheduleLocked) {
      showToast("Cannot modify permissions because schedule is generated and locked.", "error");
      return;
    }
    let targetId = activeConclaveId || selectedConclaveId;
    if (!targetId) {
      try {
        const list = await api.get('/admin/conclaves');
        if (Array.isArray(list) && list.length > 0) {
          targetId = list[0].id;
          setActiveConclaveId(targetId);
        }
      } catch { }
    }
    if (!targetId) {
      showToast("Please select a conclave first.", "error");
      return;
    }

    const nextValue = !allowAdminAddMembers;
    setIsPermissionsLoading(true);
    try {
      const res = await api.put(`/admin/conclaves/${targetId}/permissions`, {
        allowAdminAddMembers: nextValue
      });
      setAllowAdminAddMembers(nextValue);
      showToast(res.message || (nextValue ? "Admin member addition enabled." : "Admin member addition restricted."), "success");
    } catch (err) {
      console.error("Failed to update permissions:", err);
      showToast(err.message || "Failed to update permissions.", "error");
    } finally {
      setIsPermissionsLoading(false);
    }
  };

  const [members, setMembers] = useState(() => {
    const cached = localStorage.getItem('bni_admin_members_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [viewScope, setViewScope] = useState('conclave'); // 'conclave', 'region', or 'global'

  useEffect(() => {
    async function loadMembersData() {
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

        let targetConclaveId = activeConclaveId || selectedConclaveId;
        if (viewScope === 'conclave' && !targetConclaveId) {
          const conclavesList = await api.get('/admin/conclaves').catch(() => []);
          if (Array.isArray(conclavesList) && conclavesList.length > 0) {
            targetConclaveId = conclavesList[0].id;
            setActiveConclaveId(targetConclaveId);
          }
        }

        if (viewScope === 'conclave') {
          if (targetConclaveId) {
            try {
              const res = await api.get(`/admin/conclaves/${targetConclaveId}/registrations`);
              if (res && Array.isArray(res.registrations)) {
                rawList = res.registrations.map(r => {
                  const uid = r.userId || r.uid || r.id;
                  const master = userMap.get(uid) || {};
                  const userRegion = r.region || master.region || (typeof r.location === 'string' ? r.location : '') || 'Global BNI Network';
                  const loc = resolveLocationDetails({ ...master, ...r }, userRegion);
                  return {
                    ...master,
                    ...r,
                    id: uid,
                    uid: uid,
                    name: r.name || master.name || master.displayName || 'Member',
                    email: r.email || master.email || 'n/a',
                    phone: r.phone || master.phone || master.mobile || 'n/a',
                    company: r.company || master.company || master.businessName || 'Self Employed',
                    category: r.category || master.category || master.businessCategory || 'General',
                    chapter: r.chapter || master.chapter || 'N/A',
                    region: userRegion,
                    userRegion: userRegion,
                    state: r.state || master.state || loc.state,
                    country: r.country || master.country || loc.country
                  };
                });
              }
            } catch { }
          } else {
            rawList = [];
          }
        } else {
          const conclavesList = await api.get('/admin/conclaves?global=true').catch(() => []);
          const memberMap = new Map();

          if (Array.isArray(allUsers)) {
            allUsers.forEach(u => {
              const uid = u.id || u.uid;
              if (uid) memberMap.set(uid, { ...u });
            });
          }

          if (Array.isArray(conclavesList)) {
            await Promise.all(conclavesList.map(async (c) => {
              try {
                const res = await api.get(`/admin/conclaves/${c.id}/registrations`);
                if (res && Array.isArray(res.registrations)) {
                  res.registrations.forEach(r => {
                    const uid = r.userId || r.uid || r.id;
                    const existing = memberMap.get(uid) || {};
                    const userRegion = r.region || existing.region || (typeof r.location === 'string' ? r.location : '') || 'Global';
                    const loc = resolveLocationDetails({ ...existing, ...r }, userRegion);
                    memberMap.set(uid, {
                      ...r,
                      ...existing,
                      id: uid,
                      uid: uid,
                      name: existing.name || r.name || existing.displayName || 'Member',
                      email: existing.email || r.email || 'n/a',
                      phone: existing.phone || r.phone || existing.mobile || 'n/a',
                      company: existing.company || r.company || existing.businessName || 'Self Employed',
                      category: existing.category || r.category || existing.businessCategory || 'General',
                      chapter: existing.chapter || r.chapter || 'N/A',
                      state: existing.state || r.state || loc.state,
                      country: existing.country || r.country || loc.country,
                      userRegion: userRegion
                    });
                  });
                }
              } catch { }
            }));
          }

          rawList = Array.from(memberMap.values());
        }

        const mapped = rawList.map(r => {
          const displayName = r.name?.trim() || r.email?.split('@')[0] || r.id || 'Member';
          const fallbackCategory = r.category || r.businessCategory?.trim() || 'General';
          const fallbackCompany = r.company || r.businessName?.trim() || 'Self Employed';

          const resolvedRegion = r.userRegion || r.region || 'Global BNI Network';
          const locStr = typeof r.location === 'object' && r.location !== null
            ? (r.location.place || r.location.city || '')
            : (r.location || r.address || '');
          const fallbackLocation = locStr || (r.chapter ? `${r.chapter}, ${resolvedRegion}` : resolvedRegion);
          const locDetails = resolveLocationDetails(r, resolvedRegion);
          const finalState = r.state || locDetails.state;
          const finalCountry = r.country || locDetails.country;

          const rawStatus = (r.status || '').toLowerCase();
          const isActiveMember = rawStatus === 'active' || rawStatus === 'pending' || rawStatus === 'registered' || rawStatus === 'confirmed' || r.isActive === true || !r.status;

          const rawDate = r.createdAt || r.registeredAt;
          const joinDateFormatted = rawDate && !isNaN(new Date(rawDate).getTime())
            ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : 'N/A';

          const historyDateFormatted = rawDate && !isNaN(new Date(rawDate).getTime())
            ? new Date(rawDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

          const pay = r.payment || {};
          const paymentStatus = pay.status || r.paymentStatus || 'paid';
          const paymentMethod = pay.method || r.paymentMethod || 'admin_direct';
          const paymentAmount = pay.amount !== undefined ? pay.amount : (r.paymentAmount || 0);
          const transactionId = pay.transactionId || r.transactionId || '';

          return {
            id: r.id || r.uid || `mem_${Math.random()}`,
            name: displayName,
            email: r.email?.trim() || 'n/a',
            phone: r.phone?.trim() || r.mobile?.trim() || 'n/a',
            company: fallbackCompany,
            category: fallbackCategory,
            address: fallbackLocation,
            state: finalState,
            country: finalCountry,
            chapter: r.chapter || '',
            region: resolvedRegion,
            payment: {
              status: paymentStatus,
              method: paymentMethod,
              amount: paymentAmount,
              transactionId: transactionId
            },
            paymentStatus,
            paymentMethod,
            paymentAmount,
            transactionId,
            isCaptain: r.role === 'captain' || r.isTableCaptain === true,
            status: isActiveMember ? 'Active' : 'Inactive',
            joinDate: joinDateFormatted,
            avatar: displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'M',
            conclaveIds: [selectedConclaveId],
            history: [{ event: 'Registered', date: historyDateFormatted, role: r.role === 'captain' ? 'Captain' : 'Member' }]
          };
        });
        setMembers(mapped);
        localStorage.setItem('bni_admin_members_cache', JSON.stringify(mapped));
      } catch (err) {
        console.error("Failed to load members from API:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadMembersData();
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
  const [captainFilter, setCaptainFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [selectedMember, setSelectedMember] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Lock background body scroll when drawer or modal is open
  useEffect(() => {
    if (selectedMember || isFormOpen || editingMember || deleteTarget || isBulkDeleteConfirmOpen) {
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
  }, [selectedMember, isFormOpen, editingMember, deleteTarget, isBulkDeleteConfirmOpen]);



  const [selectedRows, setSelectedRows] = useState(new Set());
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success', duration = 4000) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const getMemberRegion = (m) => {
    const reg = m?.region || m?.userRegion;
    if (reg && typeof reg === 'string' && reg.trim() !== '' && reg !== 'Global BNI Network') return reg;
    if (m?.state && m.state.trim() !== '') return m.state;
    if (m?.location) {
      if (typeof m.location === 'string' && m.location !== 'Global BNI Network') return m.location;
      if (typeof m.location === 'object' && m.location.place) return m.location.place;
    }
    if (m?.address && typeof m.address === 'string' && m.address !== 'Global BNI Network') return m.address;
    return 'Global';
  };

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchVal, categoryFilter, captainFilter, statusFilter, stateFilter, countryFilter, viewScope]);

  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('bni_categories_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [
      'Advertising',
      'Architecture',
      'Banking',
      'Builder',
      'Business Consultant',
      'CA',
      'Catering',
      'Corporate Gifting',
      'Digital Marketing',
      'Finance',
      'Financial Consultant',
      'Graphic Design',
      'HR Services',
      'IT Services',
      'Interiors',
      'Legal Services',
      'Marketing',
      'Real Estate'
    ];
  });

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await api.get('/categories').catch(() => null)
          || await api.get('/admin/categories').catch(() => null);
        const list = Array.isArray(res?.categories) ? res.categories : (Array.isArray(res) ? res : []);
        if (list.length > 0) {
          setCategories(list);
          localStorage.setItem('bni_categories_cache', JSON.stringify(list));
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    loadCategories();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Real Estate',
    email: '',
    phone: '',
    company: '',
    chapter: '',
    address: '',
    region: 'Guntur Region',
    state: 'Andhra Pradesh',
    country: 'India',
    paymentStatus: 'paid',
    paymentMethod: 'UPI',
    paymentAmount: '0',
    transactionId: '',
    isCaptain: false,
    status: 'Active'
  });

  const categoryOptions = useMemo(() => {
    const set = new Set(categories);
    if (formData.category && formData.category.trim()) {
      set.add(formData.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, formData.category]);

  const openAddModal = () => {
    if (isScheduleLocked) {
      showToast("Cannot add members because this conclave schedule is generated and locked.", "error");
      return;
    }
    setEditingMember(null);
    setFormData({
      name: '',
      category: categories[0] || 'Real Estate',
      email: '',
      phone: '',
      company: '',
      chapter: '',
      address: '',
      region: loggedInAdmin?.region && loggedInAdmin.region !== 'Global' ? loggedInAdmin.region : 'Guntur Region',
      state: 'Andhra Pradesh',
      country: 'India',
      paymentStatus: 'paid',
      paymentMethod: 'UPI',
      paymentAmount: '0',
      transactionId: '',
      isCaptain: false,
      status: 'Active'
    });
    setIsFormOpen(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setFormData({
      name: member.name || '',
      category: member.category || '',
      email: member.email || '',
      phone: member.phone || '',
      company: member.company || '',
      chapter: member.chapter || '',
      address: member.address || '',
      region: member.region || member.userRegion || 'Guntur Region',
      state: member.state || 'Andhra Pradesh',
      country: member.country || 'India',
      paymentStatus: member.payment?.status || member.paymentStatus || 'paid',
      paymentMethod: member.payment?.method || member.paymentMethod || 'UPI',
      paymentAmount: member.payment?.amount !== undefined ? String(member.payment.amount) : (member.paymentAmount !== undefined ? String(member.paymentAmount) : '0'),
      transactionId: member.payment?.transactionId || member.transactionId || '',
      isCaptain: Boolean(member.isCaptain),
      status: member.status || 'Active'
    });
    setSelectedMember(null); // Close the details side drawer
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter the member's name.", "error");
      return;
    }
    if (!formData.email.trim()) {
      showToast("Please enter the member's email address.", "error");
      return;
    }
    if (!formData.phone.trim()) {
      showToast("Please enter the member's mobile number.", "error");
      return;
    }
    if (!formData.chapter.trim()) {
      showToast("Please enter the BNI chapter name.", "error");
      return;
    }

    let targetConclaveId = activeConclaveId || selectedConclaveId;
    if (!targetConclaveId) {
      const conclavesList = await api.get('/admin/conclaves').catch(() => []);
      if (Array.isArray(conclavesList) && conclavesList.length > 0) {
        targetConclaveId = conclavesList[0].id;
        setActiveConclaveId(targetConclaveId);
      }
    }

    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      company: formData.company.trim(),
      chapter: formData.chapter.trim(),
      address: formData.address.trim(),
      region: formData.region,
      state: formData.state,
      country: formData.country,
      paymentStatus: formData.paymentStatus,
      paymentMethod: formData.paymentMethod,
      paymentAmount: Number(formData.paymentAmount) || 0,
      transactionId: formData.transactionId.trim(),
      role: formData.isCaptain ? 'captain' : 'member',
      status: formData.status
    };

    if (editingMember) {
      // Edit mode
      try {
        if (targetConclaveId) {
          await api.put(`/admin/conclaves/${targetConclaveId}/members/${editingMember.id}`, payload);

          if (editingMember.isCaptain !== formData.isCaptain) {
            await api.post(`/admin/conclaves/${targetConclaveId}/registrations/${editingMember.id}/role`, {
              role: formData.isCaptain ? 'captain' : 'member'
            }).catch(() => {});
          }
        }

        const updatedData = {
          ...formData,
          payment: {
            status: formData.paymentStatus,
            method: formData.paymentMethod,
            amount: Number(formData.paymentAmount) || 0,
            transactionId: formData.transactionId.trim()
          }
        };

        setMembers(prev => prev.map(m => m.id === editingMember.id ? {
          ...m,
          ...updatedData,
          avatar: formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || m.avatar
        } : m));

        setSelectedMember(prev => prev && prev.id === editingMember.id ? {
          ...prev,
          ...updatedData,
          avatar: formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || prev.avatar
        } : prev);

        showToast("Member updated successfully.", "success");
        setIsFormOpen(false);
      } catch (err) {
        console.error("Failed to update member:", err);
        showToast(err.message || "Failed to update member.", "error");
      }
    } else {
      // Add mode
      if (isScheduleLocked) {
        showToast("Cannot add members because this conclave schedule is generated and locked.", "error");
        return;
      }
      try {
        let addedId = `BNI-00${Math.floor(100 + Math.random() * 900)}`;
        let defaultPw = null;
        let loginId = null;
        if (targetConclaveId) {
          const res = await api.post(`/admin/conclaves/${targetConclaveId}/members`, payload);
          if (res?.registration?.userId) {
            addedId = res.registration.userId;
          }
          if (res?.defaultPassword) {
            defaultPw = res.defaultPassword;
            loginId = res.loginIdentifier || formData.phone.trim() || formData.email.trim();
          }
        }

        const newMember = {
          ...formData,
          id: addedId,
          uid: addedId,
          payment: {
            status: formData.paymentStatus,
            method: formData.paymentMethod,
            amount: Number(formData.paymentAmount) || 0,
            transactionId: formData.transactionId.trim()
          },
          avatar: formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'M',
          joinDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          history: [{ event: 'Created manually', date: new Date().toLocaleDateString(), role: formData.isCaptain ? 'Captain' : 'Member' }],
          conclaveIds: [targetConclaveId]
        };
        setMembers(prev => [newMember, ...prev]);
        if (defaultPw) {
          showToast(`Member created! Login ID: ${loginId} | Password: ${defaultPw}`, "success", 12000);
        } else {
          showToast("Member added successfully.", "success");
        }
        setIsFormOpen(false);
      } catch (err) {
        console.error("Failed to add member:", err);
        showToast(err.message || "Failed to add member.", "error");
      }
    }
  };

  // Conclave-specific members subset
  const conclaveMembers = useMemo(() => {
    return members;
  }, [members]);

  // Dynamic statistics calculations
  const totalCount = conclaveMembers.length;
  const activeCount = conclaveMembers.filter(m => m.status === 'Active').length;
  const activePercentage = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : '0';
  const captainCount = conclaveMembers.filter(m => m.isCaptain).length;
  const businessClassCount = new Set(conclaveMembers.map(m => m.category)).size;

  // Get distinct filter options dynamically from member data
  const categoriesList = useMemo(() => {
    const list = new Set(members.map(m => m.category).filter(v => v && v !== 'N/A' && v !== 'General'));
    return ['All', ...Array.from(list).sort()];
  }, [members]);

  const statesList = useMemo(() => {
    const defaultStates = [
      'Andhra Pradesh',
      'Telangana',
      'Karnataka',
      'Tamil Nadu',
      'Maharashtra',
      'Gujarat',
      'Delhi',
      'Kerala',
      'Goa',
      'Madhya Pradesh',
      'Rajasthan',
      'Uttar Pradesh',
      'West Bengal',
      'Punjab',
      'Haryana',
      'Central Region',
      'Greater London',
      'Dubai'
    ];
    const memberStates = members
      .map(m => m.state)
      .filter(v => v && v !== 'N/A' && v.trim() !== '');

    const combined = new Set([...memberStates, ...defaultStates]);
    const sorted = Array.from(combined).sort((a, b) => a.localeCompare(b));
    return ['All', ...sorted];
  }, [members]);

  const countriesList = useMemo(() => {
    const defaultCountries = [
      'India',
      'Singapore',
      'United Arab Emirates',
      'United States',
      'United Kingdom',
      'Australia',
      'Canada',
      'Malaysia'
    ];
    const memberCountries = members
      .map(m => m.country)
      .filter(v => v && v !== 'N/A' && v.trim() !== '');

    const combined = new Set([...memberCountries, ...defaultCountries]);
    const sorted = Array.from(combined).sort((a, b) => a.localeCompare(b));
    return ['All', ...sorted];
  }, [members]);

  const chaptersList = useMemo(() => {
    const list = new Set(members.map(m => m.chapter).filter(v => v && v !== 'N/A'));
    return ['All', ...Array.from(list).sort()];
  }, [members]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const q = (searchVal || '').trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];

    return conclaveMembers.filter(member => {
      const memberText = `${member.name || ''} ${member.id || ''} ${member.email || ''} ${member.phone || ''} ${member.company || ''} ${member.category || ''} ${member.chapter || ''} ${member.address || ''} ${member.state || ''} ${member.country || ''}`.toLowerCase();
      const matchesSearch = !q || tokens.every(token => memberText.includes(token));

      const matchesCategory = categoryFilter === 'All' || member.category === categoryFilter;

      const matchesCaptain =
        captainFilter === 'All' ||
        (captainFilter === 'Captain' && member.isCaptain) ||
        (captainFilter === 'Member' && !member.isCaptain);

      const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
      const adminReg = (loggedInAdmin?.region || loggedInAdmin?.scope || '').toLowerCase().trim();
      const memberReg = (member.region || getMemberRegion(member) || '').toLowerCase().trim();
      const matchesViewScope = viewScope === 'conclave' || viewScope === 'global' || !adminReg || adminReg === 'global' || adminReg.includes('global') || memberReg.includes(adminReg) || adminReg.includes(memberReg);

      const matchesState = stateFilter === 'All' ||
        (member.state && member.state.toLowerCase() === stateFilter.toLowerCase()) ||
        (!member.state && stateFilter === 'Andhra Pradesh');

      const matchesCountry = countryFilter === 'All' ||
        (member.country && member.country.toLowerCase() === countryFilter.toLowerCase()) ||
        (!member.country && countryFilter === 'India');

      return matchesSearch && matchesCategory && matchesCaptain && matchesStatus && matchesViewScope && matchesState && matchesCountry;
    });
  }, [conclaveMembers, searchVal, categoryFilter, captainFilter, statusFilter, stateFilter, countryFilter, viewScope, loggedInAdmin]);

  // Paginated members slice
  const paginatedMembers = useMemo(() => {
    const totalPages = Math.ceil(filteredMembers.length / itemsPerPage) || 1;
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredMembers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMembers, currentPage, itemsPerPage]);

  // Export filtered members to CSV file
  const handleExport = () => {
    if (filteredMembers.length === 0) {
      showToast('No members found to export!', 'error');
      return;
    }
    const headers = ['Member ID', 'Name', 'Category', 'Email', 'Phone', 'Role', 'Status', 'Join Date', 'Company', 'Chapter', 'Region'];
    const rows = filteredMembers.map(m => [
      m.id,
      `"${m.name}"`,
      `"${m.category}"`,
      m.email,
      m.phone,
      m.isCaptain ? 'Captain' : 'Member',
      m.status,
      m.joinDate,
      `"${m.company}"`,
      `"${m.chapter}"`,
      `"${getMemberRegion(m)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bni_members_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export only checked members to CSV
  const handleBulkExport = () => {
    const selectedList = members.filter(m => selectedRows.has(m.id));
    if (selectedList.length === 0) return;

    const headers = ['Member ID', 'Name', 'Category', 'Email', 'Phone', 'Role', 'Status', 'Join Date', 'Company', 'Chapter'];
    const rows = selectedList.map(m => [
      m.id,
      `"${m.name}"`,
      `"${m.category}"`,
      m.email,
      m.phone,
      m.isCaptain ? 'Captain' : 'Member',
      m.status,
      m.joinDate,
      `"${m.company}"`,
      `"${m.chapter}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `selected_members_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Successfully exported ${selectedList.length} selected members.`, 'success');
  };

  // Import members from CSV file
  const handleImport = (e) => {
    if (isScheduleLocked) {
      showToast("Cannot import members because this conclave schedule is generated and locked.", "error");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    let targetConclaveId = activeConclaveId || selectedConclaveId;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length <= 1) return;

      const newMembers = [];
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(col => col.replace(/^["']|["']$/g, '').trim());
        if (columns.length >= 5) {
          const [id, name, category, email, phone, role, status, joinDate, company, chapter] = columns;

          const avatar = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'M';

          newMembers.push({
            id: id || `BNI-00${Math.floor(100 + Math.random() * 900)}`,
            name: name || 'Unknown Member',
            category: category || 'General',
            email: email || 'n/a',
            phone: phone || 'n/a',
            isCaptain: role === 'Captain',
            status: status === 'Inactive' ? 'Inactive' : 'Active',
            joinDate: joinDate || 'Just now',
            company: company || 'Self Employed',
            chapter: chapter || 'Peak Performance',
            avatar: avatar,
            history: [{ event: 'Imported via CSV', date: new Date().toLocaleDateString(), role: 'Active Member' }],
            conclaveIds: [targetConclaveId]
          });
        }
      }

      if (newMembers.length > 0) {
        if (targetConclaveId) {
          for (const m of newMembers) {
            try {
              await api.post(`/admin/conclaves/${targetConclaveId}/members`, {
                name: m.name,
                category: m.category,
                email: m.email,
                phone: m.phone,
                company: m.company,
                chapter: m.chapter,
                role: m.isCaptain ? 'captain' : 'member',
                status: m.status
              });
            } catch (err) {
              console.warn("Failed to sync imported member to backend:", m.name, err);
            }
          }
        }
        setMembers(prev => [...newMembers, ...prev]);
        showToast(`Successfully imported ${newMembers.length} members from CSV!`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle individual row checkbox toggle
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

  // Handle select all checkbox toggle
  const toggleSelectAll = () => {
    if (selectedRows.size === filteredMembers.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredMembers.map(m => m.id)));
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('All');
    setCaptainFilter('All');
    setStatusFilter('All');
    setStateFilter('All');
    setCountryFilter('All');
    setSelectedRows(new Set());
  };

  const handleDownloadTemplate = () => {
    const headers = ['Member ID', 'Name', 'Category', 'Email', 'Phone', 'Role', 'Status', 'Join Date', 'Company', 'Chapter'];
    const sampleRow = [
      'BNI-00101',
      '"Suresh Verma"',
      '"Interior Designer"',
      'suresh@verma.com',
      '+91 9811122233',
      'Member',
      'Active',
      'June 2024',
      '"Verma Design Studio"',
      '"Zenith Chapter"'
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bni_members_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6 animate-fade-in">

      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-dashboard-title text-zinc-955 font-extrabold tracking-tight">Members Management</h2>
          <p className="text-body-text text-zinc-500 mt-2">
            Manage registered BNI members and chapter seating details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
          {/* Schedule Locked Notice */}
          {isScheduleLocked && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg shadow-3xs">
              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-600">
                  Schedule Locked
                </span>
                <span className="text-[11px] font-extrabold text-amber-800">
                  Member additions closed
                </span>
              </div>
            </div>
          )}

          {/* Superadmin toggle for allowing regular admins to add/manage members */}
          {isSuperadmin && (
            <div className={`flex items-center gap-2.5 px-3 py-1.5 bg-white border border-zinc-250 rounded-lg shadow-3xs ${isScheduleLocked ? 'opacity-60' : ''}`}>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                  Admin Member Add
                </span>
                <span className={`text-[11px] font-extrabold ${isScheduleLocked ? 'text-zinc-500' : allowAdminAddMembers ? 'text-emerald-600' : 'text-zinc-500'}`}>
                  {isScheduleLocked ? 'Locked (OFF)' : allowAdminAddMembers ? 'Allowed (ON)' : 'Restricted (OFF)'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!isScheduleLocked && allowAdminAddMembers}
                disabled={isPermissionsLoading || isScheduleLocked}
                onClick={handleToggleAdminPermission}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !isScheduleLocked && allowAdminAddMembers ? 'bg-emerald-600' : 'bg-zinc-300'
                } ${isPermissionsLoading || isScheduleLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isScheduleLocked ? 'Schedule is locked - Member additions closed' : allowAdminAddMembers ? 'Click to revoke Admin permission to add/manage members' : 'Click to grant Admin permission to add/manage members'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !isScheduleLocked && allowAdminAddMembers ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Export button always available for attendee check-in/badges */}
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-[11px] rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-3xs"
          >
            <Upload className="w-4 h-4 text-zinc-400" />
            Export
          </button>

          {/* Member action buttons: conditionally visible only if not schedule locked AND has permission */}
          {!isScheduleLocked && canPerformMemberActions && (
            <>
              <input
                type="file"
                id="csv-file-input"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={handleDownloadTemplate}
                title="Download formatted CSV template for member import"
                className="flex items-center justify-center gap-1 px-3 py-2 border border-zinc-250 bg-zinc-50 text-zinc-700 font-bold text-[11px] rounded-lg hover:bg-zinc-100 transition-smooth cursor-pointer shadow-3xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Template
              </button>
              <button
                onClick={() => document.getElementById('csv-file-input')?.click()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white text-zinc-700 font-bold text-[11px] rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer shadow-3xs"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                Import
              </button>
              <button
                onClick={openAddModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-red hover:bg-red-700 text-white font-bold text-button rounded-lg transition-smooth shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </button>
            </>
          )}
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

      {/* Statistics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Total Members</span>
          <span className="text-display-sm font-extrabold text-zinc-900 leading-none mt-3">{totalCount}</span>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Active Members</span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-display-sm font-extrabold text-zinc-900 leading-none">{activeCount}</span>
          </div>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Chapter Captains</span>
          <span className="text-display-sm font-extrabold text-zinc-900 leading-none mt-3">{captainCount}</span>
        </div>
        <div className="bg-white border border-zinc-200/80 p-5 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md transition-smooth">
          <span className="text-label-md text-zinc-500 uppercase font-semibold">Business Classifications</span>
          <span className="text-display-sm font-extrabold text-zinc-900 leading-none mt-3">{businessClassCount}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-zinc-200/80 p-3.5 flex flex-col lg:flex-row gap-3 items-center justify-between rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm placeholder-zinc-400 focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth bg-zinc-50/20"
              placeholder="Search by member name, ID, email..."
              type="text"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Category Filter */}
            <SearchableDropdown
              label="Category"
              options={categoriesList.length > 1 ? categoriesList : ['All']}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder="Search category..."
            />

            {/* Captain Status */}
            <SearchableDropdown
              label="Role"
              options={['All', 'Captain', 'Member']}
              value={captainFilter}
              onChange={setCaptainFilter}
              placeholder="Search role..."
            />

            {/* Status */}
            <SearchableDropdown
              label="Status"
              options={['All', 'Active', 'Inactive']}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Search status..."
            />

            {/* State Filter */}
            <SearchableDropdown
              label="State"
              options={statesList}
              value={stateFilter}
              onChange={setStateFilter}
              placeholder="Search state..."
            />

            {/* Country Filter */}
            <SearchableDropdown
              label="Country"
              options={countriesList}
              value={countryFilter}
              onChange={setCountryFilter}
              placeholder="Search country..."
            />
          </div>
        </div>
        <button
          onClick={resetFilters}
          className="text-label-md font-bold text-brand-red hover:underline px-4 cursor-pointer shrink-0 transition-smooth"
        >
          Reset Filters
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-label-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-5 py-4 w-12 text-center">
                  <input
                    checked={filteredMembers.length > 0 && selectedRows.size === filteredMembers.length}
                    onChange={toggleSelectAll}
                    className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                    type="checkbox"
                  />
                </th>
                <th className="px-5 py-4">Member Name</th>
                <th className="px-5 py-4">Member ID</th>
                <th className="px-5 py-4">Region</th>
                <th className="px-5 py-4">Classification</th>
                <th className="px-5 py-4">Contact Info</th>
                <th className="px-5 py-4">Chapter Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-center">Given</th>
                <th className="px-5 py-4 text-center">Taken</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-table-text">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="11" className="p-8 text-center text-zinc-400 font-medium">
                    No members match the active filters. Try resetting search queries.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className="group cursor-pointer"
                  >
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        checked={selectedRows.has(member.id)}
                        onChange={(e) => toggleRow(member.id, e)}
                        className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                        type="checkbox"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-red/10 text-brand-red font-bold text-xs flex items-center justify-center shrink-0 border border-brand-red/10">
                          {member.avatar}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-body-sm font-bold text-zinc-900 transition-smooth leading-tight">{member.name}</span>
                          <span className="text-[10px] text-zinc-455 font-semibold uppercase mt-0.5">Member since {member.joinDate.split(' ')[1] || member.joinDate}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-700">{member.id}</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-550 text-[10px] font-bold rounded-full whitespace-nowrap">
                        {getMemberRegion(member)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md text-[10.5px] font-extrabold border border-zinc-200/80">
                        {member.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-body-sm text-zinc-650 leading-tight select-all">{member.email}</span>
                        <span className="text-[10px] text-zinc-400 font-semibold mt-0.5 select-all">{member.phone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {member.isCaptain ? (
                        <span className="px-2.5 py-0.5 border border-brand-red/35 text-brand-red bg-brand-red/5 font-extrabold rounded-md text-[9px] uppercase tracking-wide">
                          Captain
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 border border-zinc-200 text-zinc-500 bg-zinc-50 font-semibold rounded-md text-[9px] uppercase tracking-wide">
                          Member
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {member.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-zinc-805">
                      {referrals.filter(r => r.fromMemberId === member.id).length}
                    </td>
                    <td className="px-5 py-4 text-center font-bold text-zinc-805">
                      {referrals.filter(r => r.toMemberId === member.id).length}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedMember(member)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-smooth cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canPerformMemberActions && (
                          <>
                            <button
                              onClick={() => openEditModal(member)}
                              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-brand-red transition-smooth cursor-pointer"
                              title="Edit Profile"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(member)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-brand-red transition-smooth cursor-pointer"
                              title="Delete Member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Reusable Pagination Component */}
        <Pagination
          totalItems={filteredMembers.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          label="localized Indian members"
        />
      </div>

      {/* Member Details Drawer overlay */}
      {createPortal(
        <>
          <div
            onClick={() => setSelectedMember(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${selectedMember ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
          />

          <div className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[420px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${selectedMember ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}>
            {selectedMember && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedMember(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <h3 className="text-section-heading font-extrabold text-zinc-955">Member Details</h3>
                  </div>
                  {canPerformMemberActions && (
                    <button
                      onClick={() => openEditModal(selectedMember)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-brand-red hover:bg-brand-red/5 transition-smooth cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">

                  {/* Profile Card Summary */}
                  <div className="flex flex-col items-center gap-3 text-center bg-white p-4 rounded-xl border border-zinc-200/60 shadow-2xs">
                    <div className="w-20 h-20 rounded-full border-2 border-brand-red/20 p-1 bg-white">
                      <div className="w-full h-full rounded-full bg-brand-red/10 text-brand-red font-bold text-xl flex items-center justify-center shadow-inner">
                        {selectedMember.avatar}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-headline-md font-bold text-zinc-950 leading-tight">{selectedMember.name}</h4>
                      <p className="text-body-text text-zinc-500 font-semibold">{selectedMember.company}</p>
                      <div className="flex gap-2 mt-2.5 justify-center">
                        {selectedMember.isCaptain ? (
                          <span className="px-2.5 py-0.5 border border-brand-red/35 text-brand-red bg-brand-red/5 font-extrabold rounded-md text-[9px] uppercase tracking-wide">
                            Captain
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 border border-zinc-200 text-zinc-500 bg-white font-semibold rounded-md text-[9px] uppercase tracking-wide">
                            Member
                          </span>
                        )}
                        {selectedMember.status === 'Active' ? (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-md text-[9px] font-extrabold uppercase">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-zinc-100 text-zinc-500 border border-zinc-200 rounded-md text-[9px] font-semibold uppercase">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2.5 mt-3 justify-center border-t border-zinc-100 pt-2.5 w-full">
                        <span className="px-2 py-1 bg-zinc-50 border border-zinc-150 rounded-lg text-[9.5px] font-bold text-zinc-600">
                          Sent: {referrals.filter(r => r.fromMemberId === selectedMember.id).length}
                        </span>
                        <span className="px-2 py-1 bg-zinc-50 border border-zinc-150 rounded-lg text-[9.5px] font-bold text-zinc-600">
                          Received: {referrals.filter(r => r.toMemberId === selectedMember.id).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Member Info details */}
                  <section className="space-y-3">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Member Information</h5>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Member ID</span>
                        <span className="text-body-sm font-bold text-zinc-800">{selectedMember.id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">BNI Chapter</span>
                        <span className="text-body-sm font-bold text-zinc-800">{selectedMember.chapter}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Classification</span>
                        <span className="text-body-sm font-bold text-zinc-800">{selectedMember.category}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Join Date</span>
                        <span className="text-body-sm font-bold text-zinc-800">{selectedMember.joinDate}</span>
                      </div>
                    </div>
                  </section>

                  {/* Contact Details */}
                  <section className="space-y-4">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Contact Details</h5>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg flex items-center justify-center">
                          <Mail className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="text-[10px] text-zinc-400 font-semibold block">Email Address</span>
                          <span className="text-body-sm font-bold text-zinc-800 select-all">{selectedMember.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg flex items-center justify-center">
                          <Phone className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="text-[10px] text-zinc-400 font-semibold block">Mobile Number</span>
                          <span className="text-body-sm font-bold text-zinc-800 select-all">{selectedMember.phone}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg flex items-center justify-center mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="text-[10px] text-zinc-400 font-semibold block">Office Location</span>
                          <span className="text-body-sm font-bold text-zinc-800 select-all">{selectedMember.address}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payment Details */}
                  <section className="space-y-3 bg-zinc-50/80 p-3.5 rounded-xl border border-zinc-200/80">
                    <div className="flex items-center justify-between border-b border-zinc-200/70 pb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                        Registration Payment
                      </span>
                      <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border ${
                        (selectedMember.payment?.status || selectedMember.paymentStatus) === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (selectedMember.payment?.status || selectedMember.paymentStatus) === 'waived'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {selectedMember.payment?.status || selectedMember.paymentStatus || 'Paid'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-body-sm">
                      <div>
                        <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">Amount</span>
                        <span className="font-extrabold text-zinc-800">
                          ₹{Number(selectedMember.payment?.amount !== undefined ? selectedMember.payment.amount : (selectedMember.paymentAmount || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">Method</span>
                        <span className="font-bold text-zinc-800 uppercase text-[11px]">
                          {selectedMember.payment?.method || selectedMember.paymentMethod || 'Admin Direct'}
                        </span>
                      </div>
                      {(selectedMember.payment?.transactionId || selectedMember.transactionId) && (
                        <div className="col-span-2 pt-1 border-t border-zinc-150">
                          <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">Transaction Ref / ID</span>
                          <span className="font-mono text-[11px] font-bold text-zinc-700 select-all">
                            {selectedMember.payment?.transactionId || selectedMember.transactionId}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Conclave History */}
                  <section className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Conclave Activity</h5>
                    <div className="relative pl-3 space-y-5 border-l border-zinc-100 ml-1.5">
                      {selectedMember.history.map((hist, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[17.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-brand-red' : 'bg-zinc-300'
                            }`} />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-caption font-bold text-zinc-800 leading-tight">{hist.event}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">{hist.date} • {hist.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Referral History */}
                  <section className="space-y-3.5">
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-1.5">Referral History</h5>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
                      {referrals.filter(r => r.fromMemberId === selectedMember.id || r.toMemberId === selectedMember.id).length === 0 ? (
                        <p className="p-4 text-center text-[10.5px] text-zinc-400 font-semibold bg-white">No referrals logged for this member.</p>
                      ) : (
                        referrals.filter(r => r.fromMemberId === selectedMember.id || r.toMemberId === selectedMember.id).map(ref => {
                          const isGiven = ref.fromMemberId === selectedMember.id;
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
                              <p className="text-[11px] font-semibold text-zinc-500 mt-1 italic">"{ref.description}"</p>
                              <span className="text-[8px] text-zinc-400 font-extrabold uppercase mt-1 block">{ref.date}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-zinc-100 bg-white flex flex-col gap-2 shrink-0 shadow-lg">
                  <button
                    onClick={async () => {
                      const newIsCaptain = !selectedMember.isCaptain;
                      const newRole = newIsCaptain ? 'captain' : 'member';

                      try {
                        await api.post(`/admin/users/${selectedMember.id}/role`, { role: newRole });
                        if (selectedConclaveId) {
                          await api.post(`/admin/conclaves/${selectedConclaveId}/registrations/${selectedMember.id}/role`, { role: newRole }).catch(() => { });
                        }
                      } catch (err) {
                        console.error("Failed to update user role:", err);
                      }

                      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, isCaptain: newIsCaptain, role: newRole } : m));
                      setSelectedMember(prev => prev ? { ...prev, isCaptain: newIsCaptain, role: newRole } : null);
                      showToast(`${selectedMember.name}'s role updated to ${newIsCaptain ? 'Table Captain' : 'Member'}.`);
                    }}
                    className={`w-full py-2 ${selectedMember.isCaptain ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-red hover:bg-red-700'} text-white rounded-lg text-button font-bold transition-smooth shadow-sm cursor-pointer`}
                  >
                    {selectedMember.isCaptain ? 'Demote to Member' : 'Promote to Table Captain'}
                  </button>
                  <button
                    onClick={() => setSelectedMember(null)}
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

      {/* Add / Edit Member Modal */}
      {isFormOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white rounded-2xl border border-zinc-100 shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
              <h3 className="text-section-heading font-extrabold text-zinc-950">
                {editingMember ? 'Edit Member Profile' : 'Add New Member'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 font-bold transition-smooth text-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[60vh] md:max-h-[65vh]">
                <div className="grid grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Full Name <span className="text-brand-red font-black">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="e.g. Rajesh Mehta"
                    />
                  </div>

                  {/* Classification / Category */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Classification <span className="text-brand-red font-black">*</span>
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-medium text-zinc-700 cursor-pointer"
                    >
                      <option value="" disabled>Select Classification</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      BNI Chapter <span className="text-brand-red font-black">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.chapter}
                      onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="e.g. Apex Chapter"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Email Address <span className="text-brand-red font-black">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="name@company.com"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Mobile Number <span className="text-brand-red font-black">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="+91 98XXX XXXXX"
                    />
                  </div>

                  {/* Company Name */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Company Name <span className="text-brand-red font-black">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="e.g. Mehta Developers"
                    />
                  </div>

                  {/* Office Location */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                      Office Location <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-smooth"
                      placeholder="Office address or city"
                    />
                  </div>

                  {/* Location & Jurisdiction Section */}
                  <div className="col-span-2 pt-3 border-t border-zinc-100 space-y-3">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">
                      Region &amp; Geography
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Region</label>
                        <input
                          type="text"
                          value={formData.region}
                          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-1 focus:ring-brand-red outline-none"
                          placeholder="e.g. Guntur Region"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">State</label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-1 focus:ring-brand-red outline-none"
                          placeholder="e.g. Andhra Pradesh"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Country</label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-1 focus:ring-brand-red outline-none"
                          placeholder="e.g. India"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Section */}
                  <div className="col-span-2 pt-3 border-t border-zinc-100 space-y-3 bg-zinc-50/60 p-3.5 rounded-xl border border-zinc-200/60">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
                      Registration Payment Details
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Payment Status</label>
                        <select
                          value={formData.paymentStatus}
                          onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm bg-white font-medium focus:ring-1 focus:ring-brand-red outline-none cursor-pointer"
                        >
                          <option value="paid">Paid</option>
                          <option value="pending">Pending / Unpaid</option>
                          <option value="waived">Waived / Free</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Payment Method</label>
                        <select
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm bg-white font-medium focus:ring-1 focus:ring-brand-red outline-none cursor-pointer"
                        >
                          <option value="UPI">UPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer / NEFT</option>
                          <option value="Razorpay">Razorpay / Online</option>
                          <option value="admin_direct">Admin Direct</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.paymentAmount}
                          onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-1 focus:ring-brand-red outline-none"
                          placeholder="e.g. 2500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9.5px] text-zinc-500 font-bold uppercase block">Transaction / Ref ID (optional)</label>
                        <input
                          type="text"
                          value={formData.transactionId}
                          onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-body-sm focus:ring-1 focus:ring-brand-red outline-none"
                          placeholder="e.g. UPI-12345678"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Role Toggle & Status Select */}
                  <div className="col-span-2 flex items-center justify-between pt-2 border-t border-zinc-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="form-is-captain"
                        checked={formData.isCaptain}
                        onChange={(e) => setFormData({ ...formData, isCaptain: e.target.checked })}
                        className="rounded border-zinc-300 text-brand-red focus:ring-brand-red cursor-pointer w-4 h-4"
                      />
                      <label htmlFor="form-is-captain" className="text-body-sm font-semibold text-zinc-700 cursor-pointer select-none">
                        Assign as Chapter Captain
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Status:</span>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="border border-zinc-200 rounded-lg px-2.5 py-1 text-body-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none bg-white font-semibold text-zinc-700 cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Static Non-Scrolling Footer Action Buttons */}
              <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-button rounded-lg transition-smooth shadow-sm cursor-pointer border border-zinc-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth shadow-md cursor-pointer font-bold text-xs"
                >
                  {editingMember ? 'Save Changes' : 'Create Member'}
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
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Confirm Deletion</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to remove this member? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-zinc-200/60 shadow-2xs text-[11px] text-zinc-500 font-medium">
              Name: <span className="font-bold text-zinc-900">{deleteTarget.name}</span>
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
                  if (!deleteTarget) return;
                  if (isScheduleLocked) {
                    showToast("Cannot delete members because this conclave schedule is generated and locked.", "error");
                    setDeleteTarget(null);
                    return;
                  }
                  const targetConclaveId = activeConclaveId || selectedConclaveId || members[0]?.conclaveIds?.[0];
                  try {
                    if (targetConclaveId) {
                      await api.delete(`/admin/conclaves/${targetConclaveId}/members/${deleteTarget.id}`);
                    }
                    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
                    if (selectedMember && selectedMember.id === deleteTarget.id) {
                      setSelectedMember(null);
                    }
                    showToast(`Member "${deleteTarget.name}" has been deleted.`, 'success');
                  } catch (err) {
                    console.error("Failed to delete member:", err);
                    showToast(err.message || "Failed to delete member.", 'error');
                  } finally {
                    setDeleteTarget(null);
                  }
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
                <h3 className="text-body-sm font-bold text-zinc-950 leading-tight">Confirm Bulk Deletion</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                  Are you sure you want to remove all {selectedRows.size} selected members? This action is permanent and cannot be undone.
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
                onClick={async () => {
                  if (isScheduleLocked) {
                    showToast("Cannot delete members because this conclave schedule is generated and locked.", "error");
                    setIsBulkDeleteConfirmOpen(false);
                    return;
                  }
                  const targetConclaveId = activeConclaveId || selectedConclaveId || members[0]?.conclaveIds?.[0];
                  const uids = Array.from(selectedRows);
                  try {
                    if (targetConclaveId) {
                      await Promise.all(
                        uids.map(uid => api.delete(`/admin/conclaves/${targetConclaveId}/members/${uid}`).catch(err => {
                          console.error(`Failed to delete member ${uid}:`, err);
                        }))
                      );
                    }
                    setMembers(prev => prev.filter(m => !selectedRows.has(m.id)));
                    showToast(`Successfully deleted ${selectedRows.size} members.`, 'success');
                    setSelectedRows(new Set());
                  } catch (err) {
                    console.error("Failed to bulk delete members:", err);
                    showToast("Failed to delete some members.", 'error');
                  } finally {
                    setIsBulkDeleteConfirmOpen(false);
                  }
                }}
                className="px-3.5 py-1.5 bg-brand-red hover:bg-red-700 text-white text-button rounded-lg transition-smooth cursor-pointer text-[10px] font-bold"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}




      {/* Floating Bulk Actions Bar */}
      {selectedRows.size > 0 && canPerformMemberActions && (
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
