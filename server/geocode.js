import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, ensureDataDirs } from './db.js';
import { resolveChina, matchCity, matchDistrict, loadGeo } from './geo.js';
import { wgs84ToGcj02, gcj02ToWgs84 } from './coords.js';

const CACHE_FILE = path.join(DATA_DIR, 'geocode-cache.json');
const UA = process.env.NOMINATIM_USER_AGENT || 'LumenAtlas/1.0 (personal travel photo atlas; contact: local-owner)';
let AMAP_KEY = process.env.AMAP_KEY || '';
let cache = null;
let cacheDirty = false;
let queue = Promise.resolve();
let lastCall = 0;

export function setAmapKey(key) {
  AMAP_KEY = String(key || process.env.AMAP_KEY || '').trim();
}

export function getAmapKey() { return AMAP_KEY; }

async function loadCache() {
  if (cache) return cache;
  await ensureDataDirs();
  try { cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); } catch { cache = { reverse: {}, search: {} }; }
  if (!cache.reverse) cache.reverse = {};
  if (!cache.search) cache.search = {};
  if (!cache.pois) cache.pois = {};
  return cache;
}

function scheduleSave() {
  cacheDirty = true;
  clearTimeout(scheduleSave.timer);
  scheduleSave.timer = setTimeout(async () => {
    if (!cacheDirty || !cache) return;
    cacheDirty = false;
    try { await fs.writeFile(CACHE_FILE, JSON.stringify(cache)); } catch {}
  }, 1200);
}

