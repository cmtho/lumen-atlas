import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, Check, Copy, Crown, Database, Globe2, HardDrive, Images,
  KeyRound, MapPin, Power, RefreshCw, Save, Search, Server, ShieldCheck, Sparkles, Ticket,
  Trash2, UserRound, Users,
} from 'lucide-react';
import Modal from './Modal.jsx';
import { api } from '../lib/api.js';
import { formatBytes, formatDateDots, initials } from '../lib/utils.js';

const statusOf = (inv) => {
  if (inv.revokedAt) return ['已撤销', 'off'];
  if ((inv.uses || 0) >= (inv.maxUses || 1)) return ['已使用', 'used'];
  if (new Date(inv.expiresAt) <= new Date()) return ['已过期', 'off'];
  return ['可用', 'on'];
};

export default function AdminView({ account, onNotice, onSiteUpdate }) {
  const isOwner = account?.role === 'owner';
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [siteSettings, setSiteSettings] = useState(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [amapFromEnv, setAmapFromEnv] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [o, u, i] = await Promise.all([api.adminOverview(), api.adminUsers(), api.adminInvites()]);
      setOverview(o); setUsers(u.users || []); setInvites(i.invites || []);
    } catch (e) { onNotice?.(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!isOwner) return;
    api.adminSettings().then(r => { setSiteSettings(r.settings || {}); setAmapFromEnv(!!r.amapFromEnv); }).catch(e => onNotice?.(e.message));
  }, [isOwner]);

  const filteredUsers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u => [u.username, u.name, u.handle, u.bio].join(' ').toLowerCase().includes(term));
  }, [users, q]);

  const toggleUser = async (user) => {
    setBusyId(user.id);
    try { await api.adminUpdateUser(user.id, { disabled: !user.disabled }); await load(true); onNotice?.(user.disabled ? `已启用 @${user.username}` : `已禁用 @${user.username}`); }
    catch (e) { onNotice?.(e.message); }
    finally { setBusyId(''); }
  };
  const setRole = async (user, role) => {
    setBusyId(user.id);
    try { await api.adminUpdateUser(user.id, { role }); await load(true); onNotice?.(role === 'admin' ? `@${user.username} 已成为管理员` : `@${user.username} 已取消管理员`); }
    catch (e) { onNotice?.(e.message); }
    finally { setBusyId(''); }
  };
  const resetPassword = async (user) => {
    setBusyId(user.id);
    try { const res = await api.adminResetPassword(user.id); setTempPassword({ user, password: res.temporaryPassword }); }
    catch (e) { onNotice?.(e.message); }
    finally { setBusyId(''); }
  };
  const removeUser = async (user) => {
    setBusyId(user.id);
    try { await api.adminDeleteUser(user.id); setConfirm(null); await load(true); onNotice?.(`已删除 @${user.username} 及其档案`); }
    catch (e) { onNotice?.(e.message); }
    finally { setBusyId(''); }
  };
  const revokeInvite = async (invite) => {
    setBusyId(invite.id);
    try { await api.adminRevokeInvite(invite.id); await load(true); onNotice?.(`邀请码 ${invite.code} 已撤销`); }
    catch (e) { onNotice?.(e.message); }
    finally { setBusyId(''); }
  };

  const copy = async (text, message = '已复制') => {
    try { await navigator.clipboard.writeText(text); onNotice?.(message); }
    catch { onNotice?.(text); }
  };

  const saveSite = async (e) => {
    e.preventDefault();
    setSiteSaving(true);
    try {
      const res = await api.updateAdminSettings(siteSettings);
      setSiteSettings(res.settings);
      setAmapFromEnv(!!res.amapFromEnv);
      onSiteUpdate?.(res.settings, !!res.amapFromEnv);
      onNotice?.('站点设置已保存');
      await load(true);
    } catch (err) { onNotice?.(err.message); }
    finally { setSiteSaving(false); }
  };

  const storagePct = (n) => Math.max(2, Math.min(100, (n / Math.max(1, overview?.storage?.total || 1)) * 100));

  return (
    <div className="page-view admin-view">
      <div className="page-ambient" aria-hidden="true" />
      <div className="page-wrap">
        <div className="page-title-row admin-title-row">
          <div>
            <div className="eyebrow"><span>CONTROL DECK / STAFF ONLY</span><span>PRIVATE NODE · INVITE NETWORK</span></div>
            <h1 className="page-title">控制台<span className="accent-dot">.</span></h1>
            <p>管理用户、邀请码、存储与整颗影像星球的运行状态。</p>
          </div>
          <div className="admin-title-actions">
            <span className="status-chip"><span className="live-dot" /> {overview?.system?.auth === 'invite-only' ? 'INVITE NETWORK' : 'ONLINE'}</span>
            <button className="ghost-btn" onClick={() => load()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> 刷新</button>
          </div>
        </div>

        {loading && !overview ? (
          <div className="admin-loading glass"><div className="orbit-loader"><span /><span /><i /></div><p>正在读取控制台数据</p></div>
        ) : (
          <>
            <div className="admin-stats">
              <div className="admin-stat glass"><Users size={16} /><span>注册用户</span><strong>{String(overview?.users?.total || 0).padStart(2, '0')}</strong><small>{overview?.users?.disabled || 0} 个已禁用</small></div>
              <div className="admin-stat glass"><Images size={16} /><span>全站影像</span><strong>{String(overview?.photos || 0).padStart(2, '0')}</strong><small>{overview?.people || 0} 位旅人</small></div>
              <div className="admin-stat glass"><Ticket size={16} /><span>邀请码</span><strong>{String(overview?.invites?.active || 0).padStart(2, '0')}</strong><small>{overview?.invites?.used || 0} 个已使用</small></div>
              <div className="admin-stat glass"><HardDrive size={16} /><span>磁盘占用</span><strong>{formatBytes(overview?.storage?.total || 0)}</strong><small>LOCAL MEDIA VAULT</small></div>
            </div>

            {isOwner && siteSettings && (
              <form className="admin-panel glass admin-site-panel" onSubmit={saveSite}>
                <div className="admin-panel-head"><div><span className="eyebrow">SITE IDENTITY</span><h3>站点设置</h3></div><Globe2 size={18} /></div>
                <div className="admin-site-grid">
                  <label className="admin-site-field"><span>站点名称</span><input value={siteSettings.siteName || ''} onChange={e => setSiteSettings(s => ({ ...s, siteName: e.target.value }))} maxLength={40} /></label>
                  <label className="admin-site-field"><span>一句话介绍</span><input value={siteSettings.tagline || ''} onChange={e => setSiteSettings(s => ({ ...s, tagline: e.target.value }))} maxLength={80} /></label>
                  <label className="admin-site-field wide"><span>站点描述</span><input value={siteSettings.description || ''} onChange={e => setSiteSettings(s => ({ ...s, description: e.target.value }))} maxLength={200} /></label>
                  <label className="admin-site-field wide"><span>高德 Key <em>{amapFromEnv ? '当前来自环境变量 AMAP_KEY，留空则继续使用' : '高德 Web 服务 / JS API Key'}</em></span><input value={siteSettings.amapKey || ''} onChange={e => setSiteSettings(s => ({ ...s, amapKey: e.target.value.trim() }))} placeholder={amapFromEnv ? '留空使用 .env 中的 AMAP_KEY' : '可选，稍后也可以补充'} maxLength={64} spellCheck={false} /></label>
                </div>
                <div className="admin-site-foot"><span><Sparkles size={12} /> 保存后立即影响登录页与高德服务；浏览器刷新后标题更新。</span><button className="primary-btn" disabled={siteSaving}><Save size={14} /> {siteSaving ? '保存中…' : '保存站点设置'}</button></div>
              </form>
            )}

            <section className="admin-panel glass admin-users-panel">
              <div className="admin-panel-head">
                <div><span className="eyebrow">USER REGISTRY</span><h3>用户管理</h3></div>
                <div className="admin-search"><Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索用户名 / 显示名" /></div>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>用户</th><th>角色</th><th>影像</th><th>最近活动</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="admin-user-cell">
                            <span className="admin-avatar" style={{ background: u.avatarColor }}>{u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : initials(u.name)}</span>
                            <span><strong>{u.name}</strong><small>@{u.username}{u.id === account?.id ? ' · 你' : ''}</small></span>
                          </div>
                        </td>
                        <td><span className={`role-chip ${u.role}`}>{u.role === 'owner' ? <Crown size={10} /> : u.role === 'admin' ? <ShieldCheck size={10} /> : <UserRound size={10} />}{u.role === 'owner' ? '主人' : u.role === 'admin' ? '管理员' : '成员'}</span></td>
                        <td><span className="admin-mono">{u.photos} 帧</span><small className="admin-sub">{u.people} 位旅人</small></td>
                        <td><span className="admin-mono">{u.lastPhotoAt ? formatDateDots(u.lastPhotoAt) : u.lastLoginAt ? formatDateDots(u.lastLoginAt) : '—'}</span><small className="admin-sub">{u.lastLoginAt ? '最近登录' : '尚未登录'}</small></td>
                        <td><span className={`user-status ${u.disabled ? 'off' : 'on'}`}><i />{u.disabled ? '已禁用' : '正常'}</span></td>
                        <td>
                          {u.id !== account?.id ? (() => {
                            const canManage = isOwner ? u.role !== 'owner' : u.role === 'member';
                            const canRole = canManage;
                            return canManage ? (
                              <div className="admin-row-actions">
                                {canRole && <button className="admin-icon-btn" title={u.role === 'admin' ? '取消管理员' : '设为管理员'} onClick={() => setRole(u, u.role === 'admin' ? 'member' : 'admin')} disabled={busyId === u.id}><ShieldCheck size={13} /></button>}
                                <button className="admin-icon-btn" title={u.disabled ? '启用' : '禁用'} onClick={() => toggleUser(u)} disabled={busyId === u.id}><Power size={13} /></button>
                                <button className="admin-icon-btn" title="重置密码" onClick={() => resetPassword(u)} disabled={busyId === u.id}><KeyRound size={13} /></button>
                                <button className="admin-icon-btn danger" title="删除用户" onClick={() => setConfirm({ type: 'user', user: u })}><Trash2 size={13} /></button>
                              </div>
                            ) : <span className="admin-mono muted">{isOwner ? 'OWNER' : 'STAFF'}</span>;
                          })() : <span className="admin-mono muted">SELF</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredUsers.length && <div className="admin-empty">没有匹配的用户</div>}
              </div>
            </section>

            <div className="admin-grid">
              <section className="admin-panel glass admin-invites-panel">
                <div className="admin-panel-head"><div><span className="eyebrow">INVITE LEDGER</span><h3>邀请码总览</h3></div><Ticket size={18} /></div>
                <div className="admin-invite-list">
                  {invites.slice(0, 12).map(inv => {
                    const [label, cls] = statusOf(inv);
                    return (
                      <div className="admin-invite-row" key={inv.id}>
                        <div><strong className="admin-code">{inv.code}</strong><small>@{inv.creator} · {formatDateDots(inv.expiresAt)} 到期</small></div>
                        <span className={`invite-status ${cls}`}>{label}</span>
                        {cls === 'on' && <button className="text-btn danger" onClick={() => revokeInvite(inv)} disabled={busyId === inv.id}>撤销</button>}
                      </div>
                    );
                  })}
                  {!invites.length && <div className="admin-empty">还没有邀请码</div>}
                </div>
              </section>

              <section className="admin-panel glass admin-storage-panel">
                <div className="admin-panel-head"><div><span className="eyebrow">MEDIA VAULT</span><h3>存储分布</h3></div><Database size={18} /></div>
                <div className="storage-lines">
                  {[
                    ['原图', overview?.storage?.originals || 0],
                    ['展示图', overview?.storage?.uploads || 0],
                    ['缩略图', overview?.storage?.thumbs || 0],
                    ['数据库', overview?.storage?.database || 0],
                  ].map(([label, value]) => (
                    <div className="storage-line" key={label}>
                      <span>{label}</span><strong>{formatBytes(value)}</strong>
                      <i><b style={{ width: `${storagePct(value)}%` }} /></i>
                    </div>
                  ))}
                </div>
                <div className="admin-system">
                  <div><Server size={13} /><span>NODE</span><strong>{overview?.system?.node}</strong></div>
                  <div><Activity size={13} /><span>UPTIME</span><strong>{Math.floor((overview?.system?.uptime || 0) / 60)} min</strong></div>
                  <div><MapPin size={13} /><span>AMAP</span><strong>{overview?.system?.amapEnabled ? 'CONNECTED' : 'OFFLINE'}</strong></div>
                </div>
              </section>

              <section className="admin-panel glass admin-recent-panel">
                <div className="admin-panel-head"><div><span className="eyebrow">RECENT UPLINKS</span><h3>最近上传</h3></div><Images size={18} /></div>
                <div className="admin-recent-grid">
                  {overview?.recentPhotos?.map(p => (
                    <div key={p.id} className="admin-recent-item">
                      <img src={p.thumb} alt={p.title} />
                      <span><strong>{p.title}</strong><small>@{p.username}</small></span>
                    </div>
                  ))}
                  {!overview?.recentPhotos?.length && <div className="admin-empty">还没有上传记录</div>}
                </div>
              </section>

              <section className="admin-panel glass admin-health-panel">
                <div className="admin-panel-head"><div><span className="eyebrow">SYSTEM HEALTH</span><h3>节点状态</h3></div><ShieldCheck size={18} /></div>
                <div className="health-lines">
                  <div><span>INVITE CONTROL</span><strong className="on"><i /> ENABLED</strong></div>
                  <div><span>API SESSION</span><strong className="on"><i /> SECURE</strong></div>
                  <div><span>DATABASE</span><strong className="on"><i /> WRITABLE</strong></div>
                  <div><span>AMAP KEY</span><strong className={overview?.system?.amapEnabled ? 'on' : 'off'}><i /> {overview?.system?.amapEnabled ? 'CONFIGURED' : 'MISSING'}</strong></div>
                </div>
                <div className="admin-note"><ShieldCheck size={14} /><p>后台对主人和管理员开放。主人可管理管理员；管理员可管理普通成员并授予管理员权限。禁用用户会立即使其会话失效；删除用户会移除其照片与头像文件。</p></div>
              </section>
            </div>
          </>
        )}
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} className="admin-confirm-modal" label="确认删除用户">
        {confirm?.type === 'user' && (
          <div className="person-form">
            <div className="eyebrow"><span>DESTRUCTIVE ACTION</span><span>OWNER OVERRIDE</span></div>
            <h2>删除 @{confirm.user.username}？</h2>
            <p className="admin-danger-copy">会删除该用户的 <strong>{confirm.user.photos} 张影像</strong>、{confirm.user.people} 位旅人、全部邀请码和媒体文件。此操作不可撤销。</p>
            <div className="modal-action-row"><span /><div><button className="ghost-btn" onClick={() => setConfirm(null)}>取消</button><button className="danger-btn" onClick={() => removeUser(confirm.user)} disabled={busyId === confirm.user.id}><Trash2 size={14} /> 确认删除</button></div></div>
          </div>
        )}
      </Modal>

      <Modal open={!!tempPassword} onClose={() => setTempPassword(null)} className="admin-temp-modal" label="临时密码">
        {tempPassword && (
          <div className="person-form">
            <div className="eyebrow"><span>PASSWORD RESET</span><span>SINGLE VIEW</span></div>
            <h2>@{tempPassword.user.username} 的临时密码</h2>
            <p className="admin-danger-copy">请通过安全渠道发送给用户。关闭后不再显示，用户下次登录后建议立即修改。</p>
            <button className="temp-password" onClick={() => copy(tempPassword.password, '临时密码已复制')}>{tempPassword.password}<Copy size={14} /></button>
            <div className="modal-action-row"><span /><div><button className="primary-btn" onClick={() => setTempPassword(null)}>我已保存</button></div></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
