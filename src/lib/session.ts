/** Login token storage. localStorage can throw (private mode, blocked storage), so every access is guarded. */
const TOKEN_KEY = 'et_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
}

/** Fired when the server rejects the token, so the app can sign the user out */
export const SESSION_EXPIRED_EVENT = 'et:session-expired';
