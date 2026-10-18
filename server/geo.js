import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GEO_DIR = path.join(ROOT, 'public', 'geo');

let regionData = null;
let provinceGeo = null;

export async function loadGeo() {
  if (!regionData) {
    regionData = JSON.parse(await fs.readFile(path.join(GEO_DIR, 'regions.json'), 'utf8'));
  }
  if (!provinceGeo) {
    provinceGeo = JSON.parse(await fs.readFile(path.join(GEO_DIR, 'china-provinces.json'), 'utf8'));
  }
  return { regions: regionData, provinces: provinceGeo };
}

export function getRegionsSync() { return regionData; }

const rad = d => d * Math.PI / 180;
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function ringContains(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function polygonContains(lng, lat, polygon) {
  if (!polygon?.length) return false;
  if (!ringContains(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (ringContains(lng, lat, polygon[i])) return false;
  return true;
}

function geometryContains(lng, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return polygonContains(lng, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(p => polygonContains(lng, lat, p));
  if (geometry.type === 'GeometryCollection') return geometry.geometries?.some(g => geometryContains(lng, lat, g));
  return false;
}

export function findChinaProvince(lat, lng) {
  if (!provinceGeo) return null;
  for (const f of provinceGeo.features) {
    if (geometryContains(lng, lat, f.geometry)) {
      return { name: f.properties.name, adcode: String(f.properties.adcode) };
    }
  }
  return null;
}

export function nearestCity(provinceName, lat, lng) {
  const province = regionData?.provinces.find(p => p.name === provinceName);
  if (!province) return { province: null, city: null, district: null };
  let city = null, best = Infinity;
  for (const c of province.cities) {
    if (!c.center) continue;
    const d = distanceKm(lat, lng, c.center[1], c.center[0]);
    if (d < best) { best = d; city = c; }
  }
  let district = null, dBest = Infinity;
  if (city) {
    for (const d of city.districts) {
      if (!d.center) continue;
      const km = distanceKm(lat, lng, d.center[1], d.center[0]);
      if (km < dBest) { dBest = km; district = d; }
    }
  }
  return { province, city, district };
}

const stripSuffix = s => String(s || '').replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|地区|省|市|区|县|旗|盟)$/u, '');

export function matchCity(provinceName, names = []) {
  const province = regionData?.provinces.find(p => p.name === provinceName);
  if (!province) return null;
  const normalized = names.filter(Boolean).map(stripSuffix);
  for (const city of province.cities) {
    if (names.includes(city.name) || normalized.includes(stripSuffix(city.name))) return city;
  }
  return null;
}

export function matchDistrict(city, names = []) {
  if (!city) return null;
  const normalized = names.filter(Boolean).map(stripSuffix);
  for (const district of city.districts) {
    if (names.includes(district.name) || normalized.includes(stripSuffix(district.name))) return district;
  }
  return null;
}

export async function resolveChina(lat, lng) {
  await loadGeo();
  const found = findChinaProvince(Number(lat), Number(lng));
  if (!found) return null;
  const near = nearestCity(found.name, Number(lat), Number(lng));
  return {
    country: '中国',
    countryCode: 'cn',
    province: found.name,
    provinceAdcode: found.adcode,
    city: near.city?.name || '',
    cityAdcode: near.city?.adcode || '',
    district: near.district?.name || '',
    districtAdcode: near.district?.adcode || '',
    center: near.district?.center || near.city?.center || near.province?.center || [Number(lng), Number(lat)],
    distanceToCityKm: near.city ? Math.round(distanceKm(Number(lat), Number(lng), near.city.center[1], near.city.center[0])) : null,
  };
}

export function lookupRegionCenter(provinceName, cityName, districtName) {
  if (!regionData) return null;
  const province = regionData.provinces.find(p => p.name === provinceName || p.adcode === provinceName);
  if (!province) return null;
  const city = province.cities.find(c => c.name === cityName || c.adcode === cityName) || null;
  const district = city?.districts.find(d => d.name === districtName || d.adcode === districtName) || null;
  return {
    province: province.name,
    city: city?.name || '',
    district: district?.name || '',
    center: district?.center || city?.center || province.center,
  };
}

export function regionIndex() {
  if (!regionData) return { provinces: [] };
  return regionData;
}
