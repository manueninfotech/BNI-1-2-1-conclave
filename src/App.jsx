import React, { useState, useEffect, useRef } from 'react';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';
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
import Referrals from './pages/Referrals';

import { Sparkles } from 'lucide-react';
import AdminApp from './admin/AdminApp';
import { api } from './services/api';
import { getPortalContext, isMemberRegistrationAllowed } from './utils/portalDetection';
import { setTimingConfig } from './utils/roundTiming';

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

  // Read logged in user's role from localStorage or portal URL
  const [userRole, setUserRole] = useState(() => {
    const storedRole = localStorage.getItem('bni_user_role');
    if (storedRole) return storedRole;
    return getPortalContext();
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
      } catch (e) { }

      try {
        const captainData = localStorage.getItem('bni_logged_captain');
        if (captainData && captainData !== 'undefined') setLoggedInCaptain(JSON.parse(captainData));
      } catch (e) { }

      try {
        const memberData = localStorage.getItem('bni_logged_member');
        if (memberData && memberData !== 'undefined') setLoggedInMember(JSON.parse(memberData));
      } catch (e) { }
    };

    window.addEventListener('storage', syncLoggedUser);
    return () => window.removeEventListener('storage', syncLoggedUser);
  }, []);

  // Fetch backend round timing and conclave defaults on mount
  useEffect(() => {
    async function initSettings() {
      try {
        const config = await api.get('/app-config').catch(() => null);
        if (config?.roundTiming) {
          setTimingConfig(config.roundTiming);
        }
        if (config?.conclaveDefaults) {
          localStorage.setItem('bni_conclave_defaults', JSON.stringify(config.conclaveDefaults));
        }
      } catch (e) {
        // Fallback to cached timing & defaults
      }
    }
    initSettings();
  }, []);

  // Read active tab path directly from window URL pathname
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    const validTabs = [
      'dashboard', 'members', 'captains',
      'conclaves', 'schedule-hub', 'schedule-gen', 'schedule-review',
      'round-runner', 'admins', 'referrals', 'profile', 'registrations',
      'my-schedule', 'current-round', 'history', 'my-table', 'schedule'
    ];
    return validTabs.includes(lastPart) ? lastPart : 'dashboard';
  });

  const [searchQuery, setSearchQuery] = useState('');

  const mainRef = useRef(null);

  // Handle URL updates when switching tabs
  // Handle URL updates when switching tabs
  const handleTabChange = (tabId) => {
    // Guard: if trying to navigate to current-round while conclave isn't live, redirect to my-schedule
    const conclaveStatusNow = (conclaveSyncData?.conclaveStatus?.status || '').toLowerCase();
    const isLiveNow = (conclaveStatusNow === 'running' || conclaveStatusNow === 'active') &&
      Number(conclaveSyncData?.conclaveStatus?.currentRound) > 0;
    const resolvedTab = (tabId === 'current-round' && !isLiveNow) ? 'my-schedule' : tabId;
    setActiveTab(resolvedTab);

    // Always use the user's authenticated role as the URL prefix.
    // Never inspect `path.includes('/captain')` which corrupted the URL when visiting '/admin/captains'.
    const activeRole = userRole || localStorage.getItem('bni_user_role') || 'admin';
    window.history.pushState({}, '', `/${activeRole}/${resolvedTab}`);
  };

  // Sync state if user clicks Back or Forward browser navigation buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\/|\/$/g, '');
      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      const validTabs = [
        'dashboard', 'members', 'captains',
        'conclaves', 'schedule-hub', 'schedule-gen', 'schedule-review',
        'round-runner', 'admins', 'referrals', 'profile', 'registrations',
        'my-schedule', 'current-round', 'history', 'my-table', 'schedule'
      ];
      const cleanTab = validTabs.includes(lastPart) ? lastPart : 'dashboard';

      if (path.startsWith('superadmin/') || path === 'superadmin') {
        setUserRole('superadmin');
        setActiveTab(cleanTab);
      } else if (path.startsWith('admin/') || path === 'admin') {
        setUserRole('admin');
        setActiveTab(cleanTab);
      } else if (path.startsWith('captain/') || path === 'captain') {
        setUserRole('captain');
        setActiveTab(cleanTab);
      } else if (path.startsWith('member/') || path === 'member') {
        setUserRole('member');
        setActiveTab(cleanTab);
      } else {
        const storedRole = localStorage.getItem('bni_user_role') || 'admin';
        setUserRole(storedRole);
        setActiveTab(cleanTab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userRole]);

  // Route correction guard: ensure admin-only tabs are never under /captain/ or /member/,
  // and automatically fix corrupted URLs like /captain/members -> /admin/members
  useEffect(() => {
    if (!isLoggedIn) return;
    const adminOnlyTabs = [
      'members', 'captains',
      'conclaves', 'schedule-hub', 'schedule-gen', 'schedule-review', 'round-runner', 'settings'
    ];
    const path = window.location.pathname.replace(/^\/|\/$/g, '');

    if (adminOnlyTabs.includes(activeTab)) {
      if (userRole === 'admin' || userRole === 'superadmin') {
        if (!path.startsWith('admin/') && !path.startsWith('superadmin/')) {
          window.history.replaceState({}, '', `/${userRole}/${activeTab}`);
        }
      } else if (userRole === 'captain') {
        setActiveTab('dashboard');
        window.history.replaceState({}, '', `/captain/dashboard`);
      } else if (userRole === 'member') {
        setActiveTab('dashboard');
        window.history.replaceState({}, '', `/member/dashboard`);
      }
    } else if (userRole === 'member' && (path.startsWith('captain/') || path === 'captain')) {
      setActiveTab('dashboard');
      window.history.replaceState({}, '', `/member/dashboard`);
    }
  }, [isLoggedIn, userRole, activeTab]);



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
    const portal = getPortalContext();
    if (portal === 'superadmin' && role !== 'superadmin') {
      localStorage.setItem('bni_auth_notice', 'Access restricted: This portal is reserved for Superadmin accounts only.');
      handleLogout();
      return;
    }
    if (portal === 'admin' && (role !== 'admin' && role !== 'superadmin')) {
      localStorage.setItem('bni_auth_notice', 'Access restricted: This portal is for Chapter Admins only. Please sign in through the Member portal.');
      handleLogout();
      return;
    }

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
      localStorage.setItem('bni_logged_admin', JSON.stringify({ ...(payload || {}), role: 'superadmin' }));
      setLoggedInCaptain(null);
      setLoggedInMember(null);
      setLoggedInAdmin({ ...(payload || {}), role: 'superadmin' });
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
        setLoggedInAdmin({ name: "Sanjay Wagle", email: "admin@bni.com", region: "All Regions" });
      }

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
  };

  const [conclaveSyncData, setConclaveSyncData] = useState(null);

  const [memberConclaves, setMemberConclaves] = useState(() => {
    const cached = localStorage.getItem('bni_member_conclaves_cache');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
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
        let syncResult = null;

        if (myRegisteredConclave) {
          syncResult = await api.post(`/conclaves/${myRegisteredConclave.id}/sync`, {}).catch(() => null);
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

        // Check if conclave is completed
        const conclaveStatusStr = (syncResult?.conclaveStatus?.status || myRegisteredConclave?.status || '').toLowerCase();
        const isConclaveDone = conclaveStatusStr === 'completed' || conclaveStatusStr === 'finished' || conclaveStatusStr === 'ended';

        // Evaluate resolved role:
        // A completed conclave strictly sets the role to member and never allows captain promotion!
        let resolvedRole = userRole;
        if (profile?.role === 'superadmin' || profile?.role === 'admin') {
          resolvedRole = profile.role;
        } else if (isConclaveDone) {
          resolvedRole = 'member';
        } else if (profile?.isCaptain || profile?.role === 'captain' || syncResult?.isCaptain) {
          resolvedRole = 'captain';
        } else {
          resolvedRole = 'member';
        }

        if (resolvedRole !== userRole) {
          console.info(`[Role Sync] User role transition: ${userRole} -> ${resolvedRole} (isConclaveDone: ${isConclaveDone}).`);
          localStorage.setItem('bni_user_role', resolvedRole);
          setUserRole(resolvedRole);
          if (resolvedRole === 'captain') {
            const capPayload = { ...(profile || {}), ...(loggedInMember || {}), isCaptain: true, role: 'captain' };
            localStorage.setItem('bni_logged_captain', JSON.stringify(capPayload));
            setLoggedInCaptain(capPayload);
            localStorage.removeItem('bni_logged_member');
            setLoggedInMember(null);
            window.history.replaceState({}, '', `/captain/dashboard`);
          } else {
            const fallbackMem = loggedInMember || loggedInCaptain || {
              id: syncResult?.userUid || profile?.uid,
              name: loggedInCaptain?.name || profile?.name || 'Member',
              role: 'member'
            };
            const memPayload = { ...(profile || {}), ...fallbackMem, isCaptain: false, role: 'member' };
            localStorage.setItem('bni_logged_member', JSON.stringify(memPayload));
            setLoggedInMember(memPayload);
            localStorage.removeItem('bni_logged_captain');
            setLoggedInCaptain(null);
            setActiveTab('dashboard');
            window.history.replaceState({}, '', `/member/dashboard`);
          }
          return;
        }

        // Profile updates for active role
        if (profile) {
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
    if (!isLoggedIn || (userRole !== 'admin' && userRole !== 'superadmin')) return;
    async function loadAdminProfile() {
      try {
        const profile = await api.get('/me');
        if (profile && profile.uid) {
          const rawRole = (profile.role || '').toLowerCase();
          const isRoleAdmin = rawRole === 'superadmin' || rawRole === 'admin' || rawRole === 'coordinator' || rawRole === 'regional_admin';
          const resolvedRole = rawRole === 'superadmin'
            ? 'superadmin'
            : (isRoleAdmin
              ? 'admin'
              : ((profile.isCaptain || profile.role === 'captain') ? 'captain' : 'member'));

          if (resolvedRole !== userRole && !(userRole === 'admin' && resolvedRole === 'superadmin')) {
            console.info(`[Role Sync] Admin role changed from ${userRole} to ${resolvedRole}. Logging out to re-authenticate.`);
            const roleLabels = {
              captain: 'Table Captain',
              member: 'Member',
              admin: 'Admin',
              coordinator: 'Admin',
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
      const path = window.location.pathname.replace(/^\/|\/$/g, '');
      const searchParams = new URLSearchParams(window.location.search);
      const isReset = path === 'reset-password' || searchParams.get('mode') === 'resetPassword' || searchParams.get('oobCode');
      if (!isReset && path !== 'signup' && path !== 'login') {
        window.history.pushState({}, '', '/login');
      }
    }
  }, [isLoggedIn]);

  const [authView, setAuthView] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const searchParams = new URLSearchParams(window.location.search);
    if (path === 'reset-password' || searchParams.get('mode') === 'resetPassword' || searchParams.get('oobCode')) {
      return 'reset-password';
    }
    if (path === 'signup' && isMemberRegistrationAllowed()) return 'signup';
    return 'login';
  });

  // If not logged in, render Login, SignUp or ResetPassword page
  if (!isLoggedIn) {
    if (authView === 'reset-password') {
      return (
        <ResetPassword
          onBackToLogin={() => {
            setAuthView('login');
            window.history.pushState({}, '', '/login');
          }}
        />
      );
    }
    const allowSignUp = isMemberRegistrationAllowed();
    if (authView === 'signup' && allowSignUp) {
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
        onSwitchToSignUp={allowSignUp ? () => setAuthView('signup') : null}
      />
    );
  }

  // Admins and superadmins: the routed admin panel (src/admin).
  if (userRole === 'superadmin' || userRole === 'admin') {
    return <AdminApp role={userRole} loggedInAdmin={loggedInAdmin} onLogout={handleLogout} />;
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
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-7 sm:pt-9 md:pt-10 pb-16 sm:pb-20 md:pb-24 max-w-7xl mx-auto w-full">
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
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-10 sm:pb-14 max-w-7xl mx-auto w-full">
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

  return null;
}
