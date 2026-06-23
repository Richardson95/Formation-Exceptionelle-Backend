/**
 * Human-readable "x minutes ago" label from a Date/ISO string.
 */
export function relativeTime(from, now = Date.now()) {
  const then = from instanceof Date ? from.getTime() : new Date(from).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 1 ? 'just now' : `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? '1 day ago' : `${day} days ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return week === 1 ? '1 week ago' : `${week} weeks ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? '1 month ago' : `${month} months ago`;
  const year = Math.floor(day / 365);
  return year === 1 ? '1 year ago' : `${year} years ago`;
}

/** Format a Date as 'YYYY-MM-DD'. */
export function dateOnly(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

/** Format seconds as 'mm:ss' or 'h:mm:ss'. */
export function durationLabel(totalSeconds = 0) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}
