const prefix = 'mini-connecta:';
const previewChange = prefix + 'preview-change';

export function subscribePreview(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(previewChange, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(previewChange, callback);
  };
}

export function readPreview(key: string, area: 'local' | 'session' = 'local') {
  try {
    const storage = area === 'local' ? window.localStorage : window.sessionStorage;
    return storage.getItem(prefix + key);
  } catch {
    return null;
  }
}

export function writePreview(
  key: string,
  value: string | null,
  area: 'local' | 'session' = 'local',
) {
  try {
    const storage = area === 'local' ? window.localStorage : window.sessionStorage;
    if (value === null) storage.removeItem(prefix + key);
    else storage.setItem(prefix + key, value);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(previewChange));
  return true;
}
