const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const EPS = 1e-6;

function vector([lng, lat]) {
  const phi = lat * DEG;
  const lambda = lng * DEG;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function lngLat([x, y, z]) {
  return [Math.atan2(y, x) * RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD];
}

function unwrap(points) {
  if (!points.length) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [lng, lat] = points[i];
    const prev = out[out.length - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, lat]);
  }
  return out;
}

export function greatCircle(a, b, segments = 64) {
  const av = vector(a);
  const bv = vector(b);
  const dot = Math.max(-1, Math.min(1, av[0] * bv[0] + av[1] * bv[1] + av[2] * bv[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  if (omega < EPS || Math.abs(sinOmega) < EPS) return [a, b];

  const count = Math.max(2, Math.floor(Number(segments) || 64));
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    points.push(lngLat([
      av[0] * wa + bv[0] * wb,
      av[1] * wa + bv[1] * wb,
      av[2] * wa + bv[2] * wb,
    ]));
  }
  return unwrap(points);
}

export function arcFeature(track) {
  const stops = Array.isArray(track?.stops) ? track.stops : [];
  if (stops.length < 2) return null;
  const coordinates = [];
  for (let i = 1; i < stops.length; i++) {
    const a = [Number(stops[i - 1].lng), Number(stops[i - 1].lat)];
    const b = [Number(stops[i].lng), Number(stops[i].lat)];
    if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
    const segment = greatCircle(a, b);
    if (!coordinates.length) coordinates.push(...segment);
    else coordinates.push(...segment.slice(1));
  }
  return {
    type: 'Feature',
    properties: {
      id: track.id,
      color: track.color || '#65f4ff',
      title: track.title || '',
    },
    geometry: { type: 'LineString', coordinates: unwrap(coordinates) },
  };
}

export function stopsDistanceKm(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return 0;
  const earth = 6371.0088;
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const lat1 = Number(a.lat) * DEG;
    const lat2 = Number(b.lat) * DEG;
    const dLat = lat2 - lat1;
    const dLng = (Number(b.lng) - Number(a.lng)) * DEG;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    total += 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}
