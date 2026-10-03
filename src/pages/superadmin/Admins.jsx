import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Globe,
  Info,
  CalendarRange,
  Users,
  Eye,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';

export default function SuperadminAdmins({ searchQuery }) {
  const [subTab, setSubTab] = useState('admins'); // 'admins' or 'regions'

  // Local state for interactive CRUD
  const [admins, setAdmins] = useState(() => {
    const cached = localStorage.getItem('bni_superadmin_admins_cache');
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
  const [conclaves, setConclaves] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Drawer states
  const [activeAdmin, setActiveAdmin] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);

  // Form Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    mobile: '',
    region: '',
    status: 'Active'
  });

  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState(null);
  const [regionForm, setRegionForm] = useState({
    name: '',
    membersCount: 0,
    conclavesCount: 0,
    status: 'Active'
  });

  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [isPasswordCopied, setIsPasswordCopied] = useState(false);
  const [isPasswordResetDone, setIsPasswordResetDone] = useState(false);
  const [isNewAdminCreation, setIsNewAdminCreation] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const showToast = (title, desc, type = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Lock background body scroll when drawer or modal is open
  useEffect(() => {
    if (activeAdmin || activeRegion || showAdminModal || showRegionModal || resetPasswordTarget || confirmModal) {
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
  }, [activeAdmin, activeRegion, showAdminModal, showRegionModal, resetPasswordTarget, confirmModal]);

  const loadData = async () => {
    setIsLoading(false);
    try {
      const [adminsList, regionsList, conclavesList, membersList] = await Promise.all([
        api.get('/admin/coordinators').catch(() => []),
        api.get('/admin/regions').catch(() => []),
        api.get('/admin/conclaves').catch(() => []),
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
      setConclaves(conclavesList || []);
      setMembers(membersList || []);
    } catch (err) {
      console.error("Failed to load superadmin admins/regions data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randStr = '';
    for (let i = 0; i < 6; i++) {
      randStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BNI-R${randStr}`;
  };

  const generateDefaultPassword = (fullName) => {
    const nameStr = fullName || 'Admin';
    const firstName = nameStr.trim().split(' ')[0] || 'Admin';
    // Remove any special characters, keep only standard letters/numbers
    const cleanName = firstName.replace(/[^a-zA-Z0-9]/g, '');
    return `${cleanName}123`;
  };

  const handleOpenResetPassword = (admin) => {
    setResetPasswordTarget(admin);
    setTempPassword(generateDefaultPassword(admin.name));
    setIsPasswordCopied(false);
    setIsPasswordResetDone(false);
    setIsNewAdminCreation(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setIsPasswordCopied(true);
    setTimeout(() => setIsPasswordCopied(false), 2000);
  };

  const handleConfirmReset = async () => {
    if (!resetPasswordTarget) return;
    try {
      await api.post(`/admin/coordinators/${resetPasswordTarget.uid}/reset-password`, {
        password: tempPassword
      });
      setIsPasswordResetDone(true);
    } catch (err) {
      console.error("Failed to reset password:", err);
      alert(err.message || "Failed to reset coordinator password.");
    }
  };

  // Filtered Lists
  const q = searchQuery ? searchQuery.toLowerCase() : '';
  const filteredAdmins = admins.filter(admin => {
    const name = admin.name || '';
    const email = admin.email || '';
    const region = admin.region || '';
    return name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      region.toLowerCase().includes(q);
  });

  const filteredRegions = regions.filter(region => {
    const name = region.name || '';
    return name.toLowerCase().includes(q);
  });

  // Admin CRUD Handlers
  const handleOpenAdminModal = (admin = null) => {
    if (admin) {
      setEditingAdmin(admin);
      setAdminForm({
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        region: admin.region,
        status: admin.status
      });
    } else {
      setEditingAdmin(null);
      setAdminForm({
        name: '',
        email: '',
        mobile: '',
        region: regions[0]?.name || 'Guntur Region',
        status: 'Active'
      });
    }
    setShowAdminModal(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    try {
      if (editingAdmin) {
        await api.patch(`/admin/coordinators/${editingAdmin.uid}`, {
          name: adminForm.name,
          mobile: adminForm.mobile,
          region: adminForm.region,
          status: adminForm.status
        });
        showToast('Admin Profile Updated', `Coordinator profile for ${adminForm.name} was updated successfully.`, 'info');
      } else {
        const tempPass = generateDefaultPassword(adminForm.name);
        await api.post('/admin/coordinators', {
          email: adminForm.email,
          password: tempPass,
          name: adminForm.name,
          mobile: adminForm.mobile,
          region: adminForm.region,
          status: adminForm.status,
          role: 'coordinator'
        });
        setResetPasswordTarget({
          name: adminForm.name,
          email: adminForm.email,
          region: adminForm.region || 'Guntur Region'
        });
        setTempPassword(tempPass);
        setIsPasswordResetDone(true);
        setIsNewAdminCreation(true);
      }
      setShowAdminModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to save admin:", err);
      showToast('Error saving coordinator', err.message || "Failed to save administrator.", 'error');
    }
  };

  const handleDeleteAdmin = (uid) => {
    const adminObj = admins.find(a => a.uid === uid);
    const adminName = adminObj ? adminObj.name : 'this coordinator';
    setConfirmModal({
      title: "Revoke Coordinator Access",
      message: `Are you sure you want to revoke administrator access for ${adminName}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/coordinators/${uid}`);
          if (activeAdmin?.uid === uid) setActiveAdmin(null);
          loadData();
          showToast('Access Revoked', 'Coordinator administrator access has been revoked.', 'warning');
        } catch (err) {
          console.error("Failed to delete admin:", err);
          showToast('Failed to revoke access', err.message || "Failed to delete administrator.", 'error');
        }
      }
    });
  };

  // Region CRUD Handlers
  const handleOpenRegionModal = (region = null) => {
    if (region) {
      setEditingRegion(region);
      setRegionForm({
        name: region.name,
        membersCount: region.membersCount || 0,
        conclavesCount: region.conclavesCount || 0,
        status: region.status
      });
    } else {
      setEditingRegion(null);
      setRegionForm({
        name: '',
        membersCount: 0,
        conclavesCount: 0,
        status: 'Active'
      });
    }
    setShowRegionModal(true);
  };

  const handleSaveRegion = async (e) => {
    e.preventDefault();
    try {
      if (editingRegion) {
        await api.patch(`/admin/regions/${editingRegion.id}`, {
          name: regionForm.name,
          status: regionForm.status
        });
        showToast('Region Updated', `Region '${regionForm.name}' was updated successfully.`, 'info');
      } else {
        await api.post('/admin/regions', {
          name: regionForm.name,
          status: regionForm.status
        });
        showToast('New Region Created', `Region '${regionForm.name}' has been successfully created.`, 'success');
      }
      setShowRegionModal(false);
      loadData();
    } catch (err) {
      console.error("Failed to save region:", err);
      showToast('Error saving region', err.message || "Failed to save region.", 'error');
    }
  };

  const handleDeleteRegion = (id) => {
    const regionObj = regions.find(r => r.id === id);
    const regionName = regionObj ? regionObj.name : 'this region';
    setConfirmModal({
      title: "Delete BNI Region",
      message: `Are you sure you want to delete the region "${regionName}"? All linked coordinators and conclaves will lose their region reference.`,
      onConfirm: async () => {
        try {
          await api.delete(`/admin/regions/${id}`);
          if (activeRegion?.id === id) setActiveRegion(null);
          loadData();
          showToast('Region Deleted', 'BNI Region has been removed from the database.', 'warning');
        } catch (err) {
          console.error("Failed to delete region:", err);
          showToast('Failed to delete region', err.message || "Failed to delete region.", 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 relative">

      {/* Header tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-zinc-955 tracking-tight">Admins &amp; BNI Regions</h1>
          <p className="text-xs text-zinc-500 font-semibold">Manage regional administrator accounts and BNI regional network nodes.</p>
        </div>

        <div className="flex gap-2">
          {subTab === 'admins' ? (
            <button
              onClick={() => handleOpenAdminModal()}
              className="py-2 px-4 bg-brand-red hover:bg-red-750 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer shadow-sm shadow-brand-red/10"
            >
              <Plus className="w-4 h-4" />
              Add Admin
            </button>
          ) : (
            <button
              onClick={() => handleOpenRegionModal()}
              className="py-2 px-4 bg-brand-red hover:bg-red-750 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth flex items-center gap-1.5 cursor-pointer shadow-sm shadow-brand-red/10"
            >
              <Plus className="w-4 h-4" />
              Add Region
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-4 border-b border-zinc-200">
        <button
          onClick={() => setSubTab('admins')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer ${subTab === 'admins'
            ? 'border-b-2 border-brand-red text-brand-red font-black'
            : 'text-zinc-450 hover:text-zinc-700'
            }`}
        >
          Admins ({admins.length})
        </button>
        <button
          onClick={() => setSubTab('regions')}
          className={`pb-3 text-xs font-black uppercase tracking-wider transition-smooth cursor-pointer ${subTab === 'regions'
            ? 'border-b-2 border-brand-red text-brand-red font-black'
            : 'text-zinc-450 hover:text-zinc-700'
            }`}
        >
          BNI Regions ({regions.length})
        </button>
      </div>

      {/* Content Lists */}
      {subTab === 'admins' ? (
        <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-450 uppercase tracking-wider">
                  <th className="p-4 pl-6">Admin Name</th>
                  <th className="p-4">Assigned Region</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Mobile</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[12.5px] font-semibold text-zinc-700">
                {filteredAdmins.map((admin) => {
                  const adminName = admin.name || admin.email?.split('@')[0] || 'Unnamed Admin';
                  const adminRegion = admin.region || (admin.email?.includes('admin') || admin.email?.includes('super') ? 'Global (Superadmin)' : 'Guntur Region');
                  const adminMobile = admin.mobile || 'N/A';
                  const adminStatus = admin.status || 'Active';

                  return (
                    <tr key={admin.uid || admin.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <button
                          onClick={() => setActiveAdmin(admin)}
                          className="font-black text-zinc-900 text-left cursor-pointer"
                        >
                          {adminName}
                        </button>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 bg-zinc-50 border border-zinc-200 text-zinc-550 text-[10px] font-bold rounded-full whitespace-nowrap">
                          {adminRegion}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-500">{admin.email}</td>
                      <td className="p-4 text-zinc-500">{adminMobile}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${adminStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                          : 'bg-zinc-50 text-zinc-450 border border-zinc-200'
                          }`}>
                          {adminStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => setActiveAdmin(admin)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenAdminModal(admin)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenResetPassword(admin)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin.uid || admin.id)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-450 uppercase tracking-wider">
                  <th className="p-4 pl-6">Region Name</th>
                  <th className="p-4 text-center">Conclaves Created</th>
                  <th className="p-4 text-center">Total Members</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-[12.5px] font-semibold text-zinc-700">
                {filteredRegions.map((region) => (
                  <tr key={region.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <button
                        onClick={() => setActiveRegion(region)}
                        className="font-black text-zinc-900 text-left cursor-pointer"
                      >
                        {region.name}
                      </button>
                    </td>
                    <td className="p-4 text-center font-bold text-zinc-800">{region.conclavesCount} conclaves</td>
                    <td className="p-4 text-center font-bold text-zinc-800">{region.membersCount} members</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${region.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                        : 'bg-zinc-50 text-zinc-450 border border-zinc-200'
                        }`}>
                        {region.status}
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() => setActiveRegion(region)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenRegionModal(region)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRegion(region.id)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin detail drawer */}
      {createPortal(
        <>
          <div
            onClick={() => setActiveAdmin(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${
              activeAdmin ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          />
          <div
            className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[480px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${
              activeAdmin ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}
          >
            {activeAdmin && (() => {
              const adminName = activeAdmin.name || activeAdmin.email?.split('@')[0] || 'Unnamed Admin';
              const adminRegion = activeAdmin.region || (activeAdmin.email?.includes('admin') || activeAdmin.email?.includes('super') ? 'Global (Superadmin)' : 'Guntur Region');
              const adminMobile = activeAdmin.mobile || 'N/A';
              const adminStatus = activeAdmin.status || 'Active';
              const adminInitials = adminName.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase() || 'AD';

              return (
                <>
                  {/* Drawer Header */}
                  <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveAdmin(null)}
                        className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-section-heading font-extrabold text-zinc-950">Admin Details</h3>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Body */}
                  <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
                    <div className="flex items-center gap-3.5 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                      <div className="w-12 h-12 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center font-black text-[13px] shrink-0">
                        {adminInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13.5px] font-black text-zinc-900 leading-none truncate">{adminName}</h3>
                        <p className="text-[10px] text-zinc-455 font-bold uppercase tracking-wider mt-1 truncate">{adminRegion}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Email Address</span>
                        <span className="text-body-sm font-bold text-zinc-800 mt-1 block truncate select-all">{activeAdmin.email}</span>
                      </div>
                      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Mobile Number</span>
                        <span className="text-body-sm font-bold text-zinc-800 mt-1 block select-all">{adminMobile}</span>
                      </div>
                    </div>

                    {/* Region Metrics */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-0.5">Linked Region Summary</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 bg-zinc-50/50 border border-zinc-200 rounded-xl flex items-center gap-3">
                          <CalendarRange className="w-4 h-4 text-brand-red shrink-0" />
                          <div>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Conclaves</span>
                            <span className="text-[13px] font-black text-zinc-900">
                              {conclaves.filter(c => (c.region || 'Guntur Region') === adminRegion).length} Created
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5 bg-zinc-50/50 border border-zinc-200 rounded-xl flex items-center gap-3">
                          <Users className="w-4 h-4 text-brand-red shrink-0" />
                          <div>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Members</span>
                            <span className="text-[13px] font-black text-zinc-900">
                              {members.filter(m => (m.region ? (typeof m.region === 'object' ? m.region.place : m.region) : (m.location ? (typeof m.location === 'object' ? m.location.place : m.location) : 'Global')) === adminRegion).length} Registered
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Region Members List preview */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-0.5">Registered Members</h4>
                      <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200 max-h-[220px] overflow-y-auto">
                        {members.filter(m => (m.region ? (typeof m.region === 'object' ? m.region.place : m.region) : (m.location ? (typeof m.location === 'object' ? m.location.place : m.location) : 'Global')) === adminRegion).map(member => (
                          <div key={member.id} className="p-3 flex justify-between items-center text-body-sm bg-white hover:bg-zinc-50/50 transition-colors">
                            <div>
                              <p className="font-black text-zinc-800">{member.name}</p>
                              <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">{member.company} • {member.category}</p>
                            </div>
                            <span className="text-[10px] bg-zinc-50 border border-zinc-200 text-zinc-500 font-bold px-2 py-0.5 rounded-full">
                              {member.chapter}
                            </span>
                          </div>
                        ))}
                        {members.filter(m => (m.region ? (typeof m.region === 'object' ? m.region.place : m.region) : (m.location ? (typeof m.location === 'object' ? m.location.place : m.location) : 'Global')) === adminRegion).length === 0 && (
                          <p className="p-4 text-center text-zinc-400 text-caption font-semibold">No registered members in this region.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-zinc-100 bg-white flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => {
                        const target = activeAdmin;
                        setActiveAdmin(null);
                        handleOpenResetPassword(target);
                      }}
                      className="flex-1 py-2.5 px-4 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer flex items-center justify-center gap-2"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Reset Password
                    </button>
                    <button
                      onClick={() => setActiveAdmin(null)}
                      className="flex-1 py-2.5 px-4 bg-brand-red hover:bg-red-750 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer text-center shadow-xs"
                    >
                      Close View
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* Region detail drawer */}
      {createPortal(
        <>
          <div
            onClick={() => setActiveRegion(null)}
            className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-[9999] transition-opacity duration-300 ${
              activeRegion ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          />
          <div
            className={`fixed right-0 top-0 bottom-0 h-screen w-full max-w-[480px] bg-white border-l border-zinc-100 shadow-2xl transform transition-transform duration-300 flex flex-col overflow-hidden z-[10000] ${
              activeRegion ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
            }`}
          >
            {activeRegion && (
              <>
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveRegion(null)}
                      className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-700 transition-smooth cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-section-heading font-extrabold text-zinc-950">Region Details</h3>
                    </div>
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-6">
                  <div className="flex items-center gap-3.5 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <div className="w-12 h-12 rounded-full bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13.5px] font-black text-zinc-900 leading-none truncate">{activeRegion.name}</h3>
                      <p className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider mt-1">{activeRegion.status} Status</p>
                    </div>
                  </div>

                  {/* Region stats metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs flex items-center gap-3">
                      <CalendarRange className="w-4 h-4 text-brand-red shrink-0" />
                      <div>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Conclaves</span>
                        <span className="text-body-sm font-black text-zinc-800 mt-0.5 block">{activeRegion.conclavesCount} total</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs flex items-center gap-3">
                      <Users className="w-4 h-4 text-brand-red shrink-0" />
                      <div>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Members</span>
                        <span className="text-body-sm font-black text-zinc-800 mt-0.5 block">{activeRegion.membersCount} active</span>
                      </div>
                    </div>
                  </div>

                  {/* Conclaves list under this region */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest px-0.5">Created Conclaves</h4>
                    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200 max-h-[260px] overflow-y-auto">
                      {conclaves.filter(c => (c.region || 'Guntur Region') === activeRegion.name).map(conclave => (
                        <div key={conclave.id} className="p-3 flex justify-between items-center text-body-sm bg-white hover:bg-zinc-50/50 transition-colors">
                          <div>
                            <p className="font-black text-zinc-800">{conclave.name || conclave.title || 'Unnamed Conclave'}</p>
                            <p className="text-[10px] text-zinc-450 font-semibold mt-0.5">{conclave.venueLocation || conclave.venue || 'TBD Venue'} • {conclave.date ? new Date(conclave.date).toLocaleDateString() : 'TBD Date'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${conclave.status?.toLowerCase() === 'completed' ? 'bg-zinc-100 text-zinc-650' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                            {conclave.status}
                          </span>
                        </div>
                      ))}
                      {conclaves.filter(c => (c.region || 'Guntur Region') === activeRegion.name).length === 0 && (
                        <p className="p-4 text-center text-zinc-400 text-caption font-semibold">No conclaves created in this region.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-zinc-100 bg-white flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      const target = activeRegion;
                      setActiveRegion(null);
                      handleOpenRegionModal(target);
                    }}
                    className="flex-1 py-2.5 px-4 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer text-center"
                  >
                    Edit Region
                  </button>
                  <button
                    onClick={() => setActiveRegion(null)}
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

      {/* Admin Form Modal */}
      {showAdminModal && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] relative z-10 overflow-hidden animate-scale-up flex flex-col">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-body-md font-black text-zinc-900 leading-tight">
                {editingAdmin ? 'Edit Regional Admin' : 'Add Regional Admin'}
              </h3>
              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-455 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={adminForm.name}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  placeholder="e.g. Sanjay Joshi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  required
                  value={adminForm.email}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  placeholder="e.g. sanjay@bni.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Mobile Number</label>
                <input
                  type="text"
                  required
                  value={adminForm.mobile}
                  onChange={(e) => setAdminForm(prev => ({ ...prev, mobile: e.target.value }))}
                  className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">BNI Region</label>
                  <select
                    value={adminForm.region}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full h-10 px-2.5 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  >
                    {regions.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Status</label>
                  <select
                    value={adminForm.status}
                    onChange={(e) => setAdminForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full h-10 px-2.5 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2 px-4 border border-zinc-250 text-zinc-700 font-bold rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-brand-red hover:bg-red-750 text-white font-bold rounded-lg shadow-sm transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Region Form Modal */}
      {showRegionModal && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] relative z-10 overflow-hidden animate-scale-up flex flex-col">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-body-md font-black text-zinc-900 leading-tight">
                {editingRegion ? 'Edit BNI Region' : 'Add BNI Region'}
              </h3>
              <button
                onClick={() => setShowRegionModal(false)}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-455 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRegion} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-455 uppercase tracking-widest">Region Name</label>
                <input
                  type="text"
                  required
                  value={regionForm.name}
                  onChange={(e) => setRegionForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  placeholder="e.g. Phoenix Chapter"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Members Count</label>
                  <input
                    type="number"
                    required
                    value={regionForm.membersCount}
                    onChange={(e) => setRegionForm(prev => ({ ...prev, membersCount: parseInt(e.target.value) || 0 }))}
                    className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Conclaves Count</label>
                  <input
                    type="number"
                    required
                    value={regionForm.conclavesCount}
                    onChange={(e) => setRegionForm(prev => ({ ...prev, conclavesCount: parseInt(e.target.value) || 0 }))}
                    className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9.5px] font-black text-zinc-450 uppercase tracking-widest">Status</label>
                <select
                  value={regionForm.status}
                  onChange={(e) => setRegionForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full h-10 px-2.5 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegionModal(false)}
                  className="flex-1 py-2 px-4 border border-zinc-250 text-zinc-700 font-bold rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-brand-red hover:bg-red-750 text-white font-bold rounded-lg shadow-sm transition-smooth cursor-pointer text-body-sm text-center"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Reset Password Modal */}
      {resetPasswordTarget && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-zinc-250 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] relative z-10 overflow-hidden animate-scale-up flex flex-col">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-body-md font-black text-zinc-900 leading-tight">
                {isPasswordResetDone ? (isNewAdminCreation ? 'Coordinator Created Successfully' : 'Password Reset Successful') : 'Reset Administrator Password'}
              </h3>
              <button
                onClick={() => setResetPasswordTarget(null)}
                className="p-1 rounded-full hover:bg-zinc-200 text-zinc-455 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isPasswordResetDone ? (
              <div className="p-5 space-y-4">
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1">
                  <p className="text-caption font-bold text-zinc-400 uppercase tracking-wide">Administrator</p>
                  <p className="text-[13px] font-black text-zinc-900 leading-none">{resetPasswordTarget.name}</p>
                  <p className="text-[10px] text-zinc-505 font-bold mt-1">{resetPasswordTarget.email} • {resetPasswordTarget.region}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9.5px] font-black text-zinc-455 uppercase tracking-widest">Temporary Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={tempPassword}
                      className="flex-1 h-10 px-3 border border-zinc-250 bg-zinc-50/50 rounded-lg text-body-sm font-extrabold text-zinc-900 select-all focus:outline-hidden"
                    />
                    <button
                      onClick={() => setTempPassword(generateDefaultPassword(resetPasswordTarget.name))}
                      className="px-3 h-10 border border-zinc-250 text-zinc-700 font-bold rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer text-body-sm"
                      title="Generate new default password"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 text-amber-850 rounded-lg border border-amber-200 flex gap-2.5 items-start">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-semibold leading-normal">
                    Confirming this action will replace the admin's login password. Be sure to copy and send this temporary credential.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setResetPasswordTarget(null)}
                    className="flex-1 py-2 px-4 border border-zinc-250 text-zinc-700 font-bold rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer text-body-sm text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReset}
                    className="flex-1 py-2 px-4 bg-brand-red hover:bg-red-750 text-white font-bold rounded-lg shadow-sm transition-smooth cursor-pointer text-body-sm text-center"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-5">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-body-md font-black text-zinc-900">{isNewAdminCreation ? 'Coordinator Account Created' : 'Password Reset Completed'}</p>
                  <p className="text-[11px] text-zinc-500 font-semibold leading-relaxed">
                    {isNewAdminCreation ? `The account credentials for ${resetPasswordTarget.name} have been set. Provide them this code to log in.` : `The temporary credential for ${resetPasswordTarget.name} has been generated. Provide them this code to log in.`}
                  </p>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="text-[9px] font-black text-zinc-400 uppercase block tracking-wider">Access Token / Password</span>
                    <span className="text-[14px] font-black text-brand-red font-mono leading-none select-all">{tempPassword}</span>
                  </div>
                  <button
                    onClick={handleCopyPassword}
                    className={`py-1.5 px-3 rounded-lg text-body-sm font-bold border transition-smooth cursor-pointer ${isPasswordCopied
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                      }`}
                  >
                    {isPasswordCopied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>

                <button
                  onClick={() => setResetPasswordTarget(null)}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-body-sm transition-smooth cursor-pointer"
                >
                  Close & Done
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Live Toast Notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[70] bg-zinc-900 text-white text-[11px] font-bold py-2.5 px-4 rounded-lg shadow-xl flex items-center gap-2 border border-zinc-800 animate-slide-up">
          <span className={`w-1.5 h-1.5 rounded-full ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
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

      {/* Confirmation Modal */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[10002] animate-fade-in p-4">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-scale-up">
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-red-50 text-brand-red rounded-lg">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-zinc-800 text-body">{confirmModal.title}</h3>
                <p className="text-zinc-500 text-body-sm leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 border border-zinc-200 text-zinc-550 text-[11px] font-black uppercase tracking-wider rounded-lg hover:bg-zinc-50 transition-smooth cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
