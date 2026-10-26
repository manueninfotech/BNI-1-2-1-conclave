import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import AdminSidebar from './AdminSidebar';
import Home from './Home';
import ConclaveWorkspace from './ConclaveWorkspace';
import { useConclaves } from './useConclaves';
import { pickCurrentConclave } from './conclaveStage';
import Conclaves from '../pages/Conclaves';
import Members from '../pages/Members';
import Settings from '../pages/Settings';
import AdminProfile from '../pages/admin/Profile';
import SuperadminDashboard from '../pages/superadmin/Dashboard';
import Revenue from '../pages/superadmin/Revenue';
import SuperadminAdmins from '../pages/superadmin/Admins';

/**
 * The admin and superadmin panel. Real URLs:
 *
 *   /admin                         Home — the current conclave and its next step
 *   /admin/conclaves               all conclaves
 *   /admin/conclaves/:id/:tab?     one conclave: overview | members | captains |
 *                                  schedule | payments | feedback
 *   /admin/people                  members across the region
 *   /admin/settings, /admin/profile
 *   /superadmin/...                the same, plus revenue and admins
 *
 * Old addresses (/admin/members, /admin/payments, …) still work: they open
 * that section of the current conclave.
 */
export default function AdminApp({ role, loggedInAdmin, onLogout }) {
  const base = role === 'superadmin' ? '/superadmin' : '/admin';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);

  // New page → start at the top.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [location.pathname]);

  // Login and logout move the address bar outside the router; catch up.
  useEffect(() => {
    const real = window.location.pathname + window.location.search;
    if (real !== location.pathname + location.search) navigate(real, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const conclaveIdInUrl = location.pathname.match(/\/conclaves\/([^/]+)/)?.[1] || '';

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-950 font-sans antialiased overflow-hidden relative">
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-45 lg:hidden" />}
      <AdminSidebar base={base} role={role} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setActiveTab={(tab) => tab === 'profile' && navigate(`${base}/profile`)}
          onMenuClick={() => setIsSidebarOpen(true)}
          loggedInAdmin={loggedInAdmin}
          selectedConclaveId={conclaveIdInUrl}
          onLogout={onLogout}
        />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-24">
          <Routes>
            <Route path={base}>
              <Route
                index
                element={
                  role === 'superadmin' ? (
                    <SuperadminHome base={base} loggedInAdmin={loggedInAdmin} />
                  ) : (
                    <Home base={base} loggedInAdmin={loggedInAdmin} />
                  )
                }
              />
              <Route path="conclaves" element={<ConclavesRoute base={base} loggedInAdmin={loggedInAdmin} searchQuery={searchQuery} />} />
              <Route path="conclaves/:id" element={<ConclaveWorkspace base={base} loggedInAdmin={loggedInAdmin} searchQuery={searchQuery} />} />
              <Route path="conclaves/:id/:tab" element={<ConclaveWorkspace base={base} loggedInAdmin={loggedInAdmin} searchQuery={searchQuery} />} />
              <Route
                path="people"
                element={<Members searchQuery={searchQuery} loggedInAdmin={loggedInAdmin} allowedScopes={['region', 'global']} />}
              />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<AdminProfile loggedInAdmin={loggedInAdmin} role={role} onLogout={onLogout} />} />
              {role === 'superadmin' && <Route path="revenue" element={<Revenue />} />}
              {role === 'superadmin' && <Route path="admins" element={<SuperadminAdmins searchQuery={searchQuery} />} />}

              {/* Old addresses → their new home. */}
              <Route path="dashboard" element={<Navigate to={base} replace />} />
              <Route path="members" element={<CurrentConclaveRedirect base={base} tab="members" />} />
              <Route path="captains" element={<CurrentConclaveRedirect base={base} tab="captains" />} />
              <Route path="payments" element={<CurrentConclaveRedirect base={base} tab="payments" />} />
              <Route path="feedback" element={<CurrentConclaveRedirect base={base} tab="feedback" />} />
              {['schedule-hub', 'schedule-gen', 'schedule-review', 'round-runner'].map((p) => (
                <Route key={p} path={p} element={<CurrentConclaveRedirect base={base} tab="schedule" />} />
              ))}
              <Route path="*" element={<Navigate to={base} replace />} />
            </Route>
            <Route path="*" element={<Navigate to={base} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function ConclavesRoute({ base, loggedInAdmin, searchQuery }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <Conclaves
      loggedInAdmin={loggedInAdmin}
      searchQuery={searchQuery}
      autoOpenCreate={params.get('create') === '1'}
      onOpenConclave={(id, tab) => navigate(`${base}/conclaves/${id}${tab ? `/${tab}` : ''}`)}
    />
  );
}

/** Superadmin home: the network overview, with its links going to real pages. */
function SuperadminHome({ base }) {
  const navigate = useNavigate();
  const go = (tab) => navigate(tab === 'members' ? `${base}/people` : `${base}/${tab}`);
  return <SuperadminDashboard setActiveTab={go} />;
}

/** Sends an old section link to that section of the current conclave. */
function CurrentConclaveRedirect({ base, tab }) {
  const { conclaves, loading } = useConclaves();
  if (loading) return <div className="h-24 rounded-xl bg-white border border-zinc-200 animate-pulse" />;
  const current = pickCurrentConclave(conclaves);
  return <Navigate to={current ? `${base}/conclaves/${current.id}/${tab}` : `${base}/conclaves`} replace />;
}

