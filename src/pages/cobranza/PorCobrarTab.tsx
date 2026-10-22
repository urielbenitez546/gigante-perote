import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import {
  TIPO_PAGO_LABELS,
  fechaCorta,
  fechaMX,
  hoyMX,
  metodoLabel,
  useCuentas,
  useVendedorNombre,
  type CuentaCobranza,
} from "../../hooks/useCobranza";
import { descargarCobranzaMesExcel } from "../../lib/cobranzaExport";
import { nombreMes } from "../../lib/cobranzaExcel";
import AbonoModal from "../../components/cobranza/AbonoModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Filtro = "todas" | "apartado" | "entregado" | "liquidada";

function estadoCuenta(c: CuentaCobranza): Exclude<Filtro, "todas"> {
  if (c.saldo <= 0.005) return "liquidada";
  return c.venta.status === "entregada" ? "entregado" : "apartado";
}

const BADGE: Record<string, string> = {
  apartado: "bg-amber-100 text-amber-800",
  entregado: "bg-blue-100 text-blue-700",
  liquidada: "bg-emerald-100 text-emerald-700",
};
const BADGE_LABEL: Record<string, string> = { apartado: "Apartado", entregado: "Entregado", liquidada: "Liquidada" };

export default function PorCobrarTab() {
  const vendedor = useVendedorNombre();
  const [verLiquidadas, setVerLiquidadas] = useState(false);
  const { cuentas, loading, error, reload } = useCuentas(verLiquidadas);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [vend, setVend] = useState("");
  const [texto, setTexto] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [abonando, setAbonando] = useState<CuentaCobranza | null>(null);

  const hoy = hoyMX();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [exportando, setExportando] = useState(false);
  const [errExp, setErrExp] = useState<string | null>(null);

  const conEstado = useMemo(() => cuentas.map((c) => ({ c, estado: estadoCuenta(c) })), [cuentas]);
  const vendedores = useMemo(() => [...new Set(cuentas.map((c) => vendedor(c.venta.created_by)))].sort(), [cuentas, vendedor]);

  const visibles = useMemo(() => {
    const q = norm(texto.trim());
    return conEstado
      .filter(({ c, estado }) => {
        if (!verLiquidadas && estado === "liquidada") return false;
        if (filtro !== "todas" && estado !== filtro) return false;
        if (vend && vendedor(c.venta.created_by) !== vend) return false;
        if (q && !norm([c.venta.folio, c.venta.numero_factura, c.venta.customer_name].filter(Boolean).join(" ")).includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.c.venta.created_at.localeCompare(b.c.venta.created_at));
  }, [conEstado, filtro, vend, texto, verLiquidadas, vendedor]);

  const sumaSaldo = (e: string) => conEstado.filter((x) => x.estado === e).reduce((s, x) => s + x.c.saldo, 0);
  const apartados = sumaSaldo("apartado");
  const entregados = sumaSaldo("entregado");

  const grupos = useMemo(() => {
    const m = new Map<string, typeof visibles>();
    for (const x of visibles) {
      const k = vendedor(x.c.venta.created_by);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibles, vendedor]);

  const sel = "border border-gigante-border rounded-lg px-2.5 py-2 text-sm bg-white text-gigante-navy";

  async function exportar() {
    setExportando(true);
    setErrExp(null);
    try {
      await descargarCobranzaMesExcel(anio, mes, vendedor);
    } catch (e) {
      setErrExp(e instanceof Error ? e.message : "No se pudo generar el Excel.");
    }
    setExportando(false);
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gigante-navy text-white rounded-xl p-4">
          <p className="text-xs text-white/70">Total por cobrar</p>
          <p className="text-2xl font-bold mt-1">{money(apartados + entregados)}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Apartados (aún sin entregar)</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{money(apartados)}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Entregados con saldo</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{money(entregados)}</p>
        </div>
      </div>

      <div className="mt-4 bg-white border border-gigante-border rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["todas", "Todas"],
              ["apartado", "Apartados"],
              ["entregado", "Entregados"],
              ...(verLiquidadas ? ([["liquidada", "Liquidadas"]] as [Filtro, string][]) : []),
            ] as [Filtro, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFiltro(k)}
              className={`text-xs rounded-full px-3 py-1.5 border ${
                filtro === k ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
              }`}
            >
              {label}
            </button>
          ))}
          <select value={vend} onChange={(e) => setVend(e.target.value)} className={sel}>
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gigante-navy">
            <input
              type="checkbox"
              checked={verLiquidadas}
              onChange={(e) => {
                setVerLiquidadas(e.target.checked);
                if (!e.target.checked && filtro === "liquidada") setFiltro("todas");
              }}
            />
            Ver también las liquidadas (últimos 90 días)
          </label>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gigante-muted" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar cliente, folio o factura…"
            className="w-full border border-gigante-border rounded-lg pl-8 pr-3 py-2 text-sm"
          />
        </div>
        <p className="text-[11px] text-gigante-muted">
          Las cuentas liquidadas salen solas de esta lista en cuanto el saldo llega a cero.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">No se pudo cargar: {error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-gigante-muted">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="mt-4 text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-5">
          No hay cuentas con saldo con estos filtros. 🎉
        </p>
      ) : (
        grupos.map(([nombre, lista]) => (
          <div key={nombre} className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gigante-bg">
              <p className="text-sm font-bold text-gigante-navy">{nombre}</p>
              <p className="text-xs text-gigante-muted">
                {lista.length} cuenta(s) · Saldo{" "}
                <strong className="text-gigante-red">{money(lista.reduce((s, x) => s + x.c.saldo, 0))}</strong>
              </p>
            </div>
            <ul className="divide-y divide-gigante-border">
              {lista.map(({ c, estado }) => {
                const v = c.venta;
                const abierto = abierta === v.id;
                return (
                  <li key={v.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <button onClick={() => setAbierta(abierto ? null : v.id)} className="flex items-center gap-1 text-left">
                        <ChevronDown size={14} className={`text-gigante-muted ${abierto ? "rotate-180" : ""}`} />
                        <span className="text-sm font-semibold text-gigante-navy">{v.folio}</span>
                        {v.numero_factura && <span className="text-xs text-gigante-muted">· {v.numero_factura}</span>}
                      </button>
                      <span className="text-sm text-gigante-navy flex-1 min-w-[160px]">{v.customer_name}</span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 ${BADGE[estado]}`}>{BADGE_LABEL[estado]}</span>
                      <span className="text-xs text-gigante-muted">{fechaCorta(fechaMX(v.created_at))}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                      <span className="text-gigante-muted">Total <strong className="text-gigante-navy">{money(v.total)}</strong></span>
                      <span className="text-gigante-muted">Pagado <strong className="text-emerald-700">{money(v.amount_paid)}</strong></span>
                      <span className="text-gigante-muted">Saldo <strong className={c.saldo > 0.005 ? "text-gigante-red" : "text-emerald-700"}>{money(c.saldo)}</strong></span>
                      {c.saldo > 0.005 && (
                        <button
                          onClick={() => setAbonando(c)}
                          className="ml-auto bg-gigante-red hover:bg-gigante-redDark text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                        >
                          Registrar abono
                        </button>
                      )}
                    </div>
                    {abierto && (
                      <div className="mt-2 rounded-lg bg-gigante-bg px-3 py-2">
                        {c.pagos.length === 0 ? (
                          <p className="text-xs text-gigante-muted">Todavía no tiene pagos registrados.</p>
                        ) : (
                          <ul className="space-y-1">
                            {c.pagos.map((p) => (
                              <li key={p.id} className="flex flex-wrap items-center gap-x-3 text-xs text-gigante-navy">
                                <span className="w-20">{fechaCorta(p.fecha_pago)}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.tipo === "venta" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                  {TIPO_PAGO_LABELS[p.tipo]}
                                </span>
                                <span className="text-gigante-muted">{metodoLabel(p.metodo)}</span>
                                {p.recibo && <span className="text-gigante-muted">Recibo {p.recibo}</span>}
                                <strong className="ml-auto">{money(p.monto)}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-[11px] text-gigante-muted mt-1.5">
                          Para corregir o anular un pago, búscalo en “Historial”.
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      <div className="mt-6 bg-white border border-gigante-border rounded-xl p-4">
        <p className="text-sm font-semibold text-gigante-navy">Descargar en el formato de Caja</p>
        <p className="text-xs text-gigante-muted mt-0.5">
          Excel con las hojas TOTAL, el mes elegido (PAGADOS, APARTADOS y ENTREGADOS por vendedor), APARTADOS y ENTREGADOS. Los saldos son fórmulas.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={sel}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={sel}>
            {[Number(hoy.slice(0, 4)) - 1, Number(hoy.slice(0, 4)), Number(hoy.slice(0, 4)) + 1].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={exportar}
            disabled={exportando}
            className="inline-flex items-center gap-1.5 bg-gigante-navy hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            <Download size={15} /> {exportando ? "Generando…" : "Descargar Excel"}
          </button>
        </div>
        {errExp && <p className="mt-2 text-xs text-gigante-red">{errExp}</p>}
      </div>

      {abonando && (
        <AbonoModal
          venta={abonando.venta}
          onClose={() => setAbonando(null)}
          onDone={() => {
            setAbonando(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
