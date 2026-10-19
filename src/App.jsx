import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Header, { MobileNav } from './components/Header.jsx';
import AtlasView from './components/AtlasView.jsx';
import TracksView from './components/TracksView.jsx';
import ArchiveView from './components/ArchiveView.jsx';
import PeopleView from './components/PeopleView.jsx';
import ProfileView from './components/ProfileView.jsx';
import SearchPalette from './components/SearchPalette.jsx';
import UploadModal from './components/UploadModal.jsx';
import PhotoModal from './components/PhotoModal.jsx';
import { PersonModal, ProfileModal, PasswordModal } from './components/PeopleModals.jsx';
import Toast from './components/Toast.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import AdminView from './components/AdminView.jsx';
import { api } from './lib/api.js';
import { buildPlaces, regionKey } from './lib/utils.js';

const EMBED_PARAM = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('embed') : null;
const EMBED_MAP = EMBED_PARAM === 'map';
const EMBED_TRACKS = EMBED_PARAM === 'tracks';
const EMBED_PROVIDER = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('provider') === 'amap' ? 'amap' : 'libre';
const EMPTY_FILTER = { q: '', personId: '', year: '', province: '', placeKey: '' };

function LoadingScreen() {
  return (
    <div className="boot-screen">
      <div className="boot-stars" aria-hidden="true" />
      <div className="boot-mark"><span className="brand-orbit" /><span className="brand-core" /></div>
      <h1>LUMEN <i>ATLAS</i></h1>
      <p>正在校准你的私人轨道</p>
      <div className="boot-line"><span /></div>
      <small>INITIALIZING LOCAL ARCHIVE · OPENFREEMAP LINK</small>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="boot-screen error">
      <AlertTriangle size={30} />
      <h1>无法连接轨道</h1>
      <p>{message}</p>
      <button className="primary-btn" onClick={onRetry}><RefreshCw size={15} /> 重新连接</button>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('lumen-theme') || 'dark');
  const [mapProvider, setMapProvider] = useState(() => EMBED_MAP ? EMBED_PROVIDER : (localStorage.getItem('lumen-map-provider') || 'libre'));
  const [view, setView] = useState(EMBED_TRACKS ? 'tracks' : 'atlas');
  const [toast, setToast] = useState(null);
  const [personFilter, setPersonFilter] = useState(null);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState(null);
  const [mapFocus, setMapFocus] = useState({ lat: 34, lng: 100, zoom: 2.25, ts: Date.now() });
  const [userLocation, setUserLocation] = useState(null);
  const [nativePlace, setNativePlace] = useState(null);
  const [archiveFilter, setArchiveFilter] = useState(EMPTY_FILTER);
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPersonId, setUploadPersonId] = useState(null);
  const [uploadLocation, setUploadLocation] = useState(null);
  const [pickMode, setPickMode] = useState(false);
  const [pickResult, setPickResult] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [personModal, setPersonModal] = useState({ open: false, person: null });
  const [profileModal, setProfileModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [tracksDirty, setTracksDirty] = useState(false);

  const notice = useCallback((message, type = 'success') => {
    setToast({ id: Date.now() + Math.random(), message, type });
  }, []);

  const guardSetView = useCallback((next) => {
    if (view === 'tracks' && next !== 'tracks' && tracksDirty && !window.confirm('当前轨迹还没有保存，确定离开吗？')) return;
    setView(next);
  }, [view, tracksDirty]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const res = await api.bootstrap();
      setData(res);
      setAuthRequired(false);
    } catch (e) {
      if (e.status === 401) setAuthRequired(true);
      else setLoadError(e.message || '服务器暂时没有响应');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    localStorage.setItem('lumen-map-provider', mapProvider);
  }, [mapProvider]);

  useEffect(() => {
    document.title = data?.site?.siteName ? `${data.site.siteName} · 私人旅行影像星图` : 'Lumen Atlas · 流光坐标';
  }, [data?.site?.siteName]);

  useEffect(() => {
    document.documentElement.classList.toggle('embed-map', EMBED_MAP);
    document.documentElement.classList.toggle('embed-tracks', EMBED_TRACKS);
    return () => {
      document.documentElement.classList.remove('embed-map');
      document.documentElement.classList.remove('embed-tracks');
    };
  }, []);

  useEffect(() => {
    if (!EMBED_MAP) return undefined;
    window.__lumenNativeLocation = (lat, lng, heading = 0, accuracy = 0, fly = false) => {
      const nlat = Number(lat), nlng = Number(lng);
      if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return;
      setUserLocation({ lat: nlat, lng: nlng, heading: Number(heading) || 0, accuracy: Number(accuracy) || 0, ts: Date.now() });
      if (fly) setMapFocus({ lat: nlat, lng: nlng, zoom: 12, ts: Date.now() });
    };
    window.__lumenNativePlace = (label, lat, lng, zoom = 12) => {
      const nlat = Number(lat), nlng = Number(lng);
      if (!Number.isFinite(nlat) || !Number.isFinite(nlng)) return;
      setNativePlace({ label: String(label || '地图位置'), lat: nlat, lng: nlng, ts: Date.now() });
      setMapFocus({ lat: nlat, lng: nlng, zoom: Number(zoom) || 12, ts: Date.now() });
    };
    return () => {
      delete window.__lumenNativeLocation;
      delete window.__lumenNativePlace;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('lumen-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#030811' : '#eaf3fb');
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const photos = data?.photos || [];
  const tracks = data?.tracks || [];
  const people = data?.people || [];
  const regions = data?.regions || null;
  const places = useMemo(() => buildPlaces(photos), [photos]);
  const handleTracksChange = useCallback((next) => {
    setData(prev => (prev ? { ...prev, tracks: next } : prev));
  }, []);

  const filteredPlaces = useMemo(() => {
    if (!personFilter) return places;
    return places.filter(place => place.photos.some(p => p.personIds?.includes(personFilter)));
  }, [places, personFilter]);

  const selectedPlace = useMemo(
    () => places.find(p => p.key === selectedPlaceKey) || null,
    [places, selectedPlaceKey]
  );
  const selectedPhoto = useMemo(() => photos.find(p => p.id === photoId) || null, [photos, photoId]);

  const updatePhoto = (photo) => setData(prev => ({ ...prev, photos: prev.photos.map(p => p.id === photo.id ? photo : p) }));
  const setPhotos = (updater) => setData(prev => ({ ...prev, photos: typeof updater === 'function' ? updater(prev.photos) : updater }));

  const openArchive = useCallback((opts = {}) => {
    setArchiveFilter({ ...EMPTY_FILTER, personId: opts.personId || '', placeKey: opts.placeKey || '', province: opts.province || '' });
    setView('archive');
    setSelectedPlaceKey(null);
  }, []);

  const openPhoto = (id) => {
    if (EMBED_MAP && typeof window !== 'undefined' && window.LumenBridge?.openPhoto) {
      window.LumenBridge.openPhoto(String(id));
      return;
    }
    setPhotoId(id);
  };

  const handleProvinceClick = (name) => {
    const candidates = places.filter(p => p.province === name || p.country === name);
    const region = regions?.provinces?.find(p => p.name === name);
    setSelectedPlaceKey(null);
    if (region?.center) {
      setMapFocus({ lng: region.center[0], lat: region.center[1], zoom: 6.15, province: name, ts: Date.now() });
    }
    if (candidates.length) {
      notice(`${name} · ${candidates.length} 个影像坐标，点击城市继续下钻`);
    } else {
      notice(`「${name}」还没有影像，点击城市查看区县边界`);
    }
  };

  const handleSelectPlace = (place) => setSelectedPlaceKey(place.key);

  const handleCityClick = (city) => {
    if (!city?.name) return;
    const center = city.centroid || city.center || [];
    const candidates = places.filter(p => p.city === city.name || p.province === city.name);
    if (candidates.length) {
      const place = candidates[0];
      setSelectedPlaceKey(place.key);
      setMapFocus({ bounds: place.bounds, lat: place.lat, lng: place.lng, zoom: 10.6, province: place.province, ts: Date.now() });
      notice(`${city.name} · 已载入 ${candidates.length} 个影像坐标与区县边界`);
      return;
    }
    if (center.length === 2) {
      setMapFocus({ lng: center[0], lat: center[1], zoom: 8.2, province: city.province, ts: Date.now() });
      notice(city.hasDistricts ? `${city.name} · 区县行政边界已展开` : `${city.name} · 暂无更细行政区数据`);
    }
  };

  const handleDistrictClick = (district) => {
    if (!district?.name) return;
    const center = district.centroid || district.center || [];
    const candidates = places.filter(p => p.district === district.name && (!district.city || p.city === district.city));
    if (candidates.length) {
      const place = candidates[0];
      setSelectedPlaceKey(place.key);
      setMapFocus({ bounds: place.bounds, lat: place.lat, lng: place.lng, zoom: 12, province: place.province, ts: Date.now() });
      notice(`${district.name} · 已定位到区县影像`);
      return;
    }
    if (center.length === 2) {
      setMapFocus({ lng: center[0], lat: center[1], zoom: 11.2, province: district.province, ts: Date.now() });
      notice(`${district.name} · 暂无影像，已飞抵该区县`);
    }
  };

  const changeMapProvider = (next) => {
    if (next === 'amap' && !data?.meta?.amapKey) {
      notice('高德底图尚未配置 API Key', 'error');
      return;
    }
    setMapProvider(next);
    notice(next === 'amap' ? '已切换高德中国底图 · 主要覆盖中国境内' : '已切回 LUMEN 全球星图');
  };

  const openUpload = (personId = null, location = null) => {
    setUploadPersonId(personId || null);
    setUploadLocation(location);
    setPickResult(null);
    setUploadOpen(true);
  };

  const handleAddAtPlace = (place) => {
    setView('atlas');
    setSelectedPlaceKey(null);
    setMapFocus({ lat: Number(place.lat), lng: Number(place.lng), zoom: 15, ts: Date.now() });
    openUpload(null, {
      label: place.label,
      locationName: place.label,
      country: place.country, countryCode: place.countryCode,
      province: place.province, city: place.city, district: place.district,
      lat: Number(place.lat), lng: Number(place.lng),
    });
  };

  const requestPick = (targetId) => {
    setView('atlas');
    setUploadOpen(false);
    setPickResult(null);
    setPickMode({ targetId });
  };

  const handlePick = async ({ lat, lng }) => {
    const targetId = pickMode?.targetId;
    setPickMode(false);
    try {
      const geo = await api.reverse(lat, lng);
      setPickResult({ ...geo, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), targetId });
    } catch {
      setPickResult({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), targetId });
      notice('坐标已选取，但行政区解析失败，可手动填写');
    }
    setUploadOpen(true);
  };

  const handleUploadComplete = (newPhotos) => {
    setPhotos(prev => [...newPhotos, ...prev]);
    const first = newPhotos[0];
    if (first) {
      setSelectedPlaceKey(regionKey(first));
      setMapFocus({ lat: Number(first.lat), lng: Number(first.lng), zoom: 11, ts: Date.now() });
      setView('atlas');
    }
  };

  const handleSavePhoto = async (id, patch) => {
    const res = await api.updatePhoto(id, patch);
    updatePhoto(res.photo);
    notice('影像档案已更新');
  };

  const handleDeletePhoto = async (id) => {
    await api.deletePhoto(id);
    setPhotos(prev => prev.filter(p => p.id !== id));
    notice('影像已从星图中移除');
  };

  const handleCreatePerson = async (payload) => {
    const res = await api.addPerson(payload);
    setData(prev => ({ ...prev, people: [...prev.people, res.person] }));
    notice(`旅人「${res.person.name}」已加入星图`);
    return res.person;
  };

  const handleSavePerson = async (id, payload) => {
    if (id) {
      const res = await api.updatePerson(id, payload);
      setData(prev => ({ ...prev, people: prev.people.map(p => p.id === id ? res.person : p) }));
      notice('旅人档案已更新');
    } else {
      await handleCreatePerson(payload);
    }
  };

  const handleDeletePerson = async (id) => {
    await api.deletePerson(id);
    setData(prev => ({
      ...prev,
      people: prev.people.filter(p => p.id !== id),
      photos: prev.photos.map(p => ({ ...p, personIds: (p.personIds || []).filter(x => x !== id) })),
    }));
    if (personFilter === id) setPersonFilter(null);
    if (archiveFilter.personId === id) setArchiveFilter(prev => ({ ...prev, personId: '' }));
    notice('旅人已从档案中移除');
  };

  const handleSaveProfile = async (form) => {
    const res = await api.updateProfile({
      name: form.name, handle: form.handle, bio: form.bio, home: form.home, avatarColor: form.avatarColor,
    });
    setData(prev => ({ ...prev, profile: res.profile }));
    notice('个人档案已更新');
  };

  const handleGenerateInvite = async (options = {}) => {
    const res = await api.createInvite(options);
    setData(prev => ({ ...prev, invites: [res.invite, ...(prev.invites || [])] }));
    notice(`邀请码已生成：${res.invite.code}`);
    return res.invite;
  };

  const handleRevokeInvite = async (id) => {
    await api.deleteInvite(id);
    setData(prev => ({ ...prev, invites: (prev.invites || []).filter(i => i.id !== id) }));
    notice('邀请码已撤销');
  };

  const handleSiteUpdate = (site, amapFromEnv) => {
    setData(prev => ({
      ...prev,
      site,
      meta: {
        ...prev.meta,
        amapKey: site.amapKey || (amapFromEnv ? prev.meta?.amapKey : ''),
        amapEnabled: !!site.amapKey || !!amapFromEnv,
      },
    }));
  };

  const handleAvatarUpload = async (file) => {
    const res = await api.uploadAvatar(file);
    setData(prev => ({ ...prev, profile: { ...prev.profile, avatarUrl: res.avatarUrl } }));
    notice('头像已更新');
  };

  const handleAvatarRemove = async () => {
    await api.removeAvatar();
    setData(prev => ({ ...prev, profile: { ...prev.profile, avatarUrl: null } }));
    notice('已恢复默认头像');
  };

  const handleChangePassword = async (current, next) => {
    await api.changePassword(current, next);
    notice('密码已更新，其他设备需要重新登录');
  };

  const refresh = async () => {
    const res = await api.bootstrap();
    setData(res);
    setSelectedPlaceKey(null);
    setPhotoId(null);
  };

  const clearDemo = async () => {
    const res = await api.clearDemo();
    await refresh();
    notice(`已清除 ${res.removed} 条示例影像`);
  };

  const restoreDemo = async () => {
    await api.restoreDemo();
    await refresh();
    notice('示例档案已重新载入');
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    setData(null);
    setAuthRequired(true);
    setUploadOpen(false);
    setPhotoId(null);
    setSelectedPlaceKey(null);
  };

  if (loading) return <LoadingScreen />;
  const isStaff = ['owner', 'admin'].includes(data?.account?.role);
  if (authRequired) return <LoginScreen onSuccess={() => { setAuthRequired(false); load(); }} />;
  if (loadError) return <ErrorScreen message={loadError} onRetry={load} />;

  const viewProps = { photos, people, places, regions, profile: data.profile, theme, onNotice: notice };
  const demoCount = photos.filter(p => p.demo).length;

  return (
    <div className={`app-shell view-${view}`}>
      <div className="ambient-bg" aria-hidden="true"><span className="ambient-a" /><span className="ambient-b" /><span className="ambient-c" /></div>
      <div className="grain" aria-hidden="true" />
      {!EMBED_MAP && !EMBED_TRACKS && <Header
        view={view} setView={guardSetView} theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onUpload={() => openUpload()} profile={data.profile}
        onSearch={() => setSearchOpen(true)} isStaff={isStaff} site={data.site}
      />}

      <main className="app-main">
        {!EMBED_TRACKS && (
          <AtlasView
            active={view === 'atlas'}
            profile={data.profile} photos={photos} places={places} filteredPlaces={filteredPlaces}
            people={people} personFilter={personFilter} onPersonFilter={setPersonFilter} regions={regions}
            selectedPlace={selectedPlace} onSelectPlace={handleSelectPlace}
            onClosePlace={() => setSelectedPlaceKey(null)} onUpload={() => openUpload()}
            onOpenPhoto={openPhoto} onViewArchive={(key) => { if (!key) openArchive(); else openArchive({ placeKey: key }); }}
            onProvinceClick={handleProvinceClick} onCityClick={handleCityClick} onDistrictClick={handleDistrictClick} focus={mapFocus} setFocus={setMapFocus}
            theme={theme} onNotice={notice} pickMode={pickMode} onPick={handlePick}
            provider={mapProvider} setProvider={changeMapProvider} amapKey={data.meta?.amapKey || ''}
            userLocation={userLocation} nativePlace={nativePlace} tracks={tracks}
          />
        )}
        {view === 'admin' && isStaff && <AdminView account={data.account} onNotice={notice} onSiteUpdate={handleSiteUpdate} />}
        {view === 'archive' && (
          <ArchiveView
            photos={photos} places={places} people={people}
            filter={archiveFilter} setFilter={setArchiveFilter}
            onOpenPhoto={openPhoto} onUpload={() => openUpload()}
            onClearFilter={() => setArchiveFilter(EMPTY_FILTER)}
            onPersonFilter={(id) => setArchiveFilter(prev => ({ ...prev, personId: id || '' }))}
          />
        )}
        {view === 'tracks' && (
          <TracksView
            tracks={tracks}
            regions={regions}
            onTracksChange={handleTracksChange}
            onNotice={notice}
            onDirtyChange={setTracksDirty}
          />
        )}
        {view === 'people' && (
          <PeopleView
            people={people} photos={photos} places={places}
            onAddPerson={() => setPersonModal({ open: true, person: null })}
            onEditPerson={(person) => setPersonModal({ open: true, person })}
            onOpenPhoto={openPhoto}
            onViewArchive={(id) => openArchive({ personId: id || '' })}
            onUploadForPerson={(person) => openUpload(person.id)}
          />
        )}
        {view === 'profile' && (
          <ProfileView
            profile={data.profile} photos={photos} places={places} people={people}
            theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            onEditProfile={() => setProfileModal(true)}
            onClearDemo={clearDemo} onRestoreDemo={restoreDemo} demoCount={demoCount}
            onNotice={notice} account={data.account} invites={data.invites || []}
            enableDemo={data.meta?.demoEnabled} onGenerateInvite={handleGenerateInvite}
            onRevokeInvite={handleRevokeInvite} onLogout={logout}
            onChangePassword={() => setPasswordModal(true)} onOpenAdmin={() => setView('admin')}
            isStaff={isStaff} onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove}
          />
        )}
      </main>

      {!EMBED_MAP && !EMBED_TRACKS && <MobileNav view={view} setView={guardSetView} onUpload={() => openUpload()} />}

      <SearchPalette
        open={searchOpen} onClose={() => setSearchOpen(false)}
        photos={photos} places={places} people={people}
        onPhoto={openPhoto}
        onPlace={(place) => { setView('atlas'); setSelectedPlaceKey(place.key); setMapFocus({ lat: place.lat, lng: place.lng, zoom: place.zoom || 8, bounds: place.bounds, province: place.province, ts: Date.now() }); }}
        onPerson={(id) => openArchive({ personId: id })}
        onAddAtPlace={handleAddAtPlace}
      />

      <UploadModal
        open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadPersonId(null); setUploadLocation(null); }}
        people={people} regions={regions} initialPersonId={uploadPersonId} initialLocation={uploadLocation}
        onCreatePerson={handleCreatePerson} onComplete={handleUploadComplete}
        onNotice={notice} onRequestPick={requestPick} pickResult={pickResult}
      />

      <PhotoModal
        open={!!selectedPhoto} photo={selectedPhoto} people={people} regions={regions}
        onClose={() => setPhotoId(null)} onSave={handleSavePhoto} onDelete={handleDeletePhoto}
        onNotice={notice}
      />

      <PersonModal
        open={personModal.open} person={personModal.person} people={people}
        onClose={() => setPersonModal({ open: false, person: null })}
        onSave={handleSavePerson} onDelete={handleDeletePerson}
        photoCount={personModal.person ? photos.filter(p => p.personIds?.includes(personModal.person.id)).length : 0}
        onNotice={notice}
      />

      <ProfileModal
        open={profileModal} profile={data.profile}
        onClose={() => setProfileModal(false)} onSave={handleSaveProfile} onNotice={notice}
      />

      <PasswordModal
        open={passwordModal} onClose={() => setPasswordModal(false)}
        onSave={handleChangePassword} onNotice={notice}
      />

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
