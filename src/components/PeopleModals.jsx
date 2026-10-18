import { useEffect, useState } from 'react';
import { Check, Sparkles, Trash2, UserPlus } from 'lucide-react';
import Modal from './Modal.jsx';
import { cx, initials } from '../lib/utils.js';

const COLORS = ['#65f4ff', '#ffbd73', '#b79cff', '#7df0a8', '#ff8ea8', '#9fc4ff', '#f7e57d', '#ff9f62'];

export function PersonModal({ open, person, onClose, onSave, onDelete, photoCount, onNotice }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(person?.name || '');
    setNote(person?.note || '');
    setColor(person?.color || COLORS[0]);
    setConfirm(false);
  }, [open, person]);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!name.trim()) { onNotice?.('请输入旅人名字'); return; }
    setSaving(true);
    try {
      await onSave(person?.id || null, { name: name.trim(), note: note.trim(), color });
      onClose();
    } catch (err) { onNotice?.(err.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try { await onDelete(person.id); setConfirm(false); onClose(); }
    catch (err) { onNotice?.(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} className="person-modal" label={person ? '编辑旅人' : '添加旅人'}>
      <form onSubmit={submit} className="person-form">
        <div className="eyebrow"><span>HUMAN SIGNAL / {person ? 'EDIT' : 'NEW'}</span><span>{person ? `${photoCount || 0} FRAMES` : 'ADD TO ORBIT'}</span></div>
        <h2>{person ? '编辑旅人档案' : '记录一位同行旅人'}<span className="accent-dot">.</span></h2>
        <div className="person-preview">
          <div className="person-avatar large" style={{ '--avatar': color }}><span>{initials(name || '新')}</span><i className="avatar-orbit" /></div>
          <div><strong>{name || '新旅人'}</strong><small>{note || 'TA 的注记会出现在旅人卡片上'}</small></div>
        </div>
        <label className="field"><span>名字</span><input value={name} onChange={e => setName(e.target.value)} placeholder="例如：林夏" autoFocus maxLength={30} /></label>
        <label className="field"><span>注记 <em>可选</em></span><input value={note} onChange={e => setNote(e.target.value)} placeholder="你们在哪里认识，或一句关于 TA 的话" maxLength={120} /></label>
        <div className="field"><span>信号颜色</span><div className="color-row">{COLORS.map(c => <button type="button" key={c} className={cx('color-dot', color === c && 'active')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c}>{color === c && <Check size={12} />}</button>)}</div></div>
        <div className="modal-action-row">
          {person ? <button type="button" className="danger-btn" onClick={() => setConfirm(true)}><Trash2 size={14} /> 删除旅人</button> : <span />}
          <div><button type="button" className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={saving}>{saving ? '保存中…' : <><UserPlus size={14} /> {person ? '保存修改' : '添加旅人'}</>}</button></div>
        </div>
        {confirm && (
          <div className="inline-confirm">
            <p>删除「{person.name}」会从所有影像中移除 TA 的标记，但不会删除照片。</p>
            <div><button type="button" className="ghost-btn" onClick={() => setConfirm(false)}>取消</button><button type="button" className="danger-btn" onClick={remove}>确认删除</button></div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function ProfileModal({ open, profile, onClose, onSave, onNotice }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm({ ...profile });
  }, [open, profile]);
  const patch = p => setForm(prev => ({ ...prev, ...p }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) { onNotice?.('请填写名字'); return; }
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err) { onNotice?.(err.message); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} className="profile-modal" label="编辑个人档案">
      <form onSubmit={submit} className="person-form">
        <div className="eyebrow"><span>VOYAGER IDENTITY / EDIT</span><span>LOCAL PROFILE</span></div>
        <h2>编辑你的档案<span className="accent-dot">.</span></h2>
        <div className="person-preview profile-edit-preview">
          <div className="profile-avatar small" style={{ '--avatar': form.avatarColor || '#65f4ff' }}>{form.avatarUrl ? <img className="profile-avatar-img" src={form.avatarUrl} alt="" /> : <span>{initials(form.name || '我')}</span>}<i className="orbit orbit-a" /></div>
          <div><strong>{form.name || '旅人'}</strong><small>{form.handle || 'VOYAGER'}</small></div>
        </div>
        <div className="field-grid two">
          <label className="field"><span>名字</span><input value={form.name || ''} onChange={e => patch({ name: e.target.value })} maxLength={40} /></label>
          <label className="field"><span>呼号 / HANDLE</span><input value={form.handle || ''} onChange={e => patch({ handle: e.target.value.toUpperCase() })} maxLength={30} /></label>
        </div>
        <label className="field"><span>一句话介绍</span><textarea rows={3} value={form.bio || ''} onChange={e => patch({ bio: e.target.value })} maxLength={400} /></label>
        <label className="field"><span>常驻坐标</span><input value={form.home || ''} onChange={e => patch({ home: e.target.value })} placeholder="杭州 · 中国" /></label>
        <div className="field"><span>轨道颜色</span><div className="color-row">{COLORS.map(c => <button type="button" key={c} className={cx('color-dot', form.avatarColor === c && 'active')} style={{ background: c }} onClick={() => patch({ avatarColor: c })} aria-label={c}>{form.avatarColor === c && <Check size={12} />}</button>)}</div></div>
        <div className="modal-action-row"><span /><div><button type="button" className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={saving}>{saving ? '保存中…' : <><Sparkles size={14} /> 保存档案</>}</button></div></div>
      </form>
    </Modal>
  );
}

export function PasswordModal({ open, onClose, onSave, onNotice }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setCurrent(''); setNext(''); setConfirm(''); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 8) { onNotice?.('新密码至少 8 位'); return; }
    if (next !== confirm) { onNotice?.('两次输入的新密码不一致'); return; }
    setSaving(true);
    try { await onSave(current, next); onClose(); }
    catch (err) { onNotice?.(err.message); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} className="password-modal" label="修改密码">
      <form onSubmit={submit} className="person-form">
        <div className="eyebrow"><span>ACCOUNT SECURITY</span><span>PASSWORD ROTATION</span></div>
        <h2>修改登录密码<span className="accent-dot">.</span></h2>
        <p className="password-help">修改后其他设备上的会话会失效，需要重新登录。</p>
        <label className="field"><span>当前密码</span><input type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" autoFocus /></label>
        <label className="field"><span>新密码</span><input type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" /></label>
        <label className="field"><span>确认新密码</span><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>
        <div className="modal-action-row"><span /><div><button type="button" className="ghost-btn" onClick={onClose}>取消</button><button className="primary-btn" disabled={saving}>{saving ? '保存中…' : '更新密码'}</button></div></div>
      </form>
    </Modal>
  );
}
