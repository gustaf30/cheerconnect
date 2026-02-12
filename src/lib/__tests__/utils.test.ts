import { describe, it, expect } from 'vitest';
import { getInitials } from '../utils';

describe('getInitials', () => {
  it('returns first two initials from two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns first letter for single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('returns first two initials for three-word name', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('converts to uppercase', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('handles single character', () => {
    expect(getInitials('A')).toBe('A');
  });
});
