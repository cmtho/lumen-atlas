import fs from 'node:fs/promises';

const BASE = 'https://geo.datav.aliyun.com/areas_v3/bound';
const OUT = new URL('../public/geo/regions.json', import.meta.url);
const CACHE = new URL('../.cache-regions/', import.meta.url);
await fs.mkdir(CACHE, { recursive: true });

async function get(adcode, full = true) {
  const name = `${adcode}${full ? '_full' : ''}.json`;
  const cachePath = new URL(name, CACHE);
  try { return JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}
  const url = `${BASE}/${name}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'LumenAtlas/1.0 (region build)' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      const json = JSON.parse(text);
      await fs.writeFile(cachePath, text);
      return json;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
    }
  }
}

function centerOf(p) {
  const c = p.center || p.centroid;
  return Array.isArray(c) ? [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))] : null;
}

const china = await get(100000);
const provinces = [];
for (const pf of china.features) {
  const p = pf.properties;
  if (!p?.adcode || p.adcode === 100000) continue;
  const province = { adcode: String(p.adcode), name: p.name, center: centerOf(p), cities: [] };
  let detail;
  try { detail = await get(p.adcode); } catch { detail = null; }
  if (detail?.features?.length) {
    const levels = new Set(detail.features.map(f => f.properties?.level));
    if (levels.has('city')) {
      const cityFeatures = detail.features.filter(f => f.properties?.level === 'city');
      for (let i = 0; i < cityFeatures.length; i++) {
        const cf = cityFeatures[i];
        const c = cf.properties;
        const city = { adcode: String(c.adcode), name: c.name, center: centerOf(c), districts: [] };
        try {
          const cityDetail = await get(c.adcode);
          if (cityDetail?.features?.length) {
            city.districts = cityDetail.features
              .filter(f => f.properties?.name && ['district', 'city'].includes(f.properties?.level))
              .map(f => ({ adcode: String(f.properties.adcode), name: f.properties.name, center: centerOf(f.properties) }));
          }
        } catch {}
        province.cities.push(city);
        if (i % 12 === 0) process.stdout.write(`  ${province.name}: ${i + 1}/${cityFeatures.length}\n`);
      }
    } else {
      const districts = detail.features
        .filter(f => f.properties?.name)
        .map(f => ({ adcode: String(f.properties.adcode), name: f.properties.name, center: centerOf(f.properties) }));
      province.cities.push({ adcode: String(p.adcode), name: p.name, center: centerOf(p), districts });
    }
  } else {
    province.cities.push({ adcode: String(p.adcode), name: p.name, center: centerOf(p), districts: [] });
  }
  provinces.push(province);
  console.log(`${province.name}: ${province.cities.length} cities`);
}

provinces.sort((a, b) => a.adcode.localeCompare(b.adcode));
const out = {
  source: 'Aliyun DataV GeoAtlas areas_v3',
  generatedAt: new Date().toISOString(),
  provinces,
};
await fs.writeFile(OUT, JSON.stringify(out));
const stats = provinces.reduce((acc, p) => { acc.cities += p.cities.length; for (const c of p.cities) acc.districts += c.districts.length; return acc; }, { cities: 0, districts: 0 });
console.log('DONE', provinces.length, stats, 'bytes', (await fs.stat(OUT)).size);