function serialized(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function throttle() {
  const wait = Math.max(0, 1150 - (Date.now() - lastCall));
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
}

async function nominatim(url) {
  await throttle();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

function shortName(address = {}) {
  return address.tourism || address.attraction || address.neighbourhood || address.suburb || address.quarter ||
    address.town || address.village || address.hamlet || address.road || address.county || address.city || address.state || '';
}

function normalizeResult(raw, lat, lng) {
  const a = raw.address || {};
  const countryCode = String(a.country_code || '').toLowerCase();
  return {
    lat: Number(raw.lat ?? lat),
    lng: Number(raw.lon ?? lng),
    country: a.country || '',
    countryCode,
    province: a.state || a.province || a.region || '',
    city: a.city || a.town || a.municipality || a.county || '',
    district: a.city_district || a.district || a.county || a.suburb || '',
    locationName: shortName(a),
    displayName: raw.display_name || '',
    road: a.road || '',
    postcode: a.postcode || '',
    source: 'nominatim',
  };
}

const asText = (v) => Array.isArray(v) ? '' : (v == null ? '' : String(v));

async function amapReverse(lat, lng) {
  if (!AMAP_KEY) return null;
  const [glng, glat] = wgs84ToGcj02(lng, lat);
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(AMAP_KEY)}&location=${glng.toFixed(6)},${glat.toFixed(6)}&extensions=base&radius=1000&roadlevel=0`;
  const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== '1' || !json.regeocode) return null;
  const rg = json.regeocode;
  const a = rg.addressComponent || {};
  const sn = Array.isArray(a.streetNumber) ? {} : (a.streetNumber || {});
  const province = asText(a.province);
  const city = asText(a.city);
  const district = asText(a.district);
  const township = asText(a.township);
  const street = asText(sn.street);
  const number = asText(sn.number);
  const spot = street
    ? `${street}${number ? ` ${number}` : ''}`
    : (township || (rg.pois?.[0]?.name) || district || city || province);
  return {
    province, city, district, township,
    locationName: spot,
    displayName: asText(rg.formatted_address) || [province, city, district, township, spot].filter(Boolean).join(' '),
    road: street,
    postcode: asText(a.postcode),
    adcode: asText(a.adcode),
  };
}

async function amapSearch(q) {
  if (!AMAP_KEY || !/[\u4e00-\u9fa5]/.test(q)) return null;
  const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(AMAP_KEY)}&keywords=${encodeURIComponent(q)}&offset=6&page=1&extensions=base&citylimit=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== '1' || !Array.isArray(json.pois)) return null;
  return json.pois.map(p => {
    const [glng, glat] = String(p.location || '').split(',').map(Number);
    if (!Number.isFinite(glng) || !Number.isFinite(glat)) return null;
    const [lng, lat] = gcj02ToWgs84(glng, glat);
    const province = asText(p.pname);
    const city = asText(p.cityname);
    const district = asText(p.adname);
    const detail = [province, city, district, asText(p.address)].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ');
    return {
      label: asText(p.name) || q,
      detail: detail || asText(p.address) || '',
      lat, lng,
      country: '中国', countryCode: 'cn',
      province, city, district,
      type: asText(p.type) || 'poi',
      source: 'amap',
    };
  }).filter(Boolean);
}

const POI_COLORS = {
  11: '#ffd178', // scenic
  14: '#a58cff', // culture / museum
  15: '#64f4ff', // transit
  6: '#ff8ea8', // shopping
  8: '#7df0ae', // park / sports
  10: '#8fb8ff', // hotel
  5: '#ffbd73', // dining
};
const POI_LABELS = { 11: '风景', 14: '文化', 15: '交通', 6: '购物', 8: '休闲', 10: '住宿', 5: '餐饮' };

export async function aroundPois(lat, lng, zoom = 13) {
  if (!AMAP_KEY) return [];
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return [];
  const z = Math.max(10, Math.min(Number(zoom) || 13, 18));
  const zoomBucket = Math.round(z * 2) / 2;
  const key = `${la.toFixed(3)},${ln.toFixed(3)},${zoomBucket}`;
  await loadCache();
  if (cache.pois[key]?.expiresAt > Date.now()) return cache.pois[key].data;
  const radius = z >= 16 ? 650 : z >= 15 ? 1200 : z >= 14 ? 2200 : z >= 13 ? 4000 : z >= 12 ? 6000 : 10000;
  const [glng, glat] = wgs84ToGcj02(ln, la);
  const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(AMAP_KEY)}&location=${glng.toFixed(6)},${glat.toFixed(6)}&radius=${radius}&types=110000%7C140000%7C150000%7C060000%7C080000%7C100000&offset=25&page=1&extensions=base&sortrule=distance`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== '1' || !Array.isArray(json.pois)) return [];
    const pois = json.pois.map(p => {
      const [plng, plat] = String(p.location || '').split(',').map(Number);
      if (!Number.isFinite(plng) || !Number.isFinite(plat)) return null;
      const [wLng, wLat] = gcj02ToWgs84(plng, plat);
      const typeCode = Number(String(p.typecode || '').slice(0, 2)) || 0;
      return {
        id: String(p.id || `${p.name}-${p.location}`),
        name: asText(p.name),
        address: asText(p.address),
        type: asText(p.type),
        typeCode,
        category: POI_LABELS[typeCode] || '地点',
        color: POI_COLORS[typeCode] || '#64f4ff',
        lat: wLat, lng: wLng,
        distance: Number(p.distance) || null,
      };
    }).filter(p => p && p.name);
    const unique = [...new Map(pois.map(p => [p.id, p])).values()];
    cache.pois[key] = { data: unique, expiresAt: Date.now() + 1000 * 60 * 30 };
    scheduleSave();
    return unique;
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
    throw new Error('无效坐标');
  }
  const key = `${la.toFixed(5)},${ln.toFixed(5)}`;
  await loadCache();
  if (cache.reverse[key]?.expiresAt > Date.now()) return { ...cache.reverse[key].data, cached: true };
  await loadGeo();

  let china = null;
  try { china = await resolveChina(la, ln); } catch {}

  let amap = null;
  let raw = null;
  if (china) {
    try { amap = await amapReverse(la, ln); } catch {}
  }
  if (!amap) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${la}&lon=${ln}&zoom=14&addressdetails=1&accept-language=zh-CN`;
      raw = await nominatim(url);
    } catch (e) {
      raw = null;
    }
  }

  let data;
  if (china && amap) {
    const province = amap.province || china.province;
    const cityName = amap.city || china.city || province;
    const districtName = amap.district || china.district;
    data = {
      lat: la, lng: ln,
      country: '中国', countryCode: 'cn',
      province, city: cityName, district: districtName,
      locationName: amap.locationName || districtName || cityName || province,
      displayName: amap.displayName || [province, cityName, districtName].filter(Boolean).join(' '),
      road: amap.road || '',
      postcode: amap.postcode || '',
      source: 'amap+datav',
    };
  } else if (china) {
    const addr = raw?.address || {};
    const city = matchCity(china.province, [addr.city, addr.town, addr.municipality, addr.county]) || null;
    const district = matchDistrict(city, [addr.city_district, addr.district, addr.county, addr.suburb, addr.town]);
    const province = china.province;
    const cityName = city?.name || china.city;
    const districtName = district?.name || china.district;
    const spot = shortName(addr);
    const generic = new Set([province, cityName, districtName, '中国', 'China', '中华人民共和国']);
    data = {
      lat: la, lng: ln,
      country: '中国', countryCode: 'cn',
      province, city: cityName, district: districtName,
      locationName: spot && !generic.has(spot) ? spot : (districtName || cityName || province),
      displayName: raw?.display_name || [province, cityName, districtName].filter(Boolean).join(' '),
      road: addr.road || '',
      postcode: addr.postcode || '',
      source: raw ? 'nominatim+datav' : 'datav',
    };
  } else if (raw && raw.address) {
    data = normalizeResult(raw, la, ln);
  } else {
    data = {
      lat: la, lng: ln, country: '', countryCode: '',
      province: '', city: '', district: '', locationName: '',
      displayName: `${la.toFixed(5)}, ${ln.toFixed(5)}`, road: '', postcode: '',
      source: 'coordinates',
    };
  }

  cache.reverse[key] = { data, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 120 };
  scheduleSave();
  return { ...data, cached: false };
}

export async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const key = q.toLowerCase();
  await loadCache();
  if (cache.search[key]?.expiresAt > Date.now()) return cache.search[key].data;
  try {
    let results = null;
    try { results = await amapSearch(q); } catch {}
    if (results?.length) {
      cache.search[key] = { data: results, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 };
      scheduleSave();
      return results;
    }
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6&addressdetails=1&accept-language=zh-CN`;
    const raw = await nominatim(url);
    results = raw.map(r => {
      const n = normalizeResult(r, r.lat, r.lon);
      return {
        label: n.locationName || n.city || n.province || n.country || q,
        detail: n.displayName,
        lat: n.lat, lng: n.lng,
        country: n.country, countryCode: n.countryCode,
        province: n.province, city: n.city, district: n.district,
        type: r.type || r.class || 'place',
      };
    });
    cache.search[key] = { data: results, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 };
    scheduleSave();
    return results;
  } catch {
    return [];
  }
}
