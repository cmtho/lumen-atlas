import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { arcFeature } from '../lib/geo-arc.js';

const EMPTY = { type: 'FeatureCollection', features: [] };

const style = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'track-background', type: 'background', paint: { 'background-color': '#061321' } },
    { id: 'track-raster', type: 'raster', source: 'osm', paint: { 'raster-opacity': .62, 'raster-saturation': -.45 } },
  ],
};

function stopData(stops, color) {
  return {
    type: 'FeatureCollection',
    features: (stops || []).filter(s => Number.isFinite(Number(s.lng)) && Number.isFinite(Number(s.lat))).map((s, i) => ({
      type: 'Feature',
      properties: { name: s.name || `地点 ${i + 1}`, color },
      geometry: { type: 'Point', coordinates: [Number(s.lng), Number(s.lat)] },
    })),
  };
}

const TrackPreview = forwardRef(function TrackPreview({ stops = [], color = '#65f4ff', height = 460 }, ref) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);

  function flyToBounds(list = []) {
    const map = mapRef.current;
    const valid = (list || []).filter(s => Number.isFinite(Number(s.lng)) && Number.isFinite(Number(s.lat)));
    if (!map || !valid.length) return;
    if (valid.length === 1) {
      map.easeTo({ center: [Number(valid[0].lng), Number(valid[0].lat)], zoom: 5, duration: 500 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    valid.forEach(s => bounds.extend([Number(s.lng), Number(s.lat)]));
    map.fitBounds(bounds, { padding: 64, maxZoom: 6, duration: 500 });
  }

  useImperativeHandle(ref, () => ({ flyToBounds }), [ready]);

  useEffect(() => {
    let disposed = false;
    const map = new maplibregl.Map({
      container: hostRef.current,
      style,
      center: [104.2, 35.8],
      zoom: 2.2,
      minZoom: 0.8,
      maxZoom: 18,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      renderWorldCopies: true,
    });
    mapRef.current = map;
    window.__trackPreviewMap = map;
    map.on('error', e => console.warn('[track-preview]', e?.error?.message || e));
    map.on('load', () => {
      if (disposed) return;
      map.addSource('track-arc', { type: 'geojson', data: EMPTY });
      map.addSource('track-stops', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'track-arc-glow',
        type: 'line',
        source: 'track-arc',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 7,
          'line-blur': 8,
          'line-opacity': .18,
        },
      });
      map.addLayer({
        id: 'track-arc',
        type: 'line',
        source: 'track-arc',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': .9,
        },
      });
      map.addLayer({
        id: 'track-stops',
        type: 'circle',
        source: 'track-stops',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 4,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });
      setReady(true);
      if (stops.length) setTimeout(() => flyToBounds(stops), 80);
    });
    const observer = new ResizeObserver(() => map.resize());
    if (hostRef.current) observer.observe(hostRef.current);
    return () => {
      disposed = true;
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      if (window.__trackPreviewMap === map) delete window.__trackPreviewMap;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getSource('track-arc')?.setData(arcFeature({ stops, color }) || EMPTY);
    map.getSource('track-stops')?.setData(stopData(stops, color));
  }, [stops, color, ready]);

  return <div ref={hostRef} className="track-preview" style={{ height }} aria-label="轨迹预览地图" />;
});

export default TrackPreview;
