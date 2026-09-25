import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tags,
  Upload,
  Printer,
  CheckCheck,
  Percent,
  MapPin,
  History,
  FileSpreadsheet,
  ArrowRight,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import { useProfiles } from "../../hooks/useProfiles";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  useLabelQueue,
  useStoreZones,
  useDiscountRules,
  useLabelBatches,
  marcarEtiquetas,
  aplicarActualizacion,
  guardarReglas,
  guardarZona,
  borrarZona,
  asignarZona,
  asignarTamanoEtiqueta,
  type FilaActualizacion,
} from "../../hooks/useEtiquetas";
import { leerExcel, detectarColumnas, type CampoExcel, type HojaLeida } from "../../lib/excel";
import {
  agruparPorTamano,
  prepararLote,
  tamanoAutomatico,
  TAMANO_LABELS,
  TAMANO_USO,
  TAMANOS,
  type TamanoEtiqueta,
} from "../../lib/etiquetasLote";
import {
  ROTACION_LABELS,
  productoId,
  productoCoincide,
  type LabelQueueItem,
  type Product,
  type ProductRotacion,
  type ResultadoActualizacion,
} from "../../types";

const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rotLabel = (r: string | null | undefined) => (r ? ROTACION_LABELS[r as ProductRotacion] ?? r : "—");
const ROTACIONES: ProductRotacion[] = ["incorporacion", "rapido", "medio", "lento", "muy_lento", "obsoleto"];

type Tab = "cambiar" | "excel" | "reglas" | "zonas" | "historial";

function descripcionCambio(q: LabelQueueItem): string[] {
  const partes: string[] = [];
  if (q.rotacion_antes !== q.rotacion_despues) partes.push(`${rotLabel(q.rotacion_antes)} → ${rotLabel(q.rotacion_despues)}`);
  if (Number(q.precio_antes) !== Number(q.precio_despues)) partes.push(`Precio ${money(q.precio_antes)} → ${money(q.precio_despues)}`);
  if (Number(q.descuento_antes) !== Number(q.descuento_despues))
    partes.push(`Descuento ${Number(q.descuento_antes ?? 0)}% → ${Number(q.descuento_despues ?? 0)}%`);
  return partes;
}

