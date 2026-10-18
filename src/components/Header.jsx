import { Compass, Globe2, Images, Plus, Search, ShieldCheck, Sun, Moon, UserRound, Users } from 'lucide-react';
import { initials, cx } from '../lib/utils.js';

const tabs = [
  { id: 'atlas', label: '星图', en: 'ATLAS', icon: Globe2 },
  { id: 'archive', label: '档案', en: 'ARCHIVE', icon: Images },
  { id: 'people', label: '旅人', en: 'PEOPLE', icon: Users },
  { id: 'profile', label: '我的', en: 'PROFILE', icon: UserRound },
];

export default function Header({ view, setView, theme, onToggleTheme, onUpload, profile, onSearch, isStaff, site }) {
  const visibleTabs = isStaff ? [...tabs, { id: 'admin', label: '管理', en: 'ADMIN', icon: ShieldCheck }] : tabs;
  const words = String(site?.siteName || 'LUMEN ATLAS').trim().split(/\s+/);
  const lastWord = words.pop() || 'ATLAS';
  return (
    <header className={cx('app-header', view === 'atlas' && 'on-map')}>
      <button className="brand" onClick={() => setView('atlas')} aria-label="返回星图">
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-orbit" />
          <span className="brand-core" />
        </span>
        <span className="brand-type">
          <strong>{words.join(' ')}{words.length ? ' ' : ''}<i>{lastWord}</i></strong>
          <small>{site?.tagline || '流光坐标 · PERSONAL ORBIT'}</small>
        </span>
      </button>

      <nav className="main-nav glass" aria-label="主要导航">
        {visibleTabs.map(({ id, label, en, icon: Icon }) => (
          <button key={id} className={cx('nav-tab', view === id && 'active')} onClick={() => setView(id)}>
            <Icon size={15} strokeWidth={1.7} />
            <span>{label}</span>
            <em>{en}</em>
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <button className="icon-btn glass search-btn" onClick={onSearch} aria-label="搜索"><Search size={17} /></button>
        <button className="icon-btn glass" onClick={onToggleTheme} aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="upload-btn" onClick={onUpload}>
          <Plus size={16} />
          <span>上传影像</span>
          <small>UPLOAD</small>
        </button>
        <button className="avatar-btn" onClick={() => setView('profile')} aria-label="打开个人档案" style={{ '--avatar': profile?.avatarColor || '#65f4ff' }}>
          {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{initials(profile?.name || '我')}</span>}
        </button>
      </div>
    </header>
  );
}

export function MobileNav({ view, setView, onUpload }) {
  return (
    <nav className="mobile-nav glass" aria-label="移动端导航">
      {tabs.slice(0, 2).map(({ id, label, icon: Icon }) => (
        <button key={id} className={cx('mobile-tab', view === id && 'active')} onClick={() => setView(id)}>
          <Icon size={19} strokeWidth={1.7} />
          <span>{label}</span>
        </button>
      ))}
      <button className="mobile-upload" onClick={onUpload} aria-label="上传影像">
        <Plus size={22} />
      </button>
      {tabs.slice(2).map(({ id, label, icon: Icon }) => (
        <button key={id} className={cx('mobile-tab', view === id && 'active')} onClick={() => setView(id)}>
          <Icon size={19} strokeWidth={1.7} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
