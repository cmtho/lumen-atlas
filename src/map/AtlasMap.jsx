import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle, mapPalette } from './style.js';
import { Compass, LocateFixed, Map as MapIcon, Minus, Plus, Orbit } from 'lucide-react';
import AmapView from './AmapView.jsx';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../lib/coords.js';
import { photoDisplayDate, photoSortValue } from '../lib/utils.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

function graticule() {
  const features = [];
  for (let lat = -80; lat <= 80; lat += 20) {
    const coords = [];
    for (let lng = -180; lng <= 180; lng += 6) coords.push([lng, lat]);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  }
  for (let lng = -180; lng < 180; lng += 20) {
    const coords = [];
    for (let lat = -84; lat <= 84; lat += 4) coords.push([lng, lat]);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  }
  return { type: 'FeatureCollection', features };
}

function provincePoints(geo) {
  const features = [];
  for (const f of geo?.features || []) {
    const p = f.properties || {};
    const c = p.centroid || p.center;
    if (!Array.isArray(c) || !p.name) continue;
    features.push({ type: 'Feature', properties: { name: p.name, adcode: String(p.adcode) }, geometry: { type: 'Point', coordinates: c } });
  }
  return { type: 'FeatureCollection', features };
}

function stripAdminSuffix(name) {
  return String(name || '').replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|自治州|地区|市|省|区|县|旗|盟)$/u, '');
}

function nameSet(regions, cityGeo) {
  const cities = new Set();
  const districts = new Set();
  const add = (set, name) => {
    if (!name) return;
    set.add(name);
    const short = stripAdminSuffix(name);
    if (short && short.length >= 2) set.add(short);
  };
  for (const f of cityGeo?.features || []) add(cities, f.properties?.name);
  for (const province of regions?.provinces || []) {
    for (const city of province.cities || []) {
      add(cities, city.name);
      for (const district of city.districts || []) add(districts, district.name);
    }
  }
  return { cities: [...cities], districts: [...districts] };
}

function cityPoints(geo) {
  const features = [];
  for (const f of geo?.features || []) {
    const p = f.properties || {};
    const c = p.centroid;
    if (!Array.isArray(c) || !p.name) continue;
    features.push({
      type: 'Feature',
      properties: { name: p.name, adcode: String(p.adcode), province: p.province || '' },
      geometry: { type: 'Point', coordinates: c },
    });
  }
  return { type: 'FeatureCollection', features };
}

function districtPoints(geo) {
  const features = [];
  for (const f of geo?.features || []) {
    const p = f.properties || {};
    const c = p.centroid;
    if (!Array.isArray(c) || !p.name) continue;
    features.push({
      type: 'Feature',
      properties: { name: p.name, adcode: String(p.adcode), city: p.city || '' },
      geometry: { type: 'Point', coordinates: c },
    });
  }
  return { type: 'FeatureCollection', features };
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

function featureAt(geo, lng, lat) {
  for (const f of geo?.features || []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon' && g.coordinates?.[0]?.length) {
      if (ringContains(lng, lat, g.coordinates[0])) return f;
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) {
        if (poly?.[0]?.length && ringContains(lng, lat, poly[0])) return f;
      }
    }
  }
  return null;
}

function cityAt(geo, lng, lat) {
  for (const f of geo?.features || []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon' && g.coordinates?.[0]?.length) {
      if (ringContains(lng, lat, g.coordinates[0])) return f;
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) {
        if (poly?.[0]?.length && ringContains(lng, lat, poly[0])) return f;
      }
    }
  }
  return null;
}