// ============================================================ Etiquetas por cambiar
function PorCambiar({ esGerencia }: { esGerencia: boolean }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { items, loading, error, reload } = useLabelQueue();
  const { zonas } = useStoreZones();
  const { nameFor } = useProfileNames();
  const misZonas = useMemo(() => zonas.filter((z) => z.vendedor_id === profile?.id).map((z) => z.id), [zonas, profile]);
  const [zonaFiltro, setZonaFiltro] = useState<string>("todas");
  // Cuando cargan las zonas, el vendedor ve directo las suyas.
  const eligio = useRef(false);
  useEffect(() => {
    if (!eligio.current && misZonas.length > 0) setZonaFiltro("mias");
  }, [misZonas]);
  const [estado, setEstado] = useState<"abiertas" | "colocada">("abiertas");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    return items.filter((q) => {
      if (estado === "abiertas" ? q.estado === "colocada" : q.estado !== "colocada") return false;
      const z = q.product?.zona_id ?? null;
      if (zonaFiltro === "mias") return z !== null && misZonas.includes(z);
      if (zonaFiltro === "sin") return z === null;
      if (zonaFiltro !== "todas") return z === zonaFiltro;
      return true;
    });
  }, [items, estado, zonaFiltro, misZonas]);

  const avance = useMemo(() => {
    const porZona = new Map<string, { pend: number; imp: number; col: number }>();
    for (const q of items) {
      const k = q.product?.zona_id ?? "sin";
      const a = porZona.get(k) ?? { pend: 0, imp: 0, col: 0 };
      if (q.estado === "pendiente") a.pend++;
      else if (q.estado === "impresa") a.imp++;
      else a.col++;
      porZona.set(k, a);
    }
    return porZona;
  }, [items]);

  const seleccionadas = filtradas.filter((q) => sel.has(q.id));
  const todasSel = filtradas.length > 0 && filtradas.every((q) => sel.has(q.id));

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Las seleccionadas, separadas por tamaño de hoja (carta, media, 1/4, 1/8).
  const grupos = useMemo(() => agruparPorTamano(seleccionadas, (q) => q.product), [seleccionadas]);

  async function imprimir(tamano: TamanoEtiqueta, grupo: typeof seleccionadas) {
    const productos = grupo.map((q) => q.product).filter(Boolean) as Product[];
    if (productos.length === 0) return;
    await marcarEtiquetas(
      grupo.filter((q) => q.estado === "pendiente").map((q) => q.id),
      "impresa"
    );
    navigate(prepararLote(productos, tamano));
  }

  async function cambiarTamano(productId: string, valor: string) {
    setErr(null);
    const { error: e } = await asignarTamanoEtiqueta([productId], valor || null);
    if (e) {
      return setErr(
        e.includes("asignar_tamano_etiqueta") ? `${e} — ¿ya corriste la migración 0032 en Supabase?` : e
      );
    }
    reload();
  }

  async function colocar() {
    setErr(null);
    const { n, error: e } = await marcarEtiquetas(seleccionadas.map((q) => q.id), "colocada");
    if (e) return setErr(e);
    setMsg(`✅ ${n} etiqueta(s) marcadas como colocadas.`);
    setSel(new Set());
    reload();
  }

  const chips: { key: string; label: string }[] = [
    ...(misZonas.length > 0 ? [{ key: "mias", label: "Mis zonas" }] : []),
    { key: "todas", label: "Todas" },
    ...zonas.map((z) => ({ key: z.id, label: z.nombre })),
    { key: "sin", label: "Sin zona" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...zonas.map((z) => ({ id: z.id, nombre: z.nombre, vendedor: z.vendedor_id })), { id: "sin", nombre: "Sin zona", vendedor: null }].map(
          (z) => {
            const a = avance.get(z.id) ?? { pend: 0, imp: 0, col: 0 };
            const total = a.pend + a.imp + a.col;
            if (z.id === "sin" && total === 0) return null;
            const pct = total > 0 ? Math.round((a.col / total) * 100) : 100;
            return (
              <button
                key={z.id}
                onClick={() => setZonaFiltro(z.id)}
                className={`text-left bg-white border rounded-xl p-3 ${zonaFiltro === z.id ? "border-gigante-navy ring-1 ring-gigante-navy" : "border-gigante-border"}`}
              >
                <p className="text-sm font-semibold text-gigante-navy truncate">{z.nombre}</p>
                <p className="text-[11px] text-gigante-muted truncate">{z.vendedor ? nameFor(z.vendedor) : "Sin vendedor asignado"}</p>
                <p className="text-xs mt-1">
                  <span className="text-gigante-red font-semibold">{a.pend} por imprimir</span>
                  {a.imp > 0 && <span className="text-amber-700"> · {a.imp} por colocar</span>}
                </p>
                <div className="h-1.5 rounded-full bg-gigante-bg overflow-hidden mt-1.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          }
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              eligio.current = true;
              setZonaFiltro(c.key);
              setSel(new Set());
            }}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              zonaFiltro === c.key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="mx-1 text-gigante-border">|</span>
        <button
          onClick={() => {
            setEstado("abiertas");
            setSel(new Set());
          }}
          className={`text-xs rounded-full px-3 py-1.5 border ${estado === "abiertas" ? "bg-gigante-red text-white border-gigante-red" : "border-gigante-border bg-white"}`}
        >
          Por cambiar
        </button>
        <button
          onClick={() => {
            setEstado("colocada");
            setSel(new Set());
          }}
          className={`text-xs rounded-full px-3 py-1.5 border ${estado === "colocada" ? "bg-gigante-red text-white border-gigante-red" : "border-gigante-border bg-white"}`}
        >
          Ya colocadas (30 días)
        </button>
      </div>

      {(error || err) && (
        <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error ?? err}
          {error?.includes("label_queue") && " — ¿ya corriste la migración 0031 en Supabase?"}
        </p>
      )}
      {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}

      {estado === "abiertas" && (
        <div className="sticky top-14 z-10 bg-gigante-bg py-2 flex flex-wrap items-center gap-2">
          {grupos.length === 0 ? (
            <button
              disabled
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-red opacity-40 rounded-lg px-4 py-2"
            >
              <Printer size={15} /> Imprimir seleccionadas
            </button>
          ) : (
            grupos.map((g) => (
              <button
                key={g.tamano}
                onClick={() => imprimir(g.tamano, g.items)}
                title={TAMANO_USO[g.tamano]}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-red rounded-lg px-4 py-2"
              >
                <Printer size={15} /> Imprimir {g.items.length} · {TAMANO_LABELS[g.tamano]}
              </button>
            ))
          )}
          <button
            onClick={colocar}
            disabled={seleccionadas.length === 0}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gigante-navy border border-gigante-border bg-white disabled:opacity-40 rounded-lg px-4 py-2"
          >
            <CheckCheck size={15} /> Ya las coloqué
          </button>
          <span className="text-xs text-gigante-muted">
            Roja = tiene descuento (precio de antes tachado y %). Azul = precio normal.
            {grupos.length > 1 && " Se imprime un tamaño a la vez: imprime uno, regresa y dale al siguiente."}
          </span>
        </div>
      )}

      <div className="bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : filtradas.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">
            {estado === "abiertas" ? "✅ No hay etiquetas por cambiar aquí." : "Todavía no hay etiquetas colocadas."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  {estado === "abiertas" && (
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={todasSel}
                        onChange={() => setSel(todasSel ? new Set() : new Set(filtradas.map((q) => q.id)))}
                        aria-label="Seleccionar todas"
                      />
                    </th>
                  )}
                  <th className="text-left font-medium px-3 py-3">ID</th>
                  <th className="text-left font-medium px-3 py-3">Producto</th>
                  <th className="text-left font-medium px-3 py-3">Qué cambió</th>
                  <th className="text-right font-medium px-3 py-3">Precio en etiqueta</th>
                  <th className="text-left font-medium px-3 py-3">Etiqueta</th>
                  <th className="text-left font-medium px-3 py-3">Tamaño</th>
                  <th className="text-left font-medium px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((q) => {
                  const p = q.product;
                  const desc = Number(p?.descuento_porcentaje ?? 0);
                  const final = Number(p?.unit_price ?? 0) * (1 - desc / 100);
                  return (
                    <tr key={q.id} className="border-t border-gigante-border align-top">
                      {estado === "abiertas" && (
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={sel.has(q.id)} onChange={() => toggle(q.id)} aria-label="Seleccionar" />
                        </td>
                      )}
                      <td className="px-3 py-3 font-semibold text-gigante-navy whitespace-nowrap">{p ? productoId(p) || p.code : "—"}</td>
                      <td className="px-3 py-3 text-gigante-navy">
                        {p?.name}
                        <span className="block text-[11px] text-gigante-muted">
                          {p?.code} · {p?.brand}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gigante-navy">
                        {descripcionCambio(q).map((d) => (
                          <span key={d} className="block">
                            {d}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {desc > 0 && <span className="block text-[11px] text-gigante-muted line-through">{money(p?.unit_price)}</span>}
                        <span className="font-semibold text-gigante-navy">{money(final)}</span>
                        {desc > 0 && <span className="block text-[11px] font-semibold text-gigante-red">-{desc}%</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[11px] font-semibold rounded-full px-2 py-1 text-white ${desc > 0 ? "bg-[#C41230]" : "bg-[#0E1E42]"}`}
                        >
                          {desc > 0 ? "Roja" : "Azul"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {p && (
                          <select
                            value={p.tamano_etiqueta ?? ""}
                            onChange={(e) => cambiarTamano(p.id, e.target.value)}
                            aria-label="Tamaño de etiqueta"
                            className="text-xs rounded-lg border border-gigante-border bg-white px-2 py-1"
                          >
                            <option value="">{TAMANO_LABELS[tamanoAutomatico(p)]} (auto)</option>
                            {TAMANOS.map((t) => (
                              <option key={t} value={t}>
                                {TAMANO_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {q.estado === "pendiente" && <span className="text-gigante-red font-medium">Por imprimir</span>}
                        {q.estado === "impresa" && <span className="text-amber-700 font-medium">Impresa, por colocar</span>}
                        {q.estado === "colocada" && (
                          <span className="text-emerald-700">
                            Colocada por {nameFor(q.colocada_por)}
                            {q.colocada_at && ` · ${new Date(q.colocada_at).toLocaleDateString("es-MX")}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {esGerencia && (
        <p className="text-[11px] text-gigante-muted">
          Cualquier cambio de precio, descuento o rotación (desde el Excel o a mano en Inventario) manda el producto aquí solo.
        </p>
      )}
    </div>
  );
}

// ============================================================ Subir Excel
const CAMPOS: { key: CampoExcel; label: string; obligatorio: boolean }[] = [
  { key: "id", label: "ID del producto", obligatorio: true },
  { key: "rotacion", label: "Rotación (rápido, lento...)", obligatorio: false },
  { key: "precio", label: "Precio (si viene)", obligatorio: false },
  { key: "descuento", label: "% de descuento (si viene)", obligatorio: false },
  { key: "sucursal", label: "Sucursal (si el Excel trae varias)", obligatorio: false },
];

function SubirExcel({ onAplicado }: { onAplicado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [hoja, setHoja] = useState<HojaLeida | null>(null);
  const [cols, setCols] = useState<Record<CampoExcel, number>>({ id: -1, rotacion: -1, precio: -1, descuento: -1, sucursal: -1 });
  const [sucursal, setSucursal] = useState("");

  // Valores distintos de la columna "Sucursal" (para quedarse solo con Perote).
  const sucursales = useMemo(() => {
    if (!hoja || cols.sucursal < 0) return [];
    return Array.from(new Set(hoja.filas.map((r) => (r[cols.sucursal] ?? "").toString().trim()).filter(Boolean))).sort();
  }, [hoja, cols.sucursal]);

  useEffect(() => {
    if (sucursales.length === 0) return setSucursal("");
    const perote = sucursales.find((s) => s.toLowerCase().includes("perote"));
    setSucursal(perote ?? "");
  }, [sucursales]);
  const [simulacion, setSimulacion] = useState<ResultadoActualizacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoActualizacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(f: File | null) {
    setArchivo(f);
    setHoja(null);
    setSimulacion(null);
    setResultado(null);
    setError(null);
    if (!f) return;
    try {
      const h = await leerExcel(f);
      setHoja(h);
      setCols(detectarColumnas(h.encabezados));
    } catch {
      setError("No pude leer ese archivo. Guárdalo como .xlsx o .csv e inténtalo otra vez.");
    }
  }

  function filas(): FilaActualizacion[] {
    if (!hoja) return [];
    const val = (r: string[], k: CampoExcel) => (cols[k] >= 0 ? (r[cols[k]] ?? "").toString().trim() : undefined);
    return hoja.filas
      .filter((r) => cols.sucursal < 0 || !sucursal || (r[cols.sucursal] ?? "").toString().trim() === sucursal)
      .map((r) => ({ id: val(r, "id") ?? "", rotacion: val(r, "rotacion"), precio: val(r, "precio"), descuento: val(r, "descuento") }))
      .filter((f) => f.id !== "");
  }

  async function revisar() {
    setError(null);
    if (cols.id < 0) return setError("Dime cuál columna es el ID.");
    if (cols.sucursal >= 0 && !sucursal) return setError("Elige de qué sucursal son los datos (Perote).");
    if (cols.rotacion < 0 && cols.precio < 0 && cols.descuento < 0)
      return setError("Elige al menos una columna para actualizar: rotación, precio o descuento.");
    setTrabajando(true);
    const { resultado: r, error: e } = await aplicarActualizacion(archivo?.name ?? "Excel", filas(), true);
    setTrabajando(false);
    if (e) return setError(e);
    setSimulacion(r);
  }

  async function aplicar() {
    setTrabajando(true);
    const { resultado: r, error: e } = await aplicarActualizacion(archivo?.name ?? "Excel", filas(), false);
    setTrabajando(false);
    if (e) return setError(e);
    setResultado(r);
    setSimulacion(null);
    onAplicado();
  }

  const r = resultado ?? simulacion;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
        Sube el Excel tal como les llega (.xlsx, .xls o .csv). Solo necesita la columna de <strong>ID</strong> y la de{" "}
        <strong>rotación</strong>; si trae precio o % de descuento también se usan. Primero verás qué va a cambiar y nada se
        guarda hasta que confirmes.
      </div>

      <label className="flex items-center gap-3 border-2 border-dashed border-gigante-border rounded-xl px-4 py-6 cursor-pointer bg-white hover:border-gigante-navy">
        <FileSpreadsheet size={28} className="text-emerald-700" />
        <div>
          <p className="text-sm font-semibold text-gigante-navy">{archivo ? archivo.name : "Elegir el Excel de rotación"}</p>
          <p className="text-xs text-gigante-muted">
            {hoja ? `${hoja.filas.length} filas encontradas` : "Toca para buscar el archivo en tu computadora"}
          </p>
        </div>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
      </label>

      {hoja && (
        <div className="bg-white border border-gigante-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gigante-navy">1. Revisa qué columna es cada cosa</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <label key={c.key} className="text-xs text-gigante-navy">
                {c.label}
                {c.obligatorio && " *"}
                <select
                  value={cols[c.key]}
                  onChange={(e) => {
                    setCols((prev) => ({ ...prev, [c.key]: Number(e.target.value) }));
                    setSimulacion(null);
                  }}
                  className="mt-1 w-full rounded-lg border border-gigante-border px-2 py-2 text-sm"
                >
                  <option value={-1}>{c.obligatorio ? "— Elige —" : "No viene en el Excel"}</option>
                  {hoja.encabezados.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Columna ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {cols.sucursal >= 0 && (
            <label className="block text-xs text-gigante-navy">
              Usar solo las filas de la sucursal:
              <select
                value={sucursal}
                onChange={(e) => {
                  setSucursal(e.target.value);
                  setSimulacion(null);
                }}
                className="mt-1 w-full sm:w-80 rounded-lg border border-gigante-border px-2 py-2 text-sm"
              >
                <option value="">— Elige —</option>
                {sucursales.map((s) => (
                  <option key={s} value={s}>
                    {s} ({hoja.filas.filter((r) => (r[cols.sucursal] ?? "").toString().trim() === s).length} filas)
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="overflow-x-auto border border-gigante-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gigante-bg text-gigante-muted">
                <tr>
                  {CAMPOS.filter((c) => cols[c.key] >= 0).map((c) => (
                    <th key={c.key} className="text-left font-medium px-2 py-1.5">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hoja.filas
                  .filter((r) => cols.sucursal < 0 || !sucursal || (r[cols.sucursal] ?? "").toString().trim() === sucursal)
                  .slice(0, 5)
                  .map((f, i) => (
                  <tr key={i} className="border-t border-gigante-border">
                    {CAMPOS.filter((c) => cols[c.key] >= 0).map((c) => (
                      <td key={c.key} className="px-2 py-1.5">
                        {f[cols[c.key]]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!resultado && (
            <button
              onClick={revisar}
              disabled={trabajando}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-navy rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {trabajando && !simulacion ? "Revisando..." : "2. Ver qué va a cambiar"} <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}

      {r && (
        <div className="bg-white border border-gigante-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gigante-navy">
            {resultado ? "✅ Actualización aplicada" : "3. Esto es lo que va a cambiar"}
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gigante-bg rounded-lg p-3">
              <p className="text-2xl font-bold text-gigante-red">{r.cambiados}</p>
              <p className="text-[11px] text-gigante-muted">cambian (etiqueta nueva)</p>
            </div>
            <div className="bg-gigante-bg rounded-lg p-3">
              <p className="text-2xl font-bold text-gigante-navy">{r.sin_cambio}</p>
              <p className="text-[11px] text-gigante-muted">se quedan igual</p>
            </div>
            <div className="bg-gigante-bg rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-700">{r.no_encontrados.length}</p>
              <p className="text-[11px] text-gigante-muted">ID no encontrados</p>
            </div>
          </div>
          {r.no_encontrados.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              Estos ID no están en el inventario de la sucursal (se ignoran): {r.no_encontrados.slice(0, 40).join(", ")}
              {r.no_encontrados.length > 40 && ` y ${r.no_encontrados.length - 40} más`}.
            </p>
          )}
          {r.rotaciones_no_reconocidas.length > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              No entendí la rotación de: {r.rotaciones_no_reconocidas.slice(0, 20).join(" · ")} (se deja la que tenían).
            </p>
          )}
          {r.detalle.length > 0 && (
            <div className="overflow-x-auto border border-gigante-border rounded-lg max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gigante-bg text-gigante-muted sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-2 py-1.5">ID</th>
                    <th className="text-left font-medium px-2 py-1.5">Producto</th>
                    <th className="text-left font-medium px-2 py-1.5">Rotación</th>
                    <th className="text-right font-medium px-2 py-1.5">Precio</th>
                    <th className="text-right font-medium px-2 py-1.5">Descuento</th>
                    <th className="text-right font-medium px-2 py-1.5">Precio final</th>
                  </tr>
                </thead>
                <tbody>
                  {r.detalle.map((d) => (
                    <tr key={d.id} className="border-t border-gigante-border">
                      <td className="px-2 py-1.5 font-semibold">{d.id}</td>
                      <td className="px-2 py-1.5">{d.nombre}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {rotLabel(d.rotacion_antes)} → <strong>{rotLabel(d.rotacion_despues)}</strong>
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {Number(d.precio_antes) !== Number(d.precio_despues) ? (
                          <>
                            {money(d.precio_antes)} → <strong>{money(d.precio_despues)}</strong>
                          </>
                        ) : (
                          money(d.precio_despues)
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {Number(d.descuento_antes)}% → <strong>{Number(d.descuento_despues)}%</strong>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold whitespace-nowrap">
                        {money(Number(d.precio_despues) * (1 - Number(d.descuento_despues) / 100))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!resultado ? (
            <div className="flex gap-2">
              <button
                onClick={aplicar}
                disabled={trabajando || r.cambiados === 0}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-red rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {trabajando ? "Aplicando..." : `4. Aplicar y crear ${r.cambiados} etiqueta(s)`}
              </button>
              <button onClick={() => setSimulacion(null)} className="text-sm text-gigante-muted px-3">
                Cancelar
              </button>
            </div>
          ) : (
            <p className="text-sm text-emerald-800">
              Listo. A los vendedores les llegó el aviso; ya pueden imprimir sus etiquetas en “Por cambiar”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================ Reglas de descuento
function Reglas({ onAplicado }: { onAplicado: () => void }) {
  const { reglas, loading, reload } = useDiscountRules();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [aplicar, setAplicar] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valor = (r: ProductRotacion) =>
    valores[r] ?? String(reglas.find((x) => x.rotacion === r)?.descuento ?? 0);

  async function guardar() {
    setErr(null);
    setMsg(null);
    const lista = ROTACIONES.map((r) => ({ rotacion: r, descuento: Number(valor(r)) || 0 }));
    if (lista.some((x) => x.descuento < 0 || x.descuento > 100)) return setErr("Cada descuento debe ir de 0 a 100.");
    const { aplicados, error } = await guardarReglas(lista, aplicar);
    if (error) return setErr(error);
    setMsg(aplicar ? `Reglas guardadas y aplicadas: ${aplicados} producto(s) cambiaron de descuento y ya están en “Por cambiar”.` : "Reglas guardadas.");
    setValores({});
    reload();
    onAplicado();
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-gigante-muted">
        Qué % de descuento le toca a cada rotación. Se usa cuando el Excel no trae la columna de descuento.
      </p>
      <div className="bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border">
        {loading ? (
          <p className="p-4 text-sm text-gigante-muted">Cargando...</p>
        ) : (
          ROTACIONES.map((r) => (
            <div key={r} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gigante-navy">{ROTACION_LABELS[r]}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={valor(r)}
                  onChange={(e) => setValores((prev) => ({ ...prev, [r]: e.target.value }))}
                  className="w-20 rounded-lg border border-gigante-border px-2 py-1.5 text-sm text-right"
                />
                <Percent size={14} className="text-gigante-muted" />
              </div>
            </div>
          ))
        )}
      </div>
      <label className="flex items-start gap-2 text-sm text-gigante-navy">
        <input type="checkbox" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} className="mt-1" />
        <span>
          Aplicar también ahora a todos los productos que ya tienen esa rotación{" "}
          <span className="text-xs text-gigante-muted">(los que cambien de descuento pasan a “Por cambiar”).</span>
        </span>
      </label>
      {err && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{err}</p>}
      {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      <button onClick={guardar} className="text-sm font-semibold text-white bg-gigante-red rounded-lg px-4 py-2">
        Guardar reglas
      </button>
    </div>
  );
}

// ============================================================ Zonas
function Zonas() {
  const { zonas, reload: reloadZonas } = useStoreZones();
  const { profiles } = useProfiles();
  const { products, reload: reloadProducts } = useProducts();
  const vendedores = profiles.filter((p) => p.active && (p.role === "ventas" || p.role === "gerencia"));
  const [nueva, setNueva] = useState("");
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [filtroZona, setFiltroZona] = useState("todas");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const categorias = useMemo(() => ["Todas", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const lista = useMemo(
    () =>
      products.filter(
        (p) =>
          productoCoincide(p, buscar) &&
          (categoria === "Todas" || p.category === categoria) &&
          (filtroZona === "todas" || (filtroZona === "sin" ? !p.zona_id : p.zona_id === filtroZona))
      ),
    [products, buscar, categoria, filtroZona]
  );
  const todos = lista.length > 0 && lista.every((p) => sel.has(p.id));
  const nombreZona = (id: string | null) => zonas.find((z) => z.id === id)?.nombre ?? "Sin zona";

  async function asignar() {
    setErr(null);
    if (sel.size === 0) return setErr("Selecciona productos.");
    const { n, error } = await asignarZona(Array.from(sel), destino || null);
    if (error) return setErr(error);
    setMsg(`${n} producto(s) asignados a ${destino ? nombreZona(destino) : "Sin zona"}.`);
    setSel(new Set());
    reloadProducts();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gigante-navy mb-2">Zonas de la tienda y quién las atiende</p>
        <div className="bg-white border border-gigante-border rounded-xl divide-y divide-gigante-border max-w-2xl">
          {zonas.map((z) => (
            <div key={z.id} className="flex items-center gap-2 px-4 py-3 flex-wrap">
              <MapPin size={15} className="text-gigante-red" />
              <span className="text-sm text-gigante-navy flex-1 min-w-[8rem]">{z.nombre}</span>
              <span className="text-[11px] text-gigante-muted">{products.filter((p) => p.zona_id === z.id).length} productos</span>
              <select
                value={z.vendedor_id ?? ""}
                onChange={async (e) => {
                  await guardarZona({ id: z.id, nombre: z.nombre, vendedor_id: e.target.value || null, orden: z.orden });
                  reloadZonas();
                }}
                className="rounded-lg border border-gigante-border px-2 py-1.5 text-xs"
              >
                <option value="">Sin vendedor</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!window.confirm(`¿Borrar la zona “${z.nombre}”? Sus productos quedan sin zona.`)) return;
                  await borrarZona(z.id);
                  reloadZonas();
                  reloadProducts();
                }}
                className="text-gigante-muted hover:text-gigante-red"
                aria-label="Borrar zona"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva zona (ej. Exhibidor de baños)"
              className="flex-1 rounded-lg border border-gigante-border px-3 py-1.5 text-sm"
            />
            <button
              onClick={async () => {
                if (!nueva.trim()) return;
                const { error } = await guardarZona({ nombre: nueva.trim(), vendedor_id: null, orden: zonas.length + 1 });
                if (error) setErr(error);
                setNueva("");
                reloadZonas();
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-navy rounded-lg px-3 py-1.5"
            >
              <Plus size={13} /> Agregar
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-gigante-navy mb-1">Asignar productos a una zona</p>
        <p className="text-xs text-gigante-muted mb-2">
          Se hace una sola vez. Filtra (por ejemplo, la categoría que está en esa pared), selecciona todos y asígnalos.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por ID, código, nombre o marca..."
            className="flex-1 min-w-[12rem] rounded-lg border border-gigante-border px-3 py-2 text-sm"
          />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-gigante-border px-2 py-2 text-sm">
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)} className="rounded-lg border border-gigante-border px-2 py-2 text-sm">
            <option value="todas">Zona: todas</option>
            <option value="sin">Sin zona</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs text-gigante-muted">{sel.size} seleccionados →</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="rounded-lg border border-gigante-border px-2 py-1.5 text-sm">
            <option value="">Sin zona</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
          <button onClick={asignar} className="text-sm font-semibold text-white bg-gigante-red rounded-lg px-3 py-1.5">
            Asignar
          </button>
        </div>
        {err && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mb-2">{err}</p>}
        {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 mb-2">{msg}</p>}
        <div className="bg-white border border-gigante-border rounded-xl overflow-hidden max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gigante-bg text-gigante-muted text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={todos}
                    onChange={() => setSel(todos ? new Set() : new Set(lista.map((p) => p.id)))}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className="text-left font-medium px-3 py-2">ID</th>
                <th className="text-left font-medium px-3 py-2">Producto</th>
                <th className="text-left font-medium px-3 py-2">Categoría</th>
                <th className="text-left font-medium px-3 py-2">Zona actual</th>
              </tr>
            </thead>
            <tbody>
              {lista.slice(0, 1000).map((p) => (
                <tr key={p.id} className="border-t border-gigante-border">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={sel.has(p.id)}
                      onChange={() =>
                        setSel((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-gigante-navy">{productoId(p) || p.code}</td>
                  <td className="px-3 py-2 text-gigante-navy">{p.name}</td>
                  <td className="px-3 py-2 text-gigante-muted">{p.category}</td>
                  <td className="px-3 py-2 text-gigante-muted">{nombreZona(p.zona_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================ Historial
function Historial() {
  const { lotes } = useLabelBatches();
  const { nameFor } = useProfileNames();
  return (
    <div className="bg-white border border-gigante-border rounded-xl overflow-hidden max-w-3xl">
      {lotes.length === 0 ? (
        <p className="p-6 text-sm text-gigante-muted">Todavía no se ha subido ninguna actualización.</p>
      ) : (
        <ul className="divide-y divide-gigante-border">
          {lotes.map((l) => (
            <li key={l.id} className="px-4 py-3 text-sm">
              <p className="text-gigante-navy font-medium">{l.nombre}</p>
              <p className="text-xs text-gigante-muted">
                {new Date(l.created_at).toLocaleString("es-MX")} · {nameFor(l.created_by)} · {l.filas > 0 && `${l.filas} filas · `}
                {l.actualizados} cambiaron
                {l.no_encontrados.length > 0 && ` · ${l.no_encontrados.length} ID no encontrados`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================ Página
export default function PreciosEtiquetas() {
  const { profile } = useAuth();
  const esGerencia = profile?.role === "gerencia";
  const [tab, setTab] = useState<Tab>("cambiar");
  const [version, setVersion] = useState(0);

  const TABS: { key: Tab; label: string; icon: typeof Tags; show: boolean }[] = [
    { key: "cambiar", label: "Etiquetas por cambiar", icon: Printer, show: true },
    { key: "excel", label: "Subir Excel de rotación", icon: Upload, show: esGerencia },
    { key: "reglas", label: "Descuentos por rotación", icon: Percent, show: esGerencia },
    { key: "zonas", label: "Zonas y vendedores", icon: MapPin, show: esGerencia },
    { key: "historial", label: "Historial", icon: History, show: true },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Tags size={22} /> Precios y Etiquetas
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Sube el Excel de rotación, el sistema calcula precios y descuentos, y cada vendedor imprime solo las etiquetas de su
        zona que cambiaron.
      </p>

      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {TABS.filter((t) => t.show).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border ${
              tab === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        <button
          onClick={() => setVersion((v) => v + 1)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-gigante-muted hover:text-gigante-navy px-2"
          title="Actualizar"
        >
          <RotateCcw size={13} /> Actualizar
        </button>
      </div>

      <div className="mt-4" key={version}>
        {tab === "cambiar" && <PorCambiar esGerencia={esGerencia} />}
        {tab === "excel" && esGerencia && <SubirExcel onAplicado={() => undefined} />}
        {tab === "reglas" && esGerencia && <Reglas onAplicado={() => undefined} />}
        {tab === "zonas" && esGerencia && <Zonas />}
        {tab === "historial" && <Historial />}
      </div>
    </div>
  );
}
