/**
 * Utility to detect the active portal context based on domain/subdomain, URL pathname, or query param.
 * Supports:
 * - Superadmin: superadmin.* or /superadmin
 * - Admin: bni-admin.* or admin.* or /admin
 * - Member: member.* or /member or default attendee domain
 */
export function getPortalContext() {
  if (typeof window === 'undefined') return 'member';

  const host = (window.location.hostname || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase().replace(/^\/|\/$/g, '');
  const searchParams = new URLSearchParams(window.location.search);

  // 1. Query param override (convenient for local dev/testing: ?portal=admin, ?portal=superadmin, ?portal=member)
  const portalParam = (searchParams.get('portal') || '').toLowerCase();
  if (portalParam === 'superadmin') return 'superadmin';
  if (portalParam === 'admin') return 'admin';
  if (portalParam === 'member') return 'member';

  // 2. Check Hostname / Subdomain
  if (host.includes('superadmin')) {
    return 'superadmin';
  }
  if (host.includes('admin') || host.startsWith('bni-admin')) {
    return 'admin';
  }
  if (host.includes('member') || host.startsWith('bni-member')) {
    return 'member';
  }

  // 3. Check Pathname
  if (path === 'superadmin' || path.startsWith('superadmin/')) {
    return 'superadmin';
  }
  if (path === 'admin' || path.startsWith('admin/')) {
    return 'admin';
  }
  if (path === 'member' || path.startsWith('member/')) {
    return 'member';
  }

  // Default: check if stored role indicates an admin portal session
  const storedRole = localStorage.getItem('bni_user_role');
  if (storedRole === 'superadmin') return 'superadmin';
  if (storedRole === 'admin') return 'admin';

  return 'member';
}

/**
 * Check if the current portal permits public member account registration
 */
export function isMemberRegistrationAllowed() {
  const portal = getPortalContext();
  return portal === 'member';
}
