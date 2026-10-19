import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Images, Layers3, MapPin, Plus, Search, Sparkles, UserRound, X } from 'lucide-react';
import AtlasMap from '../map/AtlasMap.jsx';
import { cx, dateRange, formatDateDots, initials, personMap } from '../lib/utils.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export default function AtlasView({
  profile, photos, places, filteredPlaces, people, personFilter, onPersonFilter, regions,
  selectedPlace, onSelectPlace, onClosePlace, onUpload, onOpenPhoto, onViewArchive,
  onProvinceClick, onCityClick, onDistrictClick, focus, setFocus, theme, onNotice, pickMode, onPick, active = true,
  provider, setProvider, amapKey, userLocation, nativePlace, tracks = [],
}) {
  const [q, setQ] = useState('');
  const peopleById = useMemo(() => personMap(people), [people]);
  const searchPlaces = useMemo(() => {
    if (!q.trim()) return filteredPlaces;
    const term = q.trim().toLowerCase();
    return filteredPlaces.filter(p => [p.label, p.locationName, p.city, p.province, p.country].join(' ').toLowerCase().includes(term));
  }, [filteredPlaces, q]);

  const placePhotos = selectedPlace?.photos || [];
  const placePeople = selectedPlace ? [...new Set(placePhotos.flatMap(p => p.personIds || []))].map(id => peopleById.get(id)).filter(Boolean) : [];
  const extraPeople = selectedPlace?.people?.length || 0;

  const openPlace = (place) => {
    onSelectPlace(place);
    setFocus({ lat: place.lat, lng: place.lng, zoom: place.zoom || 8, ts: Date.now(), bounds: place.bounds, province: place.province });
  };

  return (
    <div className={cx('atlas-view', selectedPlace && 'has-inspector', !active && 'is-hidden')}>
      <div className="map-stage">
        <AtlasMap
          theme={theme}
          regions={regions}
          photos={photos}
          tracks={tracks}
          selectedId={selectedPlace?.cover?.id}
          focus={focus}
          onPhotoOpen={onOpenPhoto}
          onProvinceClick={onProvinceClick}
          onCityClick={onCityClick}
          onDistrictClick={onDistrictClick}
          onNotice={onNotice}
          pickMode={!!pickMode}
          onPick={onPick}
          provider={provider}
          setProvider={setProvider}
          amapKey={amapKey}
          userLocation={userLocation}
          nativePlace={nativePlace}
        />
      </div>

      <aside className="atlas-rail glass">
        <div className="rail-glow" aria-hidden="true" />
        <div className="rail-head">
          <div className="eyebrow"><span>PERSONAL ORBIT</span><span className="eyebrow-num">07</span></div>
          <h1>{greeting()}，{profile?.name || '旅人'}<span className="accent-dot">.</span></h1>
          <p className="rail-sub">把每一次抵达，钉在地球上。</p>
          <div className="stat-strip">
            <div><strong>{String(places.length).padStart(2, '0')}</strong><span>坐标</span></div>
            <i />
            <div><strong>{String(photos.length).padStart(2, '0')}</strong><span>影像</span></div>
            <i />
            <div><strong>{String(people.length).padStart(2, '0')}</strong><span>旅人</span></div>
          </div>
        </div>

        <div className="rail-search">
          <Search size={15} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索地点或旅程" />
          {q ? <button onClick={() => setQ('')} aria-label="清除"><X size={13} /></button> : <kbd>⌘K</kbd>}
        </div>

        <div className="person-filter">
          <span className="filter-label">按旅人</span>
          <div className="person-chips">
            <button className={cx('person-chip', !personFilter && 'active')} onClick={() => onPersonFilter(null)}>
              <span className="chip-dot all" />全部
            </button>
            {people.map(p => (
              <button key={p.id} className={cx('person-chip', personFilter === p.id && 'active')} onClick={() => onPersonFilter(personFilter === p.id ? null : p.id)}>
                <span className="chip-dot" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />{p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rail-section-head">
          <span>我的坐标 <em>MY COORDINATES</em></span>
          <button onClick={() => onViewArchive(null)}>全部 <ArrowUpRight size={13} /></button>
        </div>

        <div className="place-list">
          {searchPlaces.map((place, index) => (
            <button key={place.key} className={cx('place-item', selectedPlace?.key === place.key && 'active')} onClick={() => openPlace(place)} style={{ '--i': index }}>
              <span className="place-thumb">
                <img src={place.cover.thumb} alt="" loading="lazy" />
                <span className="place-thumb-ring" />
              </span>
              <span className="place-copy">
                <strong>{place.short}</strong>
                <small>{place.count} 张 · {formatDateDots(place.lastVisit).slice(0, 7)}</small>
              </span>
              <ChevronRight size={14} className="place-arrow" />
            </button>
          ))}
          {searchPlaces.length === 0 && (
            <div className="rail-empty">
              <MapPin size={22} />
              <p>{q ? '没有找到这个坐标' : '还没有记录，上传第一张影像吧'}</p>
              <button onClick={onUpload}><Plus size={13} /> 添加影像</button>
            </div>
          )}
        </div>

        <div className="rail-footer">
          <button className="rail-add" onClick={onUpload}><Plus size={15} /> 收藏新的坐标</button>
          <div className="rail-admin-tip"><Layers3 size={12} /> {provider === 'amap' ? '高德中国底图 · 街道级 POI，切回星图可下钻省 / 市 / 区县' : '地图已细化到市 / 区县，街道级自动叠加高德 POI；顶部可切完整高德底图'}</div>
          <div className="privacy-note"><span className="live-dot" /> PRIVATE ARCHIVE <span>·</span> 数据存于本机</div>
        </div>
      </aside>

      <div className="map-status glass">
        <div className="status-orbit"><span /><i /></div>
        <div>
          <span>ARCHIVE SYNC</span>
          <strong>{photos.length} FRAMES / {places.length} PLACES</strong>
          <em>{provider === 'amap' ? 'AMAP · 街道级 POI / 中国境内' : 'CN ADMIN · 省 / 市 / 区县 · 高德 POI'}</em>
        </div>
      </div>

      <div className="map-legend glass" aria-label="人物颜色图例">
        <span className="legend-title">旅人信号</span>
        {people.slice(0, 4).map(p => <span key={p.id} className="legend-person" title={p.name}><i style={{ background: p.color }} />{p.name}</span>)}
      </div>

      {selectedPlace && (
        <>
          <button className="inspector-scrim" onClick={onClosePlace} aria-label="关闭详情" />
          <aside className="inspector glass">
            <div className="inspector-cover">
              <img src={selectedPlace.cover.image} alt={selectedPlace.cover.title} />
              <div className="cover-scan" />
              <div className="cover-badge"><MapPin size={12} /> LOCATION DOSSIER</div>
              <button className="cover-close" onClick={onClosePlace} aria-label="关闭"><X size={16} /></button>
              <div className="cover-index">LOC / {String(places.findIndex(p => p.key === selectedPlace.key) + 1).padStart(2, '0')}</div>
            </div>
            <div className="inspector-body">
              <div className="eyebrow"><span>{selectedPlace.countryCode?.toUpperCase() || 'EARTH'} / {selectedPlace.count} FRAMES</span><span>{selectedPlace.years?.slice().reverse().join(' · ')}</span></div>
              <h2>{selectedPlace.short}<span className="accent-dot">.</span></h2>
              <p className="inspector-place"><MapPin size={13} /> {selectedPlace.label}</p>

              <div className="inspector-stats">
                <div><strong>{selectedPlace.count}</strong><span>影像</span></div>
                <div><strong>{extraPeople}</strong><span>同行</span></div>
                <div><strong>{dateRange(selectedPlace.photos)}</strong><span>时间</span></div>
              </div>

              <div className="inspector-people">
                <span className="filter-label">出现的人</span>
                <div>
                  {placePeople.map(p => (
                    <span key={p.id} className="person-pill" title={p.name}><i style={{ background: p.color }}>{initials(p.name)}</i>{initials(p.name) !== p.name ? p.name : ''}</span>
                  ))}
                  {!placePeople.length && <small className="muted">未标记人物</small>}
                </div>
              </div>

              <div className="mosaic">
                {placePhotos.slice(0, 4).map((p, i) => (
                  <button key={p.id} onClick={() => onOpenPhoto(p.id)} className={cx('mosaic-cell', i === 0 && 'lead')}>
                    <img src={p.thumb} alt={p.title} loading="lazy" />
                    <span>{p.title}</span>
                  </button>
                ))}
              </div>

              <div className="inspector-tags">
                {[...new Set(placePhotos.flatMap(p => p.tags || []))].slice(0, 5).map(t => <span key={t}>{t}</span>)}
              </div>

              <div className="inspector-actions">
                <button className="primary-btn" onClick={() => onViewArchive(selectedPlace.key)}><Images size={15} /> 查看全部影像 <ArrowRight size={15} /></button>
                <button className="ghost-btn" onClick={onUpload}><Plus size={15} /> 添加</button>
              </div>

              <div className="inspector-foot">
                <span><CalendarDays size={12} /> 最近抵达 {formatDateDots(selectedPlace.lastVisit)}</span>
                <span><UserRound size={12} /> {extraPeople} 位旅人</span>
              </div>
            </div>
          </aside>
        </>
      )}

      <div className="mobile-sheet glass">
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <div>
            <span className="eyebrow">NEARBY SIGNALS</span>
            <strong>最近坐标</strong>
          </div>
          <button className="sheet-all" onClick={() => onViewArchive(null)}>全部 <ArrowUpRight size={13} /></button>
        </div>
        <div className="sheet-scroll">
          {places.slice(0, 6).map(place => (
            <button key={place.key} className="sheet-card" onClick={() => openPlace(place)}>
              <img src={place.cover.thumb} alt="" />
              <span className="sheet-card-copy"><strong>{place.short}</strong><small>{place.count} 张影像</small></span>
            </button>
          ))}
          <button className="sheet-card add" onClick={onUpload}>
            <span className="sheet-add-icon"><Sparkles size={20} /></span>
            <span className="sheet-card-copy"><strong>新坐标</strong><small>上传影像</small></span>
          </button>
        </div>
      </div>
    </div>
  );
}
