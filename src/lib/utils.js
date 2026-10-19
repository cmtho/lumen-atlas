export const cx = (...args) => args.filter(Boolean).join(' ');

export function regionKey(p) {
  const parts = [p.countryCode || p.country, p.province, p.city, p.district].filter(Boolean);
  if (parts.length) return parts.join('|');
  if (p.locationName) return `spot:${p.locationName}`;
  return `geo:${Number(p.lat).toFixed(2)},${Number(p.lng).toFixed(2)}`;
}

export function placeLabel(p, { country = false } = {}) {
  const china = p.countryCode === 'cn' || p.country === '中国';
  const pieces = [];
  if (!china) {
    if (p.country) pieces.push(p.country);
    if (p.province && p.province !== p.country) pieces.push(p.province);
    if (p.city && p.city !== p.province) pieces.push(p.city);
    if (p.district && p.district !== p.city) pieces.push(p.district);
  } else {
    if (country) pieces.push('中国');
    if (p.province) pieces.push(p.province);
    if (p.city && p.city !== p.province) pieces.push(p.city);
    if (p.district && p.district !== p.city) pieces.push(p.district);
  }
  return pieces.join(' · ') || p.locationName || '未命名坐标';
}

export function shortPlace(p) {
  const pieces = [];
  if (p.country && p.countryCode !== 'cn' && p.country !== '中国') pieces.push(p.country);
  if (p.city && p.city !== p.province) pieces.push(p.city);
  else if (p.province) pieces.push(p.province);
  if (p.district && p.district !== p.city) pieces.push(p.district);
  return pieces.join(' · ') || p.locationName || '未命名坐标';
}

export function buildPlaces(photos) {
  const map = new Map();
  for (const p of photos || []) {
    if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) continue;
    const key = regionKey(p);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        label: placeLabel(p),
        short: shortPlace(p),
        country: p.country || '',
        countryCode: p.countryCode || '',
        province: p.province || '',
        city: p.city || '',
        district: p.district || '',
        locationName: p.locationName || '',
        photos: [],
        lats: [],
        lngs: [],
      };
      map.set(key, entry);
    }
    entry.photos.push(p);
    entry.lats.push(Number(p.lat));
    entry.lngs.push(Number(p.lng));
  }
  const places = [];
  for (const entry of map.values()) {
    entry.photos.sort((a, b) => photoSortValue(b) - photoSortValue(a));
    entry.cover = entry.photos[0];
    entry.count = entry.photos.length;
    entry.lat = entry.lats.reduce((a, b) => a + b, 0) / entry.lats.length;
    entry.lng = entry.lngs.reduce((a, b) => a + b, 0) / entry.lngs.length;
    entry.people = [...new Set(entry.photos.flatMap(p => p.personIds || []))];
    entry.lastVisit = photoDisplayDate(entry.photos[0]);
    entry.firstVisit = photoDisplayDate(entry.photos[entry.photos.length - 1]);
    entry.years = [...new Set(entry.photos.map(photoYear).filter(Boolean))];
    const minLat = Math.min(...entry.lats), maxLat = Math.max(...entry.lats);
    const minLng = Math.min(...entry.lngs), maxLng = Math.max(...entry.lngs);
    entry.bounds = entry.count > 1 && (maxLat - minLat > .001 || maxLng - minLng > .001)
      ? [[minLng, minLat], [maxLng, maxLat]] : null;
    entry.zoom = entry.count > 1 ? 9 : 11;
    places.push(entry);
  }
  return places.sort((a, b) => (wallSortValue(b.lastVisit) ?? 0) - (wallSortValue(a.lastVisit) ?? 0));
}

export function personMap(people) {
  return new Map((people || []).map(p => [p.id, p]));
}

function wallParts(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const parts = {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6] || 0),
  };
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (d.getUTCFullYear() !== parts.year || d.getUTCMonth() !== parts.month - 1 || d.getUTCDate() !== parts.day ||
      d.getUTCHours() !== parts.hour || d.getUTCMinutes() !== parts.minute || d.getUTCSeconds() !== parts.second) return null;
  return parts;
}

function wallDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

function wallSortValue(value) {
  const parts = wallParts(value);
  return parts ? wallDate(parts).getTime() : null;
}

export function photoDisplayDate(photo) {
  return photo?.capturedLocal || photo?.capturedAt || null;
}

export function photoSortValue(photo) {
  const at = Date.parse(photo?.capturedAt || '');
  if (Number.isFinite(at)) return at;
  return wallSortValue(photo?.capturedLocal) ?? 0;
}

export function photoYear(photo) {
  const parts = wallParts(photo?.capturedLocal);
  if (parts) return parts.year;
  return yearOf(photo?.capturedAt);
}

export function photoDateInput(photo) {
  const local = photo?.capturedLocal;
  const parts = wallParts(local);
  if (parts) {
    const pad = n => String(n).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
  }
  return dateInputValue(photo?.capturedAt);
}

export function formatPhotoDate(photo, opts = {}) {
  return formatDate(photoDisplayDate(photo), opts);
}

export function formatPhotoDateDots(photo) {
  return formatDateDots(photoDisplayDate(photo));
}

export function formatPhotoDateTime(photo) {
  return formatDateTime(photoDisplayDate(photo));
}

export function formatDate(value, opts = {}) {
  if (!value) return '未知日期';
  const parts = wallParts(value);
  if (parts) return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', ...opts, timeZone: 'UTC' }).format(wallDate(parts));
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '未知日期';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', ...opts }).format(d);
}

export function formatDateDots(value) {
  if (!value) return '—';
  const parts = wallParts(value);
  if (parts) return `${parts.year}.${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const parts = wallParts(value);
  if (parts) return `${parts.year}.${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateInputValue(value) {
  if (!value) return '';
  const parts = wallParts(value);
  if (parts) return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function yearOf(value) {
  const parts = wallParts(value);
  if (parts) return parts.year;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

export function dateRange(photos) {
  if (!photos?.length) return '—';
  const sorted = [...photos].sort((a, b) => photoSortValue(a) - photoSortValue(b));
  const a = photoYear(sorted[0]);
  const b = photoYear(sorted[sorted.length - 1]);
  if (a === b) return String(a);
  return `${a} — ${b}`;
}

export function initials(name) {
  if (!name) return '?';
  const trimmed = String(name).trim();
  if (/[\u4e00-\u9fa5]/.test(trimmed)) return trimmed.slice(0, 1);
  return trimmed.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
}

export function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Number(bytes), i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function parseTags(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
}

export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

export function avatarGradient(color, angle = 140) {
  return `linear-gradient(${angle}deg, ${color || '#65f4ff'}, ${color ? color + '55' : '#8d7cff'} 90%)`;
}

export function sortByDateDesc(a, b, key = 'capturedAt') {
  return new Date(b[key] || 0) - new Date(a[key] || 0);
}
