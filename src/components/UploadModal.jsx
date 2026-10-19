import { useEffect, useMemo, useRef, useState } from 'react';
import exifr from 'exifr';
import {
  AlertCircle, ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Crosshair, ImagePlus,
  Loader2, MapPin, Plus, Sparkles, UploadCloud, UserPlus, X,
} from 'lucide-react';
import Modal from './Modal.jsx';
import LocationFields from './LocationFields.jsx';
import { api, uploadPhotos } from '../lib/api.js';
import { cx, dateInputValue, formatBytes, initials, parseTags } from '../lib/utils.js';

const PERSON_COLORS = ['#65f4ff', '#ffbd73', '#b79cff', '#7df0a8', '#ff8ea8', '#9fc4ff', '#f7e57d', '#ff9f62'];
const EXIF_KEYS = ['Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'DateTimeOriginal', 'ExifImageWidth', 'ExifImageHeight'];

function uid() { return Math.random().toString(36).slice(2, 10); }

function trimNum(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(Number(v).toFixed(digits));
}
function exposure(v) {
  if (!v) return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n >= 1 ? `${Number(n.toFixed(2))}s` : `1/${Math.round(1 / n)}`;
}
function cameraName(make, model) {
  let m = make || '', mod = model || '';
  if (m && mod.toLowerCase().startsWith(m.toLowerCase())) mod = mod.slice(m.length).trim();
  return [m, mod].filter(Boolean).join(' ');
}
function baseTitle(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || '未命名影像';
}
function exifWallInput(value) {
  if (typeof value !== 'string') return '';
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : '';
}
function exifOffset(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
  return m && Number(m[2]) < 24 && Number(m[3]) < 60 ? `${m[1]}${m[2]}:${m[3]}` : null;
}
function blankDraft(file, initialPersonId, initialLocation = null) {
  return {
    id: uid(), file, preview: URL.createObjectURL(file), title: baseTitle(file.name),
    date: dateInputValue(file.lastModified), dateSource: 'file',
    country: initialLocation?.country || '', countryCode: initialLocation?.countryCode || '',
    province: initialLocation?.province || '', city: initialLocation?.city || '',
    district: initialLocation?.district || '', locationName: initialLocation?.locationName || initialLocation?.label || '',
    lat: initialLocation?.lat ?? '', lng: initialLocation?.lng ?? '',
    personIds: initialPersonId ? [initialPersonId] : [],
    tags: '', notes: '', camera: '', lens: '', aperture: '', shutter: '', iso: '',
    focalLength: '', dimensions: '', tzOffset: null, exifDate: false, exifGps: false, geocoding: false,
    geoResolved: !!initialLocation, status: initialLocation ? 'ready' : 'pending',
  };
}

export default function UploadModal({
  open, onClose, people, regions, initialPersonId, initialLocation, onCreatePerson, onComplete,
  onNotice, onRequestPick, pickResult,
}) {
  const [step, setStep] = useState('select');
  const [drafts, setDrafts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState({ done: 0, total: 0, label: '' });
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showMeta, setShowMeta] = useState(false);
  const [newPersonOpen, setNewPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [applying, setApplying] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const active = drafts.find(d => d.id === activeId) || drafts[0];
  const totalBytes = useMemo(() => drafts.reduce((sum, d) => sum + (d.file?.size || 0), 0), [drafts]);

  const updateDraft = (id, patch) => setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  const updateActive = (patch) => active && updateDraft(active.id, patch);

  useEffect(() => {
    if (!pickResult || !pickResult.targetId) return;
    const { targetId, ...loc } = pickResult;
    setDrafts(prev => prev.map(d => d.id === targetId ? {
      ...d,
      lat: loc.lat, lng: loc.lng,
      country: loc.country || d.country, countryCode: loc.countryCode || d.countryCode,
      province: loc.province || d.province, city: loc.city || d.city, district: loc.district || d.district,
      locationName: loc.locationName || d.locationName,
      geoResolved: true, status: 'ready',
    } : d));
    setActiveId(targetId);
    setStep('review');
  }, [pickResult]);

  useEffect(() => {
    if (!open) return;
    setError('');
  }, [open]);

  const reset = () => {
    for (const d of drafts) { try { URL.revokeObjectURL(d.preview); } catch {} }
    setDrafts([]); setActiveId(null); setStep('select'); setProgress(0); setAnalyzing(false); setError('');
    setAnalysis({ done: 0, total: 0, label: '' });
    setShowMeta(false); setNewPersonOpen(false); setNewPersonName('');
  };

  const close = () => { reset(); onClose?.(); };

  async function addFiles(list) {
    const files = [...list].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, 30);
    if (!files.length) { onNotice?.('请选择 JPG、PNG、WebP、AVIF 或 HEIC 图片'); return; }
    const base = files.map(f => blankDraft(f, initialPersonId, initialLocation));
    setDrafts(prev => [...prev, ...base]);
    setActiveId(base[0].id);
    setStep('review');
    setAnalyzing(true);
    setAnalysis({ done: 0, total: files.length, label: '读取 EXIF 与拍摄参数' });

    const local = base.map(d => ({ ...d }));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let x = null;
      let raw = null;
      try {
        x = await exifr.parse(file, { gps: true, exif: true, tiff: true, ifd0: true, iptc: true, translateValues: true, reviveValues: true });
        raw = await exifr.parse(file, { exif: true, tiff: true, ifd0: true, translateValues: false, reviveValues: false });
      } catch {}
      if (x) {
        const date = x.DateTimeOriginal || x.CreateDate || x.ModifyDate;
        const rawDate = raw?.DateTimeOriginal || raw?.CreateDate || raw?.ModifyDate;
        const wallDate = exifWallInput(rawDate);
        const offset = exifOffset(raw?.OffsetTimeOriginal || raw?.OffsetTime || raw?.OffsetTimeDigitized || x.OffsetTimeOriginal);
        const patch = {
          camera: cameraName(x.Make, x.Model) || '',
          lens: x.LensModel || x.Lens || '',
          aperture: x.FNumber ? `f/${trimNum(x.FNumber, 1)}` : '',
          shutter: exposure(x.ExposureTime),
          iso: Number.isFinite(Number(x.ISO)) ? String(Number(x.ISO)) : '',
          focalLength: x.FocalLength ? `${trimNum(x.FocalLength, 1)} mm` : '',
          dimensions: (x.ExifImageWidth || x.ImageWidth) && (x.ExifImageHeight || x.ImageHeight) ? `${x.ExifImageWidth || x.ImageWidth} × ${x.ExifImageHeight || x.ImageHeight}` : '',
          exifDate: !!(wallDate || date),
          exifGps: Number.isFinite(x.latitude) && Number.isFinite(x.longitude),
        };
        if (wallDate) {
          patch.date = wallDate;
          patch.dateSource = offset ? 'exif' : 'exif-local';
          patch.tzOffset = offset;
        } else if (date) {
          patch.date = dateInputValue(date);
          patch.dateSource = 'exif';
          patch.tzOffset = null;
        }
        if (Number.isFinite(x.latitude) && Number.isFinite(x.longitude)) { patch.lat = Number(x.latitude.toFixed(6)); patch.lng = Number(x.longitude.toFixed(6)); }
        Object.assign(local[i], patch);
        updateDraft(base[i].id, patch);
      }
      setAnalysis({ done: i + 1, total: files.length, label: '读取 EXIF 与拍摄参数' });
    }

    const coordMap = new Map();
    for (const d of local.filter(d => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)))) {
      const key = `${Number(d.lat).toFixed(4)},${Number(d.lng).toFixed(4)}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key).push(d.id);
    }
    setDrafts(prev => prev.map(d => local.some(x => x.id === d.id) && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) ? { ...d, geocoding: true } : d));
    let n = 0;
    for (const [, ids] of coordMap) {
      n++;
      setAnalysis({ done: n, total: coordMap.size, label: '反查行政区与地点' });
      const sample = local.find(x => x.id === ids[0]);
      if (!sample) continue;
      try {
        const geo = await api.reverse(sample.lat, sample.lng);
        setDrafts(prev => prev.map(d => ids.includes(d.id) ? {
          ...d,
          country: d.country || geo.country || '', countryCode: d.countryCode || geo.countryCode || '',
          province: d.province || geo.province || '', city: d.city || geo.city || '', district: d.district || geo.district || '',
          locationName: d.locationName || geo.locationName || '',
          geoResolved: true, geocoding: false,
        } : d));
      } catch {
        setDrafts(prev => prev.map(d => ids.includes(d.id) ? { ...d, geocoding: false } : d));
      }
    }
    setDrafts(prev => prev.map(d => ({ ...d, geocoding: false })));
    setAnalyzing(false);
    setAnalysis({ done: 0, total: 0, label: '' });
  }

  async function handleCreatePerson() {
    const name = newPersonName.trim();
    if (!name) return;
    try {
      const person = await onCreatePerson({ name, color: PERSON_COLORS[people.length % PERSON_COLORS.length] });
      if (person && active) updateActive({ personIds: [...new Set([...(active.personIds || []), person.id])] });
      setNewPersonName(''); setNewPersonOpen(false);
    } catch (e) { onNotice?.(e.message); }
  }

  const applyLocationAll = () => {
    if (!active) return;
    const fields = ['country', 'countryCode', 'province', 'city', 'district', 'locationName', 'lat', 'lng'];
    const patch = Object.fromEntries(fields.map(k => [k, active[k]]));
    setDrafts(prev => prev.map(d => d.id === active.id ? d : { ...d, ...patch, geoResolved: true }));
    setApplying(true); setTimeout(() => setApplying(false), 900);
    onNotice?.('已将当前地点应用到全部待上传影像');
  };
  const applyPeopleAll = () => {
    if (!active) return;
    setDrafts(prev => prev.map(d => d.id === active.id ? d : { ...d, personIds: [...(active.personIds || [])] }));
    onNotice?.('已将人物标记应用到全部影像');
  };

  async function submit() {
    if (!drafts.length) return;
    setError('');
    setStep('uploading');
    setProgress(0);
    const metadata = drafts.map(d => ({
      title: d.title,
      ...(d.dateSource === 'manual' ? {
        date: d.date ? new Date(d.date).toISOString() : undefined,
        capturedLocal: d.date ? `${d.date}:00` : undefined,
        tzOffset: null,
      } : {}),
      dateSource: d.dateSource,
      country: d.country,
      countryCode: (d.countryCode || '').toLowerCase(),
      province: d.province,
      city: d.city,
      district: d.district,
      locationName: d.locationName,
      lat: d.lat === '' ? null : Number(d.lat),
      lng: d.lng === '' ? null : Number(d.lng),
      personIds: d.personIds || [],
      tags: parseTags(d.tags),
      notes: d.notes,
      camera: d.camera,
      lens: d.lens,
      aperture: d.aperture,
      shutter: d.shutter,
      iso: d.iso === '' ? null : Number(d.iso),
      focalLength: d.focalLength,
      dimensions: d.dimensions,
      lastModified: d.file.lastModified,
    }));
    try {
      const result = await uploadPhotos(drafts.map(d => d.file), metadata, setProgress);
      onComplete?.(result.photos || []);
      const failures = result.failures || [];
      if (failures.length) {
        const detail = failures.slice(0, 3).map(f => `${f.file}: ${f.reason}`).join('；');
        onNotice?.(`${result.photos?.length || 0} 张成功，${failures.length} 张失败：${detail}`);
      } else {
        onNotice?.(`${result.photos?.length || drafts.length} 张影像已写入你的星图`);
      }
      reset();
      onClose?.();
    } catch (e) {
      setError(e.message);
      setStep('review');
    }
  }

  const allReady = drafts.length > 0 && drafts.every(d => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)));
  const located = drafts.filter(d => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) && d.locationName).length;

  return (
    <Modal open={open} onClose={close} wide hideClose className="upload-modal" label="上传旅行影像">
      <div className="upload-head">
        <div className="upload-head-title">
          <span className="eyebrow"><span>INGEST / 影像写入</span><span>{step === 'select' ? 'STEP 01' : step === 'uploading' ? 'WRITING' : 'STEP 02'}</span></span>
          <h2>{step === 'select' ? '把新的坐标写入星图' : step === 'uploading' ? '正在写入轨道档案' : '校验与编辑影像信号'}</h2>
        </div>
        <button className="modal-close inline" onClick={close} aria-label="关闭"><X size={18} /></button>
      </div>

      {step === 'select' && (
        <div className="upload-select">
          {initialLocation && (
            <div className="upload-preset">
              <MapPin size={15} />
              <span><strong>{initialLocation.label || initialLocation.locationName || [initialLocation.city, initialLocation.province].filter(Boolean).join(' · ')}</strong><small>已选定地点 · 上传后自动填入这组照片</small></span>
            </div>
          )}
          <div
            className={cx('dropzone', dragging && 'dragging')}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-orbit"><UploadCloud size={34} /><span /><i /></div>
            <h3>拖入照片，或点击选择</h3>
            <p>自动读取拍摄时间、GPS 坐标、相机与镜头参数</p>
            <div className="drop-badges"><span>JPG</span><span>PNG</span><span>WEBP</span><span>HEIC</span><span>AVIF</span><span>RAW 不支持</span></div>
            <small>单张最大 50MB · 一次最多 30 张 · 原图保存在本机</small>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="ingest-notes">
            <div><span className="note-num">01</span><div><strong>EXIF 自动识别</strong><p>拍摄日期、GPS、相机、光圈、快门、ISO 会被自动填入。</p></div></div>
            <div><span className="note-num">02</span><div><strong>逆地理编码</strong><p>GPS 会换算成国家、省市、区县与地点名称，全部可手动修正。</p></div></div>
            <div><span className="note-num">03</span><div><strong>按人物归档</strong><p>为每张照片标记同行旅人，也可以批量应用到同一组照片。</p></div></div>
          </div>
        </div>
      )}

      {step !== 'select' && (
        <div className="upload-review">
          <div className="draft-strip">
            <div className="draft-strip-head">
              <span>{drafts.length} 张待写入</span>
              {analyzing ? <span className="analyzing"><Loader2 size={12} className="spin" /> {analysis.label} {analysis.total ? `${analysis.done}/${analysis.total}` : ''}</span> : <span className="scan-done"><Check size={12} /> 识别完成</span>}
            </div>
            <div className="draft-thumbs">
              {drafts.map((d, i) => (
                <button key={d.id} className={cx('draft-thumb', d.id === active?.id && 'active')} onClick={() => setActiveId(d.id)} title={d.title}>
                  <img src={d.preview} alt="" />
                  <span className="draft-num">{String(i + 1).padStart(2, '0')}</span>
                  {d.geocoding ? <span className="draft-status locating"><Loader2 size={10} className="spin" /></span> : (Number.isFinite(Number(d.lat)) ? <span className="draft-status ok"><MapPin size={9} /></span> : <span className="draft-status warn"><AlertCircle size={9} /></span>)}
                </button>
              ))}
              <button className="draft-add" onClick={() => fileInputRef.current?.click()} aria-label="继续添加"><Plus size={17} /></button>
              <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            </div>
          </div>

          {active && (
            <div className="review-body">
              <div className="review-visual">
                <div className="review-image">
                  <img src={active.preview} alt={active.title} />
                  <div className="review-scanline" />
                  <div className="review-image-badges">
                    {active.exifDate ? <span className="exif-badge"><Check size={10} /> 日期 EXIF</span> : <span className="exif-badge warn"><AlertCircle size={10} /> 日期缺失</span>}
                    {active.exifGps ? <span className="exif-badge"><Check size={10} /> GPS EXIF</span> : <span className="exif-badge warn"><AlertCircle size={10} /> 无 GPS</span>}
                  </div>
                  <div className="review-file">{active.file.name}<span>{formatBytes(active.file.size)}</span></div>
                </div>
                <div className="review-geo-card glass">
                  <div className="review-geo-head"><MapPin size={13} /><span>{active.geocoding ? '正在反查地理位置…' : active.geoResolved ? '地理位置已解析' : Number.isFinite(Number(active.lat)) ? '仅获取到坐标' : '等待手动定位'}</span></div>
                  <strong>{[active.province, active.city, active.district].filter(Boolean).join(' · ') || active.locationName || '尚未选择地点'}</strong>
                  <small>{Number.isFinite(Number(active.lat)) ? `${Number(active.lat).toFixed(5)}° N, ${Number(active.lng).toFixed(5)}° E` : '可在右侧地图取点或手动填写'}</small>
                  <button className="ghost-btn small" onClick={() => onRequestPick?.(active.id)}><Crosshair size={13} /> 在地图上精确取点</button>
                </div>
                <div className="exif-readout">
                  <span><Camera size={12} /> {active.camera || '未知设备'}</span>
                  <span>{active.lens || '未知镜头'}</span>
                  <span>{[active.aperture, active.shutter, active.iso ? `ISO ${active.iso}` : '', active.focalLength].filter(Boolean).join(' · ') || '无曝光参数'}</span>
                </div>
              </div>

              <div className="review-form" ref={scrollRef}>
                <div className="form-section">
                  <div className="form-section-head"><span>01</span><h4>影像信息</h4><em>CAPTION</em></div>
                  <label className="field"><span>标题</span><input value={active.title} onChange={e => updateActive({ title: e.target.value })} placeholder="为这张影像命名" /></label>
                  <div className="field-grid two">
                    <label className="field"><span>拍摄时间 <em>{active.exifDate ? '来自 EXIF' : '来自文件'}</em></span><input type="datetime-local" value={active.date} onChange={e => updateActive({ date: e.target.value, dateSource: 'manual' })} /></label>
                    <label className="field"><span>尺寸</span><input value={active.dimensions} onChange={e => updateActive({ dimensions: e.target.value })} placeholder="自动获取" /></label>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-section-head"><span>02</span><h4>地点与坐标</h4><em>LOCATION</em><button type="button" className="mini-action" onClick={applyLocationAll}><Check size={11} /> {applying ? '已应用' : '应用到全部'}</button></div>
                  <LocationFields value={active} onChange={updateActive} regions={regions} onNotice={onNotice} />
                </div>

                <div className="form-section">
                  <div className="form-section-head"><span>03</span><h4>同行旅人</h4><em>PEOPLE</em><button type="button" className="mini-action" onClick={applyPeopleAll}><Check size={11} /> 应用到全部</button></div>
                  <div className="upload-person-grid">
                    {people.map(p => {
                      const selected = active.personIds?.includes(p.id);
                      return (
                        <button type="button" key={p.id} className={cx('person-select', selected && 'selected')} onClick={() => updateActive({ personIds: selected ? active.personIds.filter(id => id !== p.id) : [...(active.personIds || []), p.id] })}>
                          <span className="person-select-avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                          <span>{p.name}</span>
                          <i>{selected ? <Check size={12} /> : <Plus size={12} />}</i>
                        </button>
                      );
                    })}
                    <button type="button" className="person-select add" onClick={() => setNewPersonOpen(v => !v)}><span className="person-select-avatar"><UserPlus size={14} /></span><span>新旅人</span></button>
                  </div>
                  {newPersonOpen && (
                    <div className="inline-new-person">
                      <input value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="输入旅人名字" onKeyDown={e => e.key === 'Enter' && handleCreatePerson()} autoFocus />
                      <button onClick={handleCreatePerson} disabled={!newPersonName.trim()}>添加</button>
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="form-section-head"><span>04</span><h4>标签与注记</h4><em>NOTES</em></div>
                  <label className="field"><span>标签 <em>用逗号分隔</em></span><input value={active.tags} onChange={e => updateActive({ tags: e.target.value })} placeholder="海岸, 日落, 冬夜" /></label>
                  <label className="field"><span>这一刻</span><textarea rows={3} value={active.notes} onChange={e => updateActive({ notes: e.target.value })} placeholder="写下一点只属于这张照片的记忆…" /></label>
                </div>

                <div className="form-section meta-section">
                  <button className="form-collapse" onClick={() => setShowMeta(v => !v)}><span>05</span><h4>拍摄参数</h4><em>EXIF</em><ChevronDown size={14} className={showMeta ? 'rot' : ''} /></button>
                  {showMeta && (
                    <div className="field-grid two exif-fields">
                      <label className="field"><span>相机</span><input value={active.camera} onChange={e => updateActive({ camera: e.target.value })} /></label>
                      <label className="field"><span>镜头</span><input value={active.lens} onChange={e => updateActive({ lens: e.target.value })} /></label>
                      <label className="field"><span>光圈</span><input value={active.aperture} onChange={e => updateActive({ aperture: e.target.value })} /></label>
                      <label className="field"><span>快门</span><input value={active.shutter} onChange={e => updateActive({ shutter: e.target.value })} /></label>
                      <label className="field"><span>ISO</span><input value={active.iso} onChange={e => updateActive({ iso: e.target.value })} /></label>
                      <label className="field"><span>焦距</span><input value={active.focalLength} onChange={e => updateActive({ focalLength: e.target.value })} /></label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && <div className="upload-error"><AlertCircle size={15} /> {error}</div>}

          <div className="upload-footer">
            <div className="upload-summary">
              <span><strong>{drafts.length}</strong> 张影像 · {formatBytes(totalBytes)}</span>
              <span className={cx('ready-status', allReady && 'ready')}><span className="live-dot" /> {located}/{drafts.length} 已定位</span>
            </div>
            <div className="upload-footer-actions">
              <button className="ghost-btn" onClick={() => fileInputRef.current?.click()}><ImagePlus size={14} /> 继续添加</button>
              <button className="primary-btn" onClick={submit} disabled={analyzing || !drafts.length}>
                {analyzing ? <><Loader2 size={15} className="spin" /> 识别中</> : <><Sparkles size={15} /> 写入星图 <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'uploading' && (
        <div className="uploading-stage">
          <div className="upload-orbit"><span /><i /><b /></div>
          <h3>正在写入轨道档案</h3>
          <p>生成展示版本与缩略图，并把坐标写入本机数据库。</p>
          <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
          <div className="progress-meta"><span>{progress < 100 ? 'TRANSMITTING' : 'FINALIZING'}</span><strong>{progress}%</strong></div>
          <small>请保持页面开启 · 原图不会离开这台服务器</small>
        </div>
      )}
    </Modal>
  );
}
