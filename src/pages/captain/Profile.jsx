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
  Save
} from 'lucide-react';

export default function CaptainProfile({ loggedInCaptain, onTabChange, onLogout }) {
  // Local editable state for profile info
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState(() => {
    const cached = localStorage.getItem('bni_captain_profile_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return {
      name: loggedInCaptain?.name || loggedInCaptain?.displayName || 'Captain',
      email: loggedInCaptain?.email || 'N/A',
      phone: loggedInCaptain?.phone || loggedInCaptain?.mobile || 'N/A',
      designation: loggedInCaptain?.designation || 'Table Captain',
      company: loggedInCaptain?.company || loggedInCaptain?.businessName || 'Self Employed',
      category: loggedInCaptain?.category || loggedInCaptain?.businessCategory || 'General',
      chapter: loggedInCaptain?.chapter || 'BNI Chapter',
      registrationDate: loggedInCaptain?.registrationDate || loggedInCaptain?.joinedDate || 'N/A'
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
              chapter: fresh.chapter || prev.chapter
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
    setIsEditing(false);
    try {
      await api.put('/me', profileData);
    } catch (e) {
      console.warn("Backend profile sync notice:", e.message);
    }

    const updatedCaptain = { ...(loggedInCaptain || {}), ...profileData };
    localStorage.setItem('bni_logged_captain', JSON.stringify(updatedCaptain));
    window.dispatchEvent(new Event('storage'));
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
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Role</p>
                  <p className="font-black text-zinc-800 text-[12.5px] mt-0.5">
                    Table Captain
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
                    <p className="text-body-sm font-bold text-zinc-800 leading-tight">{profileData[field.key] || 'Not specified'}</p>
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
