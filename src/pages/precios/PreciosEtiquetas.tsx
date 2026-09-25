import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Tags,
  Upload,
  Printer,
  CheckCheck,
  Percent,
  Shuffle,
  Store,
  EyeOff,
  History,
  FileSpreadsheet,
  ArrowRight,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProducts } from "../../hooks/useInventory";
import ExhibicionModal from "../../components/inventario/ExhibicionModal";
import { useProfiles } from "../../hooks/useProfiles";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  useLabelQueue,
  useDiscountRules,
  useLabelBatches,
  marcarEtiquetas,
  aplicarActualizacion,
  guardarReglas,
  repartirEtiquetas,
  reasignarEtiquetas,
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

type Tab = "cambiar" | "excel" | "reglas" | "historial";

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
  const { profiles } = useProfiles();
  const { nameFor } = useProfileNames();
  const nombreCorto = (id: string | null | undefined) => profiles.find((p) => p.id === id)?.full_name ?? nameFor(id);

  // A quiénes se les puede repartir: Ventas y Gerencia activos.
  const posibles = useMemo(
    () => profiles.filter((p) => p.active && (p.role === "ventas" || p.role === "gerencia")),
    [profiles]
  );

  // Solo se imprime lo que está exhibido en tienda. Lo que no, se queda en
  // "Revisar exhibición" para no gastar papel en algo que no está a la vista.
  const exhibido = (q: LabelQueueItem) => q.product?.exhibido !== false;
  const abiertas = useMemo(() => items.filter((q) => q.estado !== "colocada" && exhibido(q)), [items]);
  const porRevisar = useMemo(() => items.filter((q) => q.estado !== "colocada" && !exhibido(q)), [items]);
  const [exhibirId, setExhibirId] = useState<string | null>(null);
  const sinRepartir = abiertas.filter((q) => !q.asignado_a).length;
  const tengoAsignadas = abiertas.some((q) => q.asignado_a === profile?.id);

  const [filtro, setFiltro] = useState<string>("todas"); // "todas" | "mias" | "sin" | id de la persona
  // Si al vendedor ya le tocaron etiquetas, ve directo las suyas.
  const eligio = useRef(false);
  useEffect(() => {
    if (!eligio.current && tengoAsignadas) setFiltro("mias");
  }, [tengoAsignadas]);
  const [estado, setEstado] = useState<"abiertas" | "revisar" | "colocada">("abiertas");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ----- Reparto al azar -----
  const [repartiendo, setRepartiendo] = useState(false);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [todas, setTodas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    // De entrada se marcan los de Ventas (si no hay, todos los posibles).
    const ventas = posibles.filter((p) => p.role === "ventas");
    setElegidos(new Set((ventas.length > 0 ? ventas : posibles).map((p) => p.id)));
  }, [posibles]);
  const aRepartir = todas ? abiertas.filter((q) => !q.asignado_a || q.estado === "pendiente").length : sinRepartir;

  async function repartir() {
    setErr(null);
    setMsg(null);
    if (elegidos.size === 0) return setErr("Elige al menos a un vendedor.");
    setGuardando(true);
    const { data, error: e } = await repartirEtiquetas([...elegidos], todas);
    setGuardando(false);
    if (e) {
      return setErr(e.includes("repartir_etiquetas") ? `${e} — ¿ya corriste la migración 0033 en Supabase?` : e);
    }
    const detalle = Object.entries(data?.por_vendedor ?? {})
      .map(([n, c]) => `${n}: ${c}`)
      .join(" · ");
    setMsg(`✅ Se repartieron ${data?.repartidas ?? 0} etiqueta(s). ${detalle}`);
    setRepartiendo(false);
    eligio.current = true;
    setFiltro("todas");
    setSel(new Set());
    reload();
  }

  async function reasignar(id: string, persona: string) {
    setErr(null);
    const { error: e } = await reasignarEtiquetas([id], persona || null);
    if (e) return setErr(e);
    reload();
  }

  const filtradas = useMemo(() => {
    return items.filter((q) => {
      if (estado === "colocada") {
        if (q.estado !== "colocada") return false;
      } else {
        if (q.estado === "colocada") return false;
        if (estado === "revisar") return !exhibido(q);
        if (!exhibido(q)) return false;
      }
      if (filtro === "mias") return q.asignado_a === profile?.id;
      if (filtro === "sin") return !q.asignado_a;
      if (filtro !== "todas") return q.asignado_a === filtro;
      return true;
    });
  }, [items, estado, filtro, profile]);

  // Avance por persona (y "sin repartir").
  const avance = useMemo(() => {
    const m = new Map<string, { pend: number; imp: number; col: number }>();
    for (const q of items) {
      if (q.estado !== "colocada" && !exhibido(q)) continue;
      const k = q.asignado_a ?? "sin";
      const a = m.get(k) ?? { pend: 0, imp: 0, col: 0 };
      if (q.estado === "pendiente") a.pend++;
      else if (q.estado === "impresa") a.imp++;
      else a.col++;
      m.set(k, a);
    }
    return m;
  }, [items]);
  const personas = [...avance.keys()].filter((k) => k !== "sin");

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
    ...(tengoAsignadas ? [{ key: "mias", label: "Mías" }] : []),
    { key: "todas", label: "Todas" },
    ...personas.map((id) => ({ key: id, label: nombreCorto(id) })),
    ...(sinRepartir > 0 ? [{ key: "sin", label: "Sin repartir" }] : []),
  ];

  return (
    <div className="space-y-4">
      {estado === "abiertas" && (sinRepartir > 0 || repartiendo) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          {!repartiendo ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-amber-900 flex-1 min-w-[220px]">
                Hay <strong>{sinRepartir}</strong> etiqueta(s) sin repartir. Repártelas al azar y por partes iguales entre
                los vendedores.
              </p>
              <button
                onClick={() => setRepartiendo(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-navy rounded-lg px-4 py-2"
              >
                <Shuffle size={15} /> Repartir entre vendedores
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gigante-navy">¿Entre quiénes se reparten?</p>
              <div className="flex flex-wrap gap-2">
                {posibles.map((p) => (
                  <label
                    key={p.id}
                    className={`inline-flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${
                      elegidos.has(p.id) ? "border-gigante-navy bg-white" : "border-gigante-border bg-white/60 text-gigante-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={elegidos.has(p.id)}
                      onChange={() =>
                        setElegidos((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                    />
                    {p.full_name}
                    {p.puesto && <span className="text-[11px] text-gigante-muted">({p.puesto})</span>}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-gigante-navy">
                <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
                Volver a repartir también las que ya tenían dueño (solo las que falta imprimir)
              </label>
              <p className="text-xs text-gigante-muted">
                {elegidos.size > 0
                  ? `${aRepartir} etiqueta(s) entre ${elegidos.size} persona(s): a cada quien le tocan unas ${Math.ceil(
                      aRepartir / elegidos.size
                    )}.`
                  : "Elige al menos a una persona."}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={repartir}
                  disabled={guardando || elegidos.size === 0 || aRepartir === 0}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gigante-red disabled:opacity-40 rounded-lg px-4 py-2"
                >
                  <Shuffle size={15} /> {guardando ? "Repartiendo..." : "Repartir al azar"}
                </button>
                <button
                  onClick={() => setRepartiendo(false)}
                  className="text-sm text-gigante-navy border border-gigante-border bg-white rounded-lg px-4 py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {personas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {personas.map((id) => {
            const a = avance.get(id) ?? { pend: 0, imp: 0, col: 0 };
            const total = a.pend + a.imp + a.col;
            const pct = total > 0 ? Math.round((a.col / total) * 100) : 100;
            return (
              <button
                key={id}
                onClick={() => {
                  eligio.current = true;
                  setFiltro(id);
                  setSel(new Set());
                }}
                className={`text-left bg-white border rounded-xl p-3 ${filtro === id ? "border-gigante-navy ring-1 ring-gigante-navy" : "border-gigante-border"}`}
              >
                <p className="text-sm font-semibold text-gigante-navy truncate">
                  {nombreCorto(id)}
                  {id === profile?.id && <span className="text-[11px] font-normal text-gigante-muted"> (tú)</span>}
                </p>
                <p className="text-xs mt-1">
                  <span className="text-gigante-red font-semibold">{a.pend} por imprimir</span>
                  {a.imp > 0 && <span className="text-amber-700"> · {a.imp} por colocar</span>}
                </p>
                <p className="text-[11px] text-gigante-muted">
                  {a.col} de {total} colocadas
                </p>
                <div className="h-1.5 rounded-full bg-gigante-bg overflow-hidden mt-1.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              eligio.current = true;
              setFiltro(c.key);
              setSel(new Set());
            }}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              filtro === c.key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
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
        {porRevisar.length > 0 && (
          <button
            onClick={() => {
              setEstado("revisar");
              setSel(new Set());
            }}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              estado === "revisar" ? "bg-amber-600 text-white border-amber-600" : "border-amber-300 text-amber-800 bg-amber-50"
            }`}
          >
            Revisar exhibición ({porRevisar.length})
          </button>
        )}
        {estado === "abiertas" && sinRepartir === 0 && abiertas.length > 0 && !repartiendo && (
          <button
            onClick={() => setRepartiendo(true)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-gigante-muted hover:text-gigante-navy"
          >
            <Shuffle size={13} /> Volver a repartir
          </button>
        )}
      </div>

      {(error || err) && (
        <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error ?? err}
          {error?.includes("label_queue") && " — ¿ya corriste la migración 0031 en Supabase?"}
        </p>
      )}
      {msg && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}

      {estado === "revisar" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <p className="font-semibold">Estos productos cambiaron de precio o descuento, pero en el sistema NO están exhibidos.</p>
          <p className="text-xs mt-1">
            Antes de imprimir, revisa en la tienda: si sí está exhibido, dale <strong>“Ya está exhibido”</strong> y toma la
            foto; en cuanto quede confirmado, la etiqueta pasa sola a “Por cambiar”. Si no está exhibido, no se imprime nada
            (se imprimirá cuando lo exhiban). Si de todos modos la necesitas, selecciónala e imprímela.
          </p>
        </div>
      )}

      {estado !== "colocada" && (
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
            {estado === "abiertas"
              ? "✅ No hay etiquetas por cambiar aquí."
              : estado === "revisar"
                ? "✅ Nada por revisar."
                : "Todavía no hay etiquetas colocadas."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gigante-bg text-gigante-muted text-xs">
                <tr>
                  {estado !== "colocada" && (
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
                  <th className="text-left font-medium px-3 py-3">Le toca</th>
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
                      {estado !== "colocada" && (
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
                      <td className="px-3 py-3">
                        {q.estado === "colocada" ? (
                          <span className="text-xs text-gigante-navy">{q.asignado_a ? nombreCorto(q.asignado_a) : "—"}</span>
                        ) : (
                          <select
                            value={q.asignado_a ?? ""}
                            onChange={(e) => reasignar(q.id, e.target.value)}
                            aria-label="A quién le toca"
                            className={`text-xs rounded-lg border bg-white px-2 py-1 ${q.asignado_a ? "border-gigante-border" : "border-amber-300 text-amber-800"}`}
                          >
                            <option value="">Sin repartir</option>
                            {posibles.map((pp) => (
                              <option key={pp.id} value={pp.id}>
                                {pp.full_name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {estado === "revisar" && p && (
                          <button
                            onClick={() => setExhibirId(p.id)}
                            className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-amber-600 rounded-lg px-2 py-1"
                          >
                            <Store size={12} /> Ya está exhibido
                          </button>
                        )}
                        {estado === "revisar" && <span className="block text-amber-700 font-medium">No está exhibido</span>}
                        {estado !== "revisar" && q.estado === "pendiente" && <span className="text-gigante-red font-medium">Por imprimir</span>}
                        {estado !== "revisar" && q.estado === "impresa" && (
                          <span className="text-amber-700 font-medium">Impresa, por colocar</span>
                        )}
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
      {exhibirId && (
        <ExhibicionModal
          products={porRevisar.map((q) => q.product).filter(Boolean) as Product[]}
          tipo="exhibir"
          initialProductId={exhibirId}
          esGerencia={esGerencia}
          onClose={() => setExhibirId(null)}
          onSuccess={() => {
            setExhibirId(null);
            setMsg(
              esGerencia
                ? "✅ Quedó exhibido. Su etiqueta ya pasó a “Por cambiar”."
                : "✅ Enviado a Gerencia. Cuando confirme la foto, la etiqueta pasa sola a “Por cambiar”."
            );
            reload();
          }}
        />
      )}
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
  const { products } = useProducts();
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

  // ¿El producto del Excel está exhibido? (se busca por ID del Excel o por código)
  const exhibidoPorId = (id: string): boolean | null => {
    const p = products.find((x) => String(x.external_id ?? "") === String(id) || x.code === String(id));
    return p ? p.exhibido : null;
  };
  const noExhibidos = r ? r.detalle.filter((d) => exhibidoPorId(d.id) === false) : [];

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
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
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-700">{noExhibidos.length}</p>
              <p className="text-[11px] text-amber-800">cambian pero no están exhibidos</p>
            </div>
          </div>
          {noExhibidos.length > 0 && (
            <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
              <EyeOff size={12} className="inline -mt-0.5" /> {noExhibidos.length} de los {r.detalle.length} productos que
              cambian no están exhibidos según el sistema. Sus precios sí se actualizan, pero sus etiquetas quedan en
              <strong> “Revisar exhibición”</strong> y no se reparten para imprimir hasta que alguien confirme que están en tienda.
            </p>
          )}
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
                    <th className="text-left font-medium px-2 py-1.5">Exhibido</th>
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
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {exhibidoPorId(d.id) === false ? (
                          <span className="text-amber-700 font-semibold">No → a revisar</span>
                        ) : exhibidoPorId(d.id) ? (
                          <span className="text-emerald-700">Sí</span>
                        ) : (
                          "—"
                        )}
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
              Listo. Ahora en “Etiquetas por cambiar” dale “Repartir entre vendedores”.
              {noExhibidos.length > 0 && ` Las ${noExhibidos.length} que no están exhibidas quedaron en “Revisar exhibición”.`}
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
    { key: "historial", label: "Historial", icon: History, show: true },
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Tags size={22} /> Precios y Etiquetas
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Sube el Excel de rotación, el sistema calcula precios y descuentos, se reparten al azar entre los
        vendedores y cada quien imprime las que le tocaron.
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
        {tab === "historial" && <Historial />}
      </div>
    </div>
  );
}
