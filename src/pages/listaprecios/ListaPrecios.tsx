import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useProducts } from "../../hooks/useInventory";
import type { Product } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const clave = (s: unknown) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

interface Renglon {
  modelo: string;
  descripcion: string;
  precio: number;
}
interface HojaLista {
  nombre: string;
  renglones: Renglon[];
  usar: boolean;
}

/** Busca en cada hoja la fila con "Modelo" y la columna "Precio C/IVA". */
function leerHojas(buf: ArrayBuffer): HojaLista[] {
  const wb = XLSX.read(buf, { type: "array" });
  const out: HojaLista[] = [];
  for (const nombre of wb.SheetNames) {
    const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre], { header: 1, raw: true, defval: "" }) as unknown[][];
    const fEnc = m.findIndex((r) => r.some((c) => norm(c) === "modelo"));
    if (fEnc < 0) continue;
    const enc = m[fEnc].map(norm);
    const cModelo = enc.findIndex((h) => h === "modelo");
    const cDesc = enc.findIndex((h) => h.startsWith("descrip"));
    const cIva = enc.findIndex((h) => /c\/ ?iva|con iva/.test(h));
    if (cModelo < 0 || cIva < 0) continue;
    const renglones: Renglon[] = [];
    for (const r of m.slice(fEnc + 1)) {
      const modelo = String(r[cModelo] ?? "").trim();
      const precio = Number(r[cIva]);
      if (!modelo || !isFinite(precio) || precio <= 0) continue;
      renglones.push({ modelo, descripcion: cDesc >= 0 ? String(r[cDesc] ?? "") : "", precio });
    }
    if (renglones.length) out.push({ nombre: nombre.trim(), renglones, usar: !/ecolvex/i.test(nombre) });
  }
  return out;
}

