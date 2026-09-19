import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, Award, Clock, Users } from 'lucide-react';
import { getNotifications, markAllRead } from '../utils/notifications';

export default function MemberHeader({
  loggedInMember,
  conclaveSyncData,
  activeTab,
  onTabChange,
  onLogout,
  searchQuery,
  setSearchQuery
}) {
  const userUid = loggedInMember?.uid || loggedInMember?.id || loggedInMember?.email;
  const conclaveId = conclaveSyncData?.conclaveStatus?.id || conclaveSyncData?.conclaveId;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(() => getNotifications({ userUid, conclaveId }));

  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const syncNotifs = () => {
      const fresh = getNotifications({ userUid, conclaveId });
      setNotifications(prev => (JSON.stringify(prev) !== JSON.stringify(fresh) ? fresh : prev));
    };
    syncNotifs();
    window.addEventListener('storage', syncNotifs);
    return () => window.removeEventListener('storage', syncNotifs);
  }, [userUid, conclaveId]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    markAllRead({ userUid });
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };




  const conclaveStatus = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
  const currentRoundNum = conclaveSyncData?.conclaveStatus?.currentRound;
  const isConclaveLive = (conclaveStatus === 'running' || conclaveStatus === 'active') && Number(currentRoundNum) > 0;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'registrations', label: 'Registrations' },
    { id: 'my-schedule', label: 'My Schedule' },
    ...(isConclaveLive ? [{ id: 'current-round', label: 'Current Round' }] : []),
    { id: 'history', label: 'History' },
    { id: 'referrals', label: 'Referrals' }
  ];

  const displayName = loggedInMember?.name || 'BNI Member';
  const displayInitials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="w-full bg-white border-b border-zinc-200 sticky top-0 z-40 px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs font-sans">

        {/* Left section: Official BNI Logo & Title */}
        <div className="flex items-center gap-2 border-b border-transparent shrink-0">
          <img
            src="/BNI-Guntur-Logo.png"
            alt="BNI Logo"
            className="h-8 w-auto object-contain shrink-0"
          />
          <div className="hidden lg:flex flex-col border-l border-zinc-200 pl-2.5">
            <span className="text-[13px] font-bold text-zinc-900 tracking-tight leading-none">Member Portal</span>
            <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-widest mt-1">
              BNI GUNTUR
            </span>
          </div>
        </div>

        {/* Middle section: Navigation Links (hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex items-center xl:gap-6 lg:gap-3 gap-2 shrink-0">
          <nav className="flex items-center xl:gap-5 lg:gap-3 gap-2">
            {navItems.map(item => {
              const isActive = activeTab === item.id || (item.id === 'my-schedule' && activeTab === 'schedule');
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange && onTabChange(item.id)}
                  className={`text-[11.5px] lg:text-[12.5px] xl:text-[13px] font-extrabold tracking-tight transition-smooth cursor-pointer h-16 relative flex items-center ${isActive
                    ? 'text-brand-red font-black border-b-2 border-brand-red mt-0.5'
                    : 'text-zinc-455 hover:text-zinc-800'
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right section: Notifications & Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 shrink-0">

          {/* Notifications Popover Menu */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1 hover:bg-zinc-50 rounded-lg text-zinc-400 hover:text-zinc-800 transition-smooth cursor-pointer relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-red rounded-full border border-white"></span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed top-20 left-4 right-4 w-auto sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-72 sm:mt-2 bg-white border border-zinc-250 rounded-xl shadow-xl z-55 overflow-hidden animate-scale-up">
                <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-black text-zinc-955">Table Alerts</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-[8px] font-black text-brand-red rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[9px] font-black text-brand-red hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[10.5px] text-zinc-400 font-semibold">
                      No notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`p-3 flex items-start gap-2.5 transition-smooth relative group ${n.unread ? 'bg-red-50/10' : 'bg-white'}`}>
                        {n.unread && (
                          <div className="absolute left-1 top-4 w-1 h-1 rounded-full bg-brand-red"></div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-zinc-800 leading-snug">{n.title}</p>
                          <p className="text-[10px] text-zinc-455 font-semibold leading-normal mt-0.5">{n.desc}</p>
                          <span className="text-[8px] text-zinc-400 font-extrabold mt-1 block">{n.time}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Member User Profile Avatar / Logout Dropdown */}
          <div className="group relative flex items-center gap-2 cursor-pointer shrink-0">
            <div className="w-7.5 h-7.5 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-[10.5px] border border-brand-red/10 shadow-sm shrink-0">
              {displayInitials}
            </div>

            <div className="hidden lg:flex flex-col">
              <span className="text-[11.5px] xl:text-[12.5px] font-extrabold text-zinc-955 leading-none whitespace-nowrap">{displayName}</span>
              <span className="text-[8px] text-zinc-450 font-bold uppercase tracking-wider mt-0.5">Member</span>
            </div>

            {/* Hover dropdown list */}
            <div className="absolute right-0 top-full pt-2 opacity-0 translate-y-1 invisible group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible transition-smooth z-50">
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xl w-40 overflow-hidden py-1">
                <button
                  onClick={() => onTabChange && onTabChange('profile')}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 transition-smooth cursor-pointer"
                >
                  My Profile
                </button>
                <div className="h-px bg-zinc-100 my-1"></div>
                <button
                  onClick={onLogout}
                  className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-brand-red hover:bg-red-50/50 transition-smooth cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Navigation Sub-bar (rendered only on screens smaller than md) */}
      <div className="md:hidden flex items-center overflow-x-auto gap-4 px-4 h-11 bg-white border-b border-zinc-200 scrollbar-none shrink-0 select-none">
        {navItems.map(item => {
          const isActive = activeTab === item.id || (item.id === 'my-schedule' && activeTab === 'schedule');
          return (
            <button
              key={item.id}
              onClick={() => onTabChange && onTabChange(item.id)}
              className={`text-[12px] font-extrabold tracking-tight transition-smooth cursor-pointer whitespace-nowrap pb-1.5 border-b-2 ${isActive
                ? 'text-brand-red font-black border-brand-red'
                : 'text-zinc-450 border-transparent hover:text-zinc-800'
                }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
