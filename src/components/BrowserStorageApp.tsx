import DashboardResumen from './DashboardResumen';
import { useEffect, useMemo, useState } from 'react';
import type { BrowserDb, Cliente, Perro, Servicio, Session } from '../lib/browserStore';
import {
  clearSession,
  formatMoney,
  formatShortDate,
  getAccount,
  getDb,
  getSession,
  resetDb,
  setAccount,
  setDb,
  setSession,
  sha256,
  todayISO,
  uid,
} from '../lib/browserStore';

type Page = 'login' | 'dashboard' | 'clientes' | 'perros' | 'servicios';

interface Props {
  page: Page;
}

type LoginState = {
  username: string;
  password: string;
  next: string;
  loading: boolean;
  error: string;
};

type ClienteForm = Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>;
type PerroForm = Omit<Perro, 'id' | 'createdAt' | 'updatedAt'>;
type ServicioForm = Omit<Servicio, 'id' | 'createdAt' | 'updatedAt'>;

const emptyCliente = (): ClienteForm => ({ nombre: '', telefono: '', email: '', notas: '' });
const emptyPerro = (): PerroForm => ({
  clienteId: '',
  nombre: '',
  raza: '',
  tamanio: '',
  pesoKg: '',
  fechaNacimiento: '',
  notas: '',
});
const emptyServicio = (): ServicioForm => ({
  perroId: '',
  fecha: todayISO(),
  tipo: 'bano',
  precio: '',
  notas: '',
});

function normalize(value: string) {
  return value.trim();
}

