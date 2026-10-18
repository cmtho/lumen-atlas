import { useMemo, useRef, useState } from 'react';
import { Aperture, Camera, Copy, Database, Download, Globe2, HardDrive, KeyRound, Link2, LogOut, MapPin, Moon, Pencil, RotateCcw, ShieldCheck, Sparkles, Sun, Ticket, Trash2 } from 'lucide-react';
import { formatDateDots, initials, regionKey } from '../lib/utils.js';

export default function ProfileView({ profile, photos, places, people, theme, onToggleTheme, onEditProfile, onClearDemo, onRestoreDemo, demoCount, onNotice, account, invites = [], enableDemo, onGenerateInvite, onRevokeInvite, onLogout, onChangePassword, onOpenAdmin, isStaff, onAvatarUpload, onAvatarRemove }) {
  const avatarInputRef = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [inviteDays, setInviteDays] = useState(14);
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteBusy, setInviteBusy] = useState(false);
  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try { await onAvatarUpload?.(file); }
    catch (err) { onNotice?.(err.message); }
    finally { setAvatarBusy(false); e.target.value = ''; }
  };
  const stats = useMemo(() => {
    const countries = new Set(photos.map(p => p.countryCode || p.country).filter(Boolean));
    return { countries: countries.size, places: places.length, photos: photos.length, people: people.length };
  }, [photos, places, people]);

  const topRegions = useMemo(() => {
    const map = new Map();
    for (const p of photos) {
      const key = p.countryCode === 'cn' || p.country === '中国' ? (p.province || p.country) : (p.country || '未知地区');
      if (!key) continue;
      const entry = map.get(key) || { key, count: 0, cover: p.thumb };
      entry.count++;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [photos]);

  const cameras = useMemo(() => {
    const map = new Map();
    for (const p of photos) {
      const key = p.camera || '未知设备';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [photos]);

  const maxRegion = topRegions[0]?.count || 1;
  const yearStart = useMemo(() => {
    const dates = photos.map(p => new Date(p.capturedAt).getTime()).filter(Number.isFinite);
    return dates.length ? new Date(Math.min(...dates)).getFullYear() : new Date().getFullYear();
  }, [photos]);

  return (
    <div className="page-view profile-view">
      <div className="page-ambient" aria-hidden="true" />
      <div className="page-wrap">
        <div className="eyebrow page-top-eyebrow"><span>PERSONAL ARCHIVE / 04</span><span>IDENTITY SIGNAL VERIFIED</span></div>

        <section className="profile-hero glass">
          <div className="profile-hero-bg" aria-hidden="true"><span /><i /><b /></div>
          <div className="profile-identity">
            <div className="profile-avatar" style={{ '--avatar': profile?.avatarColor || '#65f4ff' }}>
              {profile?.avatarUrl ? <img className="profile-avatar-img" src={profile.avatarUrl} alt="头像" /> : <span>{initials(profile?.name || '我')}</span>}
              <i className="orbit orbit-a" /><i className="orbit orbit-b" /><i className="orbit orbit-c" />
              <button type="button" className="profile-avatar-edit" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy} title="上传头像">
                <Camera size={13} />
              </button>
              {profile?.avatarUrl && (
                <button type="button" className="profile-avatar-remove" onClick={async () => { try { await onAvatarRemove?.(); } catch (err) { onNotice?.(err.message); } }} title="移除头像">
                  <Trash2 size={12} />
                </button>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
            </div>
            <div className="profile-copy">
              <div className="eyebrow"><span>VOYAGER ID / {profile?.handle || 'UNASSIGNED'}</span><span>@{account?.username || 'account'} · {account?.role === 'owner' ? 'OWNER' : account?.role === 'admin' ? 'ADMIN' : 'MEMBER'}</span></div>
              <h1>{profile?.name || '未命名旅人'}<span className="accent-dot">.</span></h1>
              <p>{profile?.bio || '在这颗星球上，继续收集光与坐标。'}</p>
              <div className="profile-meta">
                <span><MapPin size={13} /> {profile?.home || '地球'}</span>
                <span><Globe2 size={13} /> 自 {yearStart} 年起记录</span>
                <span className="live-label"><span className="live-dot" /> LOCAL ARCHIVE</span>
              </div>
            </div>
            <button className="ghost-btn profile-edit" onClick={onEditProfile}><Pencil size={14} /> 编辑档案</button>
          </div>

          <div className="profile-stats">
            <div><strong>{String(stats.photos).padStart(2, '0')}</strong><span>影像帧</span><small>FRAMES</small></div>
            <div><strong>{String(stats.places).padStart(2, '0')}</strong><span>坐标</span><small>PLACES</small></div>
            <div><strong>{String(stats.countries).padStart(2, '0')}</strong><span>国家 / 地区</span><small>REGIONS</small></div>
            <div><strong>{String(stats.people).padStart(2, '0')}</strong><span>旅人</span><small>PEOPLE</small></div>
          </div>
        </section>

        <div className="profile-grid">
          <section className="profile-panel glass">
            <div className="panel-head"><div><span className="eyebrow">DENSITY MAP</span><h3>坐标密度</h3></div><MapPin size={18} /></div>
            <div className="region-bars">
              {topRegions.map((r, i) => (
                <div key={r.key} className="region-bar" style={{ '--w': `${Math.max(14, r.count / maxRegion * 100)}%`, '--i': i }}>
                  <div className="region-bar-head"><span>{r.key}</span><strong>{String(r.count).padStart(2, '0')}</strong></div>
                  <div className="region-track"><span /></div>
                </div>
              ))}
              {!topRegions.length && <div className="panel-empty">上传影像后，这里会长出你的坐标密度图。</div>}
            </div>
          </section>

          <section className="profile-panel glass">
            <div className="panel-head"><div><span className="eyebrow">OPTICAL ARRAY</span><h3>影像设备</h3></div><Aperture size={18} /></div>
            <div className="camera-list">
              {cameras.map(([camera, count], i) => (
                <div key={camera} className="camera-row">
                  <span className="camera-icon"><Camera size={15} /></span>
                  <span className="camera-name">{camera}</span>
                  <span className="camera-count">{count} 帧</span>
                  <span className="camera-line"><i style={{ width: `${Math.max(8, count / (cameras[0]?.[1] || 1) * 100)}%` }} /></span>
                </div>
              ))}
              {!cameras.length && <div className="panel-empty">上传带 EXIF 的照片，设备信息会自动归档。</div>}
            </div>
          </section>

          <section className="profile-panel glass settings-panel">
            <div className="panel-head"><div><span className="eyebrow">SYSTEM</span><h3>界面与数据</h3></div><Sparkles size={18} /></div>
            <div className="setting-row">
              <div><strong>外观模式</strong><small>液态玻璃会在明暗两种星空中重新折射</small></div>
              <div className="theme-switch">
                <button className={theme === 'dark' ? 'active' : ''} onClick={() => theme !== 'dark' && onToggleTheme()} aria-label="深色模式"><Moon size={14} /> 深色</button>
                <button className={theme === 'light' ? 'active' : ''} onClick={() => theme !== 'light' && onToggleTheme()} aria-label="浅色模式"><Sun size={14} /> 浅色</button>
              </div>
            </div>
            <div className="setting-row">
              <div><strong>数据备份</strong><small>导出全部影像元数据为 JSON，原图可在服务器 data 目录取回</small></div>
              <a className="ghost-btn" href="/api/export" download><Download size={14} /> 导出</a>
            </div>
            <div className="setting-row">
              <div><strong>地图与地理编码</strong><small>OpenFreeMap / OpenStreetMap · DataV 行政区划 · 无需 API Key</small></div>
              <span className="status-chip"><span className="live-dot" /> ONLINE</span>
            </div>
            {enableDemo && (
              <div className="setting-row">
                <div><strong>示例档案</strong><small>{demoCount ? `当前有 ${demoCount} 条示例影像，可随时清除` : '示例影像已清除，可重新载入预览效果'}</small></div>
                {demoCount ? (
                  <button className="danger-btn" onClick={onClearDemo}><Trash2 size={14} /> 清除示例</button>
                ) : (
                  <button className="ghost-btn" onClick={onRestoreDemo}><RotateCcw size={14} /> 载入示例</button>
                )}
              </div>
            )}
            <div className="setting-row storage-row">
              <div><strong>存储状态</strong><small>影像与数据库保存在本机磁盘，不上传第三方云服务</small></div>
              <span className="status-chip"><HardDrive size={12} /> LOCAL</span>
            </div>
            <div className="setting-row account-row">
              <div><strong>账号与安全</strong><small>@{account?.username || 'account'} · {account?.role === 'owner' ? '主人账号' : account?.role === 'admin' ? '管理员' : '受邀成员'} · 每个账号拥有独立的照片、人物与邀请码</small></div>
              <div className="account-actions">
                {isStaff && <button className="ghost-btn" onClick={onOpenAdmin}><ShieldCheck size={14} /> 后台管理</button>}
                <button className="ghost-btn" onClick={onChangePassword}><KeyRound size={14} /> 修改密码</button>
                <button className="ghost-btn" onClick={onLogout}><LogOut size={14} /> 退出登录</button>
              </div>
            </div>
          </section>

          <section className="profile-panel glass system-panel">
            <div className="panel-head"><div><span className="eyebrow">TELEMETRY</span><h3>档案状态</h3></div><Database size={18} /></div>
            <div className="system-lines">
              <div><span>DATABASE</span><strong>ONLINE</strong></div>
              <div><span>MEDIA VAULT</span><strong>{photos.length} FILES</strong></div>
              <div><span>LAST SYNC</span><strong>{photos[0] ? formatDateDots(photos[0].capturedAt) : '—'}</strong></div>
              <div><span>ENCRYPTION</span><strong>LOCAL ONLY</strong></div>
              <div><span>PROVIDER</span><strong>OPENFREEMAP</strong></div>
            </div>
            <div className="system-note"><Globe2 size={14} /><p>地图可从全球俯冲到街道；中国区域叠加省界与行政区选择。</p></div>
          </section>
        </div>

        <section className="invite-panel glass">
          <div className="invite-intro">
            <span className="eyebrow">GROW THE CONSTELLATION</span>
            <h3>邀请新的旅人<span className="accent-dot">.</span></h3>
            <p>每位已注册用户都可以生成邀请码。被邀请人打开链接后即可创建自己的账号，照片、人物和地点彼此隔离。</p>
            <div className="invite-config">
              <label><span>有效期</span><input type="number" min="1" max="365" value={inviteDays} onChange={e => setInviteDays(e.target.value)} /><em>天</em></label>
              <label><span>可用次数</span><input type="number" min="1" max="100" value={inviteUses} onChange={e => setInviteUses(e.target.value)} /><em>次</em></label>
            </div>
            <button className="primary-btn" disabled={inviteBusy} onClick={async () => {
              setInviteBusy(true);
              try {
                const inv = await onGenerateInvite?.({ expiresDays: Number(inviteDays), maxUses: Number(inviteUses) });
                if (inv) {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/?invite=${inv.code}`);
                    onNotice?.('邀请链接已复制');
                  } catch { onNotice?.(`邀请码：${inv.code}`); }
                }
              } catch (err) { onNotice?.(err.message); }
              finally { setInviteBusy(false); }
            }}><Ticket size={15} /> {inviteBusy ? '生成中…' : '生成邀请码'}</button>
            <small>1–365 天 · 1–100 次 · 已登录用户均可生成</small>
          </div>
          <div className="invite-list">
            <div className="invite-list-head"><span>我的邀请码</span><em>{invites.length} TOTAL</em></div>
            {invites.length === 0 && <div className="invite-empty"><Ticket size={20} /><span>还没有生成邀请码</span></div>}
            {invites.map(inv => {
              const expired = new Date(inv.expiresAt) <= new Date();
              const used = (inv.uses || 0) >= (inv.maxUses || 1);
              const active = inv.active && !expired && !used;
              return (
                <div className={`invite-item ${active ? 'active' : ''}`} key={inv.id}>
                  <div className="invite-code-row">
                    <strong>{inv.code}</strong>
                    <span className={active ? 'active' : 'spent'}>{active ? `可用 ${Math.max(0, (inv.maxUses || 1) - (inv.uses || 0))}/${inv.maxUses || 1}` : used ? '已用完' : expired ? '已过期' : '已撤销'}</span>
                  </div>
                  <div className="invite-meta">
                    <span><Link2 size={11} /> {new Date(inv.expiresAt).toLocaleDateString('zh-CN')} 到期</span>
                    <span>已用 {inv.uses || 0} / {inv.maxUses || 1} 次</span>
                    {inv.usedBy?.length > 0 && <span>@{inv.usedBy.join(', @')}</span>}
                  </div>
                  <div className="invite-actions">
                    {active && <button className="text-btn" onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/?invite=${inv.code}`).then(() => onNotice?.('邀请链接已复制')).catch(() => onNotice?.(`邀请码：${inv.code}`));
                    }}><Copy size={12} /> 复制链接</button>}
                    {active && <button className="text-btn danger" onClick={() => onRevokeInvite?.(inv.id)}>撤销</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="profile-foot">
          <span>LUMEN ATLAS · 流光坐标</span>
          <span>BUILT FOR TRAVELERS / {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
