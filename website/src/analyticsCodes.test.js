import { describe, test, expect } from 'vitest';
import { errorCode, ERROR_CODES } from './analyticsCodes.js';

describe('errorCode: analytics gets a fixed code, never error text', () => {
  test('known Firebase auth codes map to short names', () => {
    expect(errorCode({ code: 'auth/wrong-password' })).toBe('bad_credentials');
    expect(errorCode({ code: 'auth/invalid-credential' })).toBe('bad_credentials');
    expect(errorCode('auth/user-not-found')).toBe('no_account');
    expect(errorCode('auth/email-already-in-use')).toBe('email_in_use');
    expect(errorCode('auth/weak-password')).toBe('weak_password');
    expect(errorCode('auth/too-many-requests')).toBe('rate_limited');
    expect(errorCode('auth/network-request-failed')).toBe('network');
    expect(errorCode('auth/timeout')).toBe('timeout');
  });

  test('cancels in any of their forms', () => {
    expect(errorCode({ code: 'auth/popup-closed-by-user' })).toBe('cancelled');
    expect(errorCode({ code: '1001' })).toBe('cancelled');
    expect(errorCode({ message: 'The user canceled the sign-in flow.' })).toBe('cancelled');
  });

  test('anything else is "other", and free text never comes back', () => {
    const leak = 'No account for pat@example.com at 123 Main St';
    expect(errorCode({ message: leak })).toBe('other');
    expect(errorCode(leak)).toBe('other');
    expect(errorCode(undefined)).toBe('other');
    expect(errorCode(new Error('canvas tainted'))).toBe('other');
  });

  test('every result is from the fixed list', () => {
    for (const input of ['auth/weak-password', 'in_app_browser', 'storage/unauthorized', 'permission-denied', 'x', null]) {
      expect(ERROR_CODES).toContain(errorCode(input));
    }
  });
});
