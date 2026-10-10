import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';
import { SupabaseAuthAdapter } from '../src/security/auth/supabaseAuthAdapter.js';

describe('SupabaseAuthAdapter Integration Tests', () => {
  const dummyUrl = 'https://xyzcompany.supabase.co';
  const dummyKey = 'test-anon-key-12345';

  it('fails closed (returns null) when Authorization header is missing', async () => {
    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: dummyUrl,
      supabaseAnonKey: dummyKey,
    });

    const mockReq = {
      headers: {},
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toBeNull();
  });

  it('fails closed when Authorization header is not a Bearer token', async () => {
    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: dummyUrl,
      supabaseAnonKey: dummyKey,
    });

    const mockReq = {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toBeNull();
  });

  it('fails closed when Supabase credentials are missing', async () => {
    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: '',
      supabaseAnonKey: '',
    });

    const mockReq = {
      headers: { authorization: 'Bearer valid-jwt-token' },
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toBeNull();
  });

  it('successfully returns userId when Supabase validates token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'supabase-user-uuid-999' }),
    });

    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: dummyUrl,
      supabaseAnonKey: dummyKey,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const mockReq = {
      headers: { authorization: 'Bearer valid-jwt-token' },
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toEqual({ userId: 'supabase-user-uuid-999' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://xyzcompany.supabase.co/auth/v1/user',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          apikey: dummyKey,
        },
      })
    );
  });

  it('fails closed when Supabase rejects the token (e.g. 401)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid JWT' }),
    });

    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: dummyUrl,
      supabaseAnonKey: dummyKey,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const mockReq = {
      headers: { authorization: 'Bearer expired-jwt-token' },
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toBeNull();
  });

  it('fails closed when fetch encounters network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const adapter = new SupabaseAuthAdapter({
      supabaseUrl: dummyUrl,
      supabaseAnonKey: dummyKey,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const mockReq = {
      headers: { authorization: 'Bearer any-token' },
    } as unknown as Request;

    const result = await adapter.authenticate(mockReq);
    expect(result).toBeNull();
  });
});
