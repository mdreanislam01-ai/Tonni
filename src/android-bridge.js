/**
 * Android (Capacitor) bridge glue — imported for side effects from main.jsx.
 *
 * Inside the Android WebView a few browser APIs behave differently than in a
 * normal browser:
 *   1. `navigator.share` is usually missing, so the invite/recording share
 *      buttons would silently fall back to clipboard.
 *   2. `<a download>` links with `blob:`/`data:` URLs do nothing, so call
 *      recordings and chat attachments cannot be saved.
 *
 * This shim routes both through the Android share sheet (via the Capacitor
 * Share + Filesystem plugins), where the user can save to Downloads, Drive,
 * WhatsApp, etc. On the web build `window.Capacitor` is undefined and the
 * whole module is a no-op.
 */

function nativePlatform() {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function plugin(name) {
  try {
    return window.Capacitor?.Plugins?.[name] || null;
  } catch {
    return null;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('blob-read-failed'));
    reader.readAsDataURL(blob);
  });
}

function extensionForName(name, blob) {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const map = { 'video/webm': '.webm', 'video/mp4': '.mp4', 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'image/png': '.png', 'image/jpeg': '.jpg' };
  return name + (map[blob?.type] || '');
}

/** Write the blob into the app cache and open the Android share sheet for it. */
async function shareBlob(blob, filename, title) {
  const share = plugin('Share');
  const filesystem = plugin('Filesystem');
  if (!share || !filesystem) throw new Error('plugins-missing');
  const name = extensionForName(filename || 'file', blob);
  const base64 = await blobToBase64(blob);
  const written = await filesystem.writeFile({
    path: `shares/${Date.now()}-${name}`,
    data: base64,
    // Capacitor Filesystem Directory.Cache — kept as a string literal so this
    // module does not need to import @capacitor/filesystem into the bundle.
    directory: 'CACHE',
    recursive: true,
  });
  try {
    await share.share({
      title: title || name,
      dialogTitle: 'Save / share',
      files: [written.uri],
    });
    return 'shared';
  } catch (error) {
    // User closed the share sheet — mirror the web AbortError contract.
    if (error?.message?.toLowerCase?.().includes('cancel')) {
      const abort = new Error('cancelled');
      abort.name = 'AbortError';
      throw abort;
    }
    throw error;
  }
}

/** Intercept clicks on `<a download href="blob:…|data:…">` and route to native share. */
function installDownloadInterceptor() {
  document.addEventListener(
    'click',
    (event) => {
      const anchor = event.target?.closest?.('a[download]');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('blob:') && !href.startsWith('data:')) return;
      event.preventDefault();
      event.stopPropagation();
      const name = anchor.getAttribute('download') || 'file';
      fetch(href)
        .then((response) => response.blob())
        .then((blob) => shareBlob(blob, name, name))
        .catch(() => {
          // Native path failed — try the plain download once more (no-op in
          // WebView, but keeps web behaviour intact if this ever runs there).
          window.open(href, '_blank');
        });
    },
    true,
  );
}

/** Polyfill navigator.share / navigator.canShare through the Android share sheet. */
function installSharePolyfill() {
  if (typeof navigator.share === 'function') return;
  navigator.share = async (shareData = {}) => {
    const share = plugin('Share');
    if (!share) throw new Error('share-unavailable');
    const files = Array.isArray(shareData.files) ? shareData.files : [];
    const options = {
      title: shareData.title,
      text: shareData.text,
      dialogTitle: 'Share',
    };
    if (shareData.url) options.url = shareData.url;
    if (files.length) {
      const filesystem = plugin('Filesystem');
      if (!filesystem) throw new Error('share-unavailable');
      const uris = [];
      for (const file of files) {
        const base64 = await blobToBase64(file);
        const written = await filesystem.writeFile({
          path: `shares/${Date.now()}-${file.name || 'file'}`,
          data: base64,
          directory: 'CACHE',
          recursive: true,
        });
        uris.push(written.uri);
      }
      options.files = uris;
    }
    try {
      await share.share(options);
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('cancel')) {
        const abort = new Error('share canceled');
        abort.name = 'AbortError';
        throw abort;
      }
      throw error;
    }
  };
  navigator.canShare = (shareData = {}) => Boolean(plugin('Share')) && (!shareData.files || plugin('Filesystem') != null);
}

export function initAndroidBridge() {
  if (!nativePlatform()) return;
  try {
    installDownloadInterceptor();
    installSharePolyfill();
  } catch {
    // Never let bridge glue break the app.
  }
}
