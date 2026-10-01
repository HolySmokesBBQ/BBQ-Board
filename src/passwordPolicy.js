// Email/password rules for the sign-in box. Pure functions so they can be
// tested without React or Firebase.
//
// Sign-up needs 8+ characters, matching the min-8 policy set on the
// Firebase projects (length over composition rules, per NIST 800-63B).
// Sign-in keeps the old 6-character floor: accounts created before this
// change can have 6-7 character passwords and must still be able to sign
// in. Password resets happen on Firebase's emailed page, where the server
// policy applies.

export const MIN_SIGNUP_LENGTH = 8;
export const MIN_SIGNIN_LENGTH = 6;

export function passwordMeetsGate(mode, password) {
  if (mode === 'reset') return true;
  const len = (password || '').length;
  return mode === 'signUp' ? len >= MIN_SIGNUP_LENGTH : len >= MIN_SIGNIN_LENGTH;
}

// A handful of the most common passwords. Not exhaustive; the point is to
// stop the meter calling "password1" anything but weak.
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  '11111111', '00000000', 'qwerty123', 'qwertyuiop', 'iloveyou', 'abc12345',
  'letmein1', 'welcome1', 'football', 'baseball', 'sunshine', 'princess',
]);

const LABELS = ['Weak', 'Okay', 'Strong'];

// Length does most of the work; mixing kinds of character helps a little.
// Returns { score: 0 | 1 | 2, label }.
export function passwordStrength(password) {
  const p = password || '';
  const len = p.length;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(p)).length;
  let score;
  if (len < MIN_SIGNUP_LENGTH || COMMON.has(p.toLowerCase()) || /^(.)\1*$/.test(p)) score = 0;
  else if (len >= 14 || (len >= 12 && kinds >= 2) || (len >= 10 && kinds >= 3)) score = 2;
  else score = 1;
  return { score, label: LABELS[score] };
}
