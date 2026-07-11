import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export type Cliente = {
  id: string;
  user_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type Perro = {
  id: string;
  user_id: string;
  cliente_id: string;
  nombre: string;
  raza: string;
  tamanio: 'chico' | 'mediano' | 'grande' | 'gigante' | null;
  peso_kg: number | null;
  fecha_nacimiento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type Servicio = {
  id: string;
  user_id: string;
  perro_id: string;
  fecha: string;
  tipo: 'bano' | 'corte' | 'bano_y_corte' | 'otro';
  precio: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

// Browser client (singleton)
let browserClient: ReturnType<typeof createClient> | null = null;
export function getBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}

// Server-side client bound to the request's cookies (so RLS works correctly)
export function getServerClient(cookies: AstroCookies) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(cookies.getAll()).map(([name, value]) => ({
          name,
          value: value.value
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, options);
        }
      }
    }
  });
  return supabase;
}