function toNumber(value: string) {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export default function BrowserStorageApp({ page }: Props) {
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);
  const [db, setDbState] = useState<BrowserDb>(getDb());
  const [login, setLogin] = useState<LoginState>({
    username: '',
    password: '',
    next: '/dashboard',
    loading: false,
    error: '',
  });

  const [clienteForm, setClienteForm] = useState<ClienteForm>(emptyCliente());
  const [clienteEditId, setClienteEditId] = useState<string | null>(null);

  const [perroForm, setPerroForm] = useState<PerroForm>(emptyPerro());
  const [perroEditId, setPerroEditId] = useState<string | null>(null);

  const [servicioForm, setServicioForm] = useState<ServicioForm>(emptyServicio());
  const [servicioEditId, setServicioEditId] = useState<string | null>(null);

  useEffect(() => {
    const currentSession = getSession();
    setSessionState(currentSession);
    setDbState(getDb());
    setReady(true);

    if (page === 'login') {
      const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';
      setLogin(state => ({ ...state, next }));
      if (currentSession) {
        window.location.replace(next);
      }
      return;
    }

    if (!currentSession) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const queryEdit = new URLSearchParams(window.location.search).get('edit');
    if (page === 'clientes' && queryEdit) {
      const cliente = getDb().clientes.find(c => c.id === queryEdit);
      if (cliente) {
        setClienteEditId(cliente.id);
        setClienteForm({
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          email: cliente.email,
          notas: cliente.notas,
        });
      }
    }

    if (page === 'perros' && queryEdit) {
      const perro = getDb().perros.find(p => p.id === queryEdit);
      if (perro) {
        setPerroEditId(perro.id);
        setPerroForm({
          clienteId: perro.clienteId,
          nombre: perro.nombre,
          raza: perro.raza,
          tamanio: perro.tamanio,
          pesoKg: perro.pesoKg,
          fechaNacimiento: perro.fechaNacimiento,
          notas: perro.notas,
        });
      }
    }

    if (page === 'servicios' && queryEdit) {
      const servicio = getDb().servicios.find(s => s.id === queryEdit);
      if (servicio) {
        setServicioEditId(servicio.id);
        setServicioForm({
          perroId: servicio.perroId,
          fecha: servicio.fecha,
          tipo: servicio.tipo,
          precio: servicio.precio,
          notas: servicio.notas,
        });
      }
    }
  }, [page]);

  useEffect(() => {
    if (!ready) return;
    setDb(db);
  }, [db, ready]);

  const account = useMemo(() => getAccount(), [ready, session]);
  const clientes = useMemo(() => sortByUpdatedAt(db.clientes).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [db.clientes]);
  const perros = useMemo(() => sortByUpdatedAt(db.perros).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [db.perros]);
  const servicios = useMemo(() => sortByUpdatedAt(db.servicios).sort((a, b) => b.fecha.localeCompare(a.fecha)), [db.servicios]);
  const clientesById = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes]);
  const perrosById = useMemo(() => Object.fromEntries(perros.map(p => [p.id, p])), [perros]);

  if (page === 'login') {
    return (
      <section className="auth-page">
        <div className="container container-narrow">
          <div className="card auth-card animate-fade-up">
            <h1>🐾 Entrar a Patitas</h1>
            <p className="lead">Usuario y contraseña quedan guardados en tu navegador. Sin Supabase, sin backend.</p>
            <form
              className="auth-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const username = normalize(login.username);
                const password = login.password;
                const next = login.next || '/dashboard';

                if (!username || !password) {
                  setLogin(state => ({ ...state, error: 'Completá usuario y contraseña.' }));
                  return;
                }

                setLogin(state => ({ ...state, loading: true, error: '' }));
                const hash = await sha256(password);
                const current = getAccount();

                if (!current) {
                  const now = new Date().toISOString();
                  const accountData = { username, passwordHash: hash, createdAt: now, updatedAt: now };
                  setAccount(accountData);
                  const sessionData = { username, loggedInAt: now };
                  setSession(sessionData);
                  setSessionState(sessionData);
                  window.location.replace(next);
                  return;
                }

                if (current.username !== username || current.passwordHash !== hash) {
                  setLogin(state => ({ ...state, loading: false, error: 'Usuario o contraseña incorrectos.' }));
                  return;
                }

                const sessionData = { username, loggedInAt: new Date().toISOString() };
                setSession(sessionData);
                setSessionState(sessionData);
                window.location.replace(next);
              }}
            >
              {login.error && <div className="alert">⚠️ {login.error}</div>}
              <div className="field">
                <label htmlFor="username">Usuario</label>
                <input
                  id="username"
                  value={login.username}
                  onChange={(e) => setLogin(state => ({ ...state, username: e.target.value }))}
                  autoComplete="username"
                  placeholder="fede"
                />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={login.password}
                  onChange={(e) => setLogin(state => ({ ...state, password: e.target.value }))}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="btn btn-primary auth-btn" disabled={login.loading}>
                {login.loading ? 'Entrando…' : 'Entrar / crear cuenta local'}
              </button>
            </form>
            <p className="footer-note">
              Si es la primera vez, se crea la cuenta en este navegador. Si borrás los datos del navegador, se pierde.
            </p>
            {account && (
              <p className="footer-note">
                Cuenta existente detectada: <strong>{account.username}</strong>
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!session) return null;

  const logout = () => {
    clearSession();
    window.location.replace('/login');
  };

  if (page === 'dashboard') {
    return (
      <DashboardResumen
        clientes={clientes}
        perros={perros}
        servicios={servicios}
        session={session}
        onLogout={logout}
        onReset={() => {
          resetDb();
          window.location.reload();
        }}
      />
    );
  }

  if (page === 'clientes') {
    const saveCliente = () => {
      const now = new Date().toISOString();
      const nombre = normalize(clienteForm.nombre);
      if (!nombre) return;
      const payload: Cliente = {
        id: clienteEditId ?? uid(),
        nombre,
        telefono: normalize(clienteForm.telefono),
        email: normalize(clienteForm.email),
        notas: normalize(clienteForm.notas),
        createdAt: clienteEditId ? (db.clientes.find(c => c.id === clienteEditId)?.createdAt ?? now) : now,
        updatedAt: now,
      };
      setDbState(state => ({
        ...state,
        clientes: clienteEditId ? state.clientes.map(c => c.id === clienteEditId ? payload : c) : [payload, ...state.clientes],
      }));
      setClienteForm(emptyCliente());
      setClienteEditId(null);
      window.history.replaceState({}, document.title, '/dashboard/clientes');
    };

    const deleteCliente = (id: string) => {
      if (!confirm('¿Borrar este cliente y sus perros?')) return;
      setDbState(state => ({
        clientes: state.clientes.filter(c => c.id !== id),
        perros: state.perros.filter(p => p.clienteId !== id),
        servicios: state.servicios.filter(s => state.perros.find(p => p.id === s.perroId)?.clienteId !== id),
      }));
      if (clienteEditId === id) {
        setClienteEditId(null);
        setClienteForm(emptyCliente());
      }
    };

    return (
      <>
        <div className="page-head">
          <h1>Clientes</h1>
          <p className="sub">{clientes.length} clientes registrados</p>
        </div>
        <section className="layout">
          <div className="card form-card">
            <h3>{clienteEditId ? '✏️ Editar cliente' : '➕ Nuevo cliente'}</h3>
            <div className="field">
              <label>Nombre *</label>
              <input value={clienteForm.nombre} onChange={e => setClienteForm({ ...clienteForm, nombre: e.target.value })} placeholder="Juan Pérez" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Teléfono</label>
                <input value={clienteForm.telefono} onChange={e => setClienteForm({ ...clienteForm, telefono: e.target.value })} placeholder="+54 11 1234-5678" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={clienteForm.email} onChange={e => setClienteForm({ ...clienteForm, email: e.target.value })} placeholder="juan@mail.com" />
              </div>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={3} value={clienteForm.notas} onChange={e => setClienteForm({ ...clienteForm, notas: e.target.value })} placeholder="Alergias, preferencias, etc." />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveCliente}>{clienteEditId ? 'Guardar cambios' : 'Crear cliente'}</button>
              {clienteEditId && <button className="btn btn-ghost" onClick={() => { setClienteEditId(null); setClienteForm(emptyCliente()); window.history.replaceState({}, document.title, '/dashboard/clientes'); }}>Cancelar</button>}
            </div>
          </div>
          <div className="card list-card">
            <h3>Listado</h3>
            {clientes.length === 0 ? (
              <p className="empty">Todavía no cargaste ningún cliente. Empezá por la izquierda.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.nombre}</strong></td>
                      <td>
                        {c.telefono && <div>📞 {c.telefono}</div>}
                        {c.email && <div>✉️ {c.email}</div>}
                      </td>
                      <td className="notas">{c.notas || '—'}</td>
                      <td className="actions">
                        <button
                          className="btn-mini-action"
                          onClick={() => {
                            setClienteEditId(c.id);
                            setClienteForm({ nombre: c.nombre, telefono: c.telefono, email: c.email, notas: c.notas });
                            window.history.replaceState({}, document.title, `/dashboard/clientes?edit=${c.id}`);
                          }}
                        >
                          Editar
                        </button>
                        <button className="btn-mini-action danger" onClick={() => deleteCliente(c.id)}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </>
    );
  }

  if (page === 'perros') {
    const savePerro = () => {
      const now = new Date().toISOString();
      const payload: Perro = {
        id: perroEditId ?? uid(),
        clienteId: perroForm.clienteId,
        nombre: normalize(perroForm.nombre),
        raza: normalize(perroForm.raza),
        tamanio: perroForm.tamanio,
        pesoKg: normalize(perroForm.pesoKg),
        fechaNacimiento: perroForm.fechaNacimiento,
        notas: normalize(perroForm.notas),
        createdAt: perroEditId ? (db.perros.find(p => p.id === perroEditId)?.createdAt ?? now) : now,
        updatedAt: now,
      };
      if (!payload.clienteId || !payload.nombre || !payload.raza) return;
      setDbState(state => ({
        ...state,
        perros: perroEditId ? state.perros.map(p => p.id === perroEditId ? payload : p) : [payload, ...state.perros],
      }));
      setPerroEditId(null);
      setPerroForm(emptyPerro());
      window.history.replaceState({}, document.title, '/dashboard/perros');
    };

    const deletePerro = (id: string) => {
      if (!confirm('¿Borrar este perro y sus servicios?')) return;
      setDbState(state => ({
        ...state,
        perros: state.perros.filter(p => p.id !== id),
        servicios: state.servicios.filter(s => s.perroId !== id),
      }));
      if (perroEditId === id) {
        setPerroEditId(null);
        setPerroForm(emptyPerro());
      }
    };

    return (
      <>
        <div className="page-head page-head-row">
          <div>
            <h1>Perros</h1>
            <p className="sub">{perros.length} perros · {clientes.length} clientes</p>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="card empty-state">
            <h3>Necesitás un cliente primero</h3>
            <p>Antes de cargar un perro, cargá el dueño. <a href="/dashboard/clientes">Ir a clientes →</a></p>
          </div>
        ) : (
          <section className="layout">
            <div className="card form-card">
              <h3>➕ Registrar perro</h3>
              <div className="field">
                <label>Dueño *</label>
                <select value={perroForm.clienteId} onChange={e => setPerroForm({ ...perroForm, clienteId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Nombre del perro *</label>
                <input value={perroForm.nombre} onChange={e => setPerroForm({ ...perroForm, nombre: e.target.value })} placeholder="Firulais" />
              </div>
              <div className="field">
                <label>Raza *</label>
                <input value={perroForm.raza} onChange={e => setPerroForm({ ...perroForm, raza: e.target.value })} placeholder="Golden Retriever, Caniche, Mestizo..." />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Tamaño</label>
                  <select value={perroForm.tamanio} onChange={e => setPerroForm({ ...perroForm, tamanio: e.target.value as PerroForm['tamanio'] })}>
                    <option value="">—</option>
                    <option value="chico">Chico</option>
                    <option value="mediano">Mediano</option>
                    <option value="grande">Grande</option>
                    <option value="gigante">Gigante</option>
                  </select>
                </div>
                <div className="field">
                  <label>Peso (kg)</label>
                  <input type="number" step="0.1" value={perroForm.pesoKg} onChange={e => setPerroForm({ ...perroForm, pesoKg: e.target.value })} placeholder="12.5" />
                </div>
              </div>
              <div className="field">
                <label>Fecha de nacimiento</label>
                <input type="date" value={perroForm.fechaNacimiento} onChange={e => setPerroForm({ ...perroForm, fechaNacimiento: e.target.value })} />
              </div>
              <div className="field">
                <label>Notas</label>
                <textarea rows={3} value={perroForm.notas} onChange={e => setPerroForm({ ...perroForm, notas: e.target.value })} placeholder="Alergias, comportamiento, etc." />
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={savePerro}>{perroEditId ? 'Guardar cambios' : 'Registrar perro'}</button>
                {perroEditId && <button className="btn btn-ghost" onClick={() => { setPerroEditId(null); setPerroForm(emptyPerro()); window.history.replaceState({}, document.title, '/dashboard/perros'); }}>Cancelar</button>}
              </div>
            </div>
            <div className="card list-card">
              <h3>Todos los perros</h3>
              {perros.length === 0 ? (
                <p className="empty">Sin perros todavía.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Perro</th><th>Raza</th><th>Tamaño</th><th>Dueño</th><th></th></tr>
                  </thead>
                  <tbody>
                    {perros.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td>{p.raza}</td>
                        <td>{p.tamanio ? <span className="tag">{p.tamanio}</span> : '—'}</td>
                        <td>{clientesById[p.clienteId]?.nombre ?? '—'}</td>
                        <td className="actions">
                          <button
                            className="btn-mini-action"
                            onClick={() => {
                              setPerroEditId(p.id);
                              setPerroForm({
                                clienteId: p.clienteId,
                                nombre: p.nombre,
                                raza: p.raza,
                                tamanio: p.tamanio,
                                pesoKg: p.pesoKg,
                                fechaNacimiento: p.fechaNacimiento,
                                notas: p.notas,
                              });
                              window.history.replaceState({}, document.title, `/dashboard/perros?edit=${p.id}`);
                            }}
                          >
                            Editar
                          </button>
                          <button className="btn-mini-action danger" onClick={() => deletePerro(p.id)}>Borrar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </>
    );
  }

  const saveServicio = () => {
    const now = new Date().toISOString();
    const payload: Servicio = {
      id: servicioEditId ?? uid(),
      perroId: servicioForm.perroId,
      fecha: servicioForm.fecha,
      tipo: servicioForm.tipo,
      precio: normalize(servicioForm.precio),
      notas: normalize(servicioForm.notas),
      createdAt: servicioEditId ? (db.servicios.find(s => s.id === servicioEditId)?.createdAt ?? now) : now,
      updatedAt: now,
    };
    if (!payload.perroId || !payload.fecha || !payload.precio) return;
    setDbState(state => ({
      ...state,
      servicios: servicioEditId ? state.servicios.map(s => s.id === servicioEditId ? payload : s) : [payload, ...state.servicios],
    }));
    setServicioEditId(null);
    setServicioForm(emptyServicio());
    window.history.replaceState({}, document.title, '/dashboard/servicios');
  };

  const deleteServicio = (id: string) => {
    if (!confirm('¿Borrar este servicio?')) return;
    setDbState(state => ({
      ...state,
      servicios: state.servicios.filter(s => s.id !== id),
    }));
    if (servicioEditId === id) {
      setServicioEditId(null);
      setServicioForm(emptyServicio());
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Servicios</h1>
        <p className="sub">{servicios.length} registrados</p>
      </div>

      {perros.length === 0 ? (
        <div className="card empty-state">
          <h3>Necesitás un perro primero</h3>
          <p>Antes de cargar un servicio, cargá al menos un perro. <a href="/dashboard/perros">Ir a perros →</a></p>
        </div>
      ) : (
        <>
          <section className="card form-card" style={{ marginBottom: '1.25rem' }}>
            <h3>➕ Registrar servicio</h3>
            <div className="field-row">
              <div className="field">
                <label>Perro *</label>
                <select value={servicioForm.perroId} onChange={e => setServicioForm({ ...servicioForm, perroId: e.target.value })}>
                  <option value="">Seleccionar...</option>
                  {perros.map(p => {
                    const cliente = clientesById[p.clienteId];
                    return <option key={p.id} value={p.id}>{p.nombre} ({p.raza}) — {cliente?.nombre ?? '—'}</option>;
                  })}
                </select>
              </div>
              <div className="field">
                <label>Fecha *</label>
                <input type="date" value={servicioForm.fecha} onChange={e => setServicioForm({ ...servicioForm, fecha: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Tipo *</label>
                <select value={servicioForm.tipo} onChange={e => setServicioForm({ ...servicioForm, tipo: e.target.value as ServicioForm['tipo'] })}>
                  <option value="bano">Baño</option>
                  <option value="corte">Corte</option>
                  <option value="bano_y_corte">Baño + Corte</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="field">
                <label>Precio (ARS) *</label>
                <input type="number" min="0" step="100" value={servicioForm.precio} onChange={e => setServicioForm({ ...servicioForm, precio: e.target.value })} placeholder="5000" />
              </div>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={3} value={servicioForm.notas} onChange={e => setServicioForm({ ...servicioForm, notas: e.target.value })} placeholder="Corte de uñas, shampoo antipulgas, etc." />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveServicio}>{servicioEditId ? 'Guardar cambios' : 'Registrar servicio'}</button>
              {servicioEditId && <button className="btn btn-ghost" onClick={() => { setServicioEditId(null); setServicioForm(emptyServicio()); window.history.replaceState({}, document.title, '/dashboard/servicios'); }}>Cancelar</button>}
            </div>
          </section>

          <section className="card list-card">
            <h3>Historial reciente</h3>
            {servicios.length === 0 ? (
              <p className="empty">Sin servicios registrados todavía.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Perro</th>
                    <th>Dueño</th>
                    <th>Tipo</th>
                    <th>Precio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.map(s => {
                    const perro = perrosById[s.perroId];
                    const cliente = perro ? clientesById[perro.clienteId] : null;
                    return (
                      <tr key={s.id}>
                        <td>{formatShortDate(s.fecha)}</td>
                        <td><strong>{perro?.nombre ?? '—'}</strong><br /><span className="raza-small">{perro?.raza ?? ''}</span></td>
                        <td>{cliente?.nombre ?? '—'}</td>
                        <td><span className={`tag tag-${s.tipo === 'bano' ? 'bano' : s.tipo === 'corte' ? 'corte' : s.tipo === 'bano_y_corte' ? 'completo' : 'otro'}`}>{s.tipo.replaceAll('_', ' ')}</span></td>
                        <td className="price">{formatMoney(toNumber(s.precio))}</td>
                        <td className="actions">
                          <button
                            className="btn-mini-action"
                            onClick={() => {
                              setServicioEditId(s.id);
                              setServicioForm({ perroId: s.perroId, fecha: s.fecha, tipo: s.tipo, precio: s.precio, notas: s.notas });
                              window.history.replaceState({}, document.title, `/dashboard/servicios?edit=${s.id}`);
                            }}
                          >
                            Editar
                          </button>
                          <button className="btn-mini-action danger" onClick={() => deleteServicio(s.id)}>Borrar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <style>{`
        .page-head { margin-bottom: 1.5rem; }
        .page-head h1 { font-size: 1.8rem; color: var(--bone); margin-bottom: 0.2rem; }
        .page-head-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .sub { color: var(--bone-dim); font-size: 0.92rem; }
        .layout { display: grid; grid-template-columns: 360px 1fr; gap: 1.25rem; }
        @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
        .form-card h3, .list-card h3 { margin-bottom: 1rem; color: var(--bone); font-size: 1.05rem; }
        .form-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .empty { color: var(--bone-dim); padding: 1rem 0; text-align: center; }
        .empty-state { text-align: center; padding: 2rem 1rem; }
        .empty-state h3 { color: var(--amber); margin-bottom: 0.5rem; }
        .raza-small { font-size: 0.78rem; color: var(--bone-dim); }
        .price { text-align: right; font-weight: 700; color: var(--amber); }
        .actions { text-align: right; white-space: nowrap; }
        .btn-mini-action {
          font-size: 0.78rem; padding: 0.3rem 0.7rem; border-radius: 6px;
          background: rgba(217, 142, 62, 0.15); color: var(--amber);
          border: 1px solid rgba(217, 142, 62, 0.3); cursor: pointer; margin-left: 0.35rem;
        }
        .btn-mini-action.danger { background: rgba(199, 93, 79, 0.12); color: #f4a89c; border-color: rgba(199, 93, 79, 0.35); }
        .btn-mini-action:hover { background: rgba(217, 142, 62, 0.3); }
        .auth-page { padding: 4rem 0; }
        .auth-card { max-width: 460px; margin: 0 auto; }
        .auth-card h1 { margin-bottom: 0.4rem; color: var(--bone); }
        .lead { margin-bottom: 1.3rem; }
        .auth-btn { width: 100%; margin-top: 0.25rem; }
        .footer-note { font-size: 0.85rem; margin-top: 1rem; }
        .alert { background: rgba(199, 93, 79, 0.15); color: #f4b5ae; border: 1px solid rgba(199, 93, 79, 0.35); padding: 0.75rem 0.9rem; border-radius: 10px; margin-bottom: 1rem; }
      `}</style>
    </>
  );
}
