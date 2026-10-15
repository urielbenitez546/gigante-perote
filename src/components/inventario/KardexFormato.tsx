import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  registerInventoryEntry,
  registerInventorySalida,
  useProductKardex,
} from "../../hooks/useInventory";
import { useProfileNames } from "../../hooks/useProfileNames";
import ConteoFisicoModal from "./ConteoFisicoModal";
import { PRODUCT_UNIT_LABELS, productoId, tienePermiso, type Product } from "../../types";

interface Props {
  product: Product;
  /** Se llama después de guardar algo, para refrescar la existencia del producto. */
  onChanged: () => void;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) => r3(n).toLocaleString("es-MX", { maximumFractionDigits: 3 });

function fechaCorta(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Kardex digital: el mismo formato de papel (FO-GIGANTE-KAR-00) que hoy
 * está detrás de la etiqueta amarilla — Fecha, Nombre, Entrada, Salida y
 * Existencia — pero que se llena aquí y se cuadra solo con el sistema.
 */
export default function KardexFormato({ product, onChanged }: Props) {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const { entries, loading, error, reload } = useProductKardex(product.id);

  const puedeSalida = tienePermiso(profile, "kardex");
  const puedeEntrada = tienePermiso(profile, "kardex_entradas");
  const puedeAnotar = puedeSalida || puedeEntrada;

  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [conteoAbierto, setConteoAbierto] = useState(false);

  const unidad = PRODUCT_UNIT_LABELS[product.unit];
  const stock = Number(product.physical_stock);

  // Renglones del más viejo al más nuevo, con la existencia que quedó
  // después de cada uno (se calcula hacia atrás desde la existencia actual).
  const { filas, inicial } = useMemo(() => {
    const asc = [...entries].reverse();
    let despues = stock;
    const resultado = asc.map(() => 0);
    for (let i = asc.length - 1; i >= 0; i--) {
      resultado[i] = r3(despues);
      despues -= asc[i].delta;
    }
    return { filas: asc.map((e, i) => ({ e, existencia: resultado[i] })), inicial: r3(despues) };
  }, [entries, stock]);

  const nEntrada = Number(entrada) || 0;
  const nSalida = Number(salida) || 0;
  const previa = r3(stock + nEntrada - nSalida);

  async function guardar() {
    setMsg(null);
    if (nEntrada > 0 && nSalida > 0) {
      return setMsg({ tipo: "error", texto: "Anota solo entrada o solo salida en cada renglón." });
    }
    if (nEntrada <= 0 && nSalida <= 0) {
      return setMsg({ tipo: "error", texto: "Escribe cuánto entra o cuánto sale." });
    }
    if (nSalida > 0) {
      if (!puedeSalida) return setMsg({ tipo: "error", texto: "No tienes permiso para registrar salidas." });
      if (nSalida > stock) {
        return setMsg({ tipo: "error", texto: `No puedes sacar más de lo que hay (${fmt(stock)} ${unidad}).` });
      }
      if (!referencia.trim()) {
        return setMsg({ tipo: "error", texto: "Escribe el folio de la venta o el motivo de la salida." });
      }
    }
    if (nEntrada > 0 && !puedeEntrada) {
      return setMsg({ tipo: "error", texto: "No tienes permiso para registrar entradas." });
    }

    setGuardando(true);
    const { error: err } =
      nSalida > 0
        ? await registerInventorySalida(product.id, nSalida, referencia.trim())
        : await registerInventoryEntry(product.id, nEntrada, referencia.trim());
    setGuardando(false);
    if (err) return setMsg({ tipo: "error", texto: err });

    setEntrada("");
    setSalida("");
    setReferencia("");
    setMsg({ tipo: "ok", texto: "Renglón guardado." });
    reload();
    onChanged();
  }

  const celda = "border border-gigante-border px-2 py-1.5 align-top";
  const input =
    "w-full rounded border border-gigante-border px-1.5 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gigante-navy/30 disabled:bg-gigante-bg";

  return (
    <div className="bg-white border border-gigante-border rounded-2xl p-4 mt-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-gigante-navy">Formato para Kardex</h2>
          <p className="text-[11px] text-gigante-muted">FO-GIGANTE-KAR-00</p>
        </div>
        {puedeEntrada && (
          <button
            onClick={() => setConteoAbierto(true)}
            className="flex items-center gap-1.5 border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2 hover:bg-gigante-bg"
          >
            <ClipboardCheck size={14} /> Conteo físico
          </button>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] text-sm border border-gigante-border rounded-lg overflow-hidden mb-3">
        <div className="px-3 py-1.5 bg-gigante-bg font-semibold text-gigante-navy border-r border-b border-gigante-border">ID</div>
        <div className="px-3 py-1.5 font-semibold text-gigante-navy border-b border-gigante-border">
          {productoId(product) || "—"} · {product.code}
        </div>
        <div className="px-3 py-1.5 bg-gigante-bg font-semibold text-gigante-navy border-r border-gigante-border">Descripción</div>
        <div className="px-3 py-1.5 text-gigante-navy">{product.name}</div>
      </div>

      {error && <p className="text-xs text-gigante-red mb-2">No se pudo cargar el historial: {error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[560px]">
          <thead>
            <tr className="bg-gigante-bg text-gigante-navy">
              <th className={`${celda} text-left w-24`}>Fecha</th>
              <th className={`${celda} text-left`}>Nombre</th>
              <th className={`${celda} text-right w-20`}>Entrada</th>
              <th className={`${celda} text-right w-20`}>Salida</th>
              <th className={`${celda} text-right w-24`}>Existencia</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className={`${celda} text-gigante-muted`}>
                  Cargando historial...
                </td>
              </tr>
            ) : (
              <>
                <tr className="text-gigante-muted">
                  <td className={celda}>—</td>
                  <td className={celda}>Existencia antes del primer renglón</td>
                  <td className={celda}></td>
                  <td className={celda}></td>
                  <td className={`${celda} text-right font-semibold`}>{fmt(inicial)}</td>
                </tr>
                {filas.map(({ e, existencia }) => (
                  <tr key={e.id}>
                    <td className={celda}>{fechaCorta(e.fecha)}</td>
                    <td className={celda}>
                      <span className="font-medium text-gigante-navy">{nameFor(e.created_by)}</span>
                      <span className="block text-[11px] text-gigante-muted">
                        {e.detalle}
                        {e.referencia ? ` · ${e.referencia}` : ""}
                      </span>
                    </td>
                    <td className={`${celda} text-right text-emerald-700 font-semibold`}>
                      {e.delta > 0 ? fmt(e.delta) : ""}
                    </td>
                    <td className={`${celda} text-right text-gigante-red font-semibold`}>
                      {e.delta < 0 ? fmt(Math.abs(e.delta)) : ""}
                    </td>
                    <td className={`${celda} text-right font-semibold text-gigante-navy`}>{fmt(existencia)}</td>
                  </tr>
                ))}
              </>
            )}

            {puedeAnotar && !loading && (
              <>
                <tr className="bg-amber-50/60">
                  <td className={celda}>{fechaCorta(new Date().toISOString())}</td>
                  <td className={celda}>
                    <span className="font-medium text-gigante-navy">{profile?.full_name ?? "—"}</span>
                    <span className="block text-[11px] text-gigante-muted">Renglón nuevo</span>
                  </td>
                  <td className={celda}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={entrada}
                      onChange={(e) => {
                        setEntrada(e.target.value);
                        if (e.target.value) setSalida("");
                      }}
                      disabled={!puedeEntrada}
                      placeholder={puedeEntrada ? "" : "—"}
                      className={input}
                      aria-label="Entrada"
                    />
                  </td>
                  <td className={celda}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={salida}
                      onChange={(e) => {
                        setSalida(e.target.value);
                        if (e.target.value) setEntrada("");
                      }}
                      disabled={!puedeSalida}
                      className={input}
                      aria-label="Salida"
                    />
                  </td>
                  <td className={`${celda} text-right font-semibold ${previa < 0 ? "text-gigante-red" : "text-gigante-navy"}`}>
                    {fmt(previa)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className={celda}>
                    <input
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                      placeholder={
                        puedeSalida
                          ? "Folio de la venta o motivo de la salida (ej. V-1004, muestra)"
                          : "Referencia (opcional)"
                      }
                      className="w-full rounded border border-gigante-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
                    />
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {puedeAnotar && (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            {guardando ? "Guardando..." : "Guardar renglón"}
          </button>
          {msg && (
            <p className={`text-xs ${msg.tipo === "ok" ? "text-emerald-700" : "text-gigante-red"}`}>{msg.texto}</p>
          )}
        </div>
      )}
      {!puedeAnotar && (
        <p className="text-xs text-gigante-muted mt-3">Solo consulta: tu usuario no puede anotar renglones en el Kardex.</p>
      )}

      {conteoAbierto && (
        <ConteoFisicoModal
          products={[product]}
          initialProductId={product.id}
          onClose={() => setConteoAbierto(false)}
          onSuccess={() => {
            setConteoAbierto(false);
            reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