function photoData(photos) {
  const features = [];
  for (const p of photos || []) {
    if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) continue;
    features.push({
      type: 'Feature',
      properties: {
        id: p.id,
        title: p.title || '',
        thumb: p.thumb || '',
        place: [p.city, p.district].filter(Boolean).join(' · ') || p.province || p.country || '',
        date: photoDisplayDate(p) || '',
        person: p.personIds?.length || 0,
      },
      geometry: { type: 'Point', coordinates: [Number(p.lng), Number(p.lat)] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function journeyData(photos) {
  const sorted = [...(photos || [])]
    .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
    .sort((a, b) => photoSortValue(a) - photoSortValue(b));
  if (sorted.length < 2) return EMPTY;
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: sorted.map(p => [Number(p.lng), Number(p.lat)]) },
  };
}

function makeUserMarkerElement() {
  const el = document.createElement('div');
  el.className = 'lumen-user-marker';
  el.innerHTML = '<span class="lumen-user-pulse"></span><span class="lumen-user-dot"></span>';
  return el;
}

function paintUserMarker(el, location) {
  const heading = Number(location?.heading);
  el.style.setProperty('--bearing', `${Number.isFinite(heading) ? heading : 0}deg`);
  const accuracy = Math.min(96, Math.max(34, Number(location?.accuracy) || 40));
  el.style.setProperty('--accuracy', `${accuracy}px`);
}

function makePlaceMarkerElement(label) {
  const el = document.createElement('div');
  el.className = 'lumen-native-place';
  const dot = document.createElement('span');
  const text = document.createElement('em');
  text.textContent = label || '地图位置';
  el.append(dot, text);
  return el;
}

export default function AtlasMap({ theme, photos, selectedId, focus, regions, onPhotoOpen, onProvinceClick, onCityClick, onDistrictClick, onNotice, onMapReady, pickMode, onPick, provider = 'libre', setProvider, amapKey = '', userLocation = null, nativePlace = null }) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const amapRef = useRef(null);
  const amapLastViewRef = useRef(null);
  const amapPoiDataRef = useRef(EMPTY);
  const amapPoiCacheRef = useRef(new Map());
  const amapPoiKeyRef = useRef('');
  const amapPoiTokenRef = useRef(0);
  const providerRef = useRef(provider);
  const mapCenterRef = useRef({ lng: 104.2, lat: 35.8 });
  const mapZoomRef = useRef(2.25);
  const prevProviderRef = useRef(provider);
  const [ready, setReady] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [zoom, setZoom] = useState(2.25);
  const [cursor, setCursor] = useState({ lng: 104.2, lat: 35.8 });
  const [adminHover, setAdminHover] = useState('');
  const dataRef = useRef({ photos, selectedId });
  const callbacksRef = useRef({ onPhotoOpen, onProvinceClick, onCityClick, onDistrictClick, onNotice, onPick });
  const pickRef = useRef({ pickMode, onPick });
  const themeRef = useRef(theme);
  const regionsRef = useRef(regions);
  const provinceGeoRef = useRef(null);
  const cityGeoRef = useRef(null);
  const districtCacheRef = useRef(new Map());
  const districtFailedRef = useRef(new Set());
  const currentDistrictRef = useRef(null);
  const districtDataRef = useRef(EMPTY);
  const districtLabelRef = useRef(EMPTY);
  const hoverProvince = useRef(null);
  const hoverCity = useRef(null);
  const hoverDistrict = useRef(null);
  const adminHoverRef = useRef('');
  const lastHoverCalcRef = useRef(0);
  const userMarkerRef = useRef(null);
  const nativePlaceMarkerRef = useRef(null);

  dataRef.current = { photos, selectedId };
  callbacksRef.current = { onPhotoOpen, onProvinceClick, onCityClick, onDistrictClick, onNotice, onPick };
  pickRef.current = { pickMode, onPick };
  themeRef.current = theme;
  regionsRef.current = regions;
  providerRef.current = provider;

  function updateData(map) {
    if (!map?.getSource('photos')) return;
    const { photos: list, selectedId: sid } = dataRef.current;
    map.getSource('photos')?.setData(photoData(list));
    map.getSource('journey')?.setData(journeyData(list));
    if (map.getLayer('photo-point-active')) {
      map.setFilter('photo-point-active', ['==', ['get', 'id'], sid || '__none__']);
    }
  }

  function applyDistrictData(map, adcode, data) {
    currentDistrictRef.current = adcode;
    districtDataRef.current = data;
    districtLabelRef.current = districtPoints(data);
    if (!map) return;
    map.getSource('china-districts')?.setData(data);
    map.getSource('china-district-labels')?.setData(districtLabelRef.current);
  }

  async function loadDistricts(map, adcode) {
    if (!adcode) return;
    const id = String(adcode);
    if (currentDistrictRef.current === id) return;
    if (districtFailedRef.current.has(id)) {
      currentDistrictRef.current = id;
      applyDistrictData(map, id, EMPTY);
      return;
    }
    if (districtCacheRef.current.has(id)) {
      applyDistrictData(map, id, districtCacheRef.current.get(id));
      return;
    }
    currentDistrictRef.current = id;
    try {
      const res = await fetch(`/geo/china-districts/${id}.json`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      districtCacheRef.current.set(id, data);
      if (currentDistrictRef.current === id) applyDistrictData(map, id, data);
    } catch {
      districtFailedRef.current.add(id);
      districtCacheRef.current.set(id, EMPTY);
      if (currentDistrictRef.current === id) applyDistrictData(map, id, EMPTY);
    }
  }

  function syncDistricts(map, force = false) {
    if (!map || !map.isStyleLoaded() || !cityGeoRef.current) return;
    if (map.getZoom() < 6.9) return;
    const center = map.getCenter();
    const city = cityAt(cityGeoRef.current, center.lng, center.lat);
    if (!city) {
      if (force || currentDistrictRef.current) applyDistrictData(map, null, EMPTY);
      return;
    }
    const id = String(city.properties.adcode);
    if (force && currentDistrictRef.current !== id) currentDistrictRef.current = null;
    loadDistricts(map, id);
  }

  function updateAmapPoiSource(map, pois) {
    const features = (pois || []).map(p => ({
      type: 'Feature',
      properties: { ...p },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    }));
    amapPoiDataRef.current = { type: 'FeatureCollection', features };
    map.getSource('amap-pois')?.setData(amapPoiDataRef.current);
    const hideOsm = features.length >= 5;
    for (const id of ['poi-dot', 'poi-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', hideOsm ? 'none' : 'visible');
    }
  }

  async function refreshAmapPois(map, force = false) {
    if (!map || !map.isStyleLoaded() || providerRef.current === 'amap') return;
    if (map.getZoom() < 11.8) {
      amapPoiKeyRef.current = '';
      updateAmapPoiSource(map, []);
      return;
    }
    const c = map.getCenter();
    const z = Math.round(map.getZoom() * 2) / 2;
    const key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${z}`;
    if (!force && key === amapPoiKeyRef.current) return;
    amapPoiKeyRef.current = key;
    if (amapPoiCacheRef.current.has(key)) {
      updateAmapPoiSource(map, amapPoiCacheRef.current.get(key));
      return;
    }
    const token = ++amapPoiTokenRef.current;
    try {
      const res = await fetch(`/api/amap/pois?lat=${c.lat}&lng=${c.lng}&zoom=${map.getZoom()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (token !== amapPoiTokenRef.current) return;
      const pois = json.pois || [];
      amapPoiCacheRef.current.set(key, pois);
      updateAmapPoiSource(map, pois);
    } catch {}
  }

  function addLayers(map) {
    if (map.getSource('photos')) return;
    const c = mapPalette[themeRef.current] || mapPalette.dark;
    map.setProjection({ type: 'globe' });

    map.addSource('graticule', { type: 'geojson', data: graticule() });
    map.addSource('provinces', { type: 'geojson', data: provinceGeoRef.current, promoteId: 'adcode' });
    map.addSource('province-labels', { type: 'geojson', data: provincePoints(provinceGeoRef.current) });
    map.addSource('china-cities', { type: 'geojson', data: cityGeoRef.current || EMPTY, promoteId: 'adcode' });
    map.addSource('china-city-labels', { type: 'geojson', data: cityPoints(cityGeoRef.current) });
    map.addSource('china-districts', { type: 'geojson', data: districtDataRef.current, promoteId: 'adcode' });
    map.addSource('china-district-labels', { type: 'geojson', data: districtLabelRef.current });
    map.addSource('amap-pois', { type: 'geojson', data: amapPoiDataRef.current });
    map.addSource('photos', {
      type: 'geojson',
      data: photoData(dataRef.current.photos),
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 48,
    });
    map.addSource('journey', { type: 'geojson', data: journeyData(dataRef.current.photos) });
    map.addSource('pick', { type: 'geojson', data: EMPTY });

    map.addLayer({
      id: 'graticule', type: 'line', source: 'graticule',
      paint: {
        'line-color': c.graticule,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, .22, 3, .13, 6, .04],
        'line-width': .5,
        'line-dasharray': [1, 4],
      },
    });

    map.addLayer({
      id: 'province-fill', type: 'fill', source: 'provinces', minzoom: 2.15,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], c.accent,
          ['boolean', ['feature-state', 'active'], false], c.accent2,
          c.accent,
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2.15, 0, 4, .032, 8, .016],
      },
    });
    map.addLayer({
      id: 'province-glow', type: 'line', source: 'provinces', minzoom: 2.15,
      paint: { 'line-color': c.accent, 'line-width': 5, 'line-blur': 6, 'line-opacity': .17 },
    });
    map.addLayer({
      id: 'province-line', type: 'line', source: 'provinces', minzoom: 2.15,
      paint: {
        'line-color': c.accent,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2.15, .35, 6, .8, 11, 1.2],
        'line-opacity': .62,
      },
    });
    map.addLayer({
      id: 'province-label', type: 'symbol', source: 'province-labels', minzoom: 2.9,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2.9, 9, 7, 11, 12, 13],
        'text-letter-spacing': .16,
        'text-max-width': 7,
        'text-padding': 8,
      },
      paint: {
        'text-color': c.accent,
        'text-halo-color': c.halo,
        'text-halo-width': 1.4,
        'text-halo-blur': 1.4,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 2.9, 0, 3.6, .72, 7, .88, 10, .28],
      },
    });

    map.addLayer({
      id: 'china-city-fill', type: 'fill', source: 'china-cities', minzoom: 3.8,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], c.warm,
          c.accent,
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          3.8, ['case', ['boolean', ['feature-state', 'hover'], false], 0.055, 0.006],
          6, ['case', ['boolean', ['feature-state', 'hover'], false], 0.075, 0.014],
          9, ['case', ['boolean', ['feature-state', 'hover'], false], 0.03, 0.005],
        ],
      },
    });
    map.addLayer({
      id: 'china-city-glow', type: 'line', source: 'china-cities', minzoom: 3.8,
      paint: {
        'line-color': c.accent,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.8, 2, 8, 4],
        'line-blur': 5,
        'line-opacity': 0.10,
      },
    });
    map.addLayer({
      id: 'china-city-line', type: 'line', source: 'china-cities', minzoom: 3.8,
      paint: {
        'line-color': c.accent,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.8, 0.3, 7, 0.6, 11, 1.1],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.8, 0.18, 6, 0.42, 11, 0.55],
      },
    });
    map.addLayer({
      id: 'china-city-label', type: 'symbol', source: 'china-city-labels', minzoom: 4.4,
      filter: ['!=', ['get', 'name'], ['get', 'province']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4.4, 9.5, 7, 11, 10, 13],
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
        'text-padding': 7,
      },
      paint: {
        'text-color': c.textStrong,
        'text-halo-color': c.halo,
        'text-halo-width': 1.4,
        'text-halo-blur': 1.4,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 4.4, 0, 5.2, 0.78, 8, 0.9, 11, 0.45],
      },
    });
    map.addLayer({
      id: 'china-district-fill', type: 'fill', source: 'china-districts', minzoom: 7.1,
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], c.warm,
          c.accent2,
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          7.1, ['case', ['boolean', ['feature-state', 'hover'], false], 0.07, 0.01],
          10, ['case', ['boolean', ['feature-state', 'hover'], false], 0.1, 0.028],
          14, ['case', ['boolean', ['feature-state', 'hover'], false], 0.055, 0.012],
        ],
      },
    });
    map.addLayer({
      id: 'china-district-glow', type: 'line', source: 'china-districts', minzoom: 7.1,
      paint: {
        'line-color': c.accent2,
        'line-width': 6,
        'line-blur': 7,
        'line-opacity': 0.11,
      },
    });
    map.addLayer({
      id: 'china-district-line', type: 'line', source: 'china-districts', minzoom: 7.1,
      paint: {
        'line-color': c.accent2,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7.1, 0.45, 11, 0.9, 15, 1.3],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7.1, 0.35, 9.5, 0.68, 15, 0.52],
        'line-dasharray': [2, 1.5],
      },
    });
    map.addLayer({
      id: 'china-district-label', type: 'symbol', source: 'china-district-labels', minzoom: 8.0,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9.5, 12, 11.5, 16, 12.5],
        'text-letter-spacing': 0.06,
        'text-max-width': 7,
        'text-padding': 9,
      },
      paint: {
        'text-color': c.accent2,
        'text-halo-color': c.halo,
        'text-halo-width': 1.2,
        'text-halo-blur': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.8, 0.86, 15, 0.92],
      },
    });

    map.addLayer({
      id: 'amap-poi-dot', type: 'circle', source: 'amap-pois', minzoom: 11.8,
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11.8, 2.2, 15, 4.2, 18, 5.5],
        'circle-opacity': .95,
        'circle-stroke-color': c.halo,
        'circle-stroke-width': 1.1,
        'circle-stroke-opacity': .75,
      },
    });
    map.addLayer({
      id: 'amap-poi-label', type: 'symbol', source: 'amap-pois', minzoom: 12.6,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12.6, 8, 16, 10.5, 19, 11.5],
        'text-offset': [0, .85],
        'text-anchor': 'top',
        'text-max-width': 7,
        'text-padding': 3,
        'text-optional': true,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': c.halo,
        'text-halo-width': 1.1,
        'text-halo-blur': .8,
        'text-opacity': .9,
      },
    });

    map.addLayer({
      id: 'journey-glow', type: 'line', source: 'journey',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.accent2,
        'line-width': 7,
        'line-blur': 8,
        'line-opacity': .16,
      },
    });
    map.addLayer({
      id: 'journey-line', type: 'line', source: 'journey',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.accent,
        'line-width': 1.1,
        'line-opacity': .42,
        'line-dasharray': [1.5, 3],
      },
    });

    map.addLayer({
      id: 'photo-cluster-glow', type: 'circle', source: 'photos',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': c.accent,
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 22, 12, 40, 30, 56],
        'circle-blur': 1,
        'circle-opacity': .18,
      },
    });
    map.addLayer({
      id: 'photo-cluster', type: 'circle', source: 'photos',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': themeRef.current === 'dark' ? 'rgba(6,20,32,.72)' : 'rgba(246,253,255,.78)',
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 13, 12, 18, 30, 24],
        'circle-stroke-color': c.accent,
        'circle-stroke-width': 1.1,
        'circle-stroke-opacity': .85,
      },
    });
    map.addLayer({
      id: 'photo-cluster-count', type: 'symbol', source: 'photos',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.textStrong, 'text-halo-color': c.halo, 'text-halo-width': .6 },
    });
    map.addLayer({
      id: 'photo-glow', type: 'circle', source: 'photos',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': c.accent,
        'circle-radius': 13,
        'circle-blur': 1,
        'circle-opacity': .45,
      },
    });
    map.addLayer({
      id: 'photo-point', type: 'circle', source: 'photos',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': c.textStrong,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 8, 4, 14, 5.5],
        'circle-stroke-color': c.accent,
        'circle-stroke-width': 1.5,
        'circle-opacity': 1,
      },
    });
    map.addLayer({
      id: 'photo-point-active', type: 'circle', source: 'photos',
      filter: ['==', ['get', 'id'], dataRef.current.selectedId || '__none__'],
      paint: {
        'circle-color': c.warm,
        'circle-radius': 9,
        'circle-stroke-color': themeRef.current === 'dark' ? '#fff8df' : '#7c4a00',
        'circle-stroke-width': 2,
        'circle-opacity': 1,
      },
    });

    map.addLayer({
      id: 'pick-ring', type: 'circle', source: 'pick',
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 16,
        'circle-stroke-color': c.warm,
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': .9,
      },
    });
    map.addLayer({
      id: 'pick-dot', type: 'circle', source: 'pick',
      paint: { 'circle-color': c.warm, 'circle-radius': 4 },
    });

    const adminNames = nameSet(regionsRef.current, cityGeoRef.current);
    if (map.getLayer('place-city')) {
      map.setFilter('place-city', [
        'all',
        ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        ['<=', ['coalesce', ['get', 'rank'], 99], 8],
        ['!', ['in', ['coalesce', ['get', 'name:zh'], ['get', 'name']], ['literal', adminNames.cities]]],
      ]);
    }
    if (map.getLayer('place-suburb')) {
      map.setFilter('place-suburb', [
        'all',
        ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']]],
        ['!', ['in', ['coalesce', ['get', 'name:zh'], ['get', 'name']], ['literal', adminNames.districts]]],
      ]);
    }

    updateAmapPoiSource(map, amapPoiDataRef.current.features.map(f => f.properties));
    updateData(map);
  }

  useEffect(() => {
    let disposed = false;
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: buildMapStyle(theme),
      center: [100, 34],
      zoom: 2.25,
      minZoom: 0.7,
      maxZoom: 19,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      fadeDuration: 180,
      renderWorldCopies: true,
    });
    mapRef.current = map;
    window.__lumenMap = map;
    map.on('error', (e) => {
      console.warn('[map]', e?.error?.message || e);
    });
    map.on('style.load', async () => {
      try {
        if (!provinceGeoRef.current) {
          try { provinceGeoRef.current = await (await fetch('/geo/china-provinces.json')).json(); }
          catch { provinceGeoRef.current = EMPTY; }
        }
        if (!cityGeoRef.current) {
          try { cityGeoRef.current = await (await fetch('/geo/china-cities.json')).json(); }
          catch { cityGeoRef.current = EMPTY; }
        }
        if (disposed) return;
        addLayers(map);
        setReady(true);
        syncDistricts(map, true);
        refreshAmapPois(map, true);
        onMapReady?.();
      } catch (e) {
        console.warn('[map:province]', e);
      }
    });
    map.on('load', () => {
      setReady(true);
      setZoom(map.getZoom());
      const c = map.getCenter();
      setCursor({ lng: c.lng, lat: c.lat });
      onMapReady?.();
    });
    map.on('idle', () => {
      setTilesReady(true);
      refreshAmapPois(map);
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      mapCenterRef.current = { lng: c.lng, lat: c.lat };
      mapZoomRef.current = map.getZoom();
      setCursor({ lng: c.lng, lat: c.lat });
      syncDistricts(map);
      refreshAmapPois(map);
    });
    map.on('zoomend', () => {
      syncDistricts(map);
      refreshAmapPois(map);
    });
    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('mousemove', (e) => {
      setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      if (!map.isStyleLoaded() || map.getSource('photos') === undefined) return;
      if (pickRef.current.pickMode) { map.getCanvas().style.cursor = 'crosshair'; return; }
      let hits = [];
      try {
        hits = map.queryRenderedFeatures(e.point, { layers: ['photo-point', 'photo-cluster', 'amap-poi-dot', 'amap-poi-label', 'china-district-fill', 'china-city-fill', 'province-fill'].filter(id => map.getLayer(id)) });
      } catch {}
      map.getCanvas().style.cursor = hits.length ? 'pointer' : '';

      const setHover = (source, id, ref) => {
        if (ref.current != null && ref.current !== id) map.setFeatureState({ source, id: ref.current }, { hover: false });
        if (id != null) {
          map.setFeatureState({ source, id }, { hover: true });
          ref.current = id;
        } else {
          ref.current = null;
        }
      };

      let district = hits.find(h => h.layer.id === 'china-district-fill');
      let city = hits.find(h => h.layer.id === 'china-city-fill');
      const province = hits.find(h => h.layer.id === 'province-fill');

      // Polygon fills with very low opacity are not always returned by hit-testing.
      // Fall back to a throttled geometric lookup so city/district hover and clicks
      // remain reliable even when only the bounds lines are visible.
      if ((!district || !city) && Date.now() - lastHoverCalcRef.current > 110) {
        lastHoverCalcRef.current = Date.now();
        if (!district && map.getZoom() >= 7.1) {
          const found = featureAt(districtDataRef.current, e.lngLat.lng, e.lngLat.lat);
          if (found) district = { properties: found.properties };
        }
        if (!city && map.getZoom() >= 3.8) {
          const found = cityAt(cityGeoRef.current, e.lngLat.lng, e.lngLat.lat);
          if (found) city = { properties: found.properties };
        }
      }

      setHover('china-districts', district?.properties?.adcode ?? null, hoverDistrict);
      setHover('china-cities', city?.properties?.adcode ?? null, hoverCity);
      setHover('provinces', province?.properties?.adcode ?? null, hoverProvince);

      let admin = '';
      if (district?.properties) {
        const p = district.properties;
        admin = [p.province, p.city, p.name].filter((v, i, a) => v && a.indexOf(v) === i).join(' / ');
      } else if (city?.properties) {
        const p = city.properties;
        admin = [p.province, p.name].filter((v, i, a) => v && a.indexOf(v) === i).join(' / ');
      } else if (province?.properties) {
        admin = province.properties.name || '';
      }
      if (admin !== adminHoverRef.current) {
        adminHoverRef.current = admin;
        setAdminHover(admin);
      }
    });
    map.on('mouseout', () => {
      const clear = (source, ref) => {
        if (ref.current != null) map.setFeatureState({ source, id: ref.current }, { hover: false });
        ref.current = null;
      };
      clear('provinces', hoverProvince);
      clear('china-cities', hoverCity);
      clear('china-districts', hoverDistrict);
      adminHoverRef.current = '';
      setAdminHover('');
    });
    map.on('click', (e) => {
      if (!map.isStyleLoaded()) return;
      if (pickRef.current.pickMode) {
        map.getSource('pick')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] } });
        pickRef.current.onPick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        return;
      }
      let hits = [];
      try {
        hits = map.queryRenderedFeatures(e.point, { layers: ['photo-point', 'photo-cluster', 'amap-poi-dot', 'amap-poi-label', 'china-district-fill', 'china-city-fill', 'province-fill'].filter(id => map.getLayer(id)) });
      } catch {}
      if (!hits.length) return;
      const cluster = hits.find(h => h.layer.id === 'photo-cluster');
      if (cluster) {
        const src = map.getSource('photos');
        src.getClusterExpansionZoom(cluster.properties.cluster_id, (err, z) => {
          if (!err) map.easeTo({ center: cluster.geometry.coordinates, zoom: Math.min(z + .35, 16), duration: 700 });
        });
        return;
      }
      const point = hits.find(h => h.layer.id === 'photo-point');
      if (point) { callbacksRef.current.onPhotoOpen?.(point.properties.id); return; }
      const poi = hits.find(h => h.layer.id === 'amap-poi-dot' || h.layer.id === 'amap-poi-label');
      if (poi) {
        const p = poi.properties || {};
        callbacksRef.current.onNotice?.(`${p.name || '地点'}${p.category ? ` · ${p.category}` : ''}${p.address ? ` · ${p.address}` : ''}`);
        return;
      }
      const districtHit = hits.find(h => h.layer.id === 'china-district-fill');
      const district = districtHit || (map.getZoom() >= 7.1 ? { properties: featureAt(districtDataRef.current, e.lngLat.lng, e.lngLat.lat)?.properties } : null);
      if (district?.properties) { callbacksRef.current.onDistrictClick?.(district.properties); return; }
      const cityHit = hits.find(h => h.layer.id === 'china-city-fill');
      const cityFeature = cityHit || (map.getZoom() >= 3.8 ? cityAt(cityGeoRef.current, e.lngLat.lng, e.lngLat.lat) : null);
      if (cityFeature?.properties) { callbacksRef.current.onCityClick?.(cityFeature.properties); return; }
      const province = hits.find(h => h.layer.id === 'province-fill');
      if (province) callbacksRef.current.onProvinceClick?.(province.properties.name);
    });
    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setTilesReady(false);
    const next = buildMapStyle(theme);
    map.setStyle(next);
  }, [theme]);

  useEffect(() => {
    if (!ready || tilesReady) return;
    const t = setTimeout(() => setTilesReady(true), 5000);
    return () => clearTimeout(t);
  }, [ready, tilesReady]);

  useEffect(() => {
    const prev = prevProviderRef.current;
    if (prev === 'amap' && provider === 'libre' && amapLastViewRef.current && mapRef.current) {
      const v = amapLastViewRef.current;
      mapRef.current.jumpTo({ center: [v.lng, v.lat], zoom: Math.max(2.2, Math.min(v.zoom || 8, 18)) });
    }
    if (provider === 'libre' && mapRef.current) refreshAmapPois(mapRef.current, true);
    prevProviderRef.current = provider;
  }, [provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updateData(map);
  }, [photos, selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!focus) return;
    if (focus.bounds) {
      map.fitBounds(focus.bounds, { padding: { top: 120, right: 440, bottom: 100, left: 390 }, maxZoom: focus.maxZoom || 9, duration: 1500, essential: true });
    } else if (Number.isFinite(focus.lng) && Number.isFinite(focus.lat)) {
      map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 7, duration: 1500, essential: true, curve: 1.45 });
    }
  }, [focus, ready]);

  useEffect(() => {
    if (provider !== 'libre' || !ready || !mapRef.current) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!userMarkerRef.current) {
      const el = makeUserMarkerElement();
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
    paintUserMarker(userMarkerRef.current.getElement(), userLocation);
  }, [userLocation, provider, ready]);

  useEffect(() => {
    if (provider !== 'libre' || !ready || !mapRef.current) {
      nativePlaceMarkerRef.current?.remove();
      nativePlaceMarkerRef.current = null;
      return;
    }
    if (!nativePlace) {
      nativePlaceMarkerRef.current?.remove();
      nativePlaceMarkerRef.current = null;
      return;
    }
    const map = mapRef.current;
    if (!nativePlaceMarkerRef.current) {
      const el = makePlaceMarkerElement(nativePlace.label);
      nativePlaceMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([nativePlace.lng, nativePlace.lat])
        .addTo(map);
    } else {
      nativePlaceMarkerRef.current.setLngLat([nativePlace.lng, nativePlace.lat]);
      const em = nativePlaceMarkerRef.current.getElement().querySelector('em');
      if (em) em.textContent = nativePlace.label || '地图位置';
    }
  }, [nativePlace, provider, ready]);

  useEffect(() => () => {
    userMarkerRef.current?.remove();
    nativePlaceMarkerRef.current?.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!map.getSource('pick')) return;
    if (!pickMode) {
      map.getSource('pick')?.setData(EMPTY);
      if (!map.getCanvas().style.cursor) map.getCanvas().style.cursor = '';
      return;
    }
    map.getCanvas().style.cursor = 'crosshair';
  }, [pickMode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (focus?.province) {
      const provinces = provinceGeoRef.current?.features || [];
      const target = provinces.find(f => f.properties.name === focus.province);
      if (target?.properties?.adcode != null) {
        map.setFeatureState({ source: 'provinces', id: String(target.properties.adcode) }, { active: true });
      }
    }
  }, [focus?.province, ready]);

  const zoomBy = (delta) => {
    if (provider === 'amap' && amapRef.current) {
      amapRef.current.setZoom(Math.max(3, Math.min(20, amapRef.current.getZoom() + delta)));
      return;
    }
    mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + delta, duration: 450 });
  };
  const goGlobe = () => {
    if (provider === 'amap' && amapRef.current) {
      amapRef.current.setZoomAndCenter(6.5, [110.5, 32.5], true);
      onNotice?.('高德底图已回到中国全域 · 继续放大可查看街道');
      return;
    }
    mapRef.current?.flyTo({ center: [100, 34], zoom: 1.05, duration: 1400, essential: true });
  };
  const locate = () => {
    if (!navigator.geolocation) { onNotice?.('当前浏览器无法获取位置'); return; }
    onNotice?.('正在校准你的当前位置…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (provider === 'amap' && amapRef.current) {
          amapRef.current.setZoomAndCenter(15, wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude), true);
        } else {
          mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 9, duration: 1600, essential: true });
        }
        onNotice?.('已定位到当前位置');
      },
      () => onNotice?.('定位失败：请检查浏览器权限（HTTP 页面可能限制定位）'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className={`atlas-map ${pickMode ? 'is-picking' : ''} ${provider === 'amap' ? 'provider-amap' : ''}`}>
      <div ref={hostRef} className="map-canvas" />
      <div className="map-vignette" aria-hidden="true" />
      <div className="map-stars" aria-hidden="true" />
      {provider === 'amap' && amapKey && (
        <AmapView
          apiKey={amapKey} theme={theme} photos={photos} selectedId={selectedId}
          focus={focus} initialCenter={mapCenterRef.current} initialZoom={mapZoomRef.current}
          pickMode={pickMode} onPick={onPick} onPhotoOpen={onPhotoOpen}
          userLocation={userLocation} nativePlace={nativePlace}
          onReady={(m) => { amapRef.current = m; window.__lumenAmap = m; }}
          onCursor={(c) => setCursor(c)} onZoom={(z) => setZoom(z)}
          onView={(v) => { amapLastViewRef.current = v; }}
          onError={(e) => { onNotice?.('高德底图加载失败，已切回全球星图'); setProvider?.('libre'); }}
        />
      )}
      <div className="map-provider glass" role="group" aria-label="地图底图">
        <button className={provider === 'libre' ? 'active' : ''} onClick={() => setProvider?.('libre')} title="全球星图 · OpenStreetMap">
          <Orbit size={13} /><span>LUMEN</span><em>全球</em>
        </button>
        <button className={provider === 'amap' ? 'active' : ''} onClick={() => setProvider?.('amap')} disabled={!amapKey} title={amapKey ? '高德中国底图' : '未配置 AMAP_KEY'}>
          <MapIcon size={13} /><span>高德</span><em>中国</em>
        </button>
        <a className="provider-credit" href={provider === 'amap' ? 'https://www.amap.com/' : 'https://www.openstreetmap.org/copyright'} target="_blank" rel="noreferrer">
          {provider === 'amap' ? '© AutoNavi' : '© OSM'}
        </a>
      </div>
      <div className="map-hud map-hud-top">
        <div className="hud-kicker"><span className="live-dot" /> {provider === 'amap' ? 'AMAP VIEW' : 'ORBITAL VIEW'} <span className="hud-slash">/</span> {provider === 'amap' ? '高德中国底图' : '全球影像坐标'}</div>
        <div className="hud-coord">{cursor.lat >= 0 ? 'N' : 'S'} {Math.abs(cursor.lat).toFixed(3)}° <span>·</span> {cursor.lng >= 0 ? 'E' : 'W'} {Math.abs(cursor.lng).toFixed(3)}°</div>
        {provider === 'libre' && adminHover && <div className="hud-admin"><i /> {adminHover}</div>}
      </div>
      <div className="map-hud map-hud-bottom">
        <span className="map-scale">GLOBE → STREET</span>
        <span className="map-admin-level">{provider === 'amap' ? 'AMAP · 街道级' : zoom >= 11.8 ? 'CN · 区县界 + AMAP POI' : `CN · ${zoom >= 7.1 ? '区县界' : zoom >= 4.4 ? '市界' : zoom >= 2.15 ? '省界' : '轨道'}`}</span>
        <span className="map-zoom">Z {zoom.toFixed(2)}</span>
      </div>
      <div className="map-controls glass">
        <button aria-label="放大" onClick={() => zoomBy(1)}><Plus size={17} /></button>
        <span className="control-sep" />
        <button aria-label="缩小" onClick={() => zoomBy(-1)}><Minus size={17} /></button>
        <span className="control-sep" />
        <button aria-label="回到地球" onClick={goGlobe}><Orbit size={17} /></button>
        <span className="control-sep" />
        <button aria-label="定位" onClick={locate}><LocateFixed size={17} /></button>
      </div>
      <div className="map-compass glass" aria-hidden="true">
        <Compass size={16} />
        <span>N</span>
      </div>
      {provider === 'amap'
        ? <a className="map-attribution" href="https://www.amap.com/" target="_blank" rel="noreferrer">高德地图 © AutoNavi · GS(2023)996号</a>
        : <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap · OpenFreeMap · DataV</a>}
      {provider === 'libre' && (!ready || !tilesReady) && (
        <div className="map-loading">
          <div className="orbit-loader"><span /><span /><i /></div>
          <p>正在同步地球坐标</p>
          <small>LINKING TO ORBITAL TILE NETWORK</small>
        </div>
      )}
      {pickMode && (
        <div className="pick-banner glass">
          <span className="live-dot" /> 点击地图选择坐标
          <small>PICK A COORDINATE ON EARTH</small>
        </div>
      )}
    </div>
  );
}
