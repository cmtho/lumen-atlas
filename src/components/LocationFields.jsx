import { useState } from 'react';
import { Crosshair, MapPin, Search, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { cx } from '../lib/utils.js';

function regionCenter(regions, provinceName, cityName, districtName) {
  const province = regions?.provinces?.find(p => p.name === provinceName);
  if (!province) return null;
  const city = province.cities.find(c => c.name === cityName);
  const district = city?.districts.find(d => d.name === districtName);
  return district?.center || city?.center || province.center || null;
}

export default function LocationFields({ value, onChange, regions, compact = false, onNotice }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const isChina = value.countryCode === 'cn' || value.country === '中国';
  const province = regions?.provinces?.find(p => p.name === value.province);
  const city = province?.cities.find(c => c.name === value.city);
  const patch = (p) => onChange({ ...value, ...p });

  const setChinaMode = (china) => {
    if (china) onChange({ ...value, country: '中国', countryCode: 'cn' });
    else onChange({ ...value, country: value.country === '中国' ? '' : value.country, countryCode: value.countryCode === 'cn' ? '' : value.countryCode });
  };

  const chooseProvince = (name) => {
    const p = regions?.provinces?.find(x => x.name === name);
    const onlyCity = p?.cities?.length === 1 ? p.cities[0] : null;
    const center = onlyCity?.center || p?.center;
    onChange({
      ...value, country: '中国', countryCode: 'cn', province: name,
      city: onlyCity?.name || '', district: '',
      lat: center ? center[1] : value.lat, lng: center ? center[0] : value.lng,
    });
  };
  const chooseCity = (name) => {
    const c = province?.cities.find(x => x.name === name);
    const center = c?.center;
    onChange({
      ...value, city: name, district: '',
      lat: center ? center[1] : value.lat, lng: center ? center[0] : value.lng,
    });
  };
  const chooseDistrict = (name) => {
    const d = city?.districts.find(x => x.name === name);
    const center = d?.center;
    onChange({
      ...value, district: name,
      lat: center ? center[1] : value.lat, lng: center ? center[0] : value.lng,
    });
  };

  const doSearch = async (e) => {
    e?.preventDefault?.();
    if (q.trim().length < 2) return;
    setSearching(true);
    try {
      const { results } = await api.searchPlaces(q.trim());
      setResults(results || []);
      if (!results?.length) onNotice?.('没有找到匹配地点，可以直接手动填写');
    } catch (e) {
      onNotice?.(e.message);
    } finally { setSearching(false); }
  };

  const applyResult = (r) => {
    onChange({
      ...value,
      country: r.country || '', countryCode: (r.countryCode || '').toLowerCase(),
      province: r.province || '', city: r.city || '', district: r.district || '',
      locationName: r.label || r.city || r.province || r.country || '',
      lat: Number(r.lat), lng: Number(r.lng),
    });
    setResults([]); setQ('');
  };

  return (
    <div className={cx('location-fields', compact && 'compact')}>
      <div className="field-mode-row">
        <div className="segmented">
          <button type="button" className={isChina ? 'active' : ''} onClick={() => setChinaMode(true)}>中国行政区</button>
          <button type="button" className={!isChina ? 'active' : ''} onClick={() => setChinaMode(false)}>海外 / 自定义</button>
        </div>
        <span className="search-source"><Sparkles size={11} /> 高德 / OSM 地点检索</span>
      </div>

      <div className="inline-search place-search">
        <form onSubmit={doSearch}>
          <Search size={14} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索地点、POI 或地址，例如：京都 南禅寺 / 深圳湾公园" />
          <button type="submit" disabled={searching}>{searching ? '检索中' : '搜索'}</button>
          {results.length > 0 && <button type="button" className="inline-search-close" onClick={() => { setResults([]); setQ(''); }}><X size={13} /></button>}
        </form>
        {results.length > 0 && (
          <div className="inline-results">
            {results.map((r, i) => (
              <button type="button" key={`${r.lat}-${r.lng}-${i}`} onClick={() => applyResult(r)}>
                <MapPin size={13} />
                <span><strong>{r.label}</strong><small>{r.detail}</small></span>
                <span className="result-source">{r.source === 'amap' ? '高德' : 'OSM'}</span>
                <Sparkles size={12} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field-grid two">
        <label className="field"><span>国家 / 地区</span><input value={value.country || ''} onChange={e => patch({ country: e.target.value, countryCode: isChina && e.target.value !== '中国' ? '' : value.countryCode })} placeholder="中国" /></label>
        <label className="field"><span>地点名称 <em>可自定义</em></span><input value={value.locationName || ''} onChange={e => patch({ locationName: e.target.value })} placeholder="例如：南禅寺 · 水路阁" /></label>
      </div>

      {isChina ? (
        <div className="field-grid three">
          <label className="field"><span>省份</span>
            <select value={value.province || ''} onChange={e => chooseProvince(e.target.value)}>
              <option value="">选择省份</option>
              {regions?.provinces?.map(p => <option key={p.adcode} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label className="field"><span>城市</span>
            <select value={value.city || ''} onChange={e => chooseCity(e.target.value)} disabled={!province}>
              <option value="">{province ? '选择城市' : '请先选省份'}</option>
              {province?.cities.map(c => <option key={c.adcode} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>区 / 县</span>
            <select value={value.district || ''} onChange={e => chooseDistrict(e.target.value)} disabled={!city?.districts?.length}>
              <option value="">{city?.districts?.length ? '选择区县' : '暂无区县'}</option>
              {city?.districts.map(d => <option key={d.adcode} value={d.name}>{d.name}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <div className="field-grid three">
          <label className="field"><span>省 / 州 / 地区</span><input value={value.province || ''} onChange={e => patch({ province: e.target.value })} placeholder="例如：京都府" /></label>
          <label className="field"><span>城市</span><input value={value.city || ''} onChange={e => patch({ city: e.target.value })} placeholder="例如：京都市" /></label>
          <label className="field"><span>区 / 街道</span><input value={value.district || ''} onChange={e => patch({ district: e.target.value })} placeholder="例如：左京区" /></label>
        </div>
      )}

      <div className="field-grid two coord-row">
        <label className="field"><span>纬度 LAT</span><input type="number" step="0.000001" value={value.lat ?? ''} onChange={e => patch({ lat: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="35.011600" /></label>
        <label className="field"><span>经度 LNG</span><input type="number" step="0.000001" value={value.lng ?? ''} onChange={e => patch({ lng: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="135.768100" /></label>
      </div>
      <div className="coord-hint"><Crosshair size={12} /> 坐标可精确到街道；选择省市区后会自动填入行政区中心坐标。</div>
    </div>
  );
}
