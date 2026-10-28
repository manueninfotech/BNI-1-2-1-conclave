import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  CheckCircle,
  Check,
  LogOut,
  Edit2,
  LayoutGrid,
  Shield,
  LogIn,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function CaptainProfile({ loggedInCaptain, onTabChange, onLogout }) {
  // Local editable state for profile info
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (title, desc, type = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [profileData, setProfileData] = useState(() => {
    const cached = localStorage.getItem('bni_captain_profile_cache') || localStorage.getItem('bni_logged_captain');
    let parsed = null;
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    const cap = parsed || loggedInCaptain || {};
    return {
      name: cap?.name || cap?.displayName || 'Captain',
      email: (cap?.email && cap.email !== 'N/A') ? cap.email : '',
      phone: (cap?.phone && cap.phone !== 'N/A') ? cap.phone : ((cap?.mobile && cap.mobile !== 'N/A') ? cap.mobile : ''),
      designation: cap?.designation || 'Table Captain',
      company: cap?.company || cap?.businessName || 'Self Employed',
      category: cap?.category || cap?.businessCategory || 'General',
      chapter: cap?.chapter || 'BNI Chapter',
      registrationDate: cap?.registrationDate || cap?.joinedDate || 'N/A'
    };
  });

  useEffect(() => {
    async function loadFreshProfile() {
      try {
        const fresh = await api.get('/me');
        if (fresh) {
          setProfileData(prev => {
            const updated = {
              ...prev,
              name: fresh.name || prev.name,
              email: (fresh.email && fresh.email !== 'N/A') ? fresh.email : prev.email,
              phone: (fresh.phone && fresh.phone !== 'N/A') ? fresh.phone : (fresh.mobile || prev.phone),
              designation: fresh.designation || prev.designation,
              company: fresh.company || fresh.businessName || prev.company,
              category: fresh.category || fresh.businessCategory || prev.category,
              chapter: fresh.chapter || prev.chapter,
              registrationDate: fresh.createdAt ? (typeof fresh.createdAt === 'string' ? fresh.createdAt : new Date(fresh.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })) : prev.registrationDate
            };
            localStorage.setItem('bni_captain_profile_cache', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (e) {}
    }
    loadFreshProfile();
  }, []);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.put('/me', profileData);
      const updatedProfile = res?.profile || res || {};
      const merged = { ...profileData, ...updatedProfile };
      setProfileData(merged);
      setIsEditing(false);

      localStorage.setItem('bni_captain_profile_cache', JSON.stringify(merged));
      const updatedCaptain = { ...(loggedInCaptain || {}), ...merged };
      localStorage.setItem('bni_logged_captain', JSON.stringify(updatedCaptain));
      window.dispatchEvent(new Event('storage'));
      showToast("Profile Updated", "Your captain profile details have been saved successfully.", "success");
    } catch (e) {
      console.error("Backend captain profile save error:", e.message);
      showToast("Save Failed", e.message || "Failed to save profile changes.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const displayInitials = (profileData.name || 'Captain')
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const captainId = loggedInCaptain?.uid || loggedInCaptain?.id || loggedInCaptain?.bniId;

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Profile &amp; Settings</h1>
        <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Manage your account information, captain role, and system preferences.</p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column (35% -> col-span-4) */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Profile Hero Card */}
          <section className="bg-white border border-zinc-200 rounded-xl p-6 shadow-2xs">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-zinc-55 border-2 border-brand-red/20 shadow-md flex items-center justify-center font-black text-2xl text-zinc-650 select-none">
                  {displayInitials}
                </div>
                <span className="absolute bottom-0 right-0 bg-brand-red text-white p-1 rounded-full border-2 border-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-white stroke-[3.5]" />
                </span>
              </div>

              <h2 className="text-lg font-black text-zinc-900 leading-tight">{profileData.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2.5 py-0.5 bg-red-50 border border-red-100 text-brand-red text-[9px] font-black rounded-full uppercase tracking-wider">
                  Table Captain
                </span>
              </div>

              <p className="text-[12px] text-zinc-500 font-semibold mt-2.5 leading-snug">
                {profileData.category} {profileData.company ? `at ${profileData.company}` : ''}
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mt-6 py-2">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Role</p>
                  <p className="font-black text-zinc-800 text-[12.5px] mt-0.5">
                    Table Captain
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Since</p>
                  <p className="font-black text-zinc-800 text-[12.5px] mt-0.5">
                    {profileData.registrationDate || loggedInCaptain?.registrationDate || '2026'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 w-full mt-5">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-smooth cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-grow py-2 px-3 bg-brand-red hover:bg-red-750 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-smooth flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-brand-red/10 disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-grow py-2 px-3 bg-brand-red hover:bg-red-750 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-smooth flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-brand-red/10"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Captain Summary KPIs */}
          <section className="grid grid-cols-2 gap-3">
            {[
              { label: "Role", value: "Captain" },
              { label: "Conclaves", value: "1 Active" },
              { label: "Rounds", value: "4 Total" },
              { label: "Status", value: "Verified" }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white border border-zinc-200 p-4 rounded-xl shadow-2xs">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-lg font-black text-brand-red mt-1 leading-none">{kpi.value}</p>
              </div>
            ))}
          </section>

          {/* Logout Card */}
          <button
            onClick={() => onLogout && onLogout()}
            className="w-full flex items-center gap-3 p-4 bg-white border border-zinc-200 rounded-xl hover:bg-red-50/50 transition-colors text-brand-red text-[12px] font-black uppercase tracking-wider justify-center cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </aside>

        {/* Right Column (65% -> col-span-8) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Personal Information */}
          <section className="bg-white border border-zinc-200 rounded-xl shadow-2xs">
            <div className="p-4 flex justify-between items-center bg-zinc-50 rounded-t-xl">
              <h2 className="text-body-md font-black text-zinc-900 leading-tight">Personal Information</h2>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="px-2.5 py-1 text-[11px] font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-200/60 hover:bg-zinc-200 rounded-md transition-smooth cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 text-[11px] font-bold text-white bg-brand-red hover:bg-red-750 rounded-md transition-smooth flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span>{isSaving ? "Saving..." : "Save"}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-zinc-450 hover:text-brand-red transition-smooth cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              {[
                { label: "Full Name", key: "name", type: "text" },
                { label: "Email Address", key: "email", type: "email" },
                { label: "Phone Number", key: "phone", type: "text" },
                { label: "Designation", key: "designation", type: "text" },
                { label: "Company", key: "company", type: "text" },
                { label: "Business Category", key: "category", type: "text" },
                { label: "BNI Chapter", key: "chapter", type: "text", disabled: true },
                { label: "Registration Date", key: "registrationDate", type: "text", disabled: true }
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-[9.5px] font-black text-zinc-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                  {isEditing && !field.disabled ? (
                    <input
                      type={field.type}
                      value={profileData[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 placeholder-zinc-400 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                    />
                  ) : (
                    <p className="text-body-sm font-bold text-zinc-800 leading-tight">{profileData[field.key] || 'Not specified'}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up flex items-center gap-3 bg-white border border-zinc-200 px-4 py-3 rounded-xl shadow-lg">
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          )}
          <div>
            <p className="text-xs font-bold text-zinc-900">{toast.title}</p>
            <p className="text-[11px] font-semibold text-zinc-500">{toast.desc}</p>
          </div>
        </div>
      )}

    </div>
  );
}
