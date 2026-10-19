import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Filter, Images, MapPin, Search, SlidersHorizontal, Sparkles, Tag, Trash2, UserPlus, UserRound, X } from 'lucide-react';
import LocationFields from './LocationFields.jsx';
import { cx, formatPhotoDate, formatPhotoDateDots, initials, personMap, photoSortValue, photoYear, shortPlace } from '../lib/utils.js';

function aspectOf(photo) {
  const m = String(photo.dimensions || '').match(/(\d+)\s*[×x]\s*(\d+)/);
  if (m) {
    const ratio = Number(m[1]) / Number(m[2]);
    return Math.min(1.55, Math.max(.68, ratio));
  }
  return 4 / 3;
}

export default function ArchiveView({ photos, places, people, filter, setFilter, onOpenPhoto, onUpload, onClearFilter, onPersonFilter, regions, onNotice, onBulkUpdate, onBulkDelete }) {
  const peopleById = useMemo(() => personMap(people), [people]);
  const years = useMemo(() => [...new Set(photos.map(photoYear).filter(Boolean))].sort((a, b) => b - a), [photos]);
  const provinces = useMemo(() => [...new Set(photos.map(p => p.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [photos]);
  const placeOptions = useMemo(() => places.filter(p => !filter.province || p.province === filter.province), [places, filter.province]);

  const filtered = useMemo(() => {
    return photos.filter(p => {
      if (filter.personId && !p.personIds?.includes(filter.personId)) return false;
      if (filter.year && photoYear(p) !== Number(filter.year)) return false;
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
    }).sort((a, b) => photoSortValue(b) - photoSortValue(a));
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
  const [visibleCount, setVisibleCount] = useState(60);
  const sentinelRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkPanel, setBulkPanel] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkPeople, setBulkPeople] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [bulkTags, setBulkTags] = useState([]);
  const [tagMode, setTagMode] = useState('add');
  const [bulkLocation, setBulkLocation] = useState({ country: '中国', countryCode: 'cn', province: '', city: '', district: '', locationName: '' });
  const lastIndexRef = useRef(null);

  useEffect(() => {
    setVisibleCount(60);
    setSelected(new Set());
    setBulkPanel(null);
    setBulkPeople([]);
    setBulkTags([]);
    lastIndexRef.current = null;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [filter.personId, filter.year, filter.province, filter.placeKey, filter.q]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const columns = useMemo(() => {
    const out = Array.from({ length: columnCount }, () => []);
    visible.forEach((photo, index) => out[index % columnCount].push({ photo, index }));
    return out;
  }, [visible, columnCount]);

  const clearSelection = ({ exit = false } = {}) => {
    setSelected(new Set());
    lastIndexRef.current = null;
    setBulkPanel(null);
    setBulkPeople([]);
    setBulkTags([]);
    if (exit) setSelecting(false);
  };

  const toggleSelecting = () => {
    if (selecting) clearSelection({ exit: true });
    else setSelecting(true);
  };

  const handleCardClick = (event, photo, index) => {
    if (!selecting) {
      onOpenPhoto(photo.id);
      return;
    }
    event.preventDefault();
    if (event.shiftKey && lastIndexRef.current !== null) {
      const start = Math.min(lastIndexRef.current, index);
      const end = Math.max(lastIndexRef.current, index);
      const range = filtered.slice(start, end + 1).map(item => item.id);
      setSelected(prev => {
        const next = new Set(prev);
        range.forEach(id => next.add(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(photo.id)) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
    }
    lastIndexRef.current = index;
  };

  const runBulkUpdate = async (patch, message) => {
    if (!selected.size || !onBulkUpdate) return;
    setBulkBusy(true);
    try {
      const result = await onBulkUpdate([...selected], patch);
      clearSelection({ exit: true });
      onNotice?.(message(result.updated));
    } catch (error) {
      onNotice?.(error.message || '批量更新失败，请重试');
    } finally {
      setBulkBusy(false);
    }
  };

  const submitPeople = () => {
    if (!bulkPeople.length) return;
    runBulkUpdate({ personIds: bulkPeople, personIdsMode: 'add' }, count => `已更新 ${count} 张`);
  };

  const addBulkTag = () => {
    const tag = tagInput.trim();
    if (!tag || bulkTags.includes(tag)) return;
    setBulkTags(prev => [...prev, tag]);
    setTagInput('');
  };

  const submitTags = () => {
    if (!bulkTags.length) return;
    runBulkUpdate({ tags: bulkTags, tagsMode: tagMode }, count => `已更新 ${count} 张`);
  };

  const submitLocation = () => {
    const patch = {};
    for (const key of ['province', 'city', 'district', 'locationName']) {
      if (String(bulkLocation[key] || '').trim()) patch[key] = bulkLocation[key];
    }
    if (!Object.keys(patch).length) {
      onNotice?.('请至少填写一个地点字段');
      return;
    }
    runBulkUpdate(patch, count => `已更新 ${count} 张`);
  };

  const submitDelete = async () => {
    if (!selected.size || !onBulkDelete) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: selected.size });
    try {
      const result = await onBulkDelete([...selected], progress => setBulkProgress(progress));
      if (result.failures?.length) {
        setSelected(new Set(result.failures.map(item => item.id)));
        onNotice?.(`已删除 ${result.deleted.length} 张，${result.failures.length} 张失败：${result.failures[0].error}`);
      } else {
        clearSelection({ exit: true });
        onNotice?.(`已删除 ${result.deleted.length} 张照片`);
      }
    } catch (error) {
      onNotice?.(error.message || '删除失败，请重试');
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  useEffect(() => {
    if (filtered.length <= visibleCount) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(count => Math.min(count + 60, filtered.length));
    }, { rootMargin: '400px' });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [filtered.length, visibleCount]);

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
          <div className="title-actions">
            <button className={cx('ghost-btn', selecting && 'active')} onClick={toggleSelecting}>
              {selecting ? <><Check size={15} /> 完成</> : <><Check size={15} /> 选择</>}
            </button>
            <button className="primary-btn title-cta" onClick={onUpload}><Sparkles size={16} /> 写入新影像</button>
          </div>
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

        {selecting && (
          <div className="archive-selection-bar glass">
            <span>已选 <strong>{selected.size}</strong> 张 / 共 {filtered.length} 张</span>
            <div className="archive-selection-actions">
              <button className="ghost-btn" onClick={() => { setSelected(new Set(filtered.map(p => p.id))); lastIndexRef.current = null; }}>全选当前结果</button>
              <button className="ghost-btn" onClick={() => clearSelection()} disabled={!selected.size}>取消选择</button>
            </div>
          </div>
        )}

        {filtered.length > 0 ? (
          <>
          <div className="photo-masonry">
            {columns.map((column, columnIndex) => (
              <div className="photo-column" key={columnIndex}>
                {column.map(({ photo: p, index: i }) => {
                  const peopleIn = (p.personIds || []).map(id => peopleById.get(id)).filter(Boolean);
                  return (
                    <button key={p.id} className={cx('photo-card', i < 12 && 'enter-card', i % 7 === 0 && 'featured', selecting && 'selecting-card', selected.has(p.id) && 'selected')} onClick={(event) => handleCardClick(event, p, i)} style={{ '--ratio': aspectOf(p), '--delay': `${i < 12 ? i * 25 : 0}ms` }} aria-pressed={selecting ? selected.has(p.id) : undefined}>
                      <span className="photo-frame" style={{ aspectRatio: `var(--ratio)` }}>
                        {selecting && <span className="photo-check" aria-hidden="true">{selected.has(p.id) && <Check size={13} />}</span>}
                        <img src={p.thumb || p.image} alt={p.title} loading="lazy" decoding="async" />
                        {/* 列表只用缩略图；大图预览仍走 PhotoModal 的 p.image */}
                        <span className="photo-scan" />
                        <span className="photo-index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="photo-hover">
                          <span className="photo-hover-top"><MapPin size={12} /> {shortPlace(p)}</span>
                          <strong>{p.title}</strong>
                          <span className="photo-hover-foot"><span>{formatPhotoDateDots(p)}</span><span>{p.camera || 'UNKNOWN CAMERA'}</span></span>
                        </span>
                        {p.demo && <span className="demo-badge">SAMPLE</span>}
                      </span>
                      <span className="photo-caption">
                        <span><strong>{p.title}</strong><small>{shortPlace(p)} · {formatPhotoDate(p, { year: 'numeric', month: '2-digit', day: '2-digit' })}</small></span>
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
          <div className="archive-pagination">
            {visibleCount < filtered.length ? (
              <>
                <div ref={sentinelRef} className="archive-sentinel" aria-hidden="true" />
                <button className="ghost-btn archive-more" onClick={() => setVisibleCount(count => Math.min(count + 60, filtered.length))}>加载更多</button>
              </>
            ) : (
              <span className="archive-complete">已显示全部 {filtered.length} 张</span>
            )}
          </div>
          </>
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

        {selecting && selected.size > 0 && (
          <>
            <div className="bulk-bar glass">
              <span className="bulk-count">已选 <strong>{selected.size}</strong> 张</span>
              <div className="bulk-actions">
                <button className="ghost-btn" onClick={() => setBulkPanel(panel => panel === 'people' ? null : 'people')}><UserPlus size={14} /> 加人物</button>
                <button className="ghost-btn" onClick={() => setBulkPanel(panel => panel === 'tags' ? null : 'tags')}><Tag size={14} /> 加标签</button>
                <button className="ghost-btn" onClick={() => setBulkPanel(panel => panel === 'location' ? null : 'location')}><MapPin size={14} /> 改地点</button>
                <button className="ghost-btn danger" onClick={() => setBulkPanel(panel => panel === 'delete' ? null : 'delete')}><Trash2 size={14} /> 删除</button>
              </div>
            </div>

            {bulkPanel && (
              <div className="bulk-panel glass">
                <div className="bulk-panel-head">
                  <strong>{bulkPanel === 'people' ? '加人物' : bulkPanel === 'tags' ? '加标签' : bulkPanel === 'location' ? '改地点' : '删除照片'}</strong>
                  <button className="icon-btn" onClick={() => setBulkPanel(null)} aria-label="关闭"><X size={14} /></button>
                </div>

                {bulkPanel === 'people' && (
                  <div className="bulk-panel-body">
                    <div className="bulk-people">
                      {people.map(person => (
                        <button key={person.id} className={cx('bulk-person', bulkPeople.includes(person.id) && 'active')} onClick={() => setBulkPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}>
                          <span className="bulk-avatar" style={{ background: person.color }}>{initials(person.name)}</span>
                          <span>{person.name}</span>
                          {bulkPeople.includes(person.id) && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                    <button className="primary-btn bulk-submit" disabled={bulkBusy || !bulkPeople.length} onClick={submitPeople}>加入 {selected.size} 张</button>
                  </div>
                )}

                {bulkPanel === 'tags' && (
                  <div className="bulk-panel-body">
                    <div className="bulk-segmented">
                      <button className={tagMode === 'add' ? 'active' : ''} onClick={() => setTagMode('add')}>添加</button>
                      <button className={tagMode === 'remove' ? 'active' : ''} onClick={() => setTagMode('remove')}>移除</button>
                    </div>
                    <div className="bulk-tag-input">
                      <input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addBulkTag(); } }} placeholder="输入标签后回车" />
                      <button className="ghost-btn" onClick={addBulkTag}>添加标签</button>
                    </div>
                    <div className="bulk-chips">
                      {bulkTags.map(tag => <button key={tag} className="bulk-chip" onClick={() => setBulkTags(prev => prev.filter(item => item !== tag))}>{tag}<X size={11} /></button>)}
                    </div>
                    <button className="primary-btn bulk-submit" disabled={bulkBusy || !bulkTags.length} onClick={submitTags}>{tagMode === 'add' ? '添加' : '移除'} {selected.size} 张</button>
                  </div>
                )}

                {bulkPanel === 'location' && (
                  <div className="bulk-panel-body">
                    <p className="bulk-hint">留空的字段不会修改。</p>
                    <LocationFields value={bulkLocation} onChange={setBulkLocation} regions={regions} compact onNotice={onNotice} />
                    <button className="primary-btn bulk-submit" disabled={bulkBusy} onClick={submitLocation}>更新 {selected.size} 张地点</button>
                  </div>
                )}

                {bulkPanel === 'delete' && (
                  <div className="bulk-panel-body">
                    <p className="bulk-danger-text">将同时删除原图、展示图和缩略图，不可恢复。</p>
                    <p className="bulk-warning">将删除 <strong>{selected.size}</strong> 张</p>
                    {bulkProgress && <p className="bulk-progress">正在删除 {bulkProgress.done}/{bulkProgress.total}</p>}
                    <div className="bulk-delete-actions">
                      <button className="ghost-btn" onClick={() => setBulkPanel(null)} disabled={bulkBusy}>取消</button>
                      <button className="primary-btn danger-btn" onClick={submitDelete} disabled={bulkBusy}>确认删除</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
