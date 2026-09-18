import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { escapeAftsValue } = require('../../server/domain/aftsEscape.cjs');

describe('escapeAftsValue', () => {
  it('escapes a double quote so it cannot close the predicate', () => {
    expect(escapeAftsValue('a"b')).toBe('a\\"b');
  });

  it('escapes a backslash, so a trailing one cannot escape the closing quote', () => {
    expect(escapeAftsValue('a\\')).toBe('a\\\\');
    expect(escapeAftsValue('a\\"')).toBe('a\\\\\\"');
  });

  it('escapes backslashes before quotes, so inserted backslashes are not doubled', () => {
    // Backslash-then-quote must become \\ then \", in that order, never \\\\".
    expect(escapeAftsValue('\\"')).toBe('\\\\\\"');
  });

  it('treats null and undefined as an empty string', () => {
    expect(escapeAftsValue(null)).toBe('');
    expect(escapeAftsValue(undefined)).toBe('');
  });
});
