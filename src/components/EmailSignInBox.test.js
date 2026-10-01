import { describe, test, expect } from 'vitest';
import {
  MIN_SIGNUP_LENGTH, MIN_SIGNIN_LENGTH, passwordMeetsGate, passwordStrength, isCommonPassword,
} from '../passwordPolicy.js';

describe('password gate', () => {
  test('sign-up needs 8+ characters', () => {
    expect(MIN_SIGNUP_LENGTH).toBe(8);
    expect(passwordMeetsGate('signUp', '1234567')).toBe(false);
    expect(passwordMeetsGate('signUp', 'brisket7')).toBe(true);
  });

  test('sign-in keeps the old 6-character gate so existing 6-7 char passwords still work', () => {
    expect(MIN_SIGNIN_LENGTH).toBe(6);
    expect(passwordMeetsGate('signIn', '123456')).toBe(true);
    expect(passwordMeetsGate('signIn', '1234567')).toBe(true);
    expect(passwordMeetsGate('signIn', '12345')).toBe(false);
  });

  test('reset needs no password at all', () => {
    expect(passwordMeetsGate('reset', '')).toBe(true);
  });

  test('empty or missing password fails sign-in and sign-up', () => {
    expect(passwordMeetsGate('signIn', '')).toBe(false);
    expect(passwordMeetsGate('signUp', undefined)).toBe(false);
  });
});

describe('common-password block (NIST 800-63B 5.1.1.2)', () => {
  test('sign-up rejects a common password even at 8+ characters', () => {
    expect('password'.length).toBeGreaterThanOrEqual(8);
    expect(passwordMeetsGate('signUp', 'password')).toBe(false);
    expect(passwordMeetsGate('signUp', '12345678')).toBe(false);
  });

  test('matching ignores case', () => {
    expect(isCommonPassword('Password1')).toBe(true);
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(passwordMeetsGate('signUp', 'Password1')).toBe(false);
  });

  test('a near miss that is not on the list is allowed', () => {
    expect(isCommonPassword('Password12!')).toBe(false);
    expect(passwordMeetsGate('signUp', 'Password12!')).toBe(true);
  });

  test('sign-in never blocks on the list, so existing accounts keep working', () => {
    expect(passwordMeetsGate('signIn', 'password')).toBe(true);
  });
});

describe('strength heuristic', () => {
  const label = (p) => passwordStrength(p).label;

  test('under 8 characters is Weak', () => {
    expect(label('Ab1!x')).toBe('Weak');
  });

  test('very common passwords are Weak at any length', () => {
    expect(label('password')).toBe('Weak');
    expect(label('12345678')).toBe('Weak');
    expect(label('Password1')).toBe('Weak');
  });

  test('one repeated character is Weak', () => {
    expect(label('aaaaaaaaaaaa')).toBe('Weak');
  });

  test('8-11 characters of ordinary mix is Okay', () => {
    expect(label('brisket7')).toBe('Okay');
    expect(label('smokering')).toBe('Okay');
  });

  test('length carries it: 14+ characters is Strong even in one case', () => {
    expect(label('burntendsforlunch')).toBe('Strong');
  });

  test('12+ with two kinds of character, or 10+ with three, is Strong', () => {
    expect(label('brisket2026pit')).toBe('Strong');
    expect(label('Brisket#26')).toBe('Strong');
  });

  test('score runs 0 to 2 in order Weak, Okay, Strong', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('brisket7').score).toBe(1);
    expect(passwordStrength('burntendsforlunch').score).toBe(2);
  });
});
