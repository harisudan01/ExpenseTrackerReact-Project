/**
 * The login token lives in an HttpOnly cookie set by the API, so scripts on the page can never read it.
 * All this file stores is a harmless "signed in" flag, so the app knows whether to ask the API
 * who is signed in when it loads. localStorage can throw (private mode, blocked storage), so every
 * access is guarded.
 */
const SIGNED_IN_KEY = 'et_signed_in';
/** Where older versions kept the login token itself; removed so it doesn't linger */
const LEGACY_TOKEN_KEY = 'et_token';

export function isSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSignedIn(signedIn: boolean): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (signedIn) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* storage unavailable: the user just signs in again after a reload */
  }
}

/** Removes a login token saved by an older version of the app */
export function clearLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Fired when the server rejects the session, so the app can sign the user out */
export const SESSION_EXPIRED_EVENT = 'et:session-expired';
