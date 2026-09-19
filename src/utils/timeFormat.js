/**
 * Comprehensive time formatting utilities ensuring consistent 12-hour AM/PM formats
 * across Member, Captain, and Admin interfaces.
 */

export const formatTimeNice = (val, fallback = '') => {
  if (!val) return fallback;
  if (typeof val === 'object') {
    if (typeof val._seconds === 'number') {
      const d = new Date(val._seconds * 1000);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = match[2];
      let meridian = match[3] ? match[3].toUpperCase() : null;
      if (!meridian) {
        meridian = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
      } else {
        hours = hours % 12 || 12;
      }
      return `${String(hours).padStart(2, '0')}:${mins} ${meridian}`;
    }
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return String(val);
};

export const formatTimeRangeNice = (rangeStr, fallback = '') => {
  if (!rangeStr) return fallback;
  if (typeof rangeStr !== 'string') return formatTimeNice(rangeStr, fallback);
  const parts = rangeStr.split(/\s*[-–—]\s*/);
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${formatTimeNice(parts[0])} – ${formatTimeNice(parts[1])}`;
  }
  return formatTimeNice(rangeStr, fallback);
};

export function parseTimeStringToDate(timeStr, baseDate = new Date()) {
  if (!timeStr) return null;
  if (typeof timeStr === 'object') {
    if (typeof timeStr._seconds === 'number') return new Date(timeStr._seconds * 1000);
    if (typeof timeStr.seconds === 'number') return new Date(timeStr.seconds * 1000);
    if (typeof timeStr.toDate === 'function') return timeStr.toDate();
  }
  const trimmed = String(timeStr).trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const meridian = match[3] ? match[3].toUpperCase() : null;
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    const d = new Date(baseDate);
    d.setHours(hours, mins, 0, 0);
    return d;
  }
  const d = new Date(timeStr);
  return isNaN(d.getTime()) ? null : d;
}

export function getAdjustedUpcomingRoundDate(timeStr, now = new Date()) {
  const startDate = parseTimeStringToDate(timeStr, now);
  if (!startDate) return null;

  const fiveMinMs = 5 * 60 * 1000;
  if (now.getTime() >= startDate.getTime()) {
    const elapsedMs = now.getTime() - startDate.getTime();
    const increments = Math.floor(elapsedMs / fiveMinMs) + 1;
    return new Date(startDate.getTime() + increments * fiveMinMs);
  }
  return startDate;
}

/**
 * Ensures upcoming round start times always roll forward by 5 minutes
 * whenever the round has not started after its scheduled time completes.
 */
export function formatUpcomingRoundStartTime(timeStr, fallback = 'Upcoming') {
  if (!timeStr) return fallback;
  const startPart = String(timeStr).split(/\s*[-–—]\s*/)[0];
  const adjusted = getAdjustedUpcomingRoundDate(startPart, new Date());
  if (!adjusted) return formatTimeNice(startPart, fallback);
  return formatTimeNice(adjusted, fallback);
}

/**
 * Ensures upcoming round 15-minute range always rolls forward by 5 minutes
 * whenever the round has not started after its scheduled time completes.
 */
export function formatUpcomingRoundRange(rangeStr, fallback = 'Upcoming', durationMins = 15) {
  if (!rangeStr) return fallback;
  const startPart = String(rangeStr).split(/\s*[-–—]\s*/)[0];
  const adjusted = getAdjustedUpcomingRoundDate(startPart, new Date());
  if (!adjusted) return formatTimeRangeNice(rangeStr, fallback);
  const end = new Date(adjusted.getTime() + durationMins * 60 * 1000);
  return `${formatTimeNice(adjusted)} – ${formatTimeNice(end)}`;
}
