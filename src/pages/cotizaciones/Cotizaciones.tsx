import { useMemo, useState } from "react";
import { FileText, Plus, Printer, RefreshCw, ShoppingCart, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import { cancelarCotizacion, useCotizaciones, type Cotizacion } from "../../hooks/useCotizaciones";
import { imprimirCotizacion } from "../../lib/cotizacionImprimir";
import { unidadLabel } from "../../types";
import NuevaCotizacionModal from "../../components/cotizaciones/NuevaCotizacionModal";
import NuevaVentaModal, { type DesdeCotizacion } from "../../components/ventas/NuevaVentaModal";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const hoyYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dia = (ymd: string) =>
  new Date(ymd + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

type Filtro = "abiertas" | "vencidas" | "convertidas" | "canceladas" | "todas";

export default function Cotizaciones() {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const { products } = useProducts();
  const { cotizaciones, loading, error, reload } = useCotizaciones();
  const puedeCrear = profile?.role === "ventas" || profile?.role === "gerencia";

  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [nueva, setNueva] = useState(false);
  const [aVenta, setAVenta] = useState<DesdeCotizacion | null>(null);
  const [cancelando, setCancelando] = useState<Cotizacion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const hoy = hoyYmd();
  const vencida = (c: Cotizacion) => c.status === "abierta" && c.vigencia_hasta < hoy;

  const grupos = useMemo(
    () => ({
      abiertas: cotizaciones.filter((c) => c.status === "abierta" && !vencida(c)),
      vencidas: cotizaciones.filter(vencida),
      convertidas: cotizaciones.filter((c) => c.status === "convertida"),
      canceladas: cotizaciones.filter((c) => c.status === "cancelada"),
      todas: cotizaciones,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cotizaciones, hoy]
  );
  const lista = grupos[filtro];

  const FILTROS: [Filtro, string][] = [
    ["abiertas", `Abiertas (${grupos.abiertas.length})`],
    ["vencidas", `Vencidas (${grupos.vencidas.length})`],
    ["convertidas", "Convertidas en venta"],
    ["canceladas", "Canceladas"],
    ["todas", "Todas"],
  ];

  function convertir(c: Cotizacion) {
    setAVenta({
      id: c.id,
      folio: c.folio,
      customer_name: c.customer_name,
      customer_phone: c.customer_phone,
      customer_address: c.customer_address,
      items: c.cotizacion_items.map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        tipo_precio: i.tipo_precio,
      })),
    });
  }

  async function confirmarCancelar() {
    if (!cancelando) return;
    setErrorCancelar(null);
    const { error: err } = await cancelarCotizacion(cancelando.id, motivo);
    if (err) return setErrorCancelar(err);
    setCancelando(null);
    setMotivo("");
    reload();
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <FileText size={22} /> Cotizaciones
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            Prepara un presupuesto para el cliente, imprímelo y, si compra, conviértelo en venta con un clic.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            className="flex items-center gap-2 border border-gigante-border text-gigante-navy text-sm font-medium rounded-lg px-3 py-2"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          {puedeCrear && (
            <button
              onClick={() => setNueva(true)}
              className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2"
            >
              <Plus size={16} /> Nueva cotización
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error} — ¿ya corriste la migración 0028 en Supabase?
        </p>
      )}
      {aviso && (
        <p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{aviso}</p>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
              filtro === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-sm text-gigante-muted">Cargando...</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-5">
            No hay cotizaciones en esta lista.
          </p>
        ) : (
          lista.map((c) => (
            <div key={c.id} className="bg-white border border-gigante-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gigante-navy">
                    {c.folio} · <span className="font-normal">{c.customer_name}</span>
                  </p>
                  <p className="text-[11px] text-gigante-muted">
                    {nameFor(c.created_by)} · {dia(c.created_at.slice(0, 10))} · vigencia hasta {dia(c.vigencia_hasta)}
                  </p>
                  <p className="text-[11px] text-gigante-muted mt-1 break-words">
                    {c.cotizacion_items
                      .map((i) => `${i.product?.code ?? "?"} (${Number(i.quantity)} ${unidadLabel(i.product?.unit)})`)
                      .join(", ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gigante-navy">{money(Number(c.total))}</p>
                  <span
                    className={`inline-block mt-1 text-[11px] rounded-full px-2 py-0.5 ${
                      c.status === "convertida"
                        ? "bg-emerald-100 text-emerald-700"
                        : c.status === "cancelada"
                        ? "bg-gigante-red/10 text-gigante-red"
                        : vencida(c)
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {c.status === "convertida"
                      ? `Venta ${c.sale_folio ?? ""}`
                      : c.status === "cancelada"
                      ? "Cancelada"
                      : vencida(c)
                      ? "Vencida"
                      : "Abierta"}
                  </span>
                </div>
              </div>
              {c.status === "cancelada" && c.motivo_cancelacion && (
                <p className="text-[11px] text-gigante-muted mt-1">Motivo: {c.motivo_cancelacion}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!imprimirCotizacion(c)) setAviso("Tu navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium border border-gigante-border text-gigante-navy rounded-lg px-3 py-1.5 bg-white"
                >
                  <Printer size={14} /> Imprimir
                </button>
                {puedeCrear && c.status === "abierta" && (
                  <>
                    <button
                      onClick={() => convertir(c)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-red hover:bg-gigante-redDark rounded-lg px-3 py-1.5"
                    >
                      <ShoppingCart size={14} /> Convertir en venta
                    </button>
                    <button
                      onClick={() => {
                        setCancelando(c);
                        setMotivo("");
                        setErrorCancelar(null);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium border border-gigante-border text-gigante-navy rounded-lg px-3 py-1.5 bg-white"
                    >
                      <XCircle size={14} /> Cancelar
                    </button>
                  </>
                )}
              </div>
              {puedeCrear && vencida(c) && (
                <p className="text-[11px] text-gigante-muted mt-2">
                  Al convertirla se usan los precios de hoy, que pueden ser distintos a los de la cotización.
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {nueva && (
        <NuevaCotizacionModal
          products={products}
          onClose={() => setNueva(false)}
          onSaved={(folio) => {
            setNueva(false);
            setAviso(`Cotización ${folio} creada.`);
            setTimeout(() => setAviso(null), 5000);
            reload();
          }}
        />
      )}

      {aVenta && (
        <NuevaVentaModal
          products={products}
          desdeCotizacion={aVenta}
          onClose={() => setAVenta(null)}
          onSuccess={(folio) => {
            setAVenta(null);
            setAviso(`Venta ${folio} registrada desde la cotización. Ya pasó a Caja.`);
            setTimeout(() => setAviso(null), 6000);
            reload();
          }}
        />
      )}

      {cancelando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold text-gigante-navy mb-1">Cancelar cotización</h2>
            <p className="text-sm text-gigante-muted mb-3">
              {cancelando.folio} · {cancelando.customer_name}
            </p>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (ej. el cliente ya no compró)"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
            {errorCancelar && <p className="text-xs text-gigante-red mt-2">{errorCancelar}</p>}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setCancelando(null)}
                className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
              >
                Volver
              </button>
              <button
                onClick={confirmarCancelar}
                disabled={!motivo.trim()}
                className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
              >
                Cancelar cotización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
