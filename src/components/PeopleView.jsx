import { useMemo } from 'react';
import { ArrowUpRight, Camera, MapPin, Plus, Sparkles, UserRound, Users } from 'lucide-react';
import { formatDateDots, initials, personMap, regionKey } from '../lib/utils.js';

export default function PeopleView({ people, photos, places, onAddPerson, onEditPerson, onOpenPhoto, onViewArchive, onUploadForPerson }) {
  const stats = useMemo(() => {
    return people.map(person => {
      const own = photos.filter(p => p.personIds?.includes(person.id)).sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
      const placeKeys = new Set(own.map(regionKey));
      const countryKeys = new Set(own.map(p => p.countryCode || p.country).filter(Boolean));
      return { person, photos: own, places: placeKeys.size, countries: countryKeys.size, last: own[0]?.capturedAt };
    }).sort((a, b) => b.photos.length - a.photos.length);
  }, [people, photos]);

  const pairs = useMemo(() => {
    const counts = new Map();
    for (const photo of photos) {
      const ids = [...new Set(photo.personIds || [])];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('|');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const byId = personMap(people);
    return [...counts.entries()].map(([key, count]) => {
      const [a, b] = key.split('|');
      return { a: byId.get(a), b: byId.get(b), count };
    }).filter(x => x.a && x.b).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [photos, people]);

  return (
    <div className="page-view people-view">
      <div className="page-ambient" aria-hidden="true" />
      <div className="page-wrap">
        <div className="page-title-row">
          <div>
            <div className="eyebrow"><span>TRAVELERS / 03</span><span>{people.length} SIGNALS</span></div>
            <h1 className="page-title">旅人星图<span className="accent-dot">.</span></h1>
            <p>有些坐标之所以发光，是因为有人和你一起抵达。</p>
          </div>
          <button className="primary-btn title-cta" onClick={onAddPerson}><Plus size={16} /> 添加旅人</button>
        </div>

        <div className="people-overview glass">
          <div className="overview-cell"><Users size={17} /><strong>{people.length}</strong><span>旅人档案</span></div>
          <div className="overview-cell"><Camera size={17} /><strong>{photos.length}</strong><span>共同影像</span></div>
          <div className="overview-cell"><MapPin size={17} /><strong>{new Set(photos.map(regionKey)).size}</strong><span>共同坐标</span></div>
          <div className="overview-pairs">
            <span className="filter-label">高频同行</span>
            {pairs.length ? pairs.map(pair => (
              <span key={`${pair.a.id}-${pair.b.id}`} className="pair-chip">
                <i style={{ background: pair.a.color }}>{pair.a.name.slice(0, 1)}</i>
                <i style={{ background: pair.b.color }}>{pair.b.name.slice(0, 1)}</i>
                {pair.a.name} × {pair.b.name}<b>{pair.count}</b>
              </span>
            )) : <small className="muted">还没有多人同框的影像</small>}
          </div>
        </div>

        <div className="people-grid">
          {stats.map(({ person, photos: own, places: placeCount, countries, last }, index) => (
            <article key={person.id} className="person-card glass" style={{ '--accent': person.color, '--delay': `${index * 50}ms` }}>
              <div className="person-card-glow" aria-hidden="true" />
              <div className="person-card-head">
                <div className="person-avatar" style={{ '--avatar': person.color }}>
                  <span>{initials(person.name)}</span>
                  <i className="avatar-orbit" />
                </div>
                <div className="person-title">
                  <div className="eyebrow"><span>HUMAN SIGNAL / {String(index + 1).padStart(2, '0')}</span></div>
                  <h2>{person.name}</h2>
                  <p>{person.note || '尚未写下关于 TA 的注记'}</p>
                </div>
                <button className="icon-btn glass person-edit" onClick={() => onEditPerson(person)} aria-label={`编辑 ${person.name}`}><Sparkles size={15} /></button>
              </div>

              <div className="person-mini-grid">
                {own.slice(0, 3).map(p => (
                  <button key={p.id} onClick={() => onOpenPhoto(p.id)} aria-label={p.title}>
                    <img src={p.thumb} alt={p.title} loading="lazy" />
                    <span>{p.title}</span>
                  </button>
                ))}
                {own.length === 0 && <div className="person-no-photo"><Camera size={20} /><span>暂无影像</span></div>}
              </div>

              <div className="person-stats">
                <span><strong>{own.length}</strong><small>影像</small></span>
                <span><strong>{placeCount}</strong><small>坐标</small></span>
                <span><strong>{countries}</strong><small>地区</small></span>
                <span className="person-last"><small>最近</small><strong>{last ? formatDateDots(last).slice(0, 7) : '—'}</strong></span>
              </div>

              <div className="person-actions">
                <button className="ghost-btn" onClick={() => onViewArchive(person.id)}>打开档案 <ArrowUpRight size={14} /></button>
                <button className="text-btn" onClick={() => onUploadForPerson(person)}><Plus size={14} /> 为此人上传</button>
              </div>
            </article>
          ))}

          <button className="person-card add-card" onClick={onAddPerson}>
            <span className="add-orbit"><Plus size={24} /></span>
            <strong>添加新的旅人</strong>
            <p>让照片记住同行的人</p>
            <small>NEW HUMAN SIGNAL</small>
          </button>
        </div>
      </div>
    </div>
  );
}
