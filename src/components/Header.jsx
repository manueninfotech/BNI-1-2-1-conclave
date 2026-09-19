import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, AlertTriangle, AlertCircle, Sparkles, Menu } from 'lucide-react';
import { getNotifications, markAllRead } from '../utils/notifications';

export default function Header({ searchQuery, setSearchQuery, activeTab, setActiveTab, onMenuClick, loggedInAdmin, onLogout, selectedConclaveId }) {

  const adminUid = loggedInAdmin?.uid || loggedInAdmin?.id || loggedInAdmin?.email;
  const adminRegion = loggedInAdmin?.region || 'Global';
  const isSuperAdmin = loggedInAdmin?.role === 'superadmin' || adminRegion === 'Global';

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);
  const [notifications, setNotifications] = useState(() => getNotifications({
    userUid: adminUid,
    conclaveId: selectedConclaveId,
    region: adminRegion,
    isSuperAdmin
  }));

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
      const fresh = getNotifications({
        userUid: adminUid,
        conclaveId: selectedConclaveId,
        region: adminRegion,
        isSuperAdmin
      });
      setNotifications(prev => (JSON.stringify(prev) !== JSON.stringify(fresh) ? fresh : prev));
    };
    syncNotifs();
    window.addEventListener('storage', syncNotifs);
    return () => window.removeEventListener('storage', syncNotifs);
  }, [adminUid, selectedConclaveId, adminRegion, isSuperAdmin]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    markAllRead({ userUid: adminUid });
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };


  const removeNotification = (id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    saveNotifications(adminUid, updated);
  };

  const toggleReadStatus = (id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, unread: !n.unread } : n);
    setNotifications(updated);
    saveNotifications(adminUid, updated);
  };


  return (
    <header className="w-full sticky top-0 z-40 bg-white border-b border-red-100 flex justify-between items-center px-4 sm:px-8 h-14 shrink-0 font-sans">

      {/* Left side: Mobile Menu Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-555 hover:text-zinc-800 transition-smooth cursor-pointer flex items-center justify-center"
          title="Open Menu"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
      </div>

      {/* Right side: Notifications & Utilities */}
      <div className="flex items-center gap-2.5 sm:gap-4 relative shrink-0">

        {/* Notifications Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-zinc-500 hover:text-brand-red transition-colors cursor-pointer rounded-lg hover:bg-zinc-50 relative flex items-center justify-center"
          >
            <Bell className="w-[18px] h-[18px]" />
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
                          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Text content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-body-sm font-extrabold text-zinc-950 leading-snug">{n.title}</p>
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

        {/* Profile Avatar Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-8.5 h-8.5 rounded-full bg-brand-red text-white flex items-center justify-center font-black text-xs border border-brand-red/10 shadow-sm cursor-pointer select-none hover:bg-red-750 transition-colors"
          >
            {(() => {
              const name = loggedInAdmin?.name || 'Admin';
              return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            })()}
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 py-1 text-zinc-700 animate-fade-in font-medium">
              <div className="px-4 py-2 border-b border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Signed in as</p>
                <p className="text-body-sm font-extrabold text-zinc-800 truncate mt-0.5">{loggedInAdmin?.name || 'Admin'}</p>
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
  );
}
