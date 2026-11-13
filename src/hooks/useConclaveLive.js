import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BASE_URL, getAuthToken } from '../services/api';

/**
 * Backend SSE configuration:
 * The backend live service emits a comment ping (`: ping <timestamp>`) every 25,000ms (25s)
 * under Azure ingress idle timeout.
 */
const BACKEND_HEARTBEAT_MS = 25000;

/**
 * Safe client-side idle watchdog threshold (50 seconds).
 * Accommodates 1 missed heartbeat due to network latency/jitter (2x 25s),
 * while rapidly identifying silently stalled/broken connections and triggering recovery.
 */
const HEARTBEAT_IDLE_TIMEOUT_MS = BACKEND_HEARTBEAT_MS * 2;

/**
 * Checks whether a value is a plain JSON object (not an Array, Date, Map, or primitive).
 */
function isPlainObject(val) {
  return (
    val !== null &&
    typeof val === 'object' &&
    Object.prototype.toString.call(val) === '[object Object]' &&
    (val.constructor === Object || !val.constructor)
  );
}

/**
 * Deep merge helper for plain JSON objects.
 * Handles nested plain objects cleanly while replacing arrays and primitive/null/date values.
 */
function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = target[key];
    if (isPlainObject(sVal) && isPlainObject(tVal)) {
      result[key] = deepMerge(tVal, sVal);
    } else {
      result[key] = sVal;
    }
  }
  return result;
}

/**
 * Global stream registry per conclaveId.
 * Guarantees that only ONE active SSE fetch connection exists per conclave,
 * even if multiple components simultaneously mount useConclaveLive.
 */
const activeStreams = new Map();

/**
 * Safe timeout threshold for asynchronous authentication token retrieval (10 seconds).
 * Prevents an offline or stalled Firebase Auth token promise from leaving a connection attempt hanging indefinitely.
 */
const AUTH_TOKEN_TIMEOUT_MS = 10000;

/**
 * In-flight token request deduplication tracker.
 *
 * Limitation Documentation:
 * The Firebase Auth Web SDK (`user.getIdToken`) does not accept an AbortSignal or support
 * native promise cancellation. When a token request exceeds AUTH_TOKEN_TIMEOUT_MS,
 * Promise.race() times out the waiting SSE connection handshake, but the underlying
 * Firebase token request continues in the background until settled.
 *
 * Mitigation:
 * We deduplicate concurrent in-flight token requests so that timeouts, repeated retries,
 * or multiple components never spawn redundant concurrent token requests against Firebase.
 */
let inFlightTokenPromise = null;
let inFlightIsForce = false;

export function getSharedAuthToken(forceRefreshToken) {
  // If an in-flight token request exists and satisfies the requested forceRefresh constraint, reuse it.
  // Normal requests (!forceRefreshToken) can reuse an active forced request (inFlightIsForce === true)
  // or an active normal request (inFlightIsForce === false).
  // Forced requests (forceRefreshToken === true) can ONLY reuse an active forced request.
  if (inFlightTokenPromise && (!forceRefreshToken || inFlightIsForce)) {
    return inFlightTokenPromise;
  }

  const isForce = Boolean(forceRefreshToken);

  let currentPromise;
  try {
    currentPromise = Promise.resolve(getAuthToken(forceRefreshToken));
  } catch (syncErr) {
    // If getAuthToken throws synchronously, wrap in a rejected promise and preserve clean tracking state
    return Promise.reject(syncErr);
  }

  inFlightIsForce = isForce;
  inFlightTokenPromise = currentPromise;

  const cleanup = () => {
    // Only reset if this promise is still the currently tracked in-flight promise.
    // If a subsequent forced refresh replaced this promise while it was in flight,
    // this older completing promise must NOT clear the newer tracking state.
    if (inFlightTokenPromise === currentPromise) {
      inFlightTokenPromise = null;
      inFlightIsForce = false;
    }
  };

  // Attach completion handler without creating an unhandled rejection if currentPromise rejects
  currentPromise.then(cleanup, cleanup);

  return currentPromise;
}

