import { useMemo, useRef, useState } from "react";
import { Camera, ClipboardCheck, Paperclip, Tag } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  registerInventoryEntry,
  registerInventorySalida,
  anularMovimientoKardex,
  adjuntarFotoKardex,
  guardarFotoProducto,
  errorFotoAmigable,
  ultimoMovimientoPropio,
  useProductKardex,
} from "../../hooks/useInventory";
import { signedPhotoUrl, uploadPhoto } from "../../lib/storage";
import { useProfileNames } from "../../hooks/useProfileNames";
import ConteoFisicoModal from "./ConteoFisicoModal";
import EtiquetaKardexModal from "./EtiquetaKardexModal";
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
  const puedeAnular = tienePermiso(profile, "anular_kardex");
  // Foto de apoyo: Gerencia, todo almacén y choferes la suben y la ven.
  const puedeFoto = profile?.role === "gerencia" || profile?.role === "almacen" || profile?.role === "reparto";

  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [conteoAbierto, setConteoAbierto] = useState(false);
  const [etiquetaAbierta, setEtiquetaAbierta] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoEsDelProducto, setFotoEsDelProducto] = useState(true);
  const vistaFoto = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto]);
  const fotoNuevaRef = useRef<HTMLInputElement>(null);
  const fotoFilaRef = useRef<HTMLInputElement>(null);
  const [movParaFoto, setMovParaFoto] = useState<string | null>(null);

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

  async function anular(movId: string) {
    const motivo = window.prompt(
      "¿Por qué se anula este renglón? (ejemplo: me equivoqué en la cantidad)\n\nQuedará tachado en el Kardex y la existencia se corrige sola. Si era una salida de una venta, la venta no cambia."
    );
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      return setMsg({ tipo: "error", texto: "Escribe el motivo para poder anular el renglón." });
    }
    const { error: err } = await anularMovimientoKardex(movId, motivo.trim());
    if (err) return setMsg({ tipo: "error", texto: err });
    setMsg({ tipo: "ok", texto: "Renglón anulado." });
    reload();
    onChanged();
  }

  async function abrirFoto(path: string) {
    const ventana = window.open("", "_blank");
    const url = await signedPhotoUrl("kardex-soporte", path, 600);
    if (!url) {
      ventana?.close();
      return setMsg({ tipo: "error", texto: "No se pudo abrir la foto." });
    }
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
  }

  async function adjuntarAFila(file: File | undefined) {
    const movId = movParaFoto;
    setMovParaFoto(null);
    if (fotoFilaRef.current) fotoFilaRef.current.value = "";
    if (!file || !movId) return;
    setMsg(null);
    const { path, error: errSubida } = await uploadPhoto("kardex-soporte", file);
    if (errSubida || !path) return setMsg({ tipo: "error", texto: errorFotoAmigable(errSubida ?? "No se pudo subir la foto.") });
    const { error: errAdjuntar } = await adjuntarFotoKardex(movId, path);
    if (errAdjuntar) return setMsg({ tipo: "error", texto: errorFotoAmigable(errAdjuntar) });
    setMsg({ tipo: "ok", texto: "Foto agregada al renglón." });
    reload();
  }

  async function guardar() {
    setMsg(null);
    if (nEntrada > 0 && nSalida > 0) {
      return setMsg({ tipo: "error", texto: "Anota solo entrada o solo salida en cada renglón." });
    }
    if (nEntrada <= 0 && nSalida <= 0) {
      return setMsg({
        tipo: "error",
        texto: foto
          ? "Escribe cuánto entra o cuánto sale: la foto se guarda junto con el renglón."
          : "Escribe cuánto entra o cuánto sale.",
      });
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
    // La foto se sube primero: si falla, el renglón no se guarda a medias.
    let fotoPath: string | null = null;
    if (foto && puedeFoto) {
      const sub = await uploadPhoto("kardex-soporte", foto);
      if (sub.error || !sub.path) {
        setGuardando(false);
        return setMsg({ tipo: "error", texto: `No se pudo subir la foto: ${errorFotoAmigable(sub.error ?? "error desconocido")}` });
      }
      fotoPath = sub.path;
    }
    const tipoMov = nSalida > 0 ? "salida" : "entrada";
    const inicioGuardado = new Date().toISOString();
    const { error: err } =
      nSalida > 0
        ? await registerInventorySalida(product.id, nSalida, referencia.trim())
        : await registerInventoryEntry(product.id, nEntrada, referencia.trim());
    if (err) {
      setGuardando(false);
      return setMsg({ tipo: "error", texto: err });
    }

    let avisoFoto: string | null = null;
    if (fotoPath && profile) {
      const movId = await ultimoMovimientoPropio(product.id, tipoMov, profile.id, inicioGuardado);
      const adj = movId ? await adjuntarFotoKardex(movId, fotoPath) : { error: "no se encontró el renglón" };
      if (adj.error) avisoFoto = errorFotoAmigable(adj.error);
    }
    // Si el producto aún no tiene foto, la misma foto queda como foto del producto.
    if (foto && puedeFoto && !product.foto_path && fotoEsDelProducto) {
      const subP = await uploadPhoto("productos-fotos", foto);
      if (subP.path) await guardarFotoProducto(product.id, subP.path, true);
    }
    setGuardando(false);

    setEntrada("");
    setSalida("");
    setReferencia("");
    setFoto(null);
    if (fotoNuevaRef.current) fotoNuevaRef.current.value = "";
    setMsg(
      avisoFoto
        ? { tipo: "error", texto: `Renglón guardado, pero la foto no se pudo adjuntar (${avisoFoto}). Agrégala desde el renglón.` }
        : { tipo: "ok", texto: "Renglón guardado." }
    );
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
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setEtiquetaAbierta(true)}
              className="flex items-center gap-1.5 border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2 hover:bg-gigante-bg"
            >
              <Tag size={14} /> Etiqueta amarilla
            </button>
            <button
              onClick={() => setConteoAbierto(true)}
              className="flex items-center gap-1.5 border border-gigante-border text-gigante-navy text-xs font-medium rounded-lg px-3 py-2 hover:bg-gigante-bg"
            >
              <ClipboardCheck size={14} /> Conteo físico
            </button>
          </div>
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
        <table className="w-full text-xs border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gigante-bg text-gigante-navy">
              <th className={`${celda} text-left w-24`}>Fecha</th>
              <th className={`${celda} text-left`}>Nombre</th>
              <th className={`${celda} text-right w-20`}>Entrada</th>
              <th className={`${celda} text-right w-20`}>Salida</th>
              <th className={`${celda} text-right w-24`}>Existencia</th>
              {puedeAnular && <th className={`${celda} w-16`}></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={puedeAnular ? 6 : 5} className={`${celda} text-gigante-muted`}>
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
                  {puedeAnular && <td className={celda}></td>}
                </tr>
                {filas.map(({ e, existencia }) => (
                  <tr key={e.id} className={e.anulado ? "bg-gigante-bg text-gigante-muted" : ""}>
                    <td className={`${celda} ${e.anulado ? "line-through" : ""}`}>{fechaCorta(e.fecha)}</td>
                    <td className={celda}>
                      <span className={`font-medium ${e.anulado ? "line-through" : "text-gigante-navy"}`}>
                        {nameFor(e.created_by)}
                      </span>
                      <span className={`block text-[11px] text-gigante-muted ${e.anulado ? "line-through" : ""}`}>
                        {e.detalle}
                        {e.referencia ? ` · ${e.referencia}` : ""}
                      </span>
                      {puedeFoto && e.fotoPath && (
                        <button
                          onClick={() => abrirFoto(e.fotoPath as string)}
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gigante-navy underline"
                        >
                          <Paperclip size={11} /> Ver foto de apoyo
                        </button>
                      )}
                      {puedeFoto && !e.fotoPath && e.movId && !e.anulado && (e.tipoMov === "entrada" || e.tipoMov === "salida") && (
                        <button
                          onClick={() => {
                            setMovParaFoto(e.movId);
                            fotoFilaRef.current?.click();
                          }}
                          className="mt-0.5 ml-0 block text-[11px] text-gigante-muted underline"
                        >
                          + Agregar foto
                        </button>
                      )}
                      {e.anulado && (
                        <span className="block text-[11px] text-gigante-red">
                          Anulado por {nameFor(e.anulado.por)} el {fechaCorta(e.anulado.fecha)}: {e.anulado.motivo}
                        </span>
                      )}
                    </td>
                    <td className={`${celda} text-right text-emerald-700 font-semibold`}>
                      {e.delta > 0 ? fmt(e.delta) : ""}
                    </td>
                    <td className={`${celda} text-right text-gigante-red font-semibold`}>
                      {e.delta < 0 ? fmt(Math.abs(e.delta)) : ""}
                    </td>
                    <td className={`${celda} text-right font-semibold text-gigante-navy`}>{fmt(existencia)}</td>
                    {puedeAnular && (
                      <td className={celda}>
                        {e.movId && !e.anulado && (e.tipoMov === "entrada" || e.tipoMov === "salida") && (
                          <button
                            onClick={() => anular(e.movId as string)}
                            className="text-[11px] text-gigante-red underline"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    )}
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
                  {puedeAnular && <td className={celda}></td>}
                </tr>
                <tr>
                  <td colSpan={puedeAnular ? 6 : 5} className={celda}>
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
                    {puedeFoto && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => fotoNuevaRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-xs font-medium border border-gigante-border rounded-lg px-2.5 py-1.5 text-gigante-navy bg-white"
                        >
                          <Camera size={13} /> {foto ? "Cambiar foto" : "Foto de apoyo (opcional)"}
                        </button>
                        {foto && (
                          <>
                            {vistaFoto && <img src={vistaFoto} alt="Vista previa" className="h-10 w-10 rounded object-cover border border-gigante-border" />}
                            <span className="text-[11px] text-gigante-muted truncate max-w-[200px]">{foto.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFoto(null);
                                if (fotoNuevaRef.current) fotoNuevaRef.current.value = "";
                              }}
                              className="text-[11px] text-gigante-red underline"
                            >
                              Quitar
                            </button>
                          </>
                        )}
                        {foto && !product.foto_path && (
                          <label className="basis-full flex items-center gap-1.5 text-[11px] text-gigante-navy">
                            <input
                              type="checkbox"
                              checked={fotoEsDelProducto}
                              onChange={(e) => setFotoEsDelProducto(e.target.checked)}
                            />
                            Usar también como foto del producto (aparece junto al nombre)
                          </label>
                        )}
                        <input
                          ref={fotoNuevaRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                        />
                      </div>
                    )}
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

      <input
        ref={fotoFilaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => adjuntarAFila(e.target.files?.[0])}
      />

      {etiquetaAbierta && <EtiquetaKardexModal product={product} onClose={() => setEtiquetaAbierta(false)} />}

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
