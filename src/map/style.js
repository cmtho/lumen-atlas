const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const TILES = 'https://tiles.openfreemap.org/planet';

const palette = {
  dark: {
    background: '#071827',
    water: '#020a13',
    waterLine: '#0a3142',
    landcover: '#061521',
    park: '#08211e',
    ice: '#0a1b2a',
    landuse: '#0a2030',
    building: '#0c2234',
    buildingLine: '#123047',
    roadMinor: '#0a1b2a',
    roadMed: '#10293b',
    roadMajor: '#173b51',
    roadCore: '#2d6c83',
    roadCasing: '#06121e',
    boundary: '#214e61',
    country: '#3e8fa8',
    text: '#a8c8d8',
    muted: '#7b9cae',
    textStrong: '#d9f5ff',
    halo: '#020812',
    city: '#8fe7ff',
    graticule: '#63f5ff',
    accent: '#63f5ff',
    accent2: '#9b8cff',
    warm: '#ffd27a',
  },
  light: {
    background: '#eaf3fb',
    water: '#badff2',
    waterLine: '#8fc4dd',
    landcover: '#d9ecdf',
    park: '#c9e8d4',
    ice: '#e8f7ff',
    landuse: '#deedf7',
    building: '#dfebf6',
    buildingLine: '#bdd8e9',
    roadMinor: '#ffffff',
    roadMed: '#fbfdff',
    roadMajor: '#ffffff',
    roadCore: '#a8cede',
    roadCasing: '#b9d7e6',
    boundary: '#8cbdd3',
    country: '#397d99',
    text: '#2d5368',
    muted: '#56778a',
    textStrong: '#07263a',
    halo: '#f8fdff',
    city: '#075d79',
    graticule: '#207e9b',
    accent: '#067e9d',
    accent2: '#5a4bc0',
    warm: '#9e6408',
  },
};

const font = ['Noto Sans Regular'];
const bold = ['Noto Sans Bold'];
const localName = ['coalesce', ['get', 'name:zh'], ['get', 'name']];
const latinName = ['coalesce', ['get', 'name:latin'], ['get', 'name']];

function roadLayers(c) {
  return [
    {
      id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track', 'path']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.roadMinor, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13, .5, 16, 1.1, 19, 3], 'line-opacity': .9 },
    },
    {
      id: 'road-med', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 8,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.roadMed, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, .5, 13, 1.5, 19, 6], 'line-opacity': .92 },
    },
    {
      id: 'road-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 4,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadMajor,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 4, .35, 8, 1.1, 13, 3.2, 19, 9],
        'line-opacity': .95,
      },
    },
    {
      id: 'road-core', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 10,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': c.roadCore,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, .25, 14, .8, 19, 2.2],
        'line-opacity': .52,
      },
    },
  ];
}

