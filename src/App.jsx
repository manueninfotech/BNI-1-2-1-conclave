import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import BusinessTypes from './pages/BusinessTypes';
import Captains from './pages/Captains';
import ActiveUsers from './pages/ActiveUsers';
import Conclaves from './pages/Conclaves';
import Snapshot from './pages/Snapshot';
import ScheduleGen from './pages/ScheduleGen';
import ScheduleReview from './pages/ScheduleReview';
import RoundRunner from './pages/RoundRunner';
import Reports from './pages/Reports';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import CaptainHeader from './components/CaptainHeader';
import CaptainDashboard from './pages/captain/Dashboard';
import CaptainTable from './pages/captain/Table';
import CaptainCurrentRound from './pages/captain/CurrentRound';
import CaptainSchedule from './pages/captain/Schedule';
import CaptainProfile from './pages/captain/Profile';
import MemberHeader from './components/MemberHeader';
import MemberDashboard from './pages/member/Dashboard';
import MemberSchedule from './pages/member/MySchedule';
import MemberCurrentRound from './pages/member/CurrentRound';
import MemberConclaveHistory from './pages/member/ConclaveHistory';
import MemberProfile from './pages/member/Profile';
import MemberRegistrations from './pages/member/Registrations';
import AdminProfile from './pages/admin/Profile';
import Referrals from './pages/Referrals';

import { Sparkles, ShieldAlert, X } from 'lucide-react';
import SuperadminLayout from './components/SuperadminLayout';
import { api } from './services/api';

