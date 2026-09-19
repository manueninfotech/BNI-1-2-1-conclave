/**
 * Notifications Management Module
 * Provides strict multi-tenant filtering by User ID, Conclave ID, and Region.
 */

const STORAGE_KEY = 'bni_conclave_notifications_v3';

// Fetch raw notification list from localStorage
export function getRawNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && item.id !== 'notif_welcome');
      }
    }

    // Migration fallback: check legacy 'bni_notifications' key if present
    const oldRaw = localStorage.getItem('bni_notifications');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (Array.isArray(oldParsed)) {
        const cleaned = oldParsed.filter(item => item && item.id !== 'notif_welcome');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
        return cleaned;
      }
    }

    return [];
  } catch (e) {
    console.error("Failed to parse notifications store", e);
    return [];
  }
}

// Save raw notification list to localStorage
export function saveRawNotifications(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error("Failed to save notifications store", e);
  }
}

/**
 * Add a notification with proper target scoping.
 * @param {string} title
 * @param {string} desc
 * @param {string} type - 'info' | 'success' | 'warning' | 'error'
 * @param {object} metadata - { conclaveId, region, targetUid, senderUid }
 */
export function addNotification(title, desc, type = 'info', metadata = {}) {
  const list = getRawNotifications();
  const newItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    desc,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
    conclaveId: metadata.conclaveId || null,
    region: metadata.region || null,
    targetUid: metadata.targetUid || metadata.uid || null,
    senderUid: metadata.senderUid || null,
    readBy: []
  };

  saveRawNotifications([newItem, ...list]);
  return newItem;
}

/**
 * Retrieve notifications filtered strictly for the requesting user context.
 * 
 * @param {object} opts
 * @param {string} opts.userUid - Logged in user's UID (member/captain/admin)
 * @param {string} opts.conclaveId - Currently active or selected Conclave ID
 * @param {string} opts.region - Admin's assigned region (e.g. "Guntur Region")
 * @param {boolean} opts.isSuperAdmin - Whether caller is global superadmin
 */
export function getNotifications(opts = {}) {
  const list = getRawNotifications();
  const { userUid, conclaveId, region, isSuperAdmin } = opts;

  return list.filter(item => {
    // 1. Superadmin / Global Region Admin sees everything across all regions and conclaves
    if (isSuperAdmin || region === 'Global') {
      return true;
    }

    // 2. Private User Notifications: If notification has targetUid, ONLY show to targetUid or senderUid
    if (item.targetUid) {
      return Boolean(userUid && (item.targetUid === userUid || item.senderUid === userUid));
    }

    // 3. Conclave-specific Notifications: If notification has conclaveId, ONLY show if matches caller's conclaveId
    if (item.conclaveId) {
      return Boolean(conclaveId && item.conclaveId === conclaveId);
    }

    // 4. Region-specific Notifications: If notification has region, ONLY show if matches caller's region
    if (item.region) {
      return Boolean(region && item.region === region);
    }

    // 5. General Broadcast Notifications (no targetUid, no conclaveId, no region): Visible to all users
    return true;
  }).map(item => ({
    ...item,
    unread: !item.readBy?.includes(userUid || 'guest')
  }));
}

/**
 * Mark all notifications as read for a user.
 */
export function markAllRead(opts = {}) {
  const userUid = typeof opts === 'string' ? opts : opts?.userUid;
  if (!userUid) return;

  const list = getRawNotifications();
  const updated = list.map(item => {
    const readBy = Array.isArray(item.readBy) ? item.readBy : [];
    if (!readBy.includes(userUid)) {
      return { ...item, readBy: [...readBy, userUid] };
    }
    return item;
  });

  saveRawNotifications(updated);
}

/**
 * Remove/Dismiss a notification.
 */
export function removeNotification(id) {
  const list = getRawNotifications();
  const updated = list.filter(item => item.id !== id);
  saveRawNotifications(updated);
}

/**
 * Backwards compatibility helper
 */
export function saveNotifications(uid, updatedList) {
  saveRawNotifications(updatedList);
}
