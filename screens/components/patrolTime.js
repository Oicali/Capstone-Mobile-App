// screens/components/patrolTime.js
// Time helpers for "HH:MM" strings. PM shift runs 20:00 → 08:00, so times before 12:00 belong to the next day.

const pad = (n) => String(n).padStart(2, "0");

// "HH:MM" → minutes since midnight (null if empty)
export const toMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Comparison key: on the PM shift, early-morning times sort after the evening ones
export const shiftMin = (t, shift) => {
  const raw = toMin(t);
  if (raw === null) return null;
  return shift === "PM" && raw < 12 * 60 ? raw + 24 * 60 : raw;
};

// "HH:MM" plus minutes, wrapping past midnight
export const addMinutes = (t, mins) => {
  const total = (((toMin(t) + mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

// 12-hour display, e.g. "8:05 PM"
export const fmt12 = (t) => {
  if (!t) return "--:--";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};

// Date <-> "HH:MM" for the native picker
export const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const timeToDate = (t) => {
  const d = new Date();
  const [h, m] = (t || "08:00").split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

// Task problems: end not after start, or starting before the previous task ends
export const badRange = (t) => {
  const s = shiftMin(t.time_start, t.shift);
  const e = shiftMin(t.time_end, t.shift);
  return s !== null && e !== null && e <= s;
};
export const overlaps = (t, prev) =>
  !!prev &&
  shiftMin(t.time_start, t.shift) < shiftMin(prev.time_end, prev.shift);