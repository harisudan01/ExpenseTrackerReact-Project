import { describe, expect, it, vi } from 'vitest';
import { clearLegacyToken, isSignedIn, setSignedIn } from './session';

describe('signed-in flag', () => {
  it('stores, reads and clears the flag', () => {
    expect(isSignedIn()).toBe(false);
    setSignedIn(true);
    expect(isSignedIn()).toBe(true);
    setSignedIn(false);
    expect(isSignedIn()).toBe(false);
  });

  it('never stores the login token itself, and removes one left by an older version', () => {
    localStorage.setItem('et_token', 'old-jwt');
    setSignedIn(true);
    expect(localStorage.getItem('et_token')).toBeNull();
    expect(localStorage.getItem('et_signed_in')).toBe('1');

    localStorage.setItem('et_token', 'old-jwt');
    clearLegacyToken();
    expect(localStorage.getItem('et_token')).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isSignedIn()).toBe(false);
    expect(() => setSignedIn(true)).not.toThrow();
    expect(() => clearLegacyToken()).not.toThrow();
  });
});
