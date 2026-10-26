/**
 * A phone box lays a number out as "(416) 904-0390" while it is typed — the pure half of `PhoneInput`.
 * What matters is what it leaves ALONE (extensions, other countries, too many digits) and that a
 * Backspace is never trapped by punctuation the formatter keeps putting back.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { caretAfterDigits, formatPhone } from '../../lib/phone-format.ts';

describe('formatPhone', () => {
  it('lays out ten digits, typed, pasted or already punctuated', () => {
    assert.equal(formatPhone('4169040390'), '(416) 904-0390');
    assert.equal(formatPhone('416-904-0390'), '(416) 904-0390');
    assert.equal(formatPhone('(416) 904-0390'), '(416) 904-0390');
    assert.equal(formatPhone('416.904.0390'), '(416) 904-0390');
  });

  it('drops a leading country code 1 (the screenshot that started this)', () => {
    assert.equal(formatPhone('14169040390'), '(416) 904-0390');
    assert.equal(formatPhone('+1 416 904 0390'), '(416) 904-0390');
  });

  it('builds up as digits arrive', () => {
    assert.equal(formatPhone('4'), '(4');
    assert.equal(formatPhone('416'), '(416');
    assert.equal(formatPhone('4169'), '(416) 9');
    assert.equal(formatPhone('416904'), '(416) 904');
    assert.equal(formatPhone('4169040'), '(416) 904-0');
  });

  it('lets Backspace through the punctuation', () => {
    assert.equal(formatPhone('(416) '), '(416');
    assert.equal(formatPhone('(416) 904-'), '(416) 904');
    assert.equal(formatPhone('('), '');
    assert.equal(formatPhone(''), '');
  });

  it('leaves what it cannot be sure of exactly as typed', () => {
    assert.equal(formatPhone('416 904 0390 x22'), '416 904 0390 x22');
    assert.equal(formatPhone('+44 20 7946 0958'), '+44 20 7946 0958');
    assert.equal(formatPhone('41690403901'), '41690403901');
  });
});

describe('caretAfterDigits', () => {
  it('keeps the caret after the same digit once the text is reshaped', () => {
    assert.equal(caretAfterDigits('(416) 904-0390', 0), 0);
    assert.equal(caretAfterDigits('(416) 904-0390', 3), 4);
    assert.equal(caretAfterDigits('(416) 904-0390', 4), 7);
    assert.equal(caretAfterDigits('(416) 904-0390', 10), 14);
    assert.equal(caretAfterDigits('(416', 9), 4);
  });
});
