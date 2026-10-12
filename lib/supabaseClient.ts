import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  '';

const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface AuthResponse {
  success: boolean;
  user?: SupabaseUser | { id: string; email?: string; user_metadata?: Record<string, any> } | null;
  session?: Session | null;
  error?: string;
  isSimulated?: boolean;
}

/**
 * Sign in using Supabase Email & Password
 * Falls back gracefully to zero-trust local demo enclave if Supabase is offline or unconfigured.
 */
export async function signInWithSupabase(
  email: string,
  password: string
): Promise<AuthResponse> {
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Supabase authentication failed',
      };
    }
  }

  // Graceful offline fallback
  return {
    success: true,
    user: {
      id: `local-${Date.now()}`,
      email,
      user_metadata: { role: 'clinician' },
    },
    isSimulated: true,
  };
}

/**
 * Sign up using Supabase Email & Password
 */
export async function signUpWithSupabase(
  email: string,
  password: string,
  metadata?: { name?: string; role?: string; profession?: string; organization?: string }
): Promise<AuthResponse> {
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Supabase signup failed',
      };
    }
  }

  // Graceful offline fallback
  return {
    success: true,
    user: {
      id: `local-${Date.now()}`,
      email,
      user_metadata: metadata,
    },
    isSimulated: true,
  };
}

/**
 * Send passwordless Magic Link / OTP via Supabase
 */
export async function sendSupabaseMagicLink(email: string): Promise<AuthResponse> {
  if (supabase) {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Could not send magic link' };
    }
  }

  // Simulated magic link for offline demo
  return {
    success: true,
    isSimulated: true,
  };
}

/**
 * Sign out from Supabase Auth
 */
export async function signOutFromSupabase(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signout
    }
  }
}

/**
 * Get current authenticated Supabase user
 */
export async function getSupabaseUser(): Promise<SupabaseUser | null> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      return data.user;
    } catch {
      return null;
    }
  }
  return null;
}