async function getAuthTokenWithTimeout(forceRefreshToken, timeoutMs = AUTH_TOKEN_TIMEOUT_MS) {
  let timer = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('AUTH_TOKEN_TIMEOUT'));
      }, timeoutMs);
    });

    const tokenPromise = getSharedAuthToken(forceRefreshToken);
    return await Promise.race([tokenPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Production-grade fetch-based SSE stream hook for real-time conclave state.
 *
 * Implements:
 * 1. SSE Heartbeat & Idle Watchdog:
 *    - Expects backend heartbeat every 25s (`: ping <timestamp>`).
 *    - Resets a 50s idle watchdog on every received network chunk.
 *    - If stalled beyond 50s, aborts the dead connection and triggers backoff recovery.
 * 2. Connection Status Tracking:
 *    - 'connecting': Initial handshake in progress.
 *    - 'connected': Stream active (200 OK, event-stream Content-Type, active reader).
 *    - 'reconnecting': Network failure, stalled heartbeat, or token refresh; retrying with backoff.
 *    - 'disconnected': Stream terminated (204 permanent close, 4xx client abort, or unmount).
 * 3. Initial Cache Synchronization:
 *    - Patches `['conclave', conclaveId]` in memory directly from initial payload.
 *    - Prevents stale referrals if previous cache was undefined or from a prior round.
 *    - Avoids redundant double invalidations when cache is already synchronized.
 * 4. Referral and Stats Update Behavior:
 *    - SSE payloads carry live conclave state metadata and clock, NOT complete referral arrays.
 *    - Retains targeted selective invalidation for `['referrals', conclaveId]` and `['stats', conclaveId]`
 *      when relevant properties (round, referralCount, status, updatedAt) actually change.
 *    - Zero invalidations and zero API calls on normal heartbeat traffic.
 * 5. Singleton Stream Management:
 *    - Reference-counts subscribers so exactly 1 HTTP stream exists per conclave.
 */
export function useConclaveLive(conclaveId) {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState(() => {
    if (!conclaveId) return 'disconnected';
    return activeStreams.get(conclaveId)?.status || 'connecting';
  });

  useEffect(() => {
    if (!conclaveId) {
      setConnectionStatus('disconnected');
      return;
    }

    let stream = activeStreams.get(conclaveId);

    const onStatusChange = (nextStatus) => {
      setConnectionStatus(nextStatus);
      queryClient.setQueryData(['sse-status', conclaveId], nextStatus);
    };

    if (!stream) {
      // Create new singleton stream for this conclaveId
      let isCancelled = false;
      let currentConnectionId = 0;
      let activeController = null;
      let retryTimeout = null;
      let idleWatchdogTimer = null;
      let backoffMs = 1500;
      let consecutiveAuthFailures = 0;
      let status = 'connecting';
      let hasReceivedInitialState = false;
      let lastSeenRound = undefined;
      let lastSeenStatus = undefined;
      let lastSeenUpdatedAt = undefined;
      let lastSeenReferrals = undefined;
      let lastChunkReceivedAt = Date.now();
      let isConnectionInProgress = false;
      let isPermanentlyDisconnected = false;

      const subscribers = new Set([onStatusChange]);

      const notifyStatus = (nextStatus) => {
        status = nextStatus;
        subscribers.forEach((cb) => {
          try {
            cb(nextStatus);
          } catch { }
        });
      };

      const clearIdleWatchdog = () => {
        if (idleWatchdogTimer) {
          clearTimeout(idleWatchdogTimer);
          idleWatchdogTimer = null;
        }
      };

      const resetIdleWatchdog = (connectionId, controller) => {
        lastChunkReceivedAt = Date.now();
        clearIdleWatchdog();
        if (isCancelled || connectionId !== currentConnectionId) return;

        idleWatchdogTimer = setTimeout(() => {
          if (isCancelled || connectionId !== currentConnectionId) return;
          console.warn(
            `[useConclaveLive] Stalled connection detected for conclave ${conclaveId} ` +
            `(no heartbeat in ${HEARTBEAT_IDLE_TIMEOUT_MS / 1000}s). Aborting to trigger recovery.`
          );
          notifyStatus('reconnecting');
          try {
            controller.abort();
          } catch { }
        }, HEARTBEAT_IDLE_TIMEOUT_MS);
      };

      async function connectStream(forceRefreshToken = false) {
        if (isCancelled || isPermanentlyDisconnected || isConnectionInProgress || status === 'connected') return;

        isConnectionInProgress = true;

        // Abort previous active controller if one exists before starting a new connection attempt
        if (activeController) {
          try {
            activeController.abort();
          } catch { }
          activeController = null;
        }

        // Increment generation identity for this connection
        const connectionId = ++currentConnectionId;
        const localController = new AbortController();
        activeController = localController;
        let localReader = null;
        let localAuthHealthyTimer = null;
        let connectionTimedOut = false;
        let connectTimeoutId = null;

        try {
          const token = await getAuthTokenWithTimeout(forceRefreshToken);
          if (isCancelled || connectionId !== currentConnectionId) {
            localController.abort();
            return;
          }

          const sseUrl = `${BASE_URL}/conclaves/${conclaveId}/live`;
          const headers = {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          // Initial handshake timeout (15 seconds) bound strictly to this connection attempt
          connectTimeoutId = setTimeout(() => {
            if (connectionId === currentConnectionId) {
              connectionTimedOut = true;
              try {
                localController.abort();
              } catch { }
            }
          }, 15000);

          const response = await fetch(sseUrl, {
            headers,
            signal: localController.signal,
          });

          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }

          if (isCancelled || connectionId !== currentConnectionId) {
            localController.abort();
            return;
          }

          if (response.status === 204) {
            console.info(`[useConclaveLive] Server closed stream permanently for conclave ${conclaveId}.`);
            isPermanentlyDisconnected = true;
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            clearIdleWatchdog();
            notifyStatus('disconnected');
            return;
          }

          if (response.status === 401) {
            throw new Error('AUTH_401');
          }

          if (
            response.status === 400 ||
            response.status === 403 ||
            response.status === 404 ||
            response.status === 422
          ) {
            console.warn(`[useConclaveLive] Client error (${response.status}) for conclave ${conclaveId}. Aborting retries.`);
            isPermanentlyDisconnected = true;
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              retryTimeout = null;
            }
            clearIdleWatchdog();
            notifyStatus('disconnected');
            return;
          }

          if (response.status === 429) {
            throw new Error('RATE_LIMITED_429');
          }

          if (!response.ok || !response.body) {
            throw new Error(`HTTP_${response.status}`);
          }

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.toLowerCase().includes('text/event-stream')) {
            throw new Error(`INVALID_SSE_CONTENT_TYPE: ${contentType}`);
          }

          localReader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          // Mark SSE connected only after a successful response with a valid event-stream content type and active reader
          notifyStatus('connected');
          isConnectionInProgress = false;
          resetIdleWatchdog(connectionId, localController);

          localAuthHealthyTimer = setTimeout(() => {
            if (connectionId === currentConnectionId) {
              consecutiveAuthFailures = 0;
              backoffMs = 1500;
            }
          }, 30000);

          const processFrame = (frame) => {
            if (!frame || connectionId !== currentConnectionId) return;

            let eventType = 'message';
            const dataLines = [];

            const lines = frame.split(/\r\n|\n|\r/);
            for (const line of lines) {
              // Ignore SSE ping/comment frames (e.g. ': ping 1785404498')
              if (line.startsWith(':')) continue;

              if (line.startsWith('event:')) {
                eventType = (line.startsWith('event: ') ? line.slice(7) : line.slice(6)).trim();
              } else if (line.startsWith('data:')) {
                const content = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
                dataLines.push(content);
              }
            }

            if ((eventType === 'state' || eventType === 'message') && dataLines.length > 0) {
              try {
                const fullDataStr = dataLines.join('\n');
                const data = JSON.parse(fullDataStr);

                if (!isPlainObject(data)) {
                  console.warn('[useConclaveLive] Ignoring invalid SSE payload.');
                  return;
                }

                const prevState = queryClient.getQueryData(['conclave', conclaveId]);
                const prevRound = prevState?.currentRound ?? prevState?.current_round ?? lastSeenRound;
                const nextRound = data.currentRound ?? data.current_round;
                const prevStatus = prevState?.status ?? lastSeenStatus;
                const nextStatus = data.status;
                const prevUpdatedAt = prevState?.updatedAt ?? lastSeenUpdatedAt;
                const nextUpdatedAt = data.updatedAt;
                const prevReferrals = prevState?.referralCount ?? prevState?.referralsCount ?? lastSeenReferrals;
                const nextReferrals = data.referralCount ?? data.referralsCount;

                // In-memory cache patch directly from payload (0 network refetches, zero refetch storm)
                queryClient.setQueryData(['conclave', conclaveId], (prev) => {
                  if (!prev) return data;
                  return deepMerge(prev, data);
                });

                // Detect state changes against either cached state or last seen event
                const roundChanged = nextRound !== undefined && prevRound !== undefined && nextRound !== prevRound;
                const statusChanged = nextStatus !== undefined && prevStatus !== undefined && nextStatus !== prevStatus;
                const referralsChanged = nextReferrals !== undefined && prevReferrals !== undefined && nextReferrals !== prevReferrals;
                const databaseUpdated = nextUpdatedAt !== undefined && prevUpdatedAt !== undefined && nextUpdatedAt !== prevUpdatedAt;

                if (!hasReceivedInitialState) {
                  hasReceivedInitialState = true;

                  // On initial event:
                  // 1. If round or status changed compared to prior cached conclave state, selectively invalidate
                  if (roundChanged || referralsChanged) {
                    queryClient.invalidateQueries({ queryKey: ['referrals', conclaveId] });
                  }
                  if (roundChanged || statusChanged) {
                    queryClient.invalidateQueries({ queryKey: ['stats', conclaveId] });
                    const membersQueryState = queryClient.getQueryState(['members', conclaveId]);
                    if (membersQueryState?.fetchStatus !== 'fetching') {
                      queryClient.invalidateQueries({ queryKey: ['members', conclaveId] });
                    }
                  } else {
                    // 2. If round did not change, check if referrals cache is populated from a previous session
                    const refQueryState = queryClient.getQueryState(['referrals', conclaveId]);
                    const isRefFetching = refQueryState?.fetchStatus === 'fetching';
                    const cachedReferrals = refQueryState?.data;

                    // If a referral query is already in progress, avoid canceling or double-fetching it
                    if (!isRefFetching && Array.isArray(cachedReferrals) && cachedReferrals.length > 0 && nextRound !== undefined && nextRound > 1) {
                      const hasActiveRoundSlips = cachedReferrals.some(r => Number(r.roundNumber || r.round_number || r.round) === Number(nextRound));
                      if (!hasActiveRoundSlips) {
                        queryClient.invalidateQueries({ queryKey: ['referrals', conclaveId] });
                      }
                    }

                    // Check if cached stats are from an earlier round
                    const statsQueryState = queryClient.getQueryState(['stats', conclaveId]);
                    const isStatsFetching = statsQueryState?.fetchStatus === 'fetching';
                    const cachedStats = statsQueryState?.data;

                    if (!isStatsFetching && cachedStats && cachedStats.currentRound !== undefined && nextRound !== undefined && cachedStats.currentRound !== nextRound) {
                      queryClient.invalidateQueries({ queryKey: ['stats', conclaveId] });
                    }

                    // Check members query cache
                    const membersQueryState = queryClient.getQueryState(['members', conclaveId]);
                    const isMembersFetching = membersQueryState?.fetchStatus === 'fetching';
                    const cachedMembers = membersQueryState?.data;

                    if (!isMembersFetching && cachedMembers) {
                      // If members response contains status/round metadata, detect staleness
                      const cachedStatus = cachedMembers?.status || (Array.isArray(cachedMembers) && cachedMembers[0]?.conclaveStatus);
                      const cachedRound = cachedMembers?.currentRound || (Array.isArray(cachedMembers) && cachedMembers[0]?.roundNumber);

                      const isStatusStale = Boolean(cachedStatus && nextStatus && cachedStatus !== nextStatus);
                      const isRoundStale = Boolean(cachedRound !== undefined && nextRound !== undefined && cachedRound !== nextRound);

                      if (isStatusStale || isRoundStale) {
                        queryClient.invalidateQueries({ queryKey: ['members', conclaveId] });
                      }
                      // Technical Note / Limitation:
                      // Standard member registration arrays (GET /admin/conclaves/:id/registrations)
                      // contain conclave-level member objects ({ uid, name, role, company, category })
                      // without embedding the active round number or conclave status.
                      // When prevState is undefined and member records lack status/round markers,
                      // staleness cannot be definitively determined from payload data alone.
                      // We deliberately avoid blind invalidation to prevent refetch storms on initial SSE connect.
                    }
                  }
                } else {
                  // Subsequent live events: selective invalidation only when state actually changed
                  if (roundChanged || referralsChanged) {
                    queryClient.invalidateQueries({ queryKey: ['referrals', conclaveId] });
                  }
                  if (roundChanged || statusChanged) {
                    queryClient.invalidateQueries({ queryKey: ['stats', conclaveId] });
                    const membersQueryState = queryClient.getQueryState(['members', conclaveId]);
                    if (membersQueryState?.fetchStatus !== 'fetching') {
                      queryClient.invalidateQueries({ queryKey: ['members', conclaveId] });
                    }
                  } else if (databaseUpdated && !referralsChanged) {
                    // Meaningful conclave row update (e.g. schedule generated or captain reconfigured)
                    queryClient.invalidateQueries({ queryKey: ['conclave', conclaveId] });
                  }
                }

                lastSeenRound = nextRound;
                lastSeenStatus = nextStatus;
                lastSeenUpdatedAt = nextUpdatedAt;
                lastSeenReferrals = nextReferrals;
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          };

          const FRAME_DELIMITER_REGEX = /(?:\r\n|\r|\n){2}/;

          while (!isCancelled && connectionId === currentConnectionId) {
            const { done, value } = await localReader.read();
            if (done || isCancelled || connectionId !== currentConnectionId) break;

            // Heartbeat received: reset idle watchdog on any incoming byte
            resetIdleWatchdog(connectionId, localController);

            buffer += decoder.decode(value, { stream: true });

            while (true) {
              const match = FRAME_DELIMITER_REGEX.exec(buffer);
              if (!match) break;
              const frame = buffer.slice(0, match.index);
              buffer = buffer.slice(match.index + match[0].length);
              processFrame(frame);
            }
          }

          if (connectionId === currentConnectionId) {
            const finalTrailing = decoder.decode(undefined, { stream: false });
            if (finalTrailing) {
              buffer += finalTrailing;
            }
            while (true) {
              const match = FRAME_DELIMITER_REGEX.exec(buffer);
              if (!match) break;
              const frame = buffer.slice(0, match.index);
              buffer = buffer.slice(match.index + match[0].length);
              processFrame(frame);
            }
            buffer = '';

            if (!isCancelled) {
              notifyStatus('reconnecting');
              const delay = backoffMs;
              backoffMs = Math.min(backoffMs * 1.5, 30000);
              scheduleReconnect(false, delay);
            }
          }
        } catch (err) {
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }

          // If this connection was superseded by a newer connection attempt or cancelled, ignore it
          if (isCancelled || connectionId !== currentConnectionId) return;

          notifyStatus('reconnecting');

          if (err.message === 'AUTH_TOKEN_TIMEOUT') {
            console.warn(`[useConclaveLive] Token retrieval timed out for conclave ${conclaveId}. Retrying with backoff.`);
            const delay = backoffMs;
            backoffMs = Math.min(backoffMs * 1.5, 30000);
            scheduleReconnect(false, delay);
            return;
          }

          if (connectionTimedOut || err.name === 'AbortError') {
            const delay = backoffMs;
            backoffMs = Math.min(backoffMs * 1.5, 30000);
            scheduleReconnect(false, delay);
            return;
          }

          if (err.message === 'AUTH_401') {
            consecutiveAuthFailures++;
            if (consecutiveAuthFailures >= 3) {
              console.warn('[useConclaveLive] Multiple consecutive auth failures. Cooling down for 30s.');
              scheduleReconnect(true, 30000);
            } else {
              scheduleReconnect(true, 1500 * consecutiveAuthFailures);
            }
          } else if (err.message === 'RATE_LIMITED_429') {
            const delay = Math.max(backoffMs, 10000);
            backoffMs = Math.min(delay * 1.5, 30000);
            scheduleReconnect(false, delay);
          } else {
            const delay = backoffMs;
            backoffMs = Math.min(backoffMs * 1.5, 30000);
            scheduleReconnect(false, delay);
          }
        } finally {
          if (connectTimeoutId) {
            clearTimeout(connectTimeoutId);
            connectTimeoutId = null;
          }

          if (localAuthHealthyTimer) {
            clearTimeout(localAuthHealthyTimer);
            localAuthHealthyTimer = null;
          }

          if (localReader) {
            try {
              await localReader.cancel();
            } catch { }
            try {
              localReader.releaseLock();
            } catch { }
            localReader = null;
          }

          // Clean up watchdog and release connection in-progress lock ONLY if this was the active generation
          if (connectionId === currentConnectionId) {
            clearIdleWatchdog();
            isConnectionInProgress = false;
            if (activeController === localController) {
              activeController = null;
            }
          }
        }
      }

      function scheduleReconnect(forceRefresh, delay) {
        if (isCancelled || isPermanentlyDisconnected || retryTimeout) return;

        retryTimeout = setTimeout(() => {
          retryTimeout = null;
          connectStream(forceRefresh);
        }, delay);
      }

      const checkHealthOrRecover = () => {
        if (isCancelled || isPermanentlyDisconnected) return;

        const now = Date.now();
        const isHealthy = status === 'connected' && (now - lastChunkReceivedAt < HEARTBEAT_IDLE_TIMEOUT_MS);
        if (isHealthy) return;

        // If another connection attempt is already in-flight, do not start another
        if (isConnectionInProgress) return;

        console.info(`[useConclaveLive] Browser active/online check: recovering stream for conclave ${conclaveId} (status: ${status})`);

        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }

        clearIdleWatchdog();
        notifyStatus('reconnecting');
        connectStream(false);
      };

      const close = () => {
        isCancelled = true;
        currentConnectionId++; // Invalidate all pending or active connections
        isConnectionInProgress = false;
        clearIdleWatchdog();
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        if (activeController) {
          try {
            activeController.abort();
          } catch { }
          activeController = null;
        }
      };

      stream = {
        subscribers,
        get status() {
          return status;
        },
        get isPermanentlyDisconnected() {
          return isPermanentlyDisconnected;
        },
        checkHealthOrRecover,
        close,
      };

      activeStreams.set(conclaveId, stream);
      notifyStatus('connecting');
      connectStream(false);
    } else {
      // Stream already exists: subscribe and immediately sync state
      stream.subscribers.add(onStatusChange);
      onStatusChange(stream.status);
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const active = activeStreams.get(conclaveId);
        active?.checkHealthOrRecover();
      }
    };

    const handleOnline = () => {
      const active = activeStreams.get(conclaveId);
      active?.checkHealthOrRecover();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }

      const active = activeStreams.get(conclaveId);
      if (!active) return;

      active.subscribers.delete(onStatusChange);
      if (active.subscribers.size === 0) {
        active.close();
        activeStreams.delete(conclaveId);
        queryClient.setQueryData(['sse-status', conclaveId], 'disconnected');
      }
    };
  }, [conclaveId, queryClient]);

  return {
    status: connectionStatus,
    isConnected: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    isReconnecting: connectionStatus === 'reconnecting',
    isDisconnected: connectionStatus === 'disconnected',
    isPermanentlyDisconnected: Boolean(activeStreams.get(conclaveId)?.isPermanentlyDisconnected),
  };
}
