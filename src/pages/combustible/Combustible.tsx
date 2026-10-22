import { useMemo, useState, type FormEvent } from "react";
import { Camera, Fuel, Paperclip } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProfileNames } from "../../hooks/useProfileNames";
import {
  TIPO_UNIDAD_LABELS,
  anularRegistroCombustible,
  registrarCombustible,
  useBitacoraCombustible,
  type RegistroCombustible,
  type TipoUnidad,
} from "../../hooks/useCombustible";
import { signedPhotoUrl, uploadPhoto } from "../../lib/storage";
import { tienePermiso } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number, d = 1) => n.toLocaleString("es-MX", { maximumFractionDigits: d });
const hoyYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Rendimiento aproximado de cada carga: se compara contra la carga anterior de la misma
 * unidad (km recorridos ÷ litros del vehículo, o litros ÷ horas del montacargas).
 * Es una aproximación: supone que cada vez se llena el tanque.
 */
function calcularRendimientos(registros: RegistroCombustible[]): Map<string, number> {
  const res = new Map<string, number>();
  const porUnidad = new Map<string, RegistroCombustible[]>();
  for (const r of registros) {
    if (r.anulado_at || r.odometro == null) continue;
    const k = `${r.tipo_unidad}|${r.unidad.trim().toLowerCase()}`;
    porUnidad.set(k, [...(porUnidad.get(k) ?? []), r]);
  }
  for (const lista of porUnidad.values()) {
    lista.sort((a, b) => Number(a.odometro) - Number(b.odometro) || a.created_at.localeCompare(b.created_at));
    for (let i = 1; i < lista.length; i++) {
      const delta = Number(lista[i].odometro) - Number(lista[i - 1].odometro);
      const litros = Number(lista[i].litros);
      if (delta <= 0 || litros <= 0) continue;
      res.set(lista[i].id, lista[i].tipo_unidad === "vehiculo" ? delta / litros : litros / delta);
    }
  }
  return res;
}

/** Un dato fuera de lo normal casi siempre es un error al anotar el tablero (ej. km en vez de horas). */
function datoRaro(tipo: TipoUnidad, valor: number): boolean {
  return tipo === "vehiculo" ? valor < 2 || valor > 40 : valor < 0.5 || valor > 15;
}

