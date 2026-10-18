import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Loader2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { formatDateDots, placeLabel, shortPlace } from '../lib/utils.js';

export default function SearchPalette({ open, onClose, photos, places, people, onPhoto, onPlace, onPerson, onAddAtPlace }) {
  const [q, setQ] = useState('');
  const [external, setExternal] = useState([]);
  const [externalLoading, setExternalLoading] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setQ(''); setExternal([]);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setExternal([]); setExternalLoading(false); return; }
    let alive = true;
    setExternal([]);
    setExternalLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { results } = await api.searchPlaces(term);
        if (alive) setExternal((results || []).slice(0, 6));
      } catch { if (alive) setExternal([]); }
      finally { if (alive) setExternalLoading(false); }
    }, 480);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      return {
        places: places.slice(0, 4),
        photos: photos.slice(0, 3),
        people: people.slice(0, 3),
      };
    }
    const match = (...vals) => vals.filter(Boolean).join(' ').toLowerCase().includes(term);
    return {
      places: places.filter(p => match(p.label, p.locationName, p.city, p.province, p.country)).slice(0, 5),
      photos: photos.filter(p => match(p.title, p.locationName, p.city, p.province, p.country, ...(p.tags || []))).slice(0, 5),
      people: people.filter(p => match(p.name, p.note)).slice(0, 4),
    };
  }, [q, photos, places, people]);

  if (!open) return null;
  const total = results.places.length + results.photos.length + results.people.length + external.length;
  return createPortal(
    <div className="search-layer" role="dialog" aria-modal="true" aria-label="全局搜索">
      <button className="search-scrim" onClick={onClose} aria-label="关闭搜索" />
      <div className="search-panel glass">
        <div className="search-input-row">
          <Search size={19} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="搜索地点、影像、旅人…" />
          <button onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        {!q && <div className="search-hint">SEARCH THE ORBIT · 输入关键词开始检索</div>}
        <div className="search-results">
          {results.places.length > 0 && (
            <section>
              <h4>坐标 <span>PLACES</span></h4>
              {results.places.map(p => (
                <button key={p.key} className="search-result" onClick={() => { onClose(); onPlace(p); }}>
                  <img src={p.cover.thumb} alt="" />
                  <span><strong>{p.label}</strong><small>{p.count} 张影像 · {formatDateDots(p.lastVisit)}</small></span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </section>
          )}
          {results.photos.length > 0 && (
            <section>
              <h4>影像 <span>FRAMES</span></h4>
              {results.photos.map(p => (
                <button key={p.id} className="search-result" onClick={() => { onClose(); onPhoto(p.id); }}>
                  <img src={p.thumb} alt="" />
                  <span><strong>{p.title}</strong><small>{shortPlace(p)} · {formatDateDots(p.capturedAt)}</small></span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </section>
          )}
          {results.people.length > 0 && (
            <section>
              <h4>旅人 <span>PEOPLE</span></h4>
              {results.people.map(p => (
                <button key={p.id} className="search-result person" onClick={() => { onClose(); onPerson(p.id); }}>
                  <span className="mini-avatar" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
                  <span><strong>{p.name}</strong><small>{photos.filter(x => x.personIds?.includes(p.id)).length} 张共同影像</small></span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </section>
          )}
          {q.trim().length >= 2 && (externalLoading || external.length > 0) && (
            <section className="search-external">
              <h4>地图地点 <span>AMAP / OSM</span></h4>
              {externalLoading && <div className="search-loading"><Loader2 size={14} className="spin" /> 正在检索地点…</div>}
              {!externalLoading && external.map((r, i) => (
                <button key={`${r.lat}-${r.lng}-${i}`} className="search-result place-add" onClick={() => { onClose(); onAddAtPlace?.(r); }}>
                  <span className="search-place-icon"><MapPin size={16} /></span>
                  <span><strong>{r.label}</strong><small>{r.detail || [r.province, r.city, r.district].filter(Boolean).join(' · ')}</small></span>
                  <span className="add-place-cta"><Sparkles size={11} /> 在此添加</span>
                </button>
              ))}
            </section>
          )}
          {q && total === 0 && !externalLoading && <div className="search-empty">这颗星球上暂时没有匹配的信号。</div>}
        </div>
        <div className="search-footer"><kbd>ESC</kbd> 关闭 <span>·</span> 数据仅存于本机</div>
      </div>
    </div>,
    document.body
  );
}
