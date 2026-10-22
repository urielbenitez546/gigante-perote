import { useMemo, useState } from "react";
import { Download, Save, ChevronDown, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  fechaCorta,
  guardarCorte,
  hoyMX,
  metodoLabel,
  sumarDias,
  useCortesGuardados,
  usePagos,
  useVendedorNombre,
  type PagoRow,
} from "../../hooks/useCobranza";
import { tienePermiso } from "../../types";
import { descargarCorteExcel } from "../../lib/cobranzaExport";
import TablaPagos from "../../components/cobranza/TablaPagos";
import PagoModal from "../../components/cobranza/PagoModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Preset = "hoy" | "ayer" | "7dias" | "semana" | "mes" | "mespasado" | "otro";

const PRESETS: [Preset, string][] = [
  ["hoy", "Hoy"],
  ["ayer", "Ayer"],
  ["7dias", "Últimos 7 días"],
  ["semana", "Esta semana"],
  ["mes", "Este mes"],
  ["mespasado", "Mes pasado"],
  ["otro", "Elegir fechas"],
];

function rango(p: Preset, actual: { desde: string; hasta: string }): { desde: string; hasta: string } {
  const hoy = hoyMX();
  const [y, m, d] = hoy.split("-").map(Number);
  switch (p) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ayer": {
      const a = sumarDias(hoy, -1);
      return { desde: a, hasta: a };
    }
    case "7dias":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "semana": {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
      const lunes = sumarDias(hoy, -((dow + 6) % 7));
      return { desde: lunes, hasta: hoy };
    }
    case "mes":
      return { desde: `${y}-${String(m).padStart(2, "0")}-01`, hasta: hoy };
    case "mespasado": {
      const ult = new Date(Date.UTC(y, m - 1, 0));
      const pm = ult.getUTCMonth() + 1;
      return {
        desde: `${ult.getUTCFullYear()}-${String(pm).padStart(2, "0")}-01`,
        hasta: `${ult.getUTCFullYear()}-${String(pm).padStart(2, "0")}-${String(ult.getUTCDate()).padStart(2, "0")}`,
      };
    }
    default:
      return actual;
  }
}

