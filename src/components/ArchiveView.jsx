import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Filter, Images, MapPin, Search, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react';
import { cx, formatDate, formatDateDots, initials, personMap, shortPlace, yearOf } from '../lib/utils.js';

function aspectOf(photo) {
  const m = String(photo.dimensions || '').match(/(\d+)\s*[×x]\s*(\d+)/);
  if (m) {
    const ratio = Number(m[1]) / Number(m[2]);
    return Math.min(1.55, Math.max(.68, ratio));
  }
  return 4 / 3;
}

export default function ArchiveView({ photos, places, people, filter, setFilter, onOpenPhoto, onUpload, onClearFilter, onPersonFilter }) {
  const peopleById = useMemo(() => personMap(people), [people]);
  const years = useMemo(() => [...new Set(photos.map(p => yearOf(p.capturedAt)).filter(Boolean))].sort((a, b) => b - a), [photos]);
  const provinces = useMemo(() => [...new Set(photos.map(p => p.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [photos]);
  const placeOptions = useMemo(() => places.filter(p => !filter.province || p.province === filter.province), [places, filter.province]);

  const filtered = useMemo(() => {
    return photos.filter(p => {
      if (filter.personId && !p.personIds?.includes(filter.personId)) return false;
      if (filter.year && yearOf(p.capturedAt) !== Number(filter.year)) return false;
      if (filter.province && p.province !== filter.province) return false;
      if (filter.placeKey) {
        const key = [p.countryCode || p.country, p.province, p.city, p.district].filter(Boolean).join('|') || `spot:${p.locationName}`;
        if (key !== filter.placeKey) return false;
      }
      if (filter.q) {
        const term = filter.q.toLowerCase();
        const hay = [p.title, p.locationName, p.city, p.province, p.country, p.notes, ...(p.tags || []), ...(p.personIds || []).map(id => peopleById.get(id)?.name)].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  }, [photos, filter, peopleById]);

  const hasFilter = filter.personId || filter.year || filter.placeKey || filter.province || filter.q;
  const set = (patch) => setFilter(prev => ({ ...prev, ...patch }));

  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth <= 1180) return window.innerWidth <= 860 ? 2 : 3;
    return 4;
  });
  useEffect(() => {
    const onResize = () => setColumnCount(window.innerWidth <= 1180 ? (window.innerWidth <= 860 ? 2 : 3) : 4);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const columns = useMemo(() => {
    const out = Array.from({ length: columnCount }, () => []);
    filtered.forEach((photo, index) => out[index % columnCount].push({ photo, index }));
    return out;
  }, [filtered, columnCount]);

  return (
    <div className="page-view archive-view">
      <div className="page-ambient" aria-hidden="true" />
      <div className="page-wrap">
        <div className="page-title-row">
          <div>
            <div className="eyebrow"><span>OPTICAL ARCHIVE / 02</span><span>{String(filtered.length).padStart(3, '0')} FRAMES</span></div>
            <h1 className="page-title">影像档案<span className="accent-dot">.</span></h1>
            <p>每一帧，都是某个坐标曾经发光的证据。</p>
          </div>
          <button className="primary-btn title-cta" onClick={onUpload}><Sparkles size={16} /> 写入新影像</button>
        </div>

        <div className="filter-bar glass">
          <div className="filter-search">
            <Search size={15} />
            <input value={filter.q} onChange={e => set({ q: e.target.value })} placeholder="搜索标题、地点、标签或人物…" />
            {filter.q && <button onClick={() => set({ q: '' })} aria-label="清除"><X size={13} /></button>}
          </div>
          <span className="filter-divider" />
          <div className="filter-group">
            <span className="filter-label"><UserRound size={12} /> 人物</span>
            <div className="person-chips">
              <button className={cx('person-chip', !filter.personId && 'active')} onClick={() => set({ personId: '' })}>全部</button>
              {people.map(p => (
                <button key={p.id} className={cx('person-chip', filter.personId === p.id && 'active')} onClick={() => set({ personId: filter.personId === p.id ? '' : p.id })}>
                  <span className="chip-dot" style={{ background: p.color }} />{p.name}
                </button>
              ))}
            </div>
          </div>
          <span className="filter-divider" />
          <div className="filter-selects">
            <label><CalendarDays size={13} /><select value={filter.year} onChange={e => set({ year: e.target.value })}><option value="">所有年份</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
            <label><MapPin size={13} /><select value={filter.province} onChange={e => set({ province: e.target.value, placeKey: '' })}><option value="">所有地区</option>{provinces.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
            <label><SlidersHorizontal size={13} /><select value={filter.placeKey} onChange={e => set({ placeKey: e.target.value })}><option value="">所有坐标</option>{placeOptions.map(p => <option key={p.key} value={p.key}>{p.short}</option>)}</select></label>
          </div>
          {hasFilter && <button className="clear-filter" onClick={onClearFilter}><X size={13} /> 清除</button>}
        </div>

        <div className="archive-meta">
          <span><Filter size={13} /> {hasFilter ? '筛选结果' : '全部影像'} <strong>{filtered.length}</strong></span>
          <span>按拍摄时间倒序 <i /></span>
        </div>

        {filtered.length > 0 ? (
          <div className="photo-masonry">
            {columns.map((column, columnIndex) => (
              <div className="photo-column" key={columnIndex}>
                {column.map(({ photo: p, index: i }) => {
                  const peopleIn = (p.personIds || []).map(id => peopleById.get(id)).filter(Boolean);
                  return (
                    <button key={p.id} className={cx('photo-card', i % 7 === 0 && 'featured')} onClick={() => onOpenPhoto(p.id)} style={{ '--ratio': aspectOf(p), '--delay': `${Math.min(i, 12) * 25}ms` }}>
                      <span className="photo-frame" style={{ aspectRatio: `var(--ratio)` }}>
                        <img src={p.image} alt={p.title} loading="lazy" />
                        <span className="photo-scan" />
                        <span className="photo-index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="photo-hover">
                          <span className="photo-hover-top"><MapPin size={12} /> {shortPlace(p)}</span>
                          <strong>{p.title}</strong>
                          <span className="photo-hover-foot"><span>{formatDateDots(p.capturedAt)}</span><span>{p.camera || 'UNKNOWN CAMERA'}</span></span>
                        </span>
                        {p.demo && <span className="demo-badge">SAMPLE</span>}
                      </span>
                      <span className="photo-caption">
                        <span><strong>{p.title}</strong><small>{shortPlace(p)} · {formatDate(p.capturedAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}</small></span>
                        {peopleIn.length > 0 && (
                          <span className="caption-people">
                            {peopleIn.slice(0, 3).map(person => <i key={person.id} style={{ background: person.color }} title={person.name}>{initials(person.name)}</i>)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state glass">
            <div className="empty-orbit"><Images size={28} /></div>
            <h3>这片星区还没有影像</h3>
            <p>{hasFilter ? '试试放宽筛选条件，或清除所有过滤器。' : '上传第一张照片，让它成为你私人星图的第一个坐标。'}</p>
            <div className="empty-actions">
              {hasFilter ? <button className="ghost-btn" onClick={onClearFilter}>清除筛选</button> : null}
              <button className="primary-btn" onClick={onUpload}><Sparkles size={15} /> 上传影像</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
