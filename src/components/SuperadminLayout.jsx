import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Award,
  CalendarRange,
  LogOut,
  X,
  Menu,
  Bell,
  Check,
  AlertTriangle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import SuperadminDashboard from '../pages/superadmin/Dashboard';
import SuperadminAdmins from '../pages/superadmin/Admins';
import SuperadminConclaves from '../pages/superadmin/Conclaves';
import SuperadminMembers from '../pages/superadmin/Members';
import AdminProfile from '../pages/admin/Profile';
import { getNotifications, addNotification, markAllRead, removeNotification as removeNotifApi, getRawNotifications, saveRawNotifications } from '../utils/notifications';
import { api } from '../services/api';

export default function SuperadminLayout({
  activeTab,
  setActiveTab,
  onLogout,
  isSidebarOpen,
  setIsSidebarOpen,
  searchQuery,
  setSearchQuery
}) {
  const SUPERADMIN_UID = 'superadmin';

  const [superadminProfile, setSuperadminProfile] = useState(() => {
    const saved = localStorage.getItem('bni_superadmin_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return { name: 'Superadmin', email: 'superadmin@bni.com', organization: 'BNI Global LLC' };
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);
  const [notifications, setNotifications] = useState(() => getNotifications({ userUid: SUPERADMIN_UID, isSuperAdmin: true }));

  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const syncNotifs = () => {
      const fresh = getNotifications({ userUid: SUPERADMIN_UID, isSuperAdmin: true });
      setNotifications(prev => (JSON.stringify(prev) !== JSON.stringify(fresh) ? fresh : prev));

      const savedProf = localStorage.getItem('bni_superadmin_profile');
      if (savedProf) {
        try { setSuperadminProfile(JSON.parse(savedProf)); } catch (e) { }
      }
    };
    syncNotifs();
    window.addEventListener('storage', syncNotifs);
    return () => window.removeEventListener('storage', syncNotifs);
  }, []);


  // Poll conclaves to notify superadmin about coordinator actions
  useEffect(() => {
    const checkNewConclaves = async () => {
      try {
        const conclavesList = await api.get('/admin/conclaves');
        const notifiedList = JSON.parse(localStorage.getItem('superadmin_notified_conclaves') || '[]');
        let updated = false;

        conclavesList.forEach(conclave => {
          if (conclave.creator && conclave.creator !== 'Superadmin' && !notifiedList.includes(conclave.id)) {
            addNotification(
              'Conclave Scheduled',
              `Coordinator ${conclave.creator} scheduled conclave "${conclave.name}" in region "${conclave.region || 'Guntur Region'}".`,
              'info',
              { uid: SUPERADMIN_UID, isSuperAdmin: true, conclaveId: conclave.id, region: conclave.region }
            );
            notifiedList.push(conclave.id);
            updated = true;
          }
        });

        if (updated) {
          localStorage.setItem('superadmin_notified_conclaves', JSON.stringify(notifiedList));
        }
      } catch (err) {
        console.error("Failed to check conclaves for notifications:", err);
      }
    };

    checkNewConclaves();
    const interval = setInterval(checkNewConclaves, 12000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    markAllRead({ userUid: SUPERADMIN_UID });
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const removeNotification = (id) => {
    removeNotifApi(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const toggleReadStatus = (id) => {
    const rawList = getRawNotifications();
    const updatedRaw = rawList.map(item => {
      if (item.id === id) {
        const readBy = Array.isArray(item.readBy) ? item.readBy : [];
        const isRead = readBy.includes(SUPERADMIN_UID);
        const newReadBy = isRead ? readBy.filter(u => u !== SUPERADMIN_UID) : [...readBy, SUPERADMIN_UID];
        return { ...item, readBy: newReadBy };
      }
      return item;
    });
    saveRawNotifications(updatedRaw);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: !n.unread } : n));
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'admins', label: 'Admins & Regions', Icon: Award },
    { id: 'conclaves', label: 'Global Conclaves', Icon: CalendarRange },
    { id: 'members', label: 'Global Members', Icon: Users },
  ];

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-955 font-sans antialiased overflow-hidden relative">

      {/* Mobile drawer backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-45 lg:hidden transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Superadmin Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] h-screen flex flex-col py-6 bg-zinc-50 border-r border-red-100 text-sidebar font-medium shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:w-[220px] ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

        {/* Branding Header */}
        <div className="px-4 mb-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/BNI-Guntur-Logo.png"
              alt="BNI Logo"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div className="border-l-2 border-brand-red/30 pl-3 flex flex-col justify-center min-w-0">
              <h1 className="text-[10px] font-bold text-brand-red leading-tight tracking-tight whitespace-nowrap">1-1-CONCLAVE</h1>
              <p className="text-[7px] text-zinc-500 font-semibold tracking-wider uppercase whitespace-nowrap mt-0.5">Super Administrator</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1 rounded-lg hover:bg-zinc-200 text-zinc-550"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-lg transition-smooth group cursor-pointer ${isActive
                    ? 'bg-brand-red text-white font-semibold shadow-sm'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-955'
                    }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="text-sidebar uppercase tracking-wider text-[10.5px] truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="mt-auto px-2.5 pt-4 border-t border-zinc-200 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-smooth text-zinc-655 hover:bg-red-50 hover:text-brand-red group cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px] text-zinc-500 group-hover:text-brand-red shrink-0" />
            <div className="overflow-hidden">
              <p className="text-body-text truncate leading-tight font-extrabold text-zinc-900 group-hover:text-brand-red">Logout</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 overflow-hidden">

        {/* Superadmin Header */}
        <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6 shrink-0 relative z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-550 mr-1"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 rounded-full text-zinc-500 hover:text-brand-red hover:bg-zinc-50 transition-smooth cursor-pointer flex items-center justify-center"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-red text-[7.5px] font-extrabold text-white leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Modal */}
              {showNotifications && (
                <div className="absolute -right-16 sm:right-0 mt-2.5 w-80 max-w-[calc(100vw-2rem)] bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden text-zinc-800 flex flex-col max-h-[420px]">
                  {/* Dropdown Header */}
                  <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-extrabold text-zinc-950">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-brand-red/5 text-brand-red text-[9px] font-extrabold border border-brand-red/10">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-brand-red hover:underline font-bold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification Items List */}
                  <div className="overflow-y-auto divide-y divide-zinc-100 flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-zinc-400 space-y-2 flex flex-col items-center">
                        <Bell className="w-8 h-8 text-zinc-300" />
                        <p className="text-label-md font-semibold">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 flex gap-3 transition-colors duration-200 group relative hover:bg-zinc-50/60 ${n.unread ? 'bg-brand-red/5/10' : ''
                            }`}
                        >
                          {/* Unread dot indicator */}
                          {n.unread && (
                            <div className="absolute left-2 top-4.5 w-1.5 h-1.5 rounded-full bg-brand-red"></div>
                          )}

                          {/* Icon type indicator */}
                          <div className="mt-0.5 shrink-0">
                            {n.type === 'warning' ? (
                              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            ) : n.type === 'error' ? (
                              <div className="p-1.5 rounded-lg bg-red-50 text-brand-red border border-red-100">
                                <AlertCircle className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-650 border border-emerald-100">
                                <Sparkles className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          {/* Text content */}
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-body-sm font-extrabold text-zinc-955 leading-snug">{n.title}</p>
                            <p className="text-[11px] text-zinc-500 leading-normal mt-0.5 font-medium">{n.desc}</p>
                            <p className="text-[9px] text-zinc-400 mt-1 font-bold">{n.time}</p>
                          </div>

                          {/* Hover action menu buttons */}
                          <div className="absolute right-2 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white group-hover:bg-zinc-50 shadow-xs border border-zinc-150 rounded px-1 py-0.5">
                            <button
                              onClick={() => toggleReadStatus(n.id)}
                              title={n.unread ? "Mark as read" : "Mark as unread"}
                              className="p-1 hover:text-zinc-900 text-zinc-400 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeNotification(n.id)}
                              title="Dismiss notification"
                              className="p-1 hover:text-brand-red text-zinc-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-zinc-200" />

            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center font-black text-[11px] text-white select-none">
                  {(superadminProfile.name || 'Superadmin').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-[11.5px] font-black text-zinc-850 leading-tight">{superadminProfile.name || 'Superadmin'}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">{superadminProfile.organization || 'BNI Global'}</p>
                </div>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1 text-zinc-700 animate-fade-in font-medium">
                  <div className="px-4 py-2 border-b border-zinc-100">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Signed in as</p>
                    <p className="text-body-sm font-extrabold text-zinc-800 truncate mt-0.5">{superadminProfile.name || 'Superadmin'}</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setActiveTab && setActiveTab('profile');
                    }}
                    className="w-full text-left px-4 py-2 text-body-sm hover:bg-zinc-50 hover:text-zinc-955 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    My Profile
                  </button>

                  <div className="border-t border-zinc-100 my-1"></div>

                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onLogout && onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-body-sm text-brand-red hover:bg-red-50/50 font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-24">
          {activeTab === 'dashboard' ? (
            <SuperadminDashboard setActiveTab={setActiveTab} />
          ) : activeTab === 'admins' ? (
            <SuperadminAdmins searchQuery={searchQuery} />
          ) : activeTab === 'conclaves' ? (
            <SuperadminConclaves searchQuery={searchQuery} />
          ) : activeTab === 'members' ? (
            <SuperadminMembers searchQuery={searchQuery} />
          ) : activeTab === 'profile' ? (
            <AdminProfile loggedInAdmin={superadminProfile} role="superadmin" onLogout={onLogout} />
          ) : (
            <div className="p-8 text-center text-zinc-400">View not found</div>
          )}
        </main>
      </div>

    </div>
  );
}
