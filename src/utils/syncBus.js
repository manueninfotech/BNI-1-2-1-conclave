/**
 * Cross-tab Real-Time Event Management & Sync Bus
 * Uses the native browser BroadcastChannel API to synchronize state across
 * multiple browser tabs instantly with 0ms latency.
 */

const CHANNEL_NAME = 'bni_conclave_sync_channel';

const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel(CHANNEL_NAME)
  : null;

export function broadcastTabMessage(message) {
  try {
    if (channel) {
      channel.postMessage({ ...message, senderTabId: window.__bni_tab_id, timestamp: Date.now() });
    }
  } catch (e) {
    console.debug('BroadcastChannel postMessage error:', e);
  }
}

export function subscribeTabMessages(callback) {
  if (!channel) return () => {};
  const handler = (e) => {
    if (e.data && e.data.senderTabId !== window.__bni_tab_id) {
      callback(e.data);
    }
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

// Generate unique tab ID for this browser tab session
if (typeof window !== 'undefined' && !window.__bni_tab_id) {
  window.__bni_tab_id = 'tab_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
}

