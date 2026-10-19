import { useEffect, useState } from 'react';
import {
  Aperture, CalendarDays, Camera, Check, Download, Edit3, ExternalLink, Focus, Image as ImageIcon,
  MapPin, Maximize2, Pencil, Ruler, Save, ShieldCheck, Sparkles, Trash2, UserRound, X,
} from 'lucide-react';
import Modal from './Modal.jsx';
import LocationFields from './LocationFields.jsx';
import { cx, formatBytes, formatPhotoDate, formatPhotoDateTime, initials, personMap, photoDateInput, placeLabel, parseTags, shortPlace } from '../lib/utils.js';

export default function PhotoModal({ open, photo, people, regions, onClose, onSave, onDelete, onNotice }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const peopleById = personMap(people);

  useEffect(() => {
    if (!photo) return;
    setEditing(false); setConfirmDelete(false); setForm(null);
  }, [photo?.id]);

  useEffect(() => {
    if (!open) { setEditing(false); setConfirmDelete(false); }
  }, [open]);

  if (!photo) return null;

  const startEdit = () => {
    setForm({
      ...photo,
      date: photoDateInput(photo),
      tags: (photo.tags || []).join(', '),
      lat: photo.lat ?? '', lng: photo.lng ?? '',
    });
    setEditing(true);
  };

  const patch = (p) => setForm(prev => ({ ...prev, ...p }));

  const save = async () => {
    if (!form?.title?.trim()) { onNotice?.('请填写影像标题'); return; }
    setSaving(true);
    try {
      const dateChanged = form.date !== photoDateInput(photo);
      const payload = {
        title: form.title,
        country: form.country, countryCode: form.countryCode,
        province: form.province, city: form.city, district: form.district,
        locationName: form.locationName,
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
        personIds: form.personIds || [],
        tags: parseTags(form.tags),
        notes: form.notes,
        camera: form.camera, lens: form.lens, aperture: form.aperture,
        shutter: form.shutter, iso: form.iso === '' ? null : Number(form.iso), focalLength: form.focalLength,
      };
      if (dateChanged) {
        payload.capturedAt = form.date ? new Date(form.date).toISOString() : null;
        payload.capturedLocal = form.date ? `${form.date}:00` : null;
        payload.tzOffset = null;
        payload.dateSource = 'manual';
      }
      await onSave(photo.id, payload);
      setEditing(false);
    } catch (e) { onNotice?.(e.message); }
    finally { setSaving(false); }
  };

  const deletePhoto = async () => {
    setSaving(true);
    try {
      await onDelete(photo.id);
      setConfirmDelete(false);
      onClose();
    } catch (e) { onNotice?.(e.message); }
    finally { setSaving(false); }
  };

  const peopleIn = (photo.personIds || []).map(id => peopleById.get(id)).filter(Boolean);
  const exif = [
    [Camera, '相机', photo.camera],
    [Focus, '镜头', photo.lens],
    [Aperture, '光圈', photo.aperture],
    [Sparkles, '快门', photo.shutter],
    [ImageIcon, 'ISO', photo.iso],
    [Ruler, '焦距', photo.focalLength],
    [Maximize2, '尺寸', photo.dimensions],
    [ShieldCheck, '文件', formatBytes(photo.fileSize)],
  ].filter(([, , v]) => v);

  return (
    <Modal open={open} onClose={onClose} wide hideClose className="photo-modal" label={photo.title}>
      <div className="photo-viewer">
        <div className="viewer-canvas">
          <img src={photo.image} alt={photo.title} />
          <div className="viewer-vignette" />
          <div className="viewer-top">
            <span className="eyebrow light">FRAME / {photo.id.slice(-4).toUpperCase()}</span>
            {photo.demo && <span className="demo-badge inline">SAMPLE ARCHIVE</span>}
          </div>
          <div className="viewer-caption">
            <span>{shortPlace(photo)}</span>
            <strong>{photo.title}</strong>
            <small>{formatPhotoDateTime(photo)}</small>
          </div>
          <a className="viewer-download" href={photo.original || photo.image} download={photo.original ? undefined : `${photo.title}.webp`} title="下载原图">
            <Download size={16} />
          </a>
        </div>

        <div className={cx('viewer-panel', editing && 'editing')}>
          <button className="modal-close inline" onClick={onClose} aria-label="关闭"><X size={18} /></button>
          {!editing ? (
            <>
              <div className="viewer-panel-head">
                <div className="eyebrow"><span>IMAGE RECORD</span><span className={cx('source-chip', photo.dateSource)}>{photo.dateSource === 'exif' ? 'EXIF VERIFIED' : photo.dateSource === 'exif-local' ? 'EXIF LOCAL' : photo.dateSource === 'file' ? 'FILE DATE' : 'MANUAL'}</span></div>
                <h2>{photo.title}</h2>
                <p className="viewer-place"><MapPin size={13} /> {placeLabel(photo, { country: true }) || '未记录地点'}</p>
                <div className="viewer-date"><CalendarDays size={13} /> {formatPhotoDate(photo, { weekday: 'short' })}</div>
              </div>

              <div className="viewer-people">
                <span className="filter-label">同行旅人</span>
                <div>
                  {peopleIn.map(p => <span key={p.id} className="person-pill"><i style={{ background: p.color }}>{initials(p.name)}</i>{initials(p.name) !== p.name ? p.name : ''}</span>)}
                  {!peopleIn.length && <small className="muted">未标记人物</small>}
                </div>
              </div>

              {photo.notes && <blockquote className="viewer-note">“{photo.notes}”</blockquote>}

              {photo.tags?.length > 0 && <div className="inspector-tags viewer-tags">{photo.tags.map(t => <span key={t}>#{t}</span>)}</div>}

              <div className="viewer-coords">
                <div><span>LATITUDE</span><strong>{Number.isFinite(Number(photo.lat)) ? `${Number(photo.lat).toFixed(5)}°` : '—'}</strong></div>
                <div><span>LONGITUDE</span><strong>{Number.isFinite(Number(photo.lng)) ? `${Number(photo.lng).toFixed(5)}°` : '—'}</strong></div>
              </div>

              <div className="exif-table">
                {exif.map(([Icon, label, value]) => (
                  <div key={label}><span><Icon size={12} /> {label}</span><strong>{value}</strong></div>
                ))}
                {!exif.length && <p className="muted small">没有读取到拍摄参数，可手动补全。</p>}
              </div>

              <div className="viewer-actions">
                <button className="primary-btn" onClick={startEdit}><Pencil size={14} /> 编辑档案</button>
                <a className="ghost-btn" href={photo.original || photo.image} download><Download size={14} /> 原图</a>
                <button className="danger-icon" onClick={() => setConfirmDelete(true)} aria-label="删除影像"><Trash2 size={15} /></button>
              </div>
            </>
          ) : (
            <div className="viewer-edit">
              <div className="viewer-panel-head">
                <div className="eyebrow"><span>EDIT RECORD</span><span>MANUAL OVERRIDE</span></div>
                <h2>编辑影像档案<span className="accent-dot">.</span></h2>
              </div>
              <label className="field"><span>标题</span><input value={form.title} onChange={e => patch({ title: e.target.value })} /></label>
              <div className="field-grid two">
                <label className="field"><span>拍摄时间</span><input type="datetime-local" value={form.date} onChange={e => patch({ date: e.target.value })} /></label>
                <label className="field"><span>尺寸</span><input value={form.dimensions || ''} onChange={e => patch({ dimensions: e.target.value })} /></label>
              </div>
              <LocationFields value={form} onChange={setForm} regions={regions} compact onNotice={onNotice} />
              <div className="form-section compact-section">
                <div className="form-section-head"><span>人物</span><h4>同行旅人</h4></div>
                <div className="upload-person-grid">
                  {people.map(p => {
                    const selected = form.personIds?.includes(p.id);
                    return (
                      <button type="button" key={p.id} className={cx('person-select', selected && 'selected')} onClick={() => patch({ personIds: selected ? form.personIds.filter(id => id !== p.id) : [...(form.personIds || []), p.id] })}>
                        <span className="person-select-avatar" style={{ background: p.color }}>{initials(p.name)}</span><span>{p.name}</span><i>{selected ? <Check size={12} /> : null}</i>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="field-grid two">
                <label className="field"><span>标签 <em>逗号分隔</em></span><input value={form.tags} onChange={e => patch({ tags: e.target.value })} /></label>
                <label className="field"><span>相机</span><input value={form.camera || ''} onChange={e => patch({ camera: e.target.value })} /></label>
              </div>
              <label className="field"><span>注记</span><textarea rows={2} value={form.notes || ''} onChange={e => patch({ notes: e.target.value })} /></label>
              <div className="field-grid three">
                <label className="field"><span>镜头</span><input value={form.lens || ''} onChange={e => patch({ lens: e.target.value })} /></label>
                <label className="field"><span>光圈</span><input value={form.aperture || ''} onChange={e => patch({ aperture: e.target.value })} /></label>
                <label className="field"><span>快门</span><input value={form.shutter || ''} onChange={e => patch({ shutter: e.target.value })} /></label>
                <label className="field"><span>ISO</span><input value={form.iso ?? ''} onChange={e => patch({ iso: e.target.value })} /></label>
                <label className="field"><span>焦距</span><input value={form.focalLength || ''} onChange={e => patch({ focalLength: e.target.value })} /></label>
              </div>
              <div className="viewer-actions sticky">
                <button className="primary-btn" onClick={save} disabled={saving}>{saving ? '保存中…' : <><Save size={14} /> 保存修改</>}</button>
                <button className="ghost-btn" onClick={() => setEditing(false)}>取消</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="confirm-layer">
          <div className="confirm-card glass">
            <Trash2 size={23} />
            <h3>删除这张影像？</h3>
            <p>原图与展示版本会从服务器移除，人物与地点统计会同步更新。此操作不可撤销。</p>
            <div><button className="ghost-btn" onClick={() => setConfirmDelete(false)}>取消</button><button className="danger-btn" onClick={deletePhoto} disabled={saving}>{saving ? '删除中…' : '确认删除'}</button></div>
          </div>
        </div>
      )}
    </Modal>
  );
}