export default function Combustible() {
  const { profile } = useAuth();
  const { nameFor } = useProfileNames();
  const { registros, loading, error, reload } = useBitacoraCombustible();

  const veTodo = tienePermiso(profile, "ver_km"); // gerencia, jefe y auxiliar
  const esGerencia = profile?.role === "gerencia";
  const tipoFijo: TipoUnidad | null =
    profile?.role === "reparto" ? "vehiculo" : profile?.role === "almacen" ? "montacargas" : null;

  const [tipo, setTipo] = useState<TipoUnidad>(tipoFijo ?? "vehiculo");
  const [unidad, setUnidad] = useState("");
  const [fecha, setFecha] = useState(hoyYmd());
  const [litros, setLitros] = useState("");
  const [monto, setMonto] = useState("");
  const [odometro, setOdometro] = useState("");
  const [notas, setNotas] = useState("");
  const [fotoTicket, setFotoTicket] = useState<File | null>(null);
  const [fotoTablero, setFotoTablero] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [filtroUnidad, setFiltroUnidad] = useState("todas");

  const tipoActual = tipoFijo ?? tipo;
  const etiquetaOdo = tipoActual === "vehiculo" ? "Kilometraje del tablero" : "Horas del tablero";
  const unidadesConocidas = useMemo(
    () => Array.from(new Set(registros.filter((r) => r.tipo_unidad === tipoActual).map((r) => r.unidad))).sort(),
    [registros, tipoActual]
  );
  const rendimientos = useMemo(() => calcularRendimientos(registros), [registros]);

  const unidades = useMemo(
    () => Array.from(new Set(registros.map((r) => `${r.tipo_unidad}|${r.unidad}`))).sort(),
    [registros]
  );
  const visibles = registros.filter((r) => filtroUnidad === "todas" || `${r.tipo_unidad}|${r.unidad}` === filtroUnidad);

  // Resumen por unidad (solo quien ve todo)
  const resumen = useMemo(() => {
    const m = new Map<string, { tipo: TipoUnidad; unidad: string; litros: number; monto: number; cargas: number; rend: number[] }>();
    for (const r of registros) {
      if (r.anulado_at) continue;
      const k = `${r.tipo_unidad}|${r.unidad.trim().toLowerCase()}`;
      const cur = m.get(k) ?? { tipo: r.tipo_unidad, unidad: r.unidad, litros: 0, monto: 0, cargas: 0, rend: [] };
      cur.litros += Number(r.litros);
      cur.monto += Number(r.monto ?? 0);
      cur.cargas += 1;
      const rd = rendimientos.get(r.id);
      if (rd) cur.rend.push(rd);
      m.set(k, cur);
    }
    return Array.from(m.values());
  }, [registros, rendimientos]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const l = Number(litros);
    if (!unidad.trim()) return setMsg({ tipo: "error", texto: "Escribe qué unidad es (placas, número o nombre)." });
    if (!l || l <= 0) return setMsg({ tipo: "error", texto: "Escribe cuántos litros se cargaron." });
    if (!odometro) return setMsg({ tipo: "error", texto: `Escribe el ${etiquetaOdo.toLowerCase()}.` });

    setGuardando(true);
    let pathTicket: string | null = null;
    let pathTablero: string | null = null;
    if (fotoTicket) {
      const s = await uploadPhoto("bitacora", fotoTicket);
      if (s.error || !s.path) {
        setGuardando(false);
        return setMsg({ tipo: "error", texto: `No se pudo subir la foto del ticket: ${s.error ?? "error"}` });
      }
      pathTicket = s.path;
    }
    if (fotoTablero) {
      const s = await uploadPhoto("bitacora", fotoTablero);
      if (s.error || !s.path) {
        setGuardando(false);
        return setMsg({ tipo: "error", texto: `No se pudo subir la foto del tablero: ${s.error ?? "error"}` });
      }
      pathTablero = s.path;
    }
    const { error: err } = await registrarCombustible({
      tipoUnidad: tipoActual,
      unidad: unidad.trim(),
      fecha,
      litros: l,
      monto: monto ? Number(monto) : null,
      odometro: Number(odometro),
      fotoTicket: pathTicket,
      fotoTablero: pathTablero,
      notas,
    });
    setGuardando(false);
    if (err) return setMsg({ tipo: "error", texto: err });

    setLitros("");
    setMonto("");
    setOdometro("");
    setNotas("");
    setFotoTicket(null);
    setFotoTablero(null);
    setFecha(hoyYmd());
    setMsg({ tipo: "ok", texto: "Carga registrada." });
    reload();
  }

  async function abrirFoto(path: string) {
    const ventana = window.open("", "_blank");
    const url = await signedPhotoUrl("bitacora", path, 600);
    if (!url) {
      ventana?.close();
      return setMsg({ tipo: "error", texto: "No se pudo abrir la foto." });
    }
    if (ventana) ventana.location.href = url;
  }

  async function anular(id: string) {
    const motivo = window.prompt("¿Por qué se anula este registro? (ej. se capturó mal)");
    if (motivo === null) return;
    if (motivo.trim().length < 3) return setMsg({ tipo: "error", texto: "Escribe el motivo para anular." });
    const { error: err } = await anularRegistroCombustible(id, motivo.trim());
    if (err) return setMsg({ tipo: "error", texto: err });
    setMsg({ tipo: "ok", texto: "Registro anulado." });
    reload();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  const botonFoto = (etiqueta: string, file: File | null, set: (f: File | null) => void) => (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium border border-gigante-border rounded-lg px-2.5 py-2 text-gigante-navy bg-white cursor-pointer">
      <Camera size={14} /> {file ? `${etiqueta} ✓` : etiqueta}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => set(e.target.files?.[0] ?? null)} />
    </label>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Fuel size={22} /> Combustible y montacargas
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        {tipoFijo === "vehiculo"
          ? "Registra cada carga de gasolina de tu unidad con la foto del ticket y del tablero."
          : tipoFijo === "montacargas"
          ? "Registra cada carga de combustible del montacargas con la foto del ticket y del tablero."
          : "Bitácora de cargas de combustible de vehículos y montacargas."}
      </p>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error} — ¿ya corriste la migración 0028 en Supabase?
        </p>
      )}

      <form onSubmit={guardar} className="mt-5 bg-white border border-gigante-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gigante-navy">Nueva carga</p>
        {!tipoFijo && (
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {(Object.keys(TIPO_UNIDAD_LABELS) as TipoUnidad[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  tipo === t ? "border-gigante-navy bg-gigante-navy text-white" : "border-gigante-border text-gigante-navy"
                }`}
              >
                {TIPO_UNIDAD_LABELS[t]}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block text-xs font-medium text-gigante-navy col-span-2 md:col-span-1">
            Unidad (placas, número o nombre)
            <input list="unidades-conocidas" value={unidad} onChange={(e) => setUnidad(e.target.value)} className={campo} />
            <datalist id="unidades-conocidas">
              {unidadesConocidas.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Fecha
            <input type="date" value={fecha} max={hoyYmd()} onChange={(e) => setFecha(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Litros
            <input type="number" min="0.01" step="any" value={litros} onChange={(e) => setLitros(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy">
            Importe $ (opcional)
            <input type="number" min="0" step="any" value={monto} onChange={(e) => setMonto(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy col-span-2 md:col-span-2">
            {etiquetaOdo}
            <input type="number" min="0" step="any" value={odometro} onChange={(e) => setOdometro(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs font-medium text-gigante-navy col-span-2 md:col-span-2">
            Nota (opcional)
            <input value={notas} onChange={(e) => setNotas(e.target.value)} className={campo} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {botonFoto("Foto del ticket", fotoTicket, setFotoTicket)}
          {botonFoto("Foto del tablero", fotoTablero, setFotoTablero)}
          <span className="text-[11px] text-gigante-muted">Las fotos se comprimen solas.</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            {guardando ? "Guardando..." : "Registrar carga"}
          </button>
          {msg && <p className={`text-xs ${msg.tipo === "ok" ? "text-emerald-700" : "text-gigante-red"}`}>{msg.texto}</p>}
        </div>
      </form>

      {veTodo && resumen.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gigante-navy mb-2">Resumen por unidad</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resumen.map((r) => {
              const prom = r.rend.length ? r.rend.reduce((a, b) => a + b, 0) / r.rend.length : null;
              return (
                <div key={`${r.tipo}|${r.unidad}`} className="bg-white border border-gigante-border rounded-xl p-3">
                  <p className="text-sm font-semibold text-gigante-navy">{r.unidad}</p>
                  <p className="text-[11px] text-gigante-muted">{TIPO_UNIDAD_LABELS[r.tipo]} · {r.cargas} carga(s)</p>
                  <p className="text-sm text-gigante-navy mt-1">
                    {num(r.litros)} L · {money(r.monto)}
                  </p>
                  <p className="text-[11px] text-gigante-muted">
                    {prom == null
                      ? "Rendimiento: faltan cargas con kilometraje/horas"
                      : r.tipo === "vehiculo"
                      ? `Rendimiento aprox.: ${num(prom)} km por litro`
                      : `Consumo aprox.: ${num(prom)} litros por hora`}
                  </p>
                  {prom != null && datoRaro(r.tipo, prom) && (
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      ⚠️ Dato raro: revisa que el tablero se haya anotado en {r.tipo === "vehiculo" ? "kilómetros" : "horas (no km)"}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-gigante-muted bg-white border border-gigante-border rounded-lg px-3 py-2 space-y-1">
            <p className="font-semibold text-gigante-navy">¿Cómo se calcula?</p>
            <p>
              Se compara cada carga con la anterior de la misma unidad y se supone que el tanque se llena cada vez
              (los litros de la carga = lo que se gastó desde la carga anterior).
            </p>
            <p>
              <strong>Vehículos — rendimiento:</strong> km recorridos ÷ litros. Entre más km por litro, mejor.
              Ej.: 450 km con 30 L → 15 km/L.
            </p>
            <p>
              <strong>Montacargas — consumo:</strong> litros ÷ horas trabajadas. Entre menos litros por hora, mejor.
              Ej.: 24 L en 8 horas → 3 L/hora (1 litro dura casi 20 minutos).
            </p>
            <p>Es aproximado: si algún día no se llenó el tanque, ese dato sale distorsionado.</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gigante-navy">{veTodo ? "Todas las cargas" : "Mis cargas"}</h2>
        {veTodo && unidades.length > 1 && (
          <select
            value={filtroUnidad}
            onChange={(e) => setFiltroUnidad(e.target.value)}
            className="text-xs rounded-lg border border-gigante-border px-2 py-1.5 bg-white"
          >
            <option value="todas">Todas las unidades</option>
            {unidades.map((u) => (
              <option key={u} value={u}>
                {u.split("|")[1]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-2 bg-white border border-gigante-border rounded-xl overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">Todavía no hay cargas registradas.</p>
        ) : (
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-gigante-bg text-gigante-muted">
              <tr>
                <th className="text-left font-medium px-3 py-2.5">Fecha</th>
                <th className="text-left font-medium px-3 py-2.5">Unidad</th>
                <th className="text-right font-medium px-3 py-2.5">Litros</th>
                <th className="text-right font-medium px-3 py-2.5">Importe</th>
                <th className="text-right font-medium px-3 py-2.5">Km / horas</th>
                {veTodo && <th className="text-right font-medium px-3 py-2.5">Rendimiento / consumo</th>}
                <th className="text-left font-medium px-3 py-2.5">Fotos</th>
                {esGerencia && <th className="px-3 py-2.5"></th>}
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const rd = rendimientos.get(r.id);
                return (
                  <tr key={r.id} className={`border-t border-gigante-border ${r.anulado_at ? "bg-gigante-bg text-gigante-muted" : ""}`}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {new Date(r.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={r.anulado_at ? "line-through" : "text-gigante-navy font-medium"}>{r.unidad}</span>
                      <span className="block text-[10px] text-gigante-muted">
                        {TIPO_UNIDAD_LABELS[r.tipo_unidad]} · {nameFor(r.created_by)}
                      </span>
                      {r.notas && <span className="block text-[10px] text-gigante-muted">{r.notas}</span>}
                      {r.anulado_at && (
                        <span className="block text-[10px] text-gigante-red">Anulado: {r.anulado_motivo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">{num(Number(r.litros), 2)}</td>
                    <td className="px-3 py-2.5 text-right">{r.monto != null ? money(Number(r.monto)) : "—"}</td>
                    <td className="px-3 py-2.5 text-right">{r.odometro != null ? num(Number(r.odometro), 1) : "—"}</td>
                    {veTodo && (
                      <td className="px-3 py-2.5 text-right">
                        {rd ? `${num(rd)} ${r.tipo_unidad === "vehiculo" ? "km/L" : "L/hora"}` : "—"}
                        {rd && datoRaro(r.tipo_unidad, rd) && (
                          <span className="block text-[10px] text-amber-700">⚠️ revisa el tablero</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.foto_ticket && (
                        <button onClick={() => abrirFoto(r.foto_ticket as string)} className="inline-flex items-center gap-0.5 text-gigante-navy underline mr-2">
                          <Paperclip size={11} /> Ticket
                        </button>
                      )}
                      {r.foto_tablero && (
                        <button onClick={() => abrirFoto(r.foto_tablero as string)} className="inline-flex items-center gap-0.5 text-gigante-navy underline">
                          <Paperclip size={11} /> Tablero
                        </button>
                      )}
                      {!r.foto_ticket && !r.foto_tablero && <span className="text-gigante-muted">—</span>}
                    </td>
                    {esGerencia && (
                      <td className="px-3 py-2.5 text-right">
                        {!r.anulado_at && (
                          <button onClick={() => anular(r.id)} className="text-[11px] text-gigante-red underline">
                            Anular
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
