import { useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import type { Cliente, Perro, Servicio, Session } from '../lib/browserStore';
import { formatMoney } from '../lib/browserStore';

interface Props {
  clientes: Cliente[];
  perros: Perro[];
  servicios: Servicio[];
  session: Session;
  onLogout: () => void;
  onReset: () => void;
}

const TIPO_LABEL: Record<Servicio['tipo'], string> = {
  bano: 'Baño',
  corte: 'Corte',
  bano_y_corte: 'Baño + Corte',
  otro: 'Otro',
};

// Color tokens — single accent on a neutral scale.
const COLOR = {
  accent: '#1f7a8c',
  accentSoft: '#7fb8c2',
  ink: '#0f1419',
  inkSoft: '#3a4250',
  paper: '#fafbfc',
  border: '#e3e7eb',
} as const;

const PIE_COLORS = ['#0f1419', '#3a4250', '#7fb8c2', '#1f7a8c'];

// Ponytail: global O(n) scan per render is fine for ≤10k services.
// Upgrade to indexed dates when real backend lands.

function toNumber(value: string): number {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function DashboardResumen({
  clientes,
  perros,
  servicios,
  session,
  onLogout,
  onReset,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── Metrics ──────────────────────────────────────────────────────────
  const today = startOfDay(new Date());

  const serviciosConPrecio = useMemo(
    () => servicios.map((s) => ({ ...s, precioNum: toNumber(s.precio) })),
    [servicios]
  );

  const totalGanancia = useMemo(
    () => serviciosConPrecio.reduce((sum, s) => sum + s.precioNum, 0),
    [serviciosConPrecio]
  );

  const monthKey = today.toISOString().slice(0, 7);
  const serviciosMes = useMemo(
    () => serviciosConPrecio.filter((s) => s.fecha.startsWith(monthKey)),
    [serviciosConPrecio, monthKey]
  );
  const gananciaMes = useMemo(
    () => serviciosMes.reduce((sum, s) => sum + s.precioNum, 0),
    [serviciosMes]
  );
  const serviciosMesCount = serviciosMes.length;
  const ticketPromedio = serviciosMesCount > 0 ? gananciaMes / serviciosMesCount : 0;

  const countsByTipo = useMemo(() => {
    const out = { bano: 0, corte: 0, completo: 0, otro: 0 };
    for (const s of servicios) {
      if (s.tipo === 'bano') out.bano += 1;
      else if (s.tipo === 'corte') out.corte += 1;
      else if (s.tipo === 'bano_y_corte') out.completo += 1;
      else out.otro += 1;
    }
    return out;
  }, [servicios]);

  // Last 30 days, day-by-day revenue.
  const ingresos30d = useMemo(() => {
    const days: { dia: string; ingresos: number; servicios: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ dia: dayKey(d), ingresos: 0, servicios: 0 });
    }
    const byKey = new Map(days.map((x) => [x.dia, x]));
    for (const s of serviciosConPrecio) {
      const slot = byKey.get(s.fecha);
      if (!slot) continue;
      slot.ingresos += s.precioNum;
      slot.servicios += 1;
    }
    return days;
  }, [serviciosConPrecio, today]);

  // Mix servicios (pie).
  const mixServicios = useMemo(
    () => [
      { name: TIPO_LABEL.bano, value: countsByTipo.bano, tipo: 'bano' as const },
      { name: TIPO_LABEL.corte, value: countsByTipo.corte, tipo: 'corte' as const },
      { name: TIPO_LABEL.completo, value: countsByTipo.completo, tipo: 'completo' as const },
      { name: TIPO_LABEL.otro, value: countsByTipo.otro, tipo: 'otro' as const },
    ].filter((x) => x.value > 0),
    [countsByTipo]
  );

  // Top clientes by frequency (with total spend).
  const perrosById = useMemo(() => Object.fromEntries(perros.map((p) => [p.id, p])), [perros]);
  const clientesById = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c])),
    [clientes]
  );

  const topClientes = useMemo(() => {
    const map = new Map<string, { count: number; gasto: number; nombre: string }>();
    for (const s of serviciosConPrecio) {
      const perro = perrosById[s.perroId];
      if (!perro) continue;
      const clienteId = perro.clienteId;
      const cur = map.get(clienteId) ?? {
        count: 0,
        gasto: 0,
        nombre: clientesById[clienteId]?.nombre ?? '—',
      };
      cur.count += 1;
      cur.gasto += s.precioNum;
      map.set(clienteId, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [serviciosConPrecio, perrosById, clientesById]);

  // Semana actual vs mes anterior (bar agrupado por día).
  const comparativaSemana = useMemo(() => {
    const out: { dia: string; esta: number; anterior: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dAnterior = new Date(d);
      dAnterior.setDate(d.getDate() - 7);
      out.push({
        dia: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
        esta: 0,
        anterior: 0,
      });
      const kEsta = dayKey(d);
      const kAnterior = dayKey(dAnterior);
      for (const s of serviciosConPrecio) {
        if (s.fecha === kEsta) out[out.length - 1].esta += s.precioNum;
        if (s.fecha === kAnterior) out[out.length - 1].anterior += s.precioNum;
      }
    }
    return out;
  }, [serviciosConPrecio, today]);

  // ─── GSAP entrance animation ──────────────────────────────────────────
  useEffect(() => {
    let ctx: { revert: () => void } | null = null;
    (async () => {
      const gsapMod = await import('gsap');
      const gsap = gsapMod.gsap ?? gsapMod.default;
      if (!containerRef.current) return;
      ctx = gsap.context(() => {
        gsap.from('.dash-kpi', {
          opacity: 0,
          y: 16,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power2.out',
        });
        gsap.from('.dash-card', {
          opacity: 0,
          y: 20,
          duration: 0.6,
          stagger: 0.12,
          delay: 0.25,
          ease: 'power2.out',
        });
        gsap.from('.dash-recent-row', {
          opacity: 0,
          x: -12,
          duration: 0.4,
          stagger: 0.04,
          delay: 0.5,
          ease: 'power1.out',
        });
      }, containerRef);
    })();
    return () => {
      ctx?.revert();
    };
  }, []);

  const recent = serviciosConPrecio.slice(0, 6);

  const hasData = servicios.length > 0 || clientes.length > 0 || perros.length > 0;

  return (
    <div className="dashboard" ref={containerRef}>
      <div className="page-head">
        <h1>
          Hola, <span className="hl">{session.username}</span> 👋
        </h1>
        <p className="sub">
          Todo queda guardado en este navegador. Próximo paso: conectamos Supabase para que
          persista entre dispositivos.
        </p>
      </div>

      {!hasData && (
        <div className="card empty-state">
          <h3>Empezá cargando datos</h3>
          <p>
            Creá tu primer cliente y registrá un servicio desde{' '}
            <a href="/dashboard/clientes">Clientes</a> para ver las métricas en vivo acá.
          </p>
        </div>
      )}

      <div className="kpis">
        <div className="card kpi dash-kpi">
          <div className="kpi-label">Ingresos del mes</div>
          <div className="kpi-value">{formatMoney(gananciaMes)}</div>
          <div className="kpi-sub">{serviciosMesCount} servicios</div>
        </div>
        <div className="card kpi dash-kpi">
          <div className="kpi-label">Ticket promedio</div>
          <div className="kpi-value">{formatMoney(ticketPromedio)}</div>
          <div className="kpi-sub">Por servicio este mes</div>
        </div>
        <div className="card kpi dash-kpi">
          <div className="kpi-label">Clientes / Perros</div>
          <div className="kpi-value">
            {clientes.length} / {perros.length}
          </div>
          <div className="kpi-sub">Base local en este navegador</div>
        </div>
        <div className="card kpi dash-kpi">
          <div className="kpi-label">Ingresos totales</div>
          <div className="kpi-value">{formatMoney(totalGanancia)}</div>
          <div className="kpi-sub">{servicios.length} servicios en el historial</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card dash-card">
          <h3>Ingresos últimos 30 días</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ingresos30d} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLOR.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: COLOR.inkSoft }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10, fill: COLOR.inkSoft }} width={60} />
                <Tooltip
                  contentStyle={{
                    background: COLOR.paper,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: COLOR.ink }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke={COLOR.accent}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: COLOR.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card dash-card">
          <h3>Mix de servicios</h3>
          {mixServicios.length === 0 ? (
            <p className="empty">Sin servicios registrados.</p>
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={mixServicios}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {mixServicios.map((entry, idx) => (
                      <Cell key={entry.tipo} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: COLOR.inkSoft }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: COLOR.paper,
                      border: `1px solid ${COLOR.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card dash-card">
          <h3>Esta semana vs semana anterior</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={comparativaSemana} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={COLOR.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: COLOR.inkSoft }}
                />
                <YAxis tick={{ fontSize: 10, fill: COLOR.inkSoft }} width={60} />
                <Tooltip
                  contentStyle={{
                    background: COLOR.paper,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: COLOR.inkSoft }} />
                <Bar dataKey="anterior" name="Semana anterior" fill={COLOR.inkSoft} radius={[3, 3, 0, 0]} />
                <Bar dataKey="esta" name="Esta semana" fill={COLOR.accent} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card dash-card">
          <h3>Top clientes por visitas</h3>
          {topClientes.length === 0 ? (
            <p className="empty">Sin servicios registrados.</p>
          ) : (
            <ol className="top-list">
              {topClientes.map((c) => (
                <li key={c.id} className="top-list-item">
                  <div className="top-list-name">{c.nombre}</div>
                  <div className="top-list-meta">
                    <span className="top-list-count">{c.count} visitas</span>
                    <span className="top-list-amount">{formatMoney(c.gasto)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="card dash-card" style={{ marginTop: '1.25rem' }}>
        <h3>Últimos servicios</h3>
        {recent.length === 0 ? (
          <p className="empty">Todavía no registraste servicios.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Perro</th>
                <th>Dueño</th>
                <th>Tipo</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const perro = perrosById[s.perroId];
                const cliente = perro ? clientesById[perro.clienteId] : null;
                return (
                  <tr key={s.id} className="dash-recent-row">
                    <td>{s.fecha}</td>
                    <td>
                      <strong>{perro?.nombre ?? '—'}</strong>
                      <br />
                      <span className="raza-small">{perro?.raza ?? ''}</span>
                    </td>
                    <td>{cliente?.nombre ?? '—'}</td>
                    <td>
                      <span className={`tag tag-${s.tipo === 'bano' ? 'bano' : s.tipo === 'corte' ? 'corte' : s.tipo === 'bano_y_corte' ? 'completo' : 'otro'}`}>
                        {TIPO_LABEL[s.tipo]}
                      </span>
                    </td>
                    <td className="price">{formatMoney(s.precioNum)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card dash-card empty-state" style={{ marginTop: '1.25rem' }}>
        <h3>Acciones de cuenta</h3>
        <p>
          Si exportás los datos, o si querés migrar a Supabase multi-dispositivo, decime y
          armamos el siguiente paso.
        </p>
        <div className="dash-actions">
          <button className="btn btn-ghost" onClick={onLogout}>
            Salir
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('¿Borrar toda la base local?')) onReset();
            }}
          >
            Reset local
          </button>
        </div>
      </div>
    </div>
  );
}