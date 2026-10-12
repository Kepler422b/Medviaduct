import { Request } from 'express';
import { AuthenticationAdapter, AuthenticatedUser } from '../contracts/interfaces.js';

export interface SupabaseAuthAdapterConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  fetchFn?: typeof fetch;
}

/**
 * SupabaseAuthAdapter
 *
 * Bridges Member 2's Supabase Auth JWT tokens into Member 3's AuthenticationAdapter interface.
 *
 * SECURITY INVARIANTS:
 * 1. Validates the JWT against Supabase's Auth API (/auth/v1/user).
 * 2. Never trusts unverified client headers (e.g. x-user-id).
 * 3. Returns only the authenticated Supabase user ID (UUID).
 * 4. Fails closed (returns null) on missing, expired, or invalid tokens.
 */
export class SupabaseAuthAdapter implements AuthenticationAdapter {
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(config?: SupabaseAuthAdapterConfig) {
    this.supabaseUrl = (config?.supabaseUrl || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    this.supabaseAnonKey = config?.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '';
    this.fetchFn = config?.fetchFn || fetch;
  }

  async authenticate(req: Request): Promise<AuthenticatedUser | null> {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1]) {
      return null;
    }

    const token = match[1].trim();
    if (!token) {
      return null;
    }

    // If Supabase credentials are not configured, fail closed
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      return null;
    }

    try {
      const response = await this.fetchFn(`${this.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: this.supabaseAnonKey,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { id?: string };
      if (!data || !data.id || typeof data.id !== 'string') {
        return null;
      }

      return {
        userId: data.id,
      };
    } catch {
      // Fail closed on network or parsing errors
      return null;
    }
  }
}