export default function CorteTab() {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const vendedor = useVendedorNombre();
  const puedeCorregir = (profile?.role === "gerencia" || profile?.role === "caja") && tienePermiso(profile, "corregir_cobros");

  const [preset, setPreset] = useState<Preset>("hoy");
  const [fechas, setFechas] = useState(() => rango("hoy", { desde: hoyMX(), hasta: hoyMX() }));
  const { pagos, loading, error, reload } = usePagos(fechas.desde, fechas.hasta);
  const { cortes, reload: reloadCortes } = useCortesGuardados();
  const [abierto, setAbierto] = useState<PagoRow | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [verCortes, setVerCortes] = useState(false);

  const vigentes = useMemo(() => pagos.filter((p) => !p.anulado), [pagos]);
  const ventas = useMemo(() => vigentes.filter((p) => p.tipo === "venta"), [vigentes]);
  const cobranza = useMemo(() => vigentes.filter((p) => p.tipo === "cobranza"), [vigentes]);
  const suma = (l: PagoRow[]) => Math.round(l.reduce((s, p) => s + p.monto, 0) * 100) / 100;
  const totalVentas = suma(ventas);
  const totalCobranza = suma(cobranza);

  const porMetodo = useMemo(() => {
    const m = new Map<string, { v: number; c: number }>();
    for (const p of vigentes) {
      const k = metodoLabel(p.metodo);
      const x = m.get(k) ?? { v: 0, c: 0 };
      if (p.tipo === "venta") x.v += p.monto;
      else x.c += p.monto;
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].v + b[1].c - (a[1].v + a[1].c));
  }, [vigentes]);

  const porVendedor = useMemo(() => {
    const m = new Map<string, { v: number; c: number }>();
    for (const p of vigentes) {
      const k = vendedor(p.sale?.created_by);
      const x = m.get(k) ?? { v: 0, c: 0 };
      if (p.tipo === "venta") x.v += p.monto;
      else x.c += p.monto;
      m.set(k, x);
    }
    return [...m.entries()].sort((a, b) => b[1].v + b[1].c - (a[1].v + a[1].c));
  }, [vigentes, vendedor]);

  function elegir(p: Preset) {
    setPreset(p);
    if (p !== "otro") setFechas(rango(p, fechas));
  }

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    const { error: err } = await guardarCorte(fechas.desde, fechas.hasta, nota);
    setGuardando(false);
    if (err) return setMsg({ tipo: "error", texto: err });
    setNota("");
    setMsg({ tipo: "ok", texto: "Corte guardado. Si después corriges un pago de esos días, el corte te avisará que cambió." });
    reloadCortes();
  }

  async function descargar() {
    setMsg(null);
    try {
      await descargarCorteExcel(pagos, fechas.desde, fechas.hasta, vendedor);
    } catch (e) {
      setMsg({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo generar el Excel." });
    }
  }

  const periodo = fechas.desde === fechas.hasta ? fechaCorta(fechas.desde) : `${fechaCorta(fechas.desde)} al ${fechaCorta(fechas.hasta)}`;
  const modificados = cortes.filter((c) => c.modificado).length;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => elegir(k)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
              preset === k ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {preset === "otro" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gigante-navy">
            Desde{" "}
            <input type="date" value={fechas.desde} max={fechas.hasta} onChange={(e) => e.target.value && setFechas((f) => ({ ...f, desde: e.target.value }))} className="border border-gigante-border rounded-lg px-2 py-1.5" />
          </label>
          <label className="text-gigante-navy">
            Hasta{" "}
            <input type="date" value={fechas.hasta} min={fechas.desde} max={hoyMX()} onChange={(e) => e.target.value && setFechas((f) => ({ ...f, hasta: e.target.value }))} className="border border-gigante-border rounded-lg px-2 py-1.5" />
          </label>
        </div>
      )}

      {modificados > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} /> {modificados} corte(s) guardado(s) cambiaron después de guardarse. Revísalos abajo en “Cortes guardados”.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">No se pudo cargar: {error}</p>}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Venta · {periodo}</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{money(totalVentas)}</p>
          <p className="text-[11px] text-gigante-muted">{ventas.length} pago(s) del mismo día de la venta</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Cobranza · {periodo}</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{money(totalCobranza)}</p>
          <p className="text-[11px] text-gigante-muted">{cobranza.length} pago(s) de días posteriores</p>
        </div>
        <div className="bg-gigante-navy rounded-xl p-4 text-white">
          <p className="text-xs text-white/70">Total en caja</p>
          <p className="text-2xl font-bold mt-1">{money(totalVentas + totalCobranza)}</p>
          <p className="text-[11px] text-white/70">{vigentes.length} movimiento(s)</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota del corte (opcional)"
          className="flex-1 min-w-[180px] border border-gigante-border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={guardar}
          disabled={guardando || vigentes.length === 0}
          className="inline-flex items-center gap-1.5 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2"
        >
          <Save size={15} /> {guardando ? "Guardando..." : "Guardar corte"}
        </button>
        <button
          onClick={descargar}
          disabled={vigentes.length === 0}
          className="inline-flex items-center gap-1.5 border border-gigante-navy text-gigante-navy disabled:opacity-50 text-sm font-semibold rounded-lg px-4 py-2 bg-white"
        >
          <Download size={15} /> Descargar Excel
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-xs rounded-lg px-3 py-2 ${msg.tipo === "ok" ? "text-emerald-800 bg-emerald-50" : "text-gigante-red bg-gigante-red/10"}`}>{msg.texto}</p>
      )}

      {vigentes.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ["Por método de pago", porMetodo],
            ["Por vendedor (de la venta)", porVendedor],
          ].map(([titulo, filas]) => (
            <div key={titulo as string} className="bg-white border border-gigante-border rounded-xl overflow-hidden">
              <p className="text-xs font-semibold text-gigante-navy px-4 py-2.5 bg-gigante-bg">{titulo as string}</p>
              <table className="w-full text-xs">
                <thead className="text-gigante-muted">
                  <tr>
                    <th className="text-left font-medium px-4 py-1.5"></th>
                    <th className="text-right font-medium px-2 py-1.5">Venta</th>
                    <th className="text-right font-medium px-2 py-1.5">Cobranza</th>
                    <th className="text-right font-medium px-4 py-1.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(filas as [string, { v: number; c: number }][]).map(([k, x]) => (
                    <tr key={k} className="border-t border-gigante-border">
                      <td className="px-4 py-1.5 text-gigante-navy">{k}</td>
                      <td className="px-2 py-1.5 text-right">{money(x.v)}</td>
                      <td className="px-2 py-1.5 text-right">{money(x.c)}</td>
                      <td className="px-4 py-1.5 text-right font-semibold">{money(x.v + x.c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-gigante-muted">Cargando…</p>
      ) : (
        <>
          <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
            <p className="text-sm font-semibold text-emerald-700 px-4 py-3 border-b border-gigante-border">
              VENTA · {money(totalVentas)}
            </p>
            <TablaPagos
              pagos={ventas}
              vendedor={vendedor}
              onAbrir={setAbierto}
              puedeCorregir={puedeCorregir}
              vacio="No hubo pagos de venta en este periodo."
            />
          </div>
          <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
            <p className="text-sm font-semibold text-blue-700 px-4 py-3 border-b border-gigante-border">
              COBRANZA · {money(totalCobranza)}
            </p>
            <TablaPagos
              pagos={cobranza}
              vendedor={vendedor}
              onAbrir={setAbierto}
              puedeCorregir={puedeCorregir}
              vacio="No hubo cobranza en este periodo."
            />
          </div>
        </>
      )}

      <div className="mt-6">
        <button onClick={() => setVerCortes((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-gigante-navy">
          <ChevronDown size={16} className={verCortes ? "rotate-180" : ""} /> Cortes guardados ({cortes.length})
        </button>
        {verCortes && (
          <div className="mt-2 space-y-2">
            {cortes.length === 0 && <p className="text-sm text-gigante-muted">Todavía no has guardado ningún corte.</p>}
            {cortes.map((c) => (
              <div key={c.id} className="bg-white border border-gigante-border rounded-xl px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gigante-navy">
                    {c.desde === c.hasta ? fechaCorta(c.desde) : `${fechaCorta(c.desde)} al ${fechaCorta(c.hasta)}`}
                  </p>
                  <button
                    onClick={() => {
                      setPreset("otro");
                      setFechas({ desde: c.desde, hasta: c.hasta });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-xs font-semibold text-gigante-red hover:underline"
                  >
                    Ver ese periodo
                  </button>
                </div>
                <p className="text-xs text-gigante-muted mt-0.5">
                  Venta {money(c.ventas_total)} · Cobranza {money(c.cobranza_total)} · guardado por {nameFor(c.creado_por)} el{" "}
                  {new Date(c.created_at).toLocaleString("es-MX")}
                </p>
                {c.nota && <p className="text-xs text-gigante-navy mt-0.5">Nota: {c.nota}</p>}
                {c.modificado && (
                  <p className="mt-1.5 text-xs text-amber-900 bg-amber-50 rounded-md px-2 py-1.5">
                    ⚠️ Cambió después de guardarse. Ahora: Venta {money(c.ventas_actual)} · Cobranza {money(c.cobranza_actual)}.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {abierto && (
        <PagoModal
          pago={abierto}
          puedeCorregir={puedeCorregir}
          onClose={() => setAbierto(null)}
          onDone={() => {
            setAbierto(null);
            reload();
            reloadCortes();
          }}
        />
      )}
    </div>
  );
}
