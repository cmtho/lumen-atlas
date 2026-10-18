import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { gcj02ToWgs84, wgs84ToGcj02 } from '../lib/coords.js';

const inChina = (lng, lat) => lng > 72 && lng < 138 && lat > 17 && lat < 55;

export default function AmapView({
  apiKey, theme, photos, selectedId, focus, initialCenter, initialZoom,
  pickMode, onPick, onPhotoOpen, onReady, onCursor, onZoom, onView, onError,
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [styleReady, setStyleReady] = useState(false);
  const markersRef = useRef([]);
  const markerNodesRef = useRef(new Map());
  const pickMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const amapApiRef = useRef(null);
  const pickModeRef = useRef(pickMode);
  const onPickRef = useRef(onPick);
  pickModeRef.current = pickMode;
  onPickRef.current = onPick;

  useEffect(() => {
    let disposed = false;
    let map;
    async function init() {
      if (!apiKey) { setError('未配置高德 API Key'); setLoading(false); return; }
      try {
        const AMap = await AMapLoader.load({ key: apiKey, version: '2.0' });
        if (disposed || !hostRef.current) return;
        amapApiRef.current = AMap;
        window.__lumenAmapApi = AMap;
        const centerInChina = initialCenter && inChina(initialCenter.lng, initialCenter.lat);
        const fallback = !initialZoom || initialZoom < 5 || !centerInChina;
        const wgsCenter = !fallback ? initialCenter : { lng: 113.2, lat: 31.2 };
        const center = wgs84ToGcj02(wgsCenter.lng, wgsCenter.lat);
        map = new AMap.Map(hostRef.current, {
          viewMode: '2D',
          zoom: fallback ? 6.5 : Math.max(6.5, Math.min(Number(initialZoom) || 9.5, 13)),
          center,
          zooms: [3, 20],
          mapStyle: theme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal',
          resizeEnable: true,
          showLabel: true,
          animateEnable: true,
          doubleClickZoom: true,
          scrollWheel: true,
          dragEnable: true,
          touchZoom: true,
        });
        mapRef.current = map;
        window.__lumenAmap = map;
        let completed = false;
        const fallbackTimer = setTimeout(() => {
          if (disposed || completed) return;
          completed = true;
          const cc = map.getCenter();
          const [clng, clat] = gcj02ToWgs84(cc.getLng(), cc.getLat());
          onCursor?.({ lng: clng, lat: clat });
          onZoom?.(map.getZoom());
          onView?.({ lng: clng, lat: clat, zoom: map.getZoom() });
          setLoading(false); setReady(true); onReady?.(map);
        }, 9000);
        map.on('complete', () => {
          if (disposed || completed) return;
          completed = true;
          clearTimeout(fallbackTimer);
          const cc = map.getCenter();
          const [clng, clat] = gcj02ToWgs84(cc.getLng(), cc.getLat());
          onCursor?.({ lng: clng, lat: clat });
          onZoom?.(map.getZoom());
          onView?.({ lng: clng, lat: clat, zoom: map.getZoom() });
          const host = hostRef.current;
          if (host) {
            setTimeout(() => {
              if (host.querySelector('.amap-layer-tile img')) host.classList.add('amap-dom-render');
            }, 900);
          }
          setLoading(false); setReady(true); onReady?.(map);
        });
        map.on('mousemove', (e) => {
          const [lng, lat] = gcj02ToWgs84(e.lnglat.getLng(), e.lnglat.getLat());
          onCursor?.({ lng, lat });
        });
        map.on('moveend', () => {
          const c = map.getCenter();
          const [lng, lat] = gcj02ToWgs84(c.getLng(), c.getLat());
          onCursor?.({ lng, lat });
          onView?.({ lng, lat, zoom: map.getZoom() });
        });
        map.on('zoomend', () => {
          const c = map.getCenter();
          const [lng, lat] = gcj02ToWgs84(c.getLng(), c.getLat());
          onZoom?.(map.getZoom());
          onCursor?.({ lng, lat });
          onView?.({ lng, lat, zoom: map.getZoom() });
        });
        map.on('click', (e) => {
          if (!pickModeRef.current) return;
          const [lng, lat] = gcj02ToWgs84(e.lnglat.getLng(), e.lnglat.getLat());
          if (pickMarkerRef.current) { map.remove(pickMarkerRef.current); pickMarkerRef.current = null; }
          const el = document.createElement('div');
          el.className = 'amap-pick-marker';
          const marker = new AMap.Marker({ position: e.lnglat, content: el, offset: new AMap.Pixel(-9, -9), zIndex: 160 });
          marker.setMap(map);
          pickMarkerRef.current = marker;
          onPickRef.current?.({ lat, lng });
        });
        setStyleReady(true);
      } catch (e) {
        console.error('[amap]', e);
        setError(e?.message || '高德底图加载失败');
        setLoading(false);
        onError?.(e);
      }
    }
    init();
    return () => {
      disposed = true;
      onReady?.(null);
      try { map?.destroy(); } catch {}
      mapRef.current = null;
    };
  }, [apiKey]);

  // map style follows app theme
  useEffect(() => {
    if (!mapRef.current || !styleReady) return;
    try { mapRef.current.setMapStyle(theme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal'); } catch {}
  }, [theme, styleReady]);

  // flying to a selected place / province / city
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    if (!Number.isFinite(Number(focus.lng)) || !Number.isFinite(Number(focus.lat))) return;
    const low = !focus.zoom || focus.zoom < 5;
    const targetLng = low ? 113.2 : focus.lng;
    const targetLat = low ? 31.2 : focus.lat;
    const [lng, lat] = wgs84ToGcj02(targetLng, targetLat);
    const z = Math.max(6.5, Math.min(Number(focus.zoom) || 11, 18));
    map.setZoomAndCenter(z, [lng, lat], true);
  }, [focus?.ts, ready]);

  // photo markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !amapApiRef.current) return;
    for (const marker of markersRef.current) { try { map.remove(marker); } catch {} }
    markersRef.current = [];
    markerNodesRef.current = new Map();
    for (const photo of photos || []) {
      if (!Number.isFinite(Number(photo.lat)) || !Number.isFinite(Number(photo.lng))) continue;
      const [lng, lat] = wgs84ToGcj02(photo.lng, photo.lat);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'amap-photo-marker';
      if (photo.id === selectedId) el.classList.add('is-selected');
      el.title = photo.title || '';
      el.setAttribute('aria-label', photo.title || '影像');
      const inner = document.createElement('span');
      el.appendChild(inner);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); onPhotoOpen?.(photo.id); });
      const marker = new amapApiRef.current.Marker({
        position: [lng, lat], content: el, offset: new window.AMap.Pixel(-9, -9), zIndex: 130, bubble: false,
      });
      marker.setMap(map);
      markersRef.current.push(marker);
      markerNodesRef.current.set(photo.id, el);
    }
    if (pickMode) { map.setDefaultCursor('crosshair'); } else { map.setDefaultCursor('pointer'); }
  }, [photos, ready]);

  useEffect(() => {
    for (const [id, el] of markerNodesRef.current.entries()) el.classList.toggle('is-selected', id === selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!mapRef.current) return;
    try { mapRef.current.setDefaultCursor(pickMode ? 'crosshair' : 'default'); } catch {}
  }, [pickMode]);

  return (
    <div className="amap-view">
      <div ref={hostRef} className="amap-host" />
      {loading && (
        <div className="amap-loading glass">
          <div className="orbit-loader"><span /><span /><i /></div>
          <p>正在连接高德中国底图</p>
          <small>AMAP / GCJ-02 / STREET DETAIL</small>
        </div>
      )}
      {error && (
        <div className="amap-error glass">
          <strong>高德底图未能加载</strong>
          <span>{error}</span>
          <small>请检查 Key 配额、域名白名单或网络；也可以切回 LUMEN 全球星图。</small>
        </div>
      )}
    </div>
  );
}
