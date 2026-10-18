import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe2, KeyRound, Map, Orbit, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';

const DEFAULTS = {
  siteName: 'LUMEN ATLAS',
  tagline: '流光坐标 · PERSONAL ORBIT',
  description: '把每一次抵达，钉在地球上。',
};

function splitBrand(name) {
  const words = String(name || DEFAULTS.siteName).trim().split(/\s+/);
  const last = words.pop() || DEFAULTS.siteName;
  return { first: words.join(' '), last };
}

export default function SetupScreen({ site, onSuccess }) {
  const [form, setForm] = useState({
    siteName: site?.siteName || DEFAULTS.siteName,
    tagline: site?.tagline || DEFAULTS.tagline,
    description: site?.description || DEFAULTS.description,
    displayName: '',
    username: '',
    password: '',
    confirm: '',
    amapKey: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const patch = (p) => setForm(prev => ({ ...prev, ...p }));
  const brand = splitBrand(form.siteName);

  useEffect(() => {
    document.title = `${form.siteName || DEFAULTS.siteName} · 初次部署`;
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [form.siteName]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.siteName.trim()) { setError('请填写站点名称'); return; }
    if (!form.username.trim() || form.username.trim().length < 3) { setError('用户名至少 3 位'); return; }
    if (form.password.length < 8) { setError('密码至少 8 位'); return; }
    if (form.password !== form.confirm) { setError('两次输入的密码不一致'); return; }
    setBusy(true);
    try {
      await api.setup({
        siteName: form.siteName.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        password: form.password,
        amapKey: form.amapKey.trim(),
      });
      try { window.history.replaceState({}, '', '/'); } catch {}
      onSuccess?.();
    } catch (err) {
      setError(err.message || '初始化失败');
      setBusy(false);
    }
  };

  return (
    <div className="login-screen setup-screen">
      <div className="login-stars" aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />
      <div className="setup-card glass">
        <aside className="setup-aside">
          <div className="login-orbit"><span /><i /><b /></div>
          <div className="eyebrow light"><span>FIRST LIGHT / INITIAL DEPLOY</span><span>OWNER CONSOLE</span></div>
          <h1>{brand.first && `${brand.first} `}<i>{brand.last}</i></h1>
          <p className="setup-tagline">{form.tagline || DEFAULTS.tagline}</p>
          <div className="setup-steps">
            <div><b>01</b><span><strong>站点身份</strong><small>名称与一句话介绍会出现在登录页和页面标题</small></span></div>
            <div><b>02</b><span><strong>主人账号</strong><small>第一个账号拥有后台与全站管理权限</small></span></div>
            <div><b>03</b><span><strong>高德 Key</strong><small>可选；中国地点搜索与街道底图会用到</small></span></div>
          </div>
          <div className="setup-security"><ShieldCheck size={14} /><span>初始化只会执行一次。完成后，新用户必须使用邀请码注册。</span></div>
        </aside>

        <form className="setup-form" onSubmit={submit}>
          <div className="setup-form-head">
            <span className="eyebrow"><span>DEPLOYMENT CONFIG</span><span>STEP 01 / ONLY ONCE</span></span>
            <h2>配置你的星图<span className="accent-dot">.</span></h2>
            <p>这些信息之后都可以在“管理 → 站点设置”里修改。</p>
          </div>

          <div className="setup-section-label"><Globe2 size={13} /><span>站点身份</span><em>SITE IDENTITY</em></div>
          <div className="setup-field-grid two">
            <label className="login-field setup-field"><Globe2 size={14} /><input value={form.siteName} onChange={e => patch({ siteName: e.target.value })} placeholder="站点名称" maxLength={40} /></label>
            <label className="login-field setup-field"><Sparkles size={14} /><input value={form.tagline} onChange={e => patch({ tagline: e.target.value })} placeholder="一句话介绍" maxLength={80} /></label>
          </div>
          <label className="login-field setup-field"><Map size={14} /><input value={form.description} onChange={e => patch({ description: e.target.value })} placeholder="站点描述（可选）" maxLength={200} /></label>

          <div className="setup-section-label"><UserRound size={13} /><span>主人账号</span><em>OWNER ACCOUNT</em></div>
          <div className="setup-field-grid two">
            <label className="login-field setup-field"><UserRound size={14} /><input value={form.displayName} onChange={e => patch({ displayName: e.target.value })} placeholder="显示名称（可选）" maxLength={40} /></label>
            <label className="login-field setup-field"><UserRound size={14} /><input ref={inputRef} value={form.username} onChange={e => patch({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} placeholder="登录用户名" maxLength={24} autoComplete="username" spellCheck={false} /></label>
          </div>
          <div className="setup-field-grid two">
            <label className="login-field setup-field"><KeyRound size={14} /><input type="password" value={form.password} onChange={e => patch({ password: e.target.value })} placeholder="密码（至少 8 位）" autoComplete="new-password" /></label>
            <label className="login-field setup-field"><KeyRound size={14} /><input type="password" value={form.confirm} onChange={e => patch({ confirm: e.target.value })} placeholder="再次输入密码" autoComplete="new-password" /></label>
          </div>

          <div className="setup-section-label"><Map size={13} /><span>高德地图</span><em>OPTIONAL</em></div>
          <label className="login-field setup-field"><Map size={14} /><input value={form.amapKey} onChange={e => patch({ amapKey: e.target.value.trim() })} placeholder="AMap Web 服务 / JS API Key（可稍后填写）" maxLength={64} spellCheck={false} /></label>
          <div className="setup-hint"><KeyRound size={12} /> 不填也能完成初始化；之后可在“管理 → 站点设置”中补充。</div>

          {error && <div className="login-error">{error}</div>}
          <button className="primary-btn setup-submit" disabled={busy}>
            {busy ? '正在初始化星图…' : <><span>完成初始化并进入</span><ArrowRight size={16} /></>}
          </button>
          <div className="setup-foot"><Orbit size={12} /> 首次部署 · 此配置页在账号创建后自动关闭</div>
        </form>
      </div>
    </div>
  );
}
