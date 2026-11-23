// save.js — Solmar Bay save slot in localStorage (no network, no files).
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