export default function App() {
  // Read logged in status from localStorage - default to FALSE so visitors see Login screen
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const stored = localStorage.getItem('bni_logged_in');
      const token = localStorage.getItem('bni_auth_token');
      if (stored === 'true' || (stored === null && token)) return true;
      return false;
    } catch (e) {
      return false;
    }
  });

  // Read logged in user's role from localStorage or pathname
  const [userRole, setUserRole] = useState(() => {
    const storedRole = localStorage.getItem('bni_user_role');
    if (storedRole) return storedRole;
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    if (path.startsWith('superadmin') || path.includes('/superadmin')) return 'superadmin';
    if (path.startsWith('captain') || path.includes('/captain')) return 'captain';
    if (path.startsWith('member') || path.includes('/member')) return 'member';
    if (path.startsWith('admin') || path.includes('/admin')) return 'admin';
    return 'admin';
  });

  // Read logged in admin info from localStorage
  const [loggedInAdmin, setLoggedInAdmin] = useState(() => {
    try {
      const data = localStorage.getItem('bni_logged_admin');
      return (data && data !== 'undefined') ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  });

  // Read logged in captain info from localStorage
  const [loggedInCaptain, setLoggedInCaptain] = useState(() => {
    try {
      const data = localStorage.getItem('bni_logged_captain');
      return (data && data !== 'undefined') ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  });

  // Read logged in member info from localStorage
  const [loggedInMember, setLoggedInMember] = useState(() => {
    try {
      const data = localStorage.getItem('bni_logged_member');
      return (data && data !== 'undefined') ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const syncLoggedUser = () => {
      try {
        const adminData = localStorage.getItem('bni_logged_admin');
        if (adminData && adminData !== 'undefined') setLoggedInAdmin(JSON.parse(adminData));
      } catch (e) {}

      try {
        const captainData = localStorage.getItem('bni_logged_captain');
        if (captainData && captainData !== 'undefined') setLoggedInCaptain(JSON.parse(captainData));
      } catch (e) {}

      try {
        const memberData = localStorage.getItem('bni_logged_member');
        if (memberData && memberData !== 'undefined') setLoggedInMember(JSON.parse(memberData));
      } catch (e) {}
    };

    window.addEventListener('storage', syncLoggedUser);
    return () => window.removeEventListener('storage', syncLoggedUser);
  }, []);

  // Read active tab path directly from window URL pathname
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    const validTabs = [
      'dashboard', 'members', 'active-users', 'business-types', 'captains',
      'conclaves', 'snapshot', 'schedule-gen', 'schedule-review',
      'round-runner', 'reports', 'admins', 'referrals', 'profile', 'registrations',
      'my-schedule', 'current-round', 'history', 'my-table', 'schedule'
    ];
    return validTabs.includes(lastPart) ? lastPart : 'dashboard';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Global conclave selector for admin panel - default to current admin's active conclave
  const [selectedConclaveId, setSelectedConclaveId] = useState('');

  // Generation warning — lives at App level so it survives ScheduleGen remounts
  const [genWarning, setGenWarning] = useState(null);
  const genWarningTimerRef = useRef(null);
  const showGenWarning = (warning) => {
    if (genWarningTimerRef.current) clearTimeout(genWarningTimerRef.current);
    setGenWarning(warning);
    genWarningTimerRef.current = setTimeout(() => setGenWarning(null), 30000);
  };
  const clearGenWarning = () => {
    if (genWarningTimerRef.current) clearTimeout(genWarningTimerRef.current);
    setGenWarning(null);
  };

  useEffect(() => {
    if (!isLoggedIn || userRole !== 'admin') return;
    async function initActiveConclave() {
      try {
        const list = await api.get('/admin/conclaves');
        if (list && list.length > 0) {
          const exists = list.some(c => c.id === selectedConclaveId);
          if (!exists) {
            // Prefer the active/running conclave — same one members see
            const active = list.find(c => c.status === 'active' || c.status === 'running') || list[0];
            setSelectedConclaveId(active.id);
          }
        }
      } catch (err) {
        console.warn("Could not sync active conclave ID with backend:", err.message);
      }
    }
    initActiveConclave();
  }, [isLoggedIn, userRole]);

  const mainRef = useRef(null);

  // Handle URL updates when switching tabs
  const handleTabChange = (tabId) => {
    // Guard: if trying to navigate to current-round while conclave isn't live, redirect to my-schedule
    const conclaveStatusNow = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
    const isLiveNow = (conclaveStatusNow === 'running' || conclaveStatusNow === 'active') &&
      Number(conclaveSyncData?.conclaveStatus?.currentRound) > 0;
    const resolvedTab = (tabId === 'current-round' && !isLiveNow) ? 'my-schedule' : tabId;
    setActiveTab(resolvedTab);
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    let activeRole = userRole;
    if (path.startsWith('captain') || path.includes('/captain')) activeRole = 'captain';
    else if (path.startsWith('member') || path.includes('/member')) activeRole = 'member';
    else if (path.startsWith('superadmin') || path.includes('/superadmin')) activeRole = 'superadmin';
    else if (path.startsWith('admin') || path.includes('/admin')) activeRole = 'admin';

    window.history.pushState({}, '', `/${activeRole}/${resolvedTab}`);
  };

  // Sync state if user clicks Back or Forward browser navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/|\/$/g, '');
      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      const validTabs = [
        'dashboard', 'members', 'active-users', 'business-types', 'captains',
        'conclaves', 'snapshot', 'schedule-gen', 'schedule-review',
        'round-runner', 'reports', 'admins', 'referrals', 'profile', 'registrations',
        'my-schedule', 'current-round', 'history', 'my-table', 'schedule'
      ];
      const cleanTab = validTabs.includes(lastPart) ? lastPart : 'dashboard';

      if (path.startsWith('superadmin/') || path.includes('/superadmin/')) {
        setUserRole('superadmin');
        setActiveTab(cleanTab);
      } else if (path.startsWith('admin/') || path.includes('/admin/')) {
        setUserRole('admin');
        setActiveTab(cleanTab);
      } else if (path.startsWith('captain/') || path.includes('/captain/')) {
        setUserRole('captain');
        setActiveTab(cleanTab);
      } else if (path.startsWith('member/') || path.includes('/member/')) {
        setUserRole('member');
        setActiveTab(cleanTab);
      } else {
        const storedRole = localStorage.getItem('bni_user_role') || 'admin';
        setUserRole(storedRole);
        setActiveTab(cleanTab);
      }
      setIsSidebarOpen(false); // Close sidebar on nav
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userRole]);



  // Sync loggedInMember on storage updates
  useEffect(() => {
    const handleStorageSync = () => {
      const storedMember = localStorage.getItem('bni_logged_member');
      if (storedMember) {
        setLoggedInMember(JSON.parse(storedMember));
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleLogin = (role, payload) => {
    localStorage.setItem('bni_logged_in', 'true');
    localStorage.setItem('bni_user_role', role);
    setUserRole(role);

    if (role === 'captain') {
      localStorage.setItem('bni_logged_captain', JSON.stringify(payload));
      setLoggedInCaptain(payload);
      localStorage.removeItem('bni_logged_member');
      setLoggedInMember(null);
      localStorage.removeItem('bni_logged_admin');
      setLoggedInAdmin(null);
      setIsLoggedIn(true);
      setActiveTab('dashboard');
      window.history.pushState({}, '', `/captain/dashboard`);
    } else if (role === 'member') {
      localStorage.setItem('bni_logged_member', JSON.stringify(payload));
      setLoggedInMember(payload);
      localStorage.removeItem('bni_logged_captain');
      setLoggedInCaptain(null);
      localStorage.removeItem('bni_logged_admin');
      setLoggedInAdmin(null);
      setIsLoggedIn(true);
      setActiveTab('dashboard');
      window.history.pushState({}, '', `/member/dashboard`);
    } else if (role === 'superadmin') {
      localStorage.removeItem('bni_logged_captain');
      localStorage.removeItem('bni_logged_member');
      localStorage.removeItem('bni_logged_admin');
      setLoggedInCaptain(null);
      setLoggedInMember(null);
      setLoggedInAdmin(null);
      setIsLoggedIn(true);
      const defaultTab = 'dashboard';
      setActiveTab(defaultTab);
      window.history.pushState({}, '', `/superadmin/${defaultTab}`);
    } else {
      localStorage.removeItem('bni_logged_captain');
      localStorage.removeItem('bni_logged_member');
      if (payload) {
        localStorage.setItem('bni_logged_admin', JSON.stringify(payload));
        setLoggedInAdmin(payload);
      } else {
        localStorage.removeItem('bni_logged_admin');
        setLoggedInAdmin({ name: "Sanjay Wagle", email: "admin@bni.com", region: "Guntur Central" });
      }

      // Fetch live conclaves to set active ID
      api.get('/admin/conclaves').then(list => {
        if (list && list.length > 0) {
          const adminName = payload?.name || "Sanjay Wagle";
          // Prefer active/running conclave (same as member portal), then admin's own, then first
          const active = list.find(c => c.status === 'active' || c.status === 'running');
          const myConclave = active || list.find(c => c.coordinator === adminName) || list[0];
          setSelectedConclaveId(myConclave.id);
        } else {
          setSelectedConclaveId('');
        }
      }).catch(err => {
        console.warn("Failed to fetch live conclaves during login:", err.message);
        setSelectedConclaveId('');
      });
      setLoggedInCaptain(null);
      setLoggedInMember(null);
      setIsLoggedIn(true);
      const defaultTab = 'dashboard';
      setActiveTab(defaultTab);
      window.history.pushState({}, '', `/admin/${defaultTab}`);
    }
  };

  const handleLogout = () => {
    localStorage.setItem('bni_logged_in', 'false');
    localStorage.removeItem('bni_user_role');
    localStorage.removeItem('bni_logged_captain');
    localStorage.removeItem('bni_logged_member');
    localStorage.removeItem('bni_logged_admin');
    localStorage.removeItem('bni_conclave_sync_data_cache');
    localStorage.removeItem('bni_member_conclaves_cache');
    localStorage.removeItem('bni_selected_member_conclave_id');
    localStorage.removeItem('bni_referrals');
    setLoggedInCaptain(null);
    setLoggedInMember(null);
    setLoggedInAdmin(null);
    setConclaveSyncData(null);
    setIsLoggedIn(false);
    setIsSidebarOpen(false);
  };

  const [conclaveSyncData, setConclaveSyncData] = useState(null);

  const [memberConclaves, setMemberConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_member_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    return [];
  });
  const [memberProfile, setMemberProfile] = useState(null);

  useEffect(() => {
    if (!isLoggedIn || (userRole !== 'member' && userRole !== 'captain')) return;

    async function loadMemberData() {
      try {
        const [list, profile] = await Promise.all([
          api.get('/conclaves').catch(() => []),
          api.get('/me').catch(() => null),
        ]);

        if (Array.isArray(list)) {
          setMemberConclaves(list);
          localStorage.setItem('bni_member_conclaves_cache', JSON.stringify(list));
        }

        if (profile) {
          // If role is changed, directly log out so the user will log in again
          const resolvedRole = (profile.isCaptain || profile.role === 'captain')
            ? 'captain'
            : ((profile.role === 'superadmin' || profile.role === 'admin') ? profile.role : 'member');

          if (resolvedRole !== userRole) {
            console.info(`[Role Sync] User role changed from ${userRole} to ${resolvedRole}. Logging out to re-authenticate.`);
            const roleLabels = {
              captain: 'Table Captain',
              member: 'Member',
              admin: 'Admin',
              superadmin: 'Superadmin'
            };
            const toLabel = roleLabels[resolvedRole] || resolvedRole;
            localStorage.setItem(
              'bni_auth_notice',
              `Your role has been updated to ${toLabel}. Please log in again to continue.`
            );
            handleLogout();
            return;
          }

          const mergedProfile = {
            ...(userRole === 'captain' ? (loggedInCaptain || {}) : (loggedInMember || {})),
            ...profile,
            uid: profile.uid || profile.id,
            id: profile.id || profile.uid,
          };
          const jsonStr = JSON.stringify(mergedProfile);
          if (userRole === 'captain') {
            if (localStorage.getItem('bni_logged_captain') !== jsonStr) {
              localStorage.setItem('bni_logged_captain', jsonStr);
              setLoggedInCaptain(mergedProfile);
            }
          } else {
            if (localStorage.getItem('bni_logged_member') !== jsonStr) {
              setMemberProfile(mergedProfile);
              localStorage.setItem('bni_logged_member', jsonStr);
              setLoggedInMember(mergedProfile);
            }
          }
        }

        const registered = Array.isArray(list) ? list.filter(c => c.isRegistered || c.registered) : [];
        const pool = registered.length > 0 ? registered : list;
        const now = Date.now();
        let chosenConclave = null;

        // 1. Live or running conclave (priority)
        chosenConclave = pool.find(c => c.status === 'running' || c.status === 'active');

        // 2. Next upcoming conclave (upcoming date >= now - 12h, sorted ascending by date so Sep 25 is chosen!)
        if (!chosenConclave) {
          const upcoming = pool
            .filter(c => {
              const s = (c.status || '').toLowerCase();
              if (s === 'completed' || s === 'finished' || s === 'ended' || s === 'cancelled') return false;
              const dt = new Date(c.date || c.startDate).getTime();
              return isNaN(dt) || dt >= now - 12 * 60 * 60 * 1000;
            })
            .sort((a, b) => {
              const da = new Date(a.date || a.startDate).getTime() || 0;
              const db = new Date(b.date || b.startDate).getTime() || 0;
              return da - db; // ASCENDING: earliest upcoming event first (Sep 25 before Nov 10)
            });

          if (upcoming.length > 0) {
            chosenConclave = upcoming[0];
          }
        }

        // 3. If no upcoming conclaves, pick the most recent conclave
        if (!chosenConclave && pool.length > 0) {
          const sorted = [...pool].sort((a, b) => {
            const da = new Date(a.date || a.startDate).getTime() || 0;
            const db = new Date(b.date || b.startDate).getTime() || 0;
            return db - da; // most recent first
          });
          chosenConclave = sorted[0];
        }

        const myRegisteredConclave = chosenConclave;

        if (myRegisteredConclave) {
          const syncResult = await api.post(`/conclaves/${myRegisteredConclave.id}/sync`, {}).catch(() => null);
          // For captains: mySchedule may be empty (they anchor their table), but conclaveStatus is still valid.
          // Set syncData if we have a valid conclaveStatus, regardless of mySchedule length.
          if (syncResult && syncResult.conclaveStatus) {
            localStorage.setItem('bni_conclave_sync_data_cache', JSON.stringify(syncResult));
            setConclaveSyncData(prev => (JSON.stringify(prev) !== JSON.stringify(syncResult) ? syncResult : prev));
          } else {
            setConclaveSyncData(null);
            localStorage.removeItem('bni_conclave_sync_data_cache');
          }
        } else {
          setConclaveSyncData(null);
          localStorage.removeItem('bni_conclave_sync_data_cache');
        }
      } catch (err) {
        console.warn("Failed to sync member conclave data:", err.message);
      }
    }

    loadMemberData();
    const interval = setInterval(loadMemberData, 2000);
    return () => clearInterval(interval);
  }, [isLoggedIn, userRole]);

  // Fetch real admin profile from backend /api/me
  useEffect(() => {
    if (!isLoggedIn || userRole !== 'admin') return;
    async function loadAdminProfile() {
      try {
        const profile = await api.get('/me');
        if (profile && profile.uid) {
          const resolvedRole = (profile.role === 'superadmin' || profile.role === 'admin')
            ? profile.role
            : ((profile.isCaptain || profile.role === 'captain') ? 'captain' : 'member');

          if (resolvedRole !== 'admin' && resolvedRole !== userRole) {
            console.info(`[Role Sync] Admin role changed from ${userRole} to ${resolvedRole}. Logging out to re-authenticate.`);
            const roleLabels = {
              captain: 'Table Captain',
              member: 'Member',
              admin: 'Admin',
              superadmin: 'Superadmin'
            };
            const toLabel = roleLabels[resolvedRole] || resolvedRole;
            localStorage.setItem(
              'bni_auth_notice',
              `Your role has been updated to ${toLabel}. Please log in again to continue.`
            );
            handleLogout();
            return;
          }

          setLoggedInAdmin(prev => {
            const updated = {
              ...(prev || {}),
              ...profile,
              name: profile.name || prev?.name || 'Admin',
              email: profile.email || prev?.email || '',
              region: profile.region || profile.scope || 'Guntur Region'
            };
            localStorage.setItem('bni_logged_admin', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.warn("Could not fetch admin profile from backend:", err.message);
      }
    }
    loadAdminProfile();
  }, [isLoggedIn, userRole]);

  useEffect(() => {
    if (!isLoggedIn) {
      window.history.pushState({}, '', '/login');
    }
  }, [isLoggedIn]);

  // Wrap tab change to also close sidebar on mobile
  const handleTabChangeResponsive = (tabId) => {
    handleTabChange(tabId);
    setIsSidebarOpen(false);
  };

  const [authView, setAuthView] = useState('login');

  // If not logged in, render Login or SignUp page
  if (!isLoggedIn) {
    if (authView === 'signup') {
      return (
        <SignUp
          onSwitchToLogin={() => setAuthView('login')}
          onLogin={handleLogin}
        />
      );
    }
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignUp={() => setAuthView('signup')}
      />
    );
  }

  // If logged in as a Superadmin, render the Superadmin portal layout directly
  if (userRole === 'superadmin') {
    return (
      <SuperadminLayout
        activeTab={activeTab}
        setActiveTab={handleTabChangeResponsive}
        onLogout={handleLogout}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  }

  // If logged in as a Captain, render the Captain portal layout
  if (userRole === 'captain') {
    return (
      <div className="flex flex-col h-screen w-screen bg-zinc-50 overflow-hidden font-sans">
        <CaptainHeader
          loggedInCaptain={loggedInCaptain}
          conclaveSyncData={conclaveSyncData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-24 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' ? (
            <CaptainDashboard
              loggedInCaptain={loggedInCaptain}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          ) : activeTab === 'my-table' ? (
            <CaptainTable
              loggedInCaptain={loggedInCaptain}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'current-round' ? (
            (['running', 'active'].includes((conclaveSyncData?.conclaveStatus?.status || '').toLowerCase()) && Number(conclaveSyncData?.conclaveStatus?.currentRound) > 0) ? (
              <CaptainCurrentRound
                loggedInCaptain={loggedInCaptain}
                conclaveSyncData={conclaveSyncData}
                searchQuery={searchQuery}
              />
            ) : (
              <CaptainSchedule
                loggedInCaptain={loggedInCaptain}
                onTabChange={handleTabChange}
                conclaveSyncData={conclaveSyncData}
                searchQuery={searchQuery}
              />
            )
          ) : (activeTab === 'schedule' || activeTab === 'my-schedule') ? (
            <CaptainSchedule
              loggedInCaptain={loggedInCaptain}
              onTabChange={handleTabChange}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'referrals' ? (
            <Referrals
              loggedInUser={loggedInCaptain}
              userType="captain"
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'profile' ? (
            <CaptainProfile
              loggedInCaptain={loggedInCaptain}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
            />
          ) : (
            <CaptainDashboard
              loggedInCaptain={loggedInCaptain}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
        </main>
      </div>
    );
  }

  // If logged in as a Member, render the Member portal layout with MemberHeader
  if (userRole === 'member') {
    return (
      <div className="flex flex-col h-screen w-screen bg-zinc-50 overflow-hidden font-sans">
        <MemberHeader
          loggedInMember={loggedInMember}
          conclaveSyncData={conclaveSyncData}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pb-20 md:pb-24 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' ? (
            <MemberDashboard
              loggedInMember={memberProfile || loggedInMember}
              memberConclaves={memberConclaves}
              onTabChange={handleTabChange}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'registrations' ? (
            <MemberRegistrations
              loggedInMember={memberProfile || loggedInMember}
              memberConclaves={memberConclaves}
              searchQuery={searchQuery}
            />
          ) : (activeTab === 'my-schedule' || activeTab === 'schedule') ? (
            <MemberSchedule
              loggedInMember={memberProfile || loggedInMember}
              onTabChange={handleTabChange}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : (activeTab === 'current-round' || activeTab === 'round') ? (
            <MemberCurrentRound
              loggedInMember={memberProfile || loggedInMember}
              onTabChange={handleTabChange}
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'history' ? (
            <MemberConclaveHistory
              loggedInMember={memberProfile || loggedInMember}
              memberConclaves={memberConclaves}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'referrals' ? (
            <Referrals
              loggedInUser={memberProfile || loggedInMember}
              userType="member"
              conclaveSyncData={conclaveSyncData}
              searchQuery={searchQuery}
            />
          ) : activeTab === 'profile' ? (
            <MemberProfile
              loggedInMember={memberProfile || loggedInMember}
              onTabChange={handleTabChange}
              onLogout={handleLogout}
            />
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 shadow-2xs text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-brand-red rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-zinc-955">{activeTab.toUpperCase()} - Under Construction</h2>
              <p className="text-xs text-zinc-500 font-semibold max-w-md mx-auto">
                Hello {loggedInMember?.name}! This member page view is currently under construction.
              </p>
              <div className="pt-4 max-w-xs mx-auto">
                <button
                  onClick={handleLogout}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-smooth cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-955 font-sans antialiased overflow-hidden relative">
      {/* Mobile drawer backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-45 lg:hidden transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Reusable Sidebar navigation component */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChangeResponsive}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        selectedConclaveId={selectedConclaveId}
        setSelectedConclaveId={setSelectedConclaveId}
        loggedInAdmin={loggedInAdmin}
      />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 overflow-hidden">
        {/* Reusable top navigation header component */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onMenuClick={() => setIsSidebarOpen(true)}
          loggedInAdmin={loggedInAdmin}
          selectedConclaveId={selectedConclaveId}
          onLogout={handleLogout}
        />


        {/* Generation warning banner — fixed overlay, doesn't affect layout */}
        {genWarning && activeTab === 'schedule-gen' && (
          <div
            role="alert"
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-xl flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-lg ${genWarning.type === 'captain'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-red-50 border-red-300 text-red-900'
              }`}
          >
            <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${genWarning.type === 'captain' ? 'text-amber-500' : 'text-red-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[13px] leading-snug">{genWarning.title}</p>
              <p className="text-[12px] mt-0.5 leading-relaxed opacity-90">{genWarning.message}</p>
            </div>
            <button onClick={clearGenWarning} aria-label="Dismiss warning" className="shrink-0 rounded-md p-1 hover:bg-black/10 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Workspace views router */}
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-zinc-50 relative min-h-full p-6 md:p-8 pb-20 md:pb-24">

          {activeTab === 'dashboard' ? (
            <Dashboard setActiveTab={handleTabChange} selectedConclaveId={selectedConclaveId} setSelectedConclaveId={setSelectedConclaveId} loggedInAdmin={loggedInAdmin} />
          ) : activeTab === 'members' ? (
            <Members searchQuery={searchQuery} selectedConclaveId={selectedConclaveId} loggedInAdmin={loggedInAdmin} />
          ) : activeTab === 'active-users' ? (
            <ActiveUsers searchQuery={searchQuery} selectedConclaveId={selectedConclaveId} loggedInAdmin={loggedInAdmin} />
          ) : activeTab === 'business-types' ? (
            <BusinessTypes searchQuery={searchQuery} selectedConclaveId={selectedConclaveId} loggedInAdmin={loggedInAdmin} />
          ) : activeTab === 'captains' ? (
            <Captains searchQuery={searchQuery} selectedConclaveId={selectedConclaveId} loggedInAdmin={loggedInAdmin} />
          ) : activeTab === 'conclaves' ? (
            <Conclaves loggedInAdmin={loggedInAdmin} setActiveTab={handleTabChange} />
          ) : activeTab === 'snapshot' ? (
            <Snapshot selectedConclaveId={selectedConclaveId} searchQuery={searchQuery} />

          ) : activeTab === 'schedule-gen' ? (
            <ScheduleGen selectedConclaveId={selectedConclaveId} showGenWarning={showGenWarning} clearGenWarning={clearGenWarning} />
          ) : activeTab === 'schedule-review' ? (
            <ScheduleReview setActiveTab={handleTabChange} selectedConclaveId={selectedConclaveId} />
          ) : activeTab === 'round-runner' ? (
            <RoundRunner selectedConclaveId={selectedConclaveId} />
          ) : activeTab === 'reports' ? (
            <Reports selectedConclaveId={selectedConclaveId} />
          ) : activeTab === 'profile' ? (
            <AdminProfile loggedInAdmin={loggedInAdmin} role="admin" onLogout={handleLogout} />
          ) : (
            <div className="p-8 text-center text-zinc-400">View not found</div>
          )}
        </main>
      </div>
    </div>
  );
}
