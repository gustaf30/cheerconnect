import { describe, it, expect } from 'vitest';
import {
  positionLabels,
  careerRoleLabels,
  categoryLabels,
  eventTypeLabels,
} from '../constants';

describe('positionLabels', () => {
  const expectedKeys = [
    'FLYER', 'BASE', 'BACKSPOT', 'FRONTSPOT', 'TUMBLER',
    'COACH', 'CHOREOGRAPHER', 'JUDGE', 'OTHER',
  ];

  it('has all expected position keys', () => {
    for (const key of expectedKeys) {
      expect(positionLabels).toHaveProperty(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(positionLabels)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('careerRoleLabels', () => {
  const expectedKeys = [
    'ATHLETE', 'COACH', 'ASSISTANT_COACH', 'CHOREOGRAPHER',
    'TEAM_MANAGER', 'JUDGE', 'OTHER',
  ];

  it('has all expected career role keys', () => {
    for (const key of expectedKeys) {
      expect(careerRoleLabels).toHaveProperty(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(careerRoleLabels)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('categoryLabels', () => {
  const expectedKeys = [
    'ALLSTAR', 'SCHOOL', 'COLLEGE', 'RECREATIONAL', 'PROFESSIONAL',
  ];

  it('has all expected category keys', () => {
    for (const key of expectedKeys) {
      expect(categoryLabels).toHaveProperty(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(categoryLabels)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('eventTypeLabels', () => {
  const expectedKeys = [
    'COMPETITION', 'TRYOUT', 'CAMP', 'WORKSHOP', 'SHOWCASE', 'OTHER',
  ];

  it('has all expected event type keys', () => {
    for (const key of expectedKeys) {
      expect(eventTypeLabels).toHaveProperty(key);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(eventTypeLabels)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
