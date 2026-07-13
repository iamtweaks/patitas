export type AuthAccount = {
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  username: string;
  loggedInAt: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
  createdAt: string;
  updatedAt: string;
};

export type Perro = {
  id: string;
  clienteId: string;
  nombre: string;
  raza: string;
  tamanio: '' | 'chico' | 'mediano' | 'grande' | 'gigante';
  pesoKg: string;
  fechaNacimiento: string;
  notas: string;
  createdAt: string;
  updatedAt: string;
};

export type Servicio = {
  id: string;
  perroId: string;
  fecha: string;
  tipo: 'bano' | 'corte' | 'bano_y_corte' | 'otro';
  precio: string;
  notas: string;
  createdAt: string;
  updatedAt: string;
};

export type BrowserDb = {
  clientes: Cliente[];
  perros: Perro[];
  servicios: Servicio[];
};

const AUTH_KEY = 'patitas.auth.account';
const SESSION_KEY = 'patitas.auth.session';
const DB_KEY = 'patitas.browser.db';

const emptyDb = (): BrowserDb => ({ clientes: [], perros: [], servicios: [] });

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getAccount(): AuthAccount | null {
  if (!hasWindow()) return null;
  return safeParse<AuthAccount | null>(window.localStorage.getItem(AUTH_KEY), null);
}

export function setAccount(account: AuthAccount) {
  if (!hasWindow()) return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(account));
}

export function getSession(): Session | null {
  if (!hasWindow()) return null;
  return safeParse<Session | null>(window.localStorage.getItem(SESSION_KEY), null);
}

export function setSession(session: Session) {
  if (!hasWindow()) return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function getDb(): BrowserDb {
  if (!hasWindow()) return emptyDb();
  const db = safeParse<BrowserDb | null>(window.localStorage.getItem(DB_KEY), null);
  return db ?? emptyDb();
}

export function setDb(db: BrowserDb) {
  if (!hasWindow()) return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDb() {
  setDb(emptyDb());
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatShortDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function uid() {
  return newId();
}
