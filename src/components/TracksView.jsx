import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, GripVertical, MapPin, Pencil, Plus,
  Route as RouteIcon, Save, Search, Trash2, X,
} from 'lucide-react';
import TrackPreview from '../map/TrackPreview.jsx';
import { api } from '../lib/api.js';
import { stopsDistanceKm } from '../lib/geo-arc.js';
import { cx, formatDateTime } from '../lib/utils.js';

const COLORS = ['#65f4ff', '#ffbd73', '#b79cff', '#7df0a8', '#ff8ea8', '#9fc4ff', '#f7e57d', '#ff9f62'];
const pad = n => String(n).padStart(2, '0');

function offsetIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function atInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : offsetIso(date);
}

function byTime(a, b) {
  return (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0);
}

function trackDays(stops) {
  const days = new Set();
  for (const stop of stops || []) {
    const date = new Date(stop.at);
    if (!Number.isNaN(date.getTime())) days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  }
  return days.size;
}

function sortedStops(stops) {
  return [...(stops || [])].sort(byTime);
}

function newStop(name, lat, lng) {
  return { name: String(name || '').trim(), lat: Number(lat), lng: Number(lng), at: offsetIso(new Date()) };
}

export default function TracksView({ tracks = [], regions, onTracksChange, onNotice, onDirtyChange }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [manualOrder, setManualOrder] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState({ name: '', lat: '', lng: '' });
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!searchOpen || q.trim().length < 2) { setResults([]); setSearching(false); return undefined; }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { results: next } = await api.searchPlaces(q.trim());
        if (alive) setResults((next || []).slice(0, 8));
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 420);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, searchOpen]);

  useEffect(() => {
    if (!editing || !draft?.stops?.length) return;
    const timer = setTimeout(() => previewRef.current?.flyToBounds(draft.stops), 120);
    return () => clearTimeout(timer);
  }, [editing, draft?.stops?.length]);

  const beginNew = () => {
    setEditing('new');
    setDraft({ id: null, title: '', stops: [], color: COLORS[tracks.length % COLORS.length], notes: '' });
    setManualOrder(false);
    setDirty(false);
    setSearchOpen(false);
    setQ('');
    setManual({ name: '', lat: '', lng: '' });
  };

  const beginEdit = (track) => {
    setEditing(track.id);
    setDraft({ ...track, stops: sortedStops(track.stops), color: track.color || COLORS[0], notes: track.notes || '' });
    setManualOrder(false);
    setDirty(false);
    setSearchOpen(false);
    setQ('');
    setManual({ name: '', lat: '', lng: '' });
  };

  const closeEditor = () => {
    if (dirty && !window.confirm('当前轨迹还没有保存，确定离开吗？')) return;
    setEditing(null);
    setDraft(null);
    setDirty(false);
    setManualOrder(false);
    setSearchOpen(false);
  };

  const updateStop = (index, patch) => {
    const timeChanged = Object.prototype.hasOwnProperty.call(patch, 'at');
    if (timeChanged) setManualOrder(false);
    setDraft(prev => {
      const stops = prev.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop);
      if (timeChanged) stops.sort(byTime);
      return { ...prev, stops };
    });
    setDirty(true);
  };

  const addStop = (stop) => {
    if (!stop.name || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) {
      onNotice?.('请填写地点名称和有效经纬度', 'error');
      return;
    }
    setDraft(prev => {
      const stops = [...prev.stops, stop];
      if (!manualOrder) stops.sort(byTime);
      return { ...prev, stops };
    });
    setDirty(true);
    setSearchOpen(false);
    setQ('');
    setManual({ name: '', lat: '', lng: '' });
  };

  const moveStop = (from, to) => {
    if (from === to || from == null || to == null) return;
    setDraft(prev => {
      const stops = [...prev.stops];
      const [item] = stops.splice(from, 1);
      stops.splice(to, 0, item);
      return { ...prev, stops };
    });
    setManualOrder(true);
    setDirty(true);
  };

  const addManual = () => {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (!manual.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      onNotice?.('请输入地点名称和有效经纬度', 'error');
      return;
    }
    addStop(newStop(manual.name, lat, lng));
  };

  const save = async () => {
    if (!draft) return;
    if (draft.stops.length < 2) { onNotice?.('轨迹至少需要两个地点', 'error'); return; }
    if (draft.stops.some(s => !s.name?.trim() || !Number.isFinite(Number(s.lat)) || !Number.isFinite(Number(s.lng)) || !s.at)) {
      onNotice?.('请补全每个地点的名称、坐标和时间', 'error');
      return;
    }
    const payload = {
      title: draft.title.trim() || '未命名轨迹',
      stops: draft.stops,
      color: draft.color,
      notes: draft.notes || '',
    };
    try {
      const res = editing === 'new' ? await api.createTrack(payload) : await api.updateTrack(editing, payload);
      const next = editing === 'new'
        ? [...tracks, res.track]
        : tracks.map(t => t.id === editing ? res.track : t);
      onTracksChange(next.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      setDirty(false);
      setEditing(null);
      setDraft(null);
      onNotice?.('轨迹已保存');
    } catch (e) {
      onNotice?.(e.message, 'error');
    }
  };

  const saveRename = async (id) => {
    const title = renameValue.trim();
    if (!title) { setRenameId(null); return; }
    try {
      const res = await api.updateTrack(id, { title });
      onTracksChange(tracks.map(t => t.id === id ? res.track : t));
      setRenameId(null);
      setRenameValue('');
      onNotice?.('轨迹已重命名');
    } catch (e) { onNotice?.(e.message, 'error'); }
  };

  const removeTrack = async (id) => {
    try {
      await api.deleteTrack(id);
      onTracksChange(tracks.filter(t => t.id !== id));
      setDeleteId(null);
      onNotice?.('轨迹已删除');
    } catch (e) { onNotice?.(e.message, 'error'); }
  };

  if (draft) {
    const distance = stopsDistanceKm(draft.stops);
    const days = trackDays(draft.stops);
    return (
      <div className="page-view view-tracks">
        <div className="page-wrap track-wrap">
          <div className="track-editor">
            <header className="track-editor-head">
              <button className="ghost-btn track-back" onClick={closeEditor}><ArrowLeft size={15} /> 返回列表</button>
              <div className="track-title-field">
                <span>TRACK NAME</span>
                <input value={draft.title} maxLength={60} placeholder="给这段旅程命名" onChange={e => { setDraft(prev => ({ ...prev, title: e.target.value })); setDirty(true); }} />
              </div>
              <div className="track-editor-stats">
                <span><strong>{draft.stops.length}</strong> 地点</span>
                <span><strong>{days}</strong> 天</span>
                <span><strong>{Math.round(distance).toLocaleString()}</strong> km</span>
              </div>
              <div className="track-colors" aria-label="轨迹颜色">
                {COLORS.map(color => (
                  <button key={color} type="button" className={cx('color-dot', draft.color === color && 'active')} style={{ background: color }} onClick={() => { setDraft(prev => ({ ...prev, color })); setDirty(true); }} aria-label={color}>
                    {draft.color === color && <Check size={11} />}
                  </button>
                ))}
              </div>
              <button className="primary-btn track-save" onClick={save}><Save size={14} /> 保存轨迹</button>
            </header>

            <div className="track-editor-body">
              <section className="track-itinerary glass">
                <div className="track-section-head">
                  <div><span className="eyebrow">ITINERARY</span><h2>行程单</h2></div>
                  <button className="ghost-btn" onClick={() => setSearchOpen(v => !v)}><Plus size={14} /> 添加地点</button>
                </div>

                {draft.stops.length === 0 && <div className="track-empty"><MapPin size={22} /><p>至少添加两个地点，弧线才会出现。</p></div>}

                <div className="track-stop-list">
                  {draft.stops.map((stop, index) => (
                    <div
                      key={`${stop.at}-${index}`}
                      className={cx('track-stop-row', dragIndex === index && 'dragging')}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragEnd={() => setDragIndex(null)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { moveStop(dragIndex, index); setDragIndex(null); }}
                    >
                      <span className="track-drag" title="拖拽排序"><GripVertical size={15} /></span>
                      <span className="track-stop-name">
                        <MapPin size={13} />
                        <input value={stop.name} placeholder="地点名称" onChange={e => updateStop(index, { name: e.target.value })} />
                      </span>
                      <span className="track-stop-time">
                        <Clock3 size={13} />
                        <input type="datetime-local" value={atInput(stop.at)} onChange={e => updateStop(index, { at: fromInput(e.target.value) })} />
                      </span>
                      <button className="track-stop-delete" aria-label="删除地点" onClick={() => { setDraft(prev => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) })); setDirty(true); }}><X size={15} /></button>
                    </div>
                  ))}
                </div>

                {searchOpen && (
                  <div className="track-add-panel">
                    <div className="track-add-head">
                      <div><span className="eyebrow">ADD STOP</span><strong>添加地点</strong></div>
                      <button className="track-icon-btn" onClick={() => setSearchOpen(false)} aria-label="关闭添加地点"><X size={15} /></button>
                    </div>
                    <div className="track-search-row"><Search size={15} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="搜索城市、地标或 POI…" /></div>
                    {searching && <div className="track-search-hint">正在检索地点…</div>}
                    {!searching && q.trim().length >= 2 && results.length === 0 && <div className="track-search-hint">没有找到匹配地点</div>}
                    <div className="track-search-results">
                      {results.map((result, index) => (
                        <button key={`${result.lat}-${result.lng}-${index}`} className="track-result" onClick={() => addStop(newStop(result.label, result.lat, result.lng))}>
                          <MapPin size={14} /><span><strong>{result.label}</strong><small>{[result.province, result.city, result.district].filter(Boolean).join(' · ')}</small></span><ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                    <div className="track-manual">
                      <span>手动坐标</span>
                      <input value={manual.name} onChange={e => setManual(v => ({ ...v, name: e.target.value }))} placeholder="地点名" />
                      <input value={manual.lat} onChange={e => setManual(v => ({ ...v, lat: e.target.value }))} placeholder="纬度 lat" inputMode="decimal" />
                      <input value={manual.lng} onChange={e => setManual(v => ({ ...v, lng: e.target.value }))} placeholder="经度 lng" inputMode="decimal" />
                      <button className="primary-btn" onClick={addManual}><Plus size={13} /> 加入</button>
                    </div>
                  </div>
                )}
              </section>

              <aside className="track-map-panel glass">
                <div className="track-map-head"><span>LIVE PREVIEW</span><em>{draft.stops.length} STOPS</em></div>
                <div className="track-preview-wrap">
                  <TrackPreview ref={previewRef} stops={draft.stops} color={draft.color} height="100%" />
                </div>
                <div className="track-map-foot"><MapPin size={12} /> 相邻地点自动连接大圆弧线</div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-view view-tracks">
      <div className="page-ambient" aria-hidden="true" />
      <div className="page-wrap track-wrap">
        <div className="track-list-head">
          <div>
            <div className="eyebrow"><span>CUSTOM ROUTES / 03</span><span>{String(tracks.length).padStart(2, '0')} TRACKS</span></div>
            <h1 className="page-title">轨迹<span className="accent-dot">.</span></h1>
            <p>不是路径记录，而是按顺序把地点连成一段旅程。</p>
          </div>
          <button className="primary-btn title-cta" onClick={beginNew}><Plus size={16} /> 新建轨迹</button>
        </div>

        {tracks.length === 0 ? (
          <div className="track-empty track-empty-page glass">
            <RouteIcon size={30} />
            <h2>还没有自定义轨迹</h2>
            <p>添加第一个地点，让两颗坐标之间出现一条光。</p>
            <button className="primary-btn" onClick={beginNew}><Plus size={15} /> 新建轨迹</button>
          </div>
        ) : (
          <div className="track-grid">
            {tracks.map((track, index) => {
              const stops = sortedStops(track.stops);
              const start = stops[0]?.at;
              const end = stops[stops.length - 1]?.at;
              return (
                <article className="track-card glass" key={track.id}>
                  <div className="track-card-top">
                    <span className="track-card-index">TRACK / {String(index + 1).padStart(2, '0')}{track.auto && <em className="track-auto-badge" title="按相邻照片超过 24 小时自动生成">AUTO</em>}</span>
                    <span className="track-card-line" style={{ background: track.color }} />
                  </div>
                  {renameId === track.id ? (
                    <div className="track-rename">
                      <input autoFocus value={renameValue} maxLength={60} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(track.id); if (e.key === 'Escape') setRenameId(null); }} />
                      <button className="primary-btn" onClick={() => saveRename(track.id)}><Check size={13} /></button>
                      <button className="ghost-btn" onClick={() => setRenameId(null)}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <h2>{track.title}</h2>
                      <p className="track-card-time"><CalendarDays size={13} /> {formatDateTime(start)} <span>→</span> {formatDateTime(end)}</p>
                      <div className="track-card-stats">
                        <span><strong>{stops.length}</strong> 地点</span>
                        <span><strong>{trackDays(stops)}</strong> 天</span>
                        <span><strong>{Math.round(stopsDistanceKm(stops)).toLocaleString()}</strong> km</span>
                      </div>
                      <div className="track-card-actions">
                        <button className="primary-btn" onClick={() => beginEdit(track)}><Pencil size={13} /> 编辑</button>
                        <button className="ghost-btn" onClick={() => { setRenameId(track.id); setRenameValue(track.title); }}><RouteIcon size={13} /> 重命名</button>
                        <button className="danger-icon" onClick={() => setDeleteId(track.id)} aria-label="删除轨迹"><Trash2 size={14} /></button>
                      </div>
                      {deleteId === track.id && (
                        <div className="track-delete-confirm">
                          <span>确定删除「{track.title}」？</span>
                          <button className="danger-btn" onClick={() => removeTrack(track.id)}>确认删除</button>
                          <button className="ghost-btn" onClick={() => setDeleteId(null)}>取消</button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
