import CryptoJS from 'crypto-js';

// Same key + URL-safe substitutions as the Angular app, so existing links keep working
const SECRET = 'c2d0f75d679b71855e3bb4d0e3d90307912f83ab';

export function encodeId(id: number): string {
  return CryptoJS.AES.encrypt(String(id), SECRET)
    .toString()
    .replace(/\+/g, 'p1L2u3S')
    .replace(/\//g, 's1L2a3S4h')
    .replace(/=/g, 'e1Q2u3A4l');
}

export function decodeId(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const raw = token.replace(/p1L2u3S/g, '+').replace(/s1L2a3S4h/g, '/').replace(/e1Q2u3A4l/g, '=');
    const id = Number(CryptoJS.AES.decrypt(raw, SECRET).toString(CryptoJS.enc.Utf8));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
