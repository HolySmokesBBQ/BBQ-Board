// Analytics error codes. track() calls send a short code from this fixed
// list instead of an error message: messages are free text and can carry
// emails, names or addresses, and scrubParams only catches email-shaped
// strings. Unknown errors become "other". (Auditor ruling 2026-10-12.)

export const ERROR_CODES = [
  'bad_credentials', 'no_account', 'email_in_use', 'weak_password', 'invalid_email',
  'rate_limited', 'network', 'timeout', 'cancelled', 'popup_blocked', 'in_app_browser',
  'permission_denied', 'storage', 'other',
];

const BY_CODE = {
  'auth/wrong-password': 'bad_credentials',
  'auth/invalid-credential': 'bad_credentials',
  'auth/invalid-login-credentials': 'bad_credentials',
  'auth/user-not-found': 'no_account',
  'auth/email-already-in-use': 'email_in_use',
  'auth/weak-password': 'weak_password',
  'auth/password-does-not-meet-requirements': 'weak_password',
  'auth/invalid-email': 'invalid_email',
  'auth/too-many-requests': 'rate_limited',
  'auth/network-request-failed': 'network',
  'auth/timeout': 'timeout',
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  '1001': 'cancelled', // ASAuthorizationError.canceled (Sign in with Apple)
  'auth/popup-blocked': 'popup_blocked',
  'in_app_browser': 'in_app_browser',
  'permission-denied': 'permission_denied',
};

// Accepts an Error-like object ({ code, message }) or a bare code string.
export function errorCode(err) {
  const code = typeof err === 'string' ? err : String(err?.code ?? '');
  if (BY_CODE[code]) return BY_CODE[code];
  if (code.startsWith('storage/')) return 'storage';
  const msg = typeof err === 'string' ? '' : String(err?.message ?? '');
  if (/cancel/i.test(msg)) return 'cancelled';
  return 'other';
}
