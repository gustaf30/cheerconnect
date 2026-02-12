import { describe, it, expect, vi } from 'vitest';

// Mock @/lib/auth to avoid Prisma/DATABASE_URL dependency chain
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { apiError, apiSuccess } from '../api-utils';

describe('apiError', () => {
  it('returns response with error message and status', async () => {
    const response = apiError('Not found', 404);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: 'Not found' });
  });

  it('returns 400 for bad request', async () => {
    const response = apiError('Invalid input', 400);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Invalid input' });
  });
});

describe('apiSuccess', () => {
  it('returns data in envelope', async () => {
    const response = apiSuccess({ name: 'test' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { name: 'test' } });
  });

  it('includes meta when provided', async () => {
    const response = apiSuccess({ items: [] }, { total: 0 });
    const body = await response.json();
    expect(body).toEqual({ data: { items: [] }, meta: { total: 0 } });
  });

  it('uses custom status code', async () => {
    const response = apiSuccess({ id: '1' }, undefined, 201);
    expect(response.status).toBe(201);
  });
});
