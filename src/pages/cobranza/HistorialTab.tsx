import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  ORIGEN_PAGO_LABELS,
  fechaCorta,
  hoyMX,
  metodoLabel,
  usePagos,
  useVendedorNombre,
  type OrigenPago,
  type PagoRow,
  type TipoPago,
} from "../../hooks/useCobranza";
import { tienePermiso } from "../../types";
import { descargarHistorialExcel } from "../../lib/cobranzaExport";
import TablaPagos from "../../components/cobranza/TablaPagos";
import PagoModal from "../../components/cobranza/PagoModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function HistorialTab() {
  const { profile } = useAuth();
  const vendedor = useVendedorNombre();
  const puedeCorregir = (profile?.role === "gerencia" || profile?.role === "caja") && tienePermiso(profile, "corregir_cobros");

  const hoy = hoyMX();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`);
  const [hasta, setHasta] = useState(hoy);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoPago | "">("");
  const [metodo, setMetodo] = useState("");
  const [origen, setOrigen] = useState<OrigenPago | "">("");
  const [vend, setVend] = useState("");
  const [conAnulados, setConAnulados] = useState(false);
  const [abierto, setAbierto] = useState<PagoRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { pagos, loading, error: errCarga, reload } = usePagos(desde, hasta);

  const vendedores = useMemo(() => [...new Set(pagos.map((p) => vendedor(p.sale?.created_by)))].sort(), [pagos, vendedor]);
  const metodos = useMemo(() => [...new Set(pagos.map((p) => p.metodo ?? "sin_metodo"))], [pagos]);

  const filtrados = useMemo(() => {
    const q = norm(texto.trim());
    return pagos.filter((p) => {
      if (!conAnulados && p.anulado) return false;
      if (tipo && p.tipo !== tipo) return false;
      if (origen && p.origen !== origen) return false;
      if (metodo && (p.metodo ?? "sin_metodo") !== metodo) return false;
      if (vend && vendedor(p.sale?.created_by) !== vend) return false;
      if (q) {
        const hay = norm(
          [p.sale?.folio, p.sale?.numero_factura, p.sale?.customer_name, p.recibo, p.comentario, p.fecha_caja, p.fecha_pago, fechaCorta(p.fecha_caja), fechaCorta(p.fecha_pago)]
            .filter(Boolean)
            .join(" ")
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pagos, texto, tipo, origen, metodo, vend, conAnulados, vendedor]);

  const vig = filtrados.filter((p) => !p.anulado);
  const sumaV = vig.filter((p) => p.tipo === "venta").reduce((s, p) => s + p.monto, 0);
  const sumaC = vig.filter((p) => p.tipo === "cobranza").reduce((s, p) => s + p.monto, 0);

  const sel = "border border-gigante-border rounded-lg px-2.5 py-2 text-sm bg-white text-gigante-navy";

  return (
    <div>
      <div className="bg-white border border-gigante-border rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gigante-muted">
            Desde
            <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && setDesde(e.target.value)} className={`${sel} block mt-0.5`} />
          </label>
          <label className="text-xs text-gigante-muted">
            Hasta
            <input type="date" value={hasta} min={desde} max={hoy} onChange={(e) => e.target.value && setHasta(e.target.value)} className={`${sel} block mt-0.5`} />
          </label>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gigante-muted" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar cliente, folio, factura, recibo, fecha…"
              className="w-full border border-gigante-border rounded-lg pl-8 pr-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPago | "")} className={sel}>
            <option value="">Venta y cobranza</option>
            <option value="venta">Solo venta</option>
            <option value="cobranza">Solo cobranza</option>
          </select>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={sel}>
            <option value="">Todos los métodos</option>
            {metodos.map((m) => (
              <option key={m} value={m}>
                {metodoLabel(m)}
              </option>
            ))}
          </select>
          <select value={origen} onChange={(e) => setOrigen(e.target.value as OrigenPago | "")} className={sel}>
            <option value="">Cómo entró (todos)</option>
            {(Object.keys(ORIGEN_PAGO_LABELS) as OrigenPago[]).map((o) => (
              <option key={o} value={o}>
                {ORIGEN_PAGO_LABELS[o]}
              </option>
            ))}
          </select>
          <select value={vend} onChange={(e) => setVend(e.target.value)} className={sel}>
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gigante-navy">
            <input type="checkbox" checked={conAnulados} onChange={(e) => setConAnulados(e.target.checked)} /> Mostrar anulados
          </label>
          <button
            onClick={async () => {
              setError(null);
              try {
                await descargarHistorialExcel(filtrados, desde, hasta, vendedor);
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo generar el Excel.");
              }
            }}
            disabled={filtrados.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 border border-gigante-navy text-gigante-navy disabled:opacity-50 text-sm font-semibold rounded-lg px-3 py-2 bg-white"
          >
            <Download size={15} /> Descargar Excel
          </button>
        </div>
      </div>

      {(error || errCarga) && <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error ?? errCarga}</p>}

      <p className="mt-3 text-sm text-gigante-navy">
        <strong>{vig.length}</strong> pago(s) · Venta <strong className="text-emerald-700">{money(sumaV)}</strong> · Cobranza{" "}
        <strong className="text-blue-700">{money(sumaC)}</strong> · Total <strong>{money(sumaV + sumaC)}</strong>
      </p>

      <div className="mt-2 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gigante-muted">Cargando…</p>
        ) : (
          <TablaPagos pagos={filtrados} vendedor={vendedor} onAbrir={setAbierto} mostrarTipo puedeCorregir={puedeCorregir} vacio="No hay pagos con esos filtros." />
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
          }}
        />
      )}
    </div>
  );
}
