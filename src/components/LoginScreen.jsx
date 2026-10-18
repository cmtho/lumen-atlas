import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Orbit, Sparkles, Ticket, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import SetupScreen from './SetupScreen.jsx';

const inviteFromUrl = () => {
  try { return new URLSearchParams(window.location.search).get('invite') || ''; } catch { return ''; }
};

function splitBrand(name) {
  const words = String(name || 'LUMEN ATLAS').trim().split(/\s+/);
  const last = words.pop() || 'LUMEN ATLAS';
  return { first: words.join(' '), last };
}

export default function LoginScreen({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const [status, setStatus] = useState(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteFromUrl());
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.authStatus().then(s => {
      if (!alive) return;
      setStatus(s);
      if (s.authenticated) onSuccess?.();
      if (s.needsSetup || inviteFromUrl()) setMode('register');
      setTimeout(() => inputRef.current?.focus(), 250);
    }).catch(() => {
      if (alive) setStatus({ needsSetup: false, inviteRequired: true });
    });
    return () => { alive = false; };
  }, [onSuccess]);

  const switchMode = (next) => {
    if (status?.needsSetup && next === 'login') return;
    setMode(next); setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (password.length < 8) { setError('密码至少 8 位'); return; }
    if (mode === 'register') {
      if (!status?.needsSetup && !inviteCode.trim()) { setError('请输入邀请码'); return; }
      if (password !== confirm) { setError('两次输入的密码不一致'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.register({
          username: username.trim(),
          password,
          displayName: displayName.trim(),
          inviteCode: inviteCode.trim(),
        });
        try { window.history.replaceState({}, '', window.location.pathname); } catch {}
      } else {
        await api.login(username.trim(), password);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.message || '操作失败');
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';
  const needsSetup = status?.needsSetup;
  const site = status?.site || {};
  const brand = splitBrand(site.siteName);
  useEffect(() => { if (site.siteName && !needsSetup) document.title = `${site.siteName} · 登录`; }, [site.siteName, needsSetup]);

  if (needsSetup && status) return <SetupScreen site={site} onSuccess={onSuccess} />;

  return (
    <div className="login-screen">
      <div className="login-stars" aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />
      <div className="login-card glass">
        <div className="login-orbit"><span /><i /><b /></div>
        <div className="eyebrow light"><span>PRIVATE ORBIT / INVITE ACCESS</span><span>ENCRYPTED SESSION</span></div>
        <h1>{brand.first && `${brand.first} `}<i>{brand.last}</i></h1>
        <p className="login-intro">
          {needsSetup ? '第一次启动：创建主人账号，接管这颗影像星球。' : isRegister ? '你收到了一张进入私人星图的邀请。' : '重新连接你的私人影像轨道。'}
        </p>

        <div className="login-tabs" role="tablist">
          {!needsSetup && <button className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')} role="tab">登录</button>}
          <button className={isRegister ? 'active' : ''} onClick={() => switchMode('register')} role="tab">{needsSetup ? '创建主人账号' : '邀请码注册'}</button>
        </div>

        <form onSubmit={submit} className="login-form">
          {isRegister && !needsSetup && (
            <label className="login-field">
              <Ticket size={15} />
              <input value={inviteCode} onChange={e => { setInviteCode(e.target.value.toUpperCase()); setError(''); }} placeholder="INVITE CODE / 邀请码" autoComplete="off" spellCheck={false} />
            </label>
          )}
          <label className="login-field">
            <UserRound size={15} />
            <input ref={inputRef} value={username} onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); setError(''); }} placeholder="USERNAME / 用户名" autoComplete="username" spellCheck={false} />
          </label>
          {isRegister && (
            <label className="login-field">
              <Sparkles size={15} />
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="显示名称（可选）" maxLength={40} />
            </label>
          )}
          <div className="login-password-wrap">
            <label className="login-field">
              <KeyRound size={15} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder={isRegister ? '设置密码（至少 8 位）' : 'PASSWORD / 密码'} autoComplete={isRegister ? 'new-password' : 'current-password'} />
            </label>
            <button type="button" className="login-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {isRegister && (
            <div className="login-password-wrap">
              <label className="login-field">
                <KeyRound size={15} />
                <input type={showPassword ? 'text' : 'password'} value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} placeholder="再次输入密码" autoComplete="new-password" />
              </label>
            </div>
          )}
          {isRegister && (
            <div className="login-note">
              <span className="live-dot" />
              {needsSetup ? '第一个账号将成为主人账号；之后的新用户必须使用邀请码。' : '每个邀请码仅可使用一次，有效期 14 天。'}
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          <button className="primary-btn login-submit" disabled={busy || !status}>
            {busy ? '正在校验轨道…' : <><span>{isRegister ? (needsSetup ? '创建账号并进入' : '接受邀请并注册') : '进入星图'}</span><ArrowRight size={16} /></>}
          </button>
        </form>

        {!needsSetup && (
          <div className="login-switch">
            {isRegister ? <>已经有账号？<button onClick={() => switchMode('login')}>直接登录</button></> : <>没有账号？<button onClick={() => switchMode('register')}>使用邀请码注册</button></>}
          </div>
        )}
        <div className="login-foot"><Orbit size={12} /> 流光坐标 · INVITE-ONLY PERSONAL PHOTO ATLAS</div>
      </div>
      <div className="login-coord" aria-hidden="true">PRIVATE NODE / INVITE REQUIRED / LUMEN ATLAS 1.1</div>
    </div>
  );
}
