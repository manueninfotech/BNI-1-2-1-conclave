import React, { useState, useEffect } from 'react';
import {
  Check,
  LogOut,
  Edit2,
  Save
} from 'lucide-react';
import { api } from '../../services/api';

export default function MemberProfile({ loggedInMember, onTabChange, onLogout }) {
  // Local editable state for profile info
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(() => {
    const cached = localStorage.getItem('bni_member_profile_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
    return {
      name: loggedInMember?.name || loggedInMember?.displayName || 'Member',
      email: loggedInMember?.email || 'N/A',
      phone: loggedInMember?.phone || loggedInMember?.mobile || 'N/A',
      designation: loggedInMember?.designation || 'BNI Member',
      company: loggedInMember?.company || loggedInMember?.businessName || 'Self Employed',
      category: loggedInMember?.category || loggedInMember?.businessCategory || 'General',
      chapter: loggedInMember?.chapter || 'BNI Chapter',
      registrationDate: loggedInMember?.registrationDate || loggedInMember?.joinedDate || 'N/A'
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
              email: fresh.email || prev.email,
              phone: fresh.phone || fresh.mobile || prev.phone,
              designation: fresh.designation || prev.designation,
              company: fresh.company || fresh.businessName || prev.company,
              category: fresh.category || fresh.businessCategory || prev.category,
              chapter: fresh.chapter || prev.chapter,
              registrationDate: fresh.createdAt ? (typeof fresh.createdAt === 'string' ? fresh.createdAt : new Date(fresh.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })) : prev.registrationDate
            };
            localStorage.setItem('bni_member_profile_cache', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (e) { }
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
    setIsEditing(false);
    try {
      localStorage.setItem('bni_member_profile_cache', JSON.stringify(profileData));
      await api.put('/me', profileData);
    } catch (e) {
      console.warn("Backend profile sync notice:", e.message);
    }

    const updatedMember = { ...(loggedInMember || {}), ...profileData };
    localStorage.setItem('bni_logged_member', JSON.stringify(updatedMember));
    window.dispatchEvent(new Event('storage'));
  };

  const displayInitials = profileData.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-[20px] font-black text-zinc-955 leading-tight">Profile &amp; Settings</h1>
        <p className="text-[11.5px] text-zinc-500 font-semibold mt-0.5">Manage your account information, conclave role, and system preferences.</p>
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

              <p className="text-[12px] text-zinc-500 font-semibold mt-2.5 leading-snug">
                {profileData.category} at <strong className="text-zinc-800 font-bold">{profileData.company}</strong>
              </p>

              <div className="grid grid-cols-2 gap-4 w-full mt-6 py-2">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Role</p>
                  <p className="font-black text-zinc-800 text-[12.5px] mt-0.5">
                    Conclave Member
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Since</p>
                  <p className="font-black text-zinc-800 text-[12.5px] mt-0.5">
                    {loggedInMember?.registrationDate || '2026'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 w-full mt-5">
                {isEditing ? (
                  <button
                    onClick={handleSave}
                    className="flex-grow py-2 px-3 bg-brand-red hover:bg-red-750 text-white text-[10.5px] font-black uppercase tracking-wider rounded-lg transition-smooth flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-brand-red/10"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </button>
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

          {/* Networking Summary KPIs */}
          <section className="grid grid-cols-2 gap-3">
            {[
              { label: "Conclaves", value: loggedInMember?.conclaveIds?.length || 0 },
              { label: "Total Rounds", value: loggedInMember?.conclaveIds?.length ? (loggedInMember.conclaveIds.length * 4) : 0 },
              { label: "Members Met", value: loggedInMember?.conclaveIds?.length ? (loggedInMember.conclaveIds.length * 20) : 0 },
              { label: "Active Status", value: "Verified" }
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
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-zinc-450 hover:text-brand-red transition-smooth cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
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
                      value={profileData[field.key]}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      className="w-full h-10 px-3 border border-zinc-250 rounded-lg text-body-sm font-semibold text-zinc-800 placeholder-zinc-400 focus:ring-1 focus:ring-brand-red focus:border-brand-red focus:outline-hidden"
                    />
                  ) : (
                    <p className="text-body-sm font-bold text-zinc-800 leading-tight">{profileData[field.key]}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

    </div>
  );
}