export default function ListaPrecios() {
  const { products, reload } = useProducts();
  const [hojas, setHojas] = useState<HojaLista[]>([]);
  const [archivo, setArchivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const porCodigo = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      for (const k of [clave(p.code), clave(p.external_id)]) {
        if (!k) continue;
        const arr = m.get(k) ?? [];
        if (!arr.includes(p)) arr.push(p);
        m.set(k, arr);
      }
    }
    return m;
  }, [products]);

  const revision = useMemo(() => {
    return hojas
      .filter((h) => h.usar)
      .map((h) => {
        const coinciden: { r: Renglon; p: Product }[] = [];
        const sinProducto: Renglon[] = [];
        for (const r of h.renglones) {
          const ps = porCodigo.get(clave(r.modelo));
          if (ps?.length) ps.forEach((p) => coinciden.push({ r, p }));
          else sinProducto.push(r);
        }
        const cambian = coinciden.filter(({ r, p }) => Number(p.precio_lista ?? -1) !== r.precio);
        const raros = coinciden.filter(({ r, p }) => r.precio < Number(p.unit_price));
        return { hoja: h, coinciden, sinProducto, cambian, raros };
      });
  }, [hojas, porCodigo]);

  const fuentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.precio_lista != null) {
      const f = p.precio_lista_fuente ?? "(sin nombre)";
      m.set(f, (m.get(f) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [products]);

  async function elegir(file: File | undefined) {
    setError(null);
    setAviso(null);
    setHojas([]);
    if (!file) return;
    try {
      const hs = leerHojas(await file.arrayBuffer());
      if (!hs.length) return setError("No encontré hojas con las columnas \"Modelo\" y \"Precio C/IVA\".");
      setArchivo(file.name);
      setHojas(hs);
    } catch {
      setError("No se pudo leer el archivo. Revisa que sea un Excel (.xlsx).");
    }
  }

  async function aplicar() {
    setGuardando(true);
    setError(null);
    setAviso(null);
    let total = 0;
    for (const rev of revision) {
      const items = rev.coinciden.map(({ r, p }) => ({ product_id: p.id, precio: r.precio }));
      if (!items.length) continue;
      const { data, error: err } = await supabase.rpc("aplicar_lista_precios", {
        p_fuente: rev.hoja.nombre,
        p_items: items,
      });
      if (err) {
        setGuardando(false);
        return setError(err.message);
      }
      total += (data as number) ?? 0;
    }
    setGuardando(false);
    setHojas([]);
    setAviso(`Listo: ${total} productos ahora usan el precio de la lista como Precio Público.`);
    reload();
  }

  async function quitar(f: string) {
    if (!confirm(`¿Quitar la lista "${f}"? Esos productos volverán a cobrar el precio de SIGAM como público.`)) return;
    const { data, error: err } = await supabase.rpc("quitar_lista_precios", { p_fuente: f });
    if (err) return setError(err.message);
    setAviso(`Se quitó la lista "${f}" de ${data as number} productos.`);
    reload();
  }

  const totalCambian = revision.reduce((a, r) => a + r.cambian.length, 0);
  const totalCoinciden = revision.reduce((a, r) => a + r.coinciden.length, 0);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <FileSpreadsheet size={22} /> Lista de precios público
      </h1>
      <p className="text-sm text-gigante-muted mt-1 mb-4">
        Sube el Excel de una marca (Helvex, Proyecta...). Sus productos usarán el <strong>precio con IVA del Excel</strong>{" "}
        como Precio Público, y el <strong>Precio Promoción</strong> sigue siendo el de SIGAM. Puedes volver a subirlo cuando
        la lista cambie.
      </p>

      {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2 mb-3">{error}</p>}
      {aviso && (
        <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} /> {aviso}
        </p>
      )}

      <label className="flex items-center gap-2 border-2 border-dashed border-gigante-border rounded-xl px-4 py-5 cursor-pointer hover:bg-gigante-bg text-sm text-gigante-navy">
        <Upload size={18} />
        {archivo ? `Archivo: ${archivo} (toca para cambiarlo)` : "Elegir el Excel de la lista de precios"}
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      </label>

      {hojas.length > 0 && (
        <div className="mt-5 space-y-4">
          <p className="text-sm font-semibold text-gigante-navy">Hojas que traen precio (marca las que quieres usar):</p>
          {revision.length === 0 && <p className="text-xs text-gigante-muted">Marca al menos una hoja.</p>}
          {hojas.map((h, i) => (
            <label key={h.nombre} className="flex items-center gap-2 text-sm text-gigante-navy">
              <input
                type="checkbox"
                checked={h.usar}
                onChange={(e) => setHojas(hojas.map((x, j) => (j === i ? { ...x, usar: e.target.checked } : x)))}
              />
              {h.nombre} <span className="text-xs text-gigante-muted">({h.renglones.length} renglones)</span>
            </label>
          ))}

          {revision.map((rev) => (
            <div key={rev.hoja.nombre} className="bg-white border border-gigante-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-gigante-navy mb-2">{rev.hoja.nombre}</h3>
              <ul className="text-sm text-gigante-navy space-y-1">
                <li>✅ {rev.coinciden.length} productos encontrados en tu inventario</li>
                <li>🔄 {rev.cambian.length} cambiarían de precio público</li>
                <li>❔ {rev.sinProducto.length} del Excel no están en tu inventario (se ignoran)</li>
              </ul>
              {rev.raros.length > 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2 flex gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {rev.raros.length} productos traen un precio del Excel MÁS BAJO que el de SIGAM. Revisa que el Código
                  coincida con el Modelo.
                </p>
              )}
              {rev.coinciden.length > 0 && (
                <div className="overflow-x-auto mt-3 max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gigante-muted text-left">
                        <th className="py-1 pr-2">Modelo</th>
                        <th className="pr-2">Producto en tu inventario</th>
                        <th className="text-right pr-2">SIGAM (promoción)</th>
                        <th className="text-right">Excel (público)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rev.coinciden.slice(0, 40).map(({ r, p }) => (
                        <tr key={r.modelo + p.id} className="border-t border-gigante-border">
                          <td className="py-1 pr-2 font-medium">{r.modelo}</td>
                          <td className="pr-2">{p.name}</td>
                          <td className="text-right pr-2">{money(Number(p.unit_price))}</td>
                          <td className="text-right font-semibold">{money(r.precio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rev.coinciden.length > 40 && (
                    <p className="text-[11px] text-gigante-muted mt-1">Mostrando 40 de {rev.coinciden.length}.</p>
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={aplicar}
            disabled={guardando || totalCoinciden === 0}
            className="bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-5 py-2.5"
          >
            {guardando ? "Guardando..." : `Aplicar lista (${totalCoinciden} productos${totalCambian ? `, ${totalCambian} con cambio` : ""})`}
          </button>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-bold text-gigante-navy mb-2">Listas activas ahora</h2>
        {fuentes.length === 0 ? (
          <p className="text-sm text-gigante-muted">Todavía no hay ninguna lista cargada.</p>
        ) : (
          <ul className="space-y-2">
            {fuentes.map(([f, n]) => (
              <li key={f} className="flex items-center justify-between bg-white border border-gigante-border rounded-xl px-4 py-2.5 text-sm">
                <span className="text-gigante-navy">
                  <strong>{f}</strong> · {n} productos
                </span>
                <button onClick={() => quitar(f)} className="flex items-center gap-1 text-xs text-gigante-red">
                  <Trash2 size={14} /> Quitar lista
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
