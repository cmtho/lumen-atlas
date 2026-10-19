async function parse(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  return parse(res);
}

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  authStatus: () => request('/api/auth/status'),
  setup: (payload) => request('/api/setup', { method: 'POST', body: JSON.stringify(payload) }),
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  changePassword: (currentPassword, newPassword) => request('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  createInvite: (options = {}) => request('/api/invites', { method: 'POST', body: JSON.stringify(options) }),
  deleteInvite: (id) => request(`/api/invites/${id}`, { method: 'DELETE' }),
  updateProfile: (patch) => request('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  uploadAvatar: (file) => { const form = new FormData(); form.append('avatar', file); return request('/api/profile/avatar', { method: 'POST', body: form }); },
  removeAvatar: () => request('/api/profile/avatar', { method: 'DELETE' }),
  addPerson: (data) => request('/api/people', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id, data) => request(`/api/people/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePerson: (id) => request(`/api/people/${id}`, { method: 'DELETE' }),
  updatePhoto: (id, data) => request(`/api/photos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePhoto: (id) => request(`/api/photos/${id}`, { method: 'DELETE' }),
  reverse: (lat, lng) => request(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`),
  searchPlaces: (q) => request(`/api/geocode/search?q=${encodeURIComponent(q)}`),
  tracks: () => request('/api/tracks'),
  createTrack: (payload) => request('/api/tracks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTrack: (id, payload) => request(`/api/tracks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTrack: (id) => request(`/api/tracks/${id}`, { method: 'DELETE' }),
  clearDemo: () => request('/api/demo/clear', { method: 'POST' }),
  restoreDemo: () => request('/api/demo/restore', { method: 'POST' }),
  exportUrl: '/api/export',
  adminOverview: () => request('/api/admin/overview'),
  adminUsers: () => request('/api/admin/users'),
  adminInvites: () => request('/api/admin/invites'),
  adminUpdateUser: (id, data) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  adminResetPassword: (id) => request(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),
  adminDeleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminRevokeInvite: (id) => request(`/api/admin/invites/${id}`, { method: 'DELETE' }),
  adminSettings: () => request('/api/admin/settings'),
  updateAdminSettings: (data) => request('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

export function uploadPhotos(files, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach(file => form.append('files', file));
    form.append('metadata', JSON.stringify(metadata));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/photos');
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('网络中断，上传未完成'));
    xhr.ontimeout = () => reject(new Error('上传超时，请重试'));
    xhr.send(form);
  });
}

export async function reverseGeocode(lat, lng) {
  return api.reverse(lat, lng);
}
