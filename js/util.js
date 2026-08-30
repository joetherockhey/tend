/* ============================================================================
   Tend - util.js
   Small shared helpers. Loaded before everything else.
   ============================================================================ */

const Util = (function () {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dateToStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function todayStr() {
    return dateToStr(new Date());
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt)) return iso;
    return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || '#888888').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /* The calendar buckets tasks by an exact 'YYYY-MM-DD' key, so anything
     shaped even slightly differently - a timestamp, an unpadded month - lands
     in a bucket no square ever asks for and silently disappears. Everything
     that carries a date goes through here first.

     Deliberately conservative: shapes that cannot be read unambiguously (a
     slash date could be day-first or month-first) are handed back untouched
     rather than guessed at. */
  function toIsoDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value) ? null : dateToStr(value);
    }

    const raw = String(value).trim();
    if (!raw) return null;

    /* Already right. */
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    /* '2026-8-4', or any ISO string with a time on the end. Taken apart by
       hand rather than through Date, which would shift the day across a
       timezone. */
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(raw);
    if (m) {
      return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    }

    /* A written date such as 'Aug 4, 2026'. Slash dates are left alone. */
    if (!raw.includes('/')) {
      const d = new Date(raw);
      if (!isNaN(d)) return dateToStr(d);
    }

    return raw;
  }

  /* A darker version of a colour, for text that has to stay readable on a
     pale tint of the same colour. Mixes towards the page's ink rather than
     towards black, so it never looks muddy. */
  function inkShade(hex, amount) {
    const h = String(hex || '#888888').replace('#', '');
    const mix = (c, target) => Math.round(c + (target - c) * amount);
    const r = mix(parseInt(h.substring(0, 2), 16), 0x1f);
    const g = mix(parseInt(h.substring(2, 4), 16), 0x24);
    const b = mix(parseInt(h.substring(4, 6), 16), 0x30);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /* Deterministic id that survives a round trip through the database. */
  function uid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* Stable colour from a string, for account avatars. */
  function colorFor(str) {
    const palette = ['#7536ff', '#0f9d6a', '#2a78d6', '#e87ba4', '#eb6834', '#eda100', '#16a085', '#8e44ad'];
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return palette[Math.abs(h) % palette.length];
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = function () {
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(null, args); }, ms);
    };
    wrapped.flush = function () {
      if (t) { clearTimeout(t); t = null; fn(); }
    };
    wrapped.pending = function () { return t !== null; };
    return wrapped;
  }

  return {
    escapeHtml, dateToStr, todayStr, formatDate,
    hexToRgba, inkShade, toIsoDate, uid, initials, colorFor, debounce
  };
})();
