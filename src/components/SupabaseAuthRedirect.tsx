import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Props {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function SupabaseAuthRedirect({ supabaseUrl, supabaseAnonKey }: Props) {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const code = new URLSearchParams(window.location.search).get('code');
    const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';

    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
      return;
    }

    if (!accessToken || !refreshToken || !supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (error) {
          window.location.replace(`/login?error=${encodeURIComponent('No pudimos terminar el login: ' + error.message)}`);
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        window.location.replace(next);
      })
      .catch((error: Error) => {
        window.location.replace(`/login?error=${encodeURIComponent('No pudimos terminar el login: ' + error.message)}`);
      });
  }, [supabaseUrl, supabaseAnonKey]);

  return null;
}
