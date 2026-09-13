import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const defaultBackendUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api'
  : 'https://conclave-backend.blackpond-26884e90.centralindia.azurecontainerapps.io/api';

const BASE_URL = import.meta.env.VITE_API_URL || defaultBackendUrl;

/**
 * Returns a promise that resolves to the current Firebase user (or null)
 * AFTER Firebase has finished restoring the session from its cache.
 *
 * Why: auth.currentUser is null synchronously on first load — Firebase
 * restores the session asynchronously. Reading it before the restore
 * finishes causes all API calls to go out without a Bearer token, which
 * makes the backend treat every request as "insecure-dev-admin" and
 * return empty schedule data.
 */
function getAuthenticatedUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });
}

async function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  try {
    const user = await getAuthenticatedUser();
    if (user) {
      const token = await user.getIdToken(false);
      headers['Authorization'] = `Bearer ${token}`;
      if (user.email) {
        headers['X-User-Id'] = user.email;
        headers['X-User-Email'] = user.email;
      }
    } else {
      const savedToken = localStorage.getItem('bni_auth_token');
      if (savedToken) {
        headers['Authorization'] = `Bearer ${savedToken}`;
      }
    }
  } catch (e) {
    console.warn("Could not retrieve auth token:", e);
  }

  const role = localStorage.getItem('bni_user_role') || 'member';
  let activeSession = null;
  if (role === 'member') {
    activeSession = localStorage.getItem('bni_logged_member');
  } else if (role === 'captain') {
    activeSession = localStorage.getItem('bni_logged_captain');
  } else {
    activeSession = localStorage.getItem('bni_logged_admin');
  }

  if (activeSession) {
    try {
      const parsed = JSON.parse(activeSession);
      if (parsed.uid || parsed.id || parsed.email) {
        headers['X-User-Id'] = parsed.uid || parsed.id || parsed.email;
      }
      if (parsed.email && !headers['X-User-Email']) {
        headers['X-User-Email'] = parsed.email;
      }
    } catch {}
  }


  return headers;
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 6000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function parseApiError(err, defaultMsg) {
  let msg = err.error || err.message || defaultMsg;
  if (err.details?.issues && Array.isArray(err.details.issues) && err.details.issues.length > 0) {
    const issueMsgs = err.details.issues.map(i => i.message).join(' ');
    msg = `${msg} Details: ${issueMsgs}`;
  } else if (err.details?.hint) {
    msg = `${msg} Hint: ${err.details.hint}`;
  }
  const errorObj = new Error(msg);
  errorObj.details = err.details;
  return errorObj;
}

export const api = {
  async get(endpoint) {
    const headers = await getAuthHeaders();
    try {
      const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw parseApiError(err, `Request to ${endpoint} failed`);
      }
      const data = await response.json();
      if (data && data.quotaExceeded) {
        const cached = localStorage.getItem('bni_conclaves_cache') || localStorage.getItem('bni_admin_conclaves_cache');
        if (cached) {
          try { return JSON.parse(cached); } catch (e) {}
        }
        return Array.isArray(data.data) ? data.data : [];
      }
      if (Array.isArray(data) && (endpoint === '/conclaves' || endpoint === '/admin/conclaves')) {
        localStorage.setItem('bni_conclaves_cache', JSON.stringify(data));
      }
      return data;
    } catch (error) {
      if (endpoint === '/conclaves' || endpoint === '/admin/conclaves') {
        const cached = localStorage.getItem('bni_conclaves_cache');
        if (cached) {
          try { return JSON.parse(cached); } catch (e) {}
        }
      }
      throw error;
    }
  },

  async post(endpoint, body) {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw parseApiError(err, `Request to ${endpoint} failed`);
    }
    return response.json();
  },

  async patch(endpoint, body) {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw parseApiError(err, `Request to ${endpoint} failed`);
    }
    return response.json();
  },

  async put(endpoint, body) {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw parseApiError(err, `Request to ${endpoint} failed`);
    }
    return response.json();
  },

  async delete(endpoint) {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw parseApiError(err, `Request to ${endpoint} failed`);
    }
    return response.json();
  }
};
