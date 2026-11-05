import { describe, expect, it } from 'vitest';
import { decodeId, encodeId } from './crypto';

describe('encodeId / decodeId', () => {
  it('round-trips an id', () => {
    expect(decodeId(encodeId(42))).toBe(42);
  });

  it('produces URL-safe tokens (no +, / or =)', () => {
    for (let id = 1; id < 40; id++) {
      expect(encodeId(id)).not.toMatch(/[+/=]/);
    }
  });

  it('returns null for missing, garbage or non-positive ids', () => {
    expect(decodeId(undefined)).toBeNull();
    expect(decodeId('')).toBeNull();
    expect(decodeId('not-a-real-token')).toBeNull();
  });
});