export function buildMapStyle(theme = 'dark') {
  const c = palette[theme] || palette.dark;
  return {
    version: 8,
    name: `Lumen ${theme}`,
    projection: { type: 'globe' },
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: TILES },
    },
    sky: {
      'sky-color': theme === 'dark' ? '#01030a' : '#dcefff',
      'horizon-color': theme === 'dark' ? '#1a4f67' : '#a4d9f4',
      'fog-color': theme === 'dark' ? '#061828' : '#eaf6ff',
      'fog-ground-blend': 0.15,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.9,
      'atmosphere-blend': 1,
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': c.background } },
      {
        id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'fill-color': c.water, 'fill-opacity': .96 },
      },
      {
        id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', minzoom: 7,
        paint: {
          'line-color': c.waterLine,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, .4, 14, 1.4, 19, 3],
          'line-opacity': .7,
        },
      },
      {
        id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 3,
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'scrub', 'farmland']]],
        paint: { 'fill-color': c.landcover, 'fill-opacity': .42 },
      },
      {
        id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', minzoom: 8,
        paint: { 'fill-color': c.park, 'fill-opacity': .55 },
      },
      {
        id: 'ice', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 1,
        filter: ['==', ['get', 'class'], 'ice'],
        paint: { 'fill-color': c.ice, 'fill-opacity': .55 },
      },
      {
        id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', minzoom: 10,
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'cemetery', 'military']]],
        paint: { 'fill-color': c.landuse, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, .06, 14, .18, 18, .24] },
      },
      {
        id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-color': c.building,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, .12, 16, .46, 19, .6],
          'fill-outline-color': c.buildingLine,
        },
      },
      ...roadLayers(c),
      {
        id: 'boundary-state', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 2.5,
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': c.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2.5, .25, 8, .7, 14, 1],
          'line-opacity': .55,
          'line-dasharray': [3, 3],
        },
      },
      {
        id: 'boundary-country', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 0,
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': c.country,
          'line-width': ['interpolate', ['linear'], ['zoom'], 0, .45, 4, .9, 10, 1.3],
          'line-opacity': .68,
        },
      },
      {
        id: 'place-country', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'country'], maxzoom: 6,
        layout: {
          'text-field': latinName,
          'text-font': bold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 2.5, 11, 5, 12.5],
          'text-letter-spacing': .12,
          'text-max-width': 8,
          'text-transform': 'uppercase',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': c.textStrong,
          'text-halo-color': c.halo,
          'text-halo-width': 1.2,
          'text-halo-blur': 1,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 0, .62, 3, .72],
        },
      },
      {
        id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 3.2,
        filter: ['all', ['in', ['get', 'class'], ['literal', ['city', 'town']]], ['<=', ['coalesce', ['get', 'rank'], 99], 8]],
        layout: {
          'text-field': localName,
          'text-font': font,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3.2, 10, 8, 13, 13, 16],
          'text-max-width': 8,
          'text-letter-spacing': .05,
          'text-padding': 4,
        },
        paint: { 'text-color': c.city, 'text-halo-color': c.halo, 'text-halo-width': 1.1, 'text-halo-blur': 1 },
      },
      {
        id: 'place-suburb', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 10,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']]],
        layout: {
          'text-field': localName,
          'text-font': font,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 16, 12],
          'text-max-width': 8,
        },
        paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1, 'text-halo-blur': 1 },
      },
      {
        id: 'poi-dot', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 13.4,
        filter: ['in', ['get', 'class'], ['literal', ['attraction', 'museum', 'monument', 'park', 'viewpoint', 'zoo', 'theme_park', 'castle', 'place_of_worship', 'stadium', 'art_gallery']]],
        paint: {
          'circle-color': c.accent,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.4, 1.5, 17, 3.2],
          'circle-opacity': .55,
          'circle-stroke-color': c.halo,
          'circle-stroke-width': .7,
        },
      },
      {
        id: 'poi-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['attraction', 'museum', 'monument', 'park', 'viewpoint', 'zoo', 'theme_park', 'castle', 'place_of_worship', 'stadium', 'art_gallery']]],
        layout: {
          'text-field': localName,
          'text-font': font,
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 8.5, 17, 10.5],
          'text-offset': [0, .75],
          'text-anchor': 'top',
          'text-max-width': 7,
          'text-padding': 4,
          'text-optional': true,
        },
        paint: {
          'text-color': c.text,
          'text-halo-color': c.halo,
          'text-halo-width': 1,
          'text-halo-blur': .8,
          'text-opacity': .82,
        },
      },
      {
        id: 'housenumber', type: 'symbol', source: 'openmaptiles', 'source-layer': 'housenumber', minzoom: 16.4,
        layout: {
          'text-field': ['get', 'housenumber'],
          'text-font': font,
          'text-size': 8,
          'text-padding': 3,
          'text-max-width': 4,
        },
        paint: {
          'text-color': c.muted,
          'text-halo-color': c.halo,
          'text-halo-width': .8,
          'text-opacity': .55,
        },
      },
      {
        id: 'road-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'symbol-placement': 'line',
          'text-field': localName,
          'text-font': font,
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 19, 11],
          'text-letter-spacing': .02,
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'viewport',
        },
        paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.1 },
      },
      {
        id: 'water-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name', minzoom: 6,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'text-field': localName,
          'text-font': font,
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 14, 14],
          'text-letter-spacing': .12,
          'text-max-width': 8,
        },
        paint: { 'text-color': c.waterLine, 'text-halo-color': c.halo, 'text-halo-width': .8, 'text-opacity': .78 },
      },
    ],
  };
}

export const mapPalette = palette;
