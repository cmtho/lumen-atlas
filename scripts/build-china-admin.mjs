import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache-regions');
const GEO = path.join(ROOT, 'public', 'geo');
const OUT_DISTRICTS = path.join(GEO, 'china-districts');
await fsp.mkdir(OUT_DISTRICTS, { recursive: true });

const regions = JSON.parse(await fsp.readFile(path.join(GEO, 'regions.json'), 'utf8'));
const provincesGeo = JSON.parse(await fsp.readFile(path.join(GEO, 'china-provinces.json'), 'utf8'));
const provinceShapes = new Map(provincesGeo.features.map(f => [String(f.properties.adcode), f]));

const cityFeatures = [];
const districtCounts = {};
let cityFileCount = 0;

for (const province of regions.provinces) {
  const cacheFile = path.join(CACHE, `${province.adcode}_full.json`);
  let detail = null;
  try { detail = JSON.parse(await fsp.readFile(cacheFile, 'utf8')); } catch {}
  if (!detail?.features?.length) {
    // Taiwan and any missing details: expose the province outline as the only city.
    const shape = provinceShapes.get(String(province.adcode));
    if (shape) {
      cityFeatures.push({
        type: 'Feature',
        properties: {
          adcode: String(province.adcode), name: province.name,
          province: province.name, provinceAdcode: String(province.adcode),
          centroid: province.center, level: 'city', hasDistricts: false,
        },
        geometry: shape.geometry,
      });
    }
    continue;
  }

  const hasCityLevel = detail.features.some(f => f.properties?.level === 'city');
  if (hasCityLevel) {
    for (const feature of detail.features) {
      if (feature.properties?.level !== 'city') continue;
      const p = feature.properties;
      cityFeatures.push({
        type: 'Feature',
        properties: {
          adcode: String(p.adcode), name: p.name,
          province: province.name, provinceAdcode: String(province.adcode),
          centroid: p.centroid || p.center || province.center,
          level: 'city', hasDistricts: (province.cities.find(c => c.name === p.name)?.districts.length || 0) > 0,
        },
        geometry: feature.geometry,
      });
      const cityCache = path.join(CACHE, `${p.adcode}_full.json`);
      try {
        const cityDetail = JSON.parse(await fsp.readFile(cityCache, 'utf8'));
        const districts = {
          type: 'FeatureCollection',
          properties: { city: p.name, adcode: String(p.adcode), province: province.name },
          features: cityDetail.features
            .filter(f => f.properties?.name && ['district', 'city'].includes(f.properties?.level))
            .map(f => ({
              type: 'Feature',
              properties: {
                adcode: String(f.properties.adcode), name: f.properties.name,
                city: p.name, cityAdcode: String(p.adcode), province: province.name,
                centroid: f.properties.centroid || f.properties.center,
                level: 'district',
              },
              geometry: f.geometry,
            })),
        };
        if (districts.features.length) {
          await fsp.writeFile(path.join(OUT_DISTRICTS, `${p.adcode}.json`), JSON.stringify(districts));
          districtCounts[String(p.adcode)] = districts.features.length;
          cityFileCount++;
        }
      } catch {}
    }
  } else {
    // Municipalities / SARs: the province outline is the city outline, children are districts.
    const shape = provinceShapes.get(String(province.adcode));
    const cityName = province.name;
    const cityCenter = province.center;
    const districts = detail.features
      .filter(f => f.properties?.name)
      .map(f => ({
        type: 'Feature',
        properties: {
          adcode: String(f.properties.adcode), name: f.properties.name,
          city: cityName, cityAdcode: String(province.adcode), province: province.name,
          centroid: f.properties.centroid || f.properties.center, level: 'district',
        },
        geometry: f.geometry,
      }));
    if (shape) {
      cityFeatures.push({
        type: 'Feature',
        properties: {
          adcode: String(province.adcode), name: cityName,
          province: province.name, provinceAdcode: String(province.adcode),
          centroid: cityCenter, level: 'city', hasDistricts: districts.length > 0,
        },
        geometry: shape.geometry,
      });
    }
    if (districts.length) {
      await fsp.writeFile(path.join(OUT_DISTRICTS, `${province.adcode}.json`), JSON.stringify({
        type: 'FeatureCollection',
        properties: { city: cityName, adcode: String(province.adcode), province: province.name },
        features: districts,
      }));
      districtCounts[String(province.adcode)] = districts.length;
      cityFileCount++;
    }
  }
}

cityFeatures.sort((a, b) => String(a.properties.adcode).localeCompare(String(b.properties.adcode)));
const cities = { type: 'FeatureCollection', features: cityFeatures };
const tmp = path.join(GEO, '.china-cities.raw.json');
const out = path.join(GEO, 'china-cities.json');
await fsp.writeFile(tmp, JSON.stringify(cities));
console.log('city features', cityFeatures.length, 'raw MB', (fs.statSync(tmp).size / 1048576).toFixed(2));

// Simplify city outlines for smooth globe/country-scale rendering.
try {
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'mapshaper'), [
    tmp, '-simplify', '35%', 'keep-shapes', '-o', out, 'format=geojson', 'precision=0.00001',
  ], { stdio: 'inherit' });
  console.log('city simplified MB', (fs.statSync(out).size / 1048576).toFixed(2));
} catch (e) {
  console.warn('mapshaper failed; using raw city boundaries', e.message);
  await fsp.copyFile(tmp, out);
}
await fsp.unlink(tmp);

// City label points for typography independent from OSM labels.
const labels = {
  type: 'FeatureCollection',
  features: cityFeatures.map(f => ({
    type: 'Feature',
    properties: {
      adcode: f.properties.adcode, name: f.properties.name,
      province: f.properties.province, rank: f.properties.name?.endsWith('市') ? 1 : 2,
    },
    geometry: { type: 'Point', coordinates: f.properties.centroid || [0, 0] },
  })).filter(f => f.geometry.coordinates[0]),
};
await fsp.writeFile(path.join(GEO, 'china-city-labels.json'), JSON.stringify(labels));
console.log('district files', cityFileCount, 'bytes', Object.values(districtCounts).reduce((a, b) => a + b, 0));
