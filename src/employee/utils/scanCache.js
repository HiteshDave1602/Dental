const STORAGE_KEY_PREFIX = 'mpf-scan-';
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 MB — sessionStorage is typically 5–10 MB per origin

function keyFor(caseId) {
  return `${STORAGE_KEY_PREFIX}${caseId}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function cacheScanFile(caseId, file) {
  if (!caseId || !file) return false;
  if (file.size > MAX_CACHE_SIZE) return false;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const payload = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      data: arrayBufferToBase64(arrayBuffer),
    };
    sessionStorage.setItem(keyFor(caseId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getCachedScanFile(caseId) {
  if (!caseId) return null;

  try {
    const raw = sessionStorage.getItem(keyFor(caseId));
    if (!raw) return null;

    const payload = JSON.parse(raw);
    const buffer = base64ToArrayBuffer(payload.data);
    return new File([buffer], payload.name, { type: payload.type });
  } catch {
    clearCachedScanFile(caseId);
    return null;
  }
}

export function clearCachedScanFile(caseId) {
  if (!caseId) return;
  try {
    sessionStorage.removeItem(keyFor(caseId));
  } catch {
    // silently ignore
  }
}
