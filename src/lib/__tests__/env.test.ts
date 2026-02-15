import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
  const originalEnv = process.env;

  const validEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/testdb',
    NEXTAUTH_SECRET: 'super-secret-key',
    NEXTAUTH_URL: 'http://localhost:3000',
    CLOUDINARY_CLOUD_NAME: 'my-cloud',
    CLOUDINARY_API_KEY: 'api-key-123',
    CLOUDINARY_API_SECRET: 'api-secret-456',
  };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('passes with all required vars', async () => {
    Object.assign(process.env, validEnv);
    const { validateEnv } = await import('../env');
    const result = validateEnv();
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.NEXTAUTH_SECRET).toBe(validEnv.NEXTAUTH_SECRET);
    expect(result.NEXTAUTH_URL).toBe(validEnv.NEXTAUTH_URL);
    expect(result.CLOUDINARY_CLOUD_NAME).toBe(validEnv.CLOUDINARY_CLOUD_NAME);
    expect(result.CLOUDINARY_API_KEY).toBe(validEnv.CLOUDINARY_API_KEY);
    expect(result.CLOUDINARY_API_SECRET).toBe(validEnv.CLOUDINARY_API_SECRET);
  });

  it('passes with optional Google vars present', async () => {
    Object.assign(process.env, validEnv, {
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });
    const { validateEnv } = await import('../env');
    const result = validateEnv();
    expect(result.GOOGLE_CLIENT_ID).toBe('google-id');
    expect(result.GOOGLE_CLIENT_SECRET).toBe('google-secret');
  });

  it('passes without optional Google vars', async () => {
    Object.assign(process.env, validEnv);
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const { validateEnv } = await import('../env');
    const result = validateEnv();
    expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(result.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('throws when DATABASE_URL is missing', async () => {
    Object.assign(process.env, validEnv);
    delete process.env.DATABASE_URL;
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });

  it('throws when NEXTAUTH_SECRET is missing', async () => {
    Object.assign(process.env, validEnv);
    delete process.env.NEXTAUTH_SECRET;
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });

  it('does not throw when NEXTAUTH_URL is missing (optional on Vercel)', async () => {
    Object.assign(process.env, validEnv);
    delete process.env.NEXTAUTH_URL;
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws when CLOUDINARY_CLOUD_NAME is missing', async () => {
    Object.assign(process.env, validEnv);
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });

  it('throws when DATABASE_URL is invalid URL', async () => {
    Object.assign(process.env, validEnv, { DATABASE_URL: 'not-a-url' });
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });

  it('throws when NEXTAUTH_URL is invalid URL', async () => {
    Object.assign(process.env, validEnv, { NEXTAUTH_URL: 'not-a-url' });
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });

  it('throws when NEXTAUTH_SECRET is empty string', async () => {
    Object.assign(process.env, validEnv, { NEXTAUTH_SECRET: '' });
    const { validateEnv } = await import('../env');
    expect(() => validateEnv()).toThrow('Invalid environment variables');
  });
});
