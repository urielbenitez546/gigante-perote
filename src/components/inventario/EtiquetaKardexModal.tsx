import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Printer } from "lucide-react";
import { ROTACION_LABELS, productoId, type Product } from "../../types";

interface Props {
  product: Product;
  onClose: () => void;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type TipoEtiqueta = "piso" | "bulto" | "pieza" | "rollo" | "otro";

const TIPOS: Record<TipoEtiqueta, string> = {
  piso: "Piso o recubrimiento (por caja / m²)",
  bulto: "Bulto o bolsa (cemento, adhesivo, boquilla…)",
  pieza: "Pieza o equipo (tinaco, mueble, llave…)",
  rollo: "Rollo (manguera, cable, malla…)",
  otro: "Otro (renglones libres)",
};

interface Fila {
  label: string;
  valor: string;
  /** Solo en el renglón junto a la marca y en el TOTAL: la unidad que va a la derecha (m2, pzas…). */
  unidad?: string;
}

/** Tipo de etiqueta sugerido por la unidad y el nombre del producto. */
function tipoSugerido(p: Product): TipoEtiqueta {
  const n = p.name.toLowerCase();
  if (/(cemento|mortero|adhesivo|pegazulejo|pegapiso|boquilla|yeso|\bcal\b|cementante|impermeabilizante)/.test(n)) return "bulto";
  if (p.unit === "caja" || p.unit === "m2") return "piso";
  if (p.unit === "bolsa") return "bulto";
  if (p.unit === "rollo") return "rollo";
  return "pieza";
}

/**
 * Renglones de abajo de la etiqueta, igual que la hoja amarilla física:
 *   [0] el dato que va a la derecha de la MARCA (en pisos: "PIEZA … m2")
 *   [1] a [4] la fila de abajo: medida por caja, cajas por tarima, cajas por cama y TOTAL.
 * Lo que el sistema ya sabe viene precargado; el resto se escribe a mano.
 */
function filasPara(tipo: TipoEtiqueta, p: Product): Fila[] {
  switch (tipo) {
    case "piso":
      return [
        { label: "PIEZA", valor: "", unidad: "m2" },
        { label: "M2 POR CAJA:", valor: p.medida_caja ?? "" },
        { label: "CAJAS POR TARIMA", valor: "" },
        { label: "CAJAS POR CAMA", valor: "" },
        { label: "TOTAL", valor: "", unidad: "m2" },
      ];
    case "bulto":
      return [
        { label: "RENDIMIENTO", valor: "", unidad: "" },
        { label: "PESO POR BULTO", valor: p.medida ?? "" },
        { label: "BULTOS POR TARIMA", valor: "" },
        { label: "BULTOS POR CAMA", valor: "" },
        { label: "TOTAL", valor: "", unidad: "bultos" },
      ];
    case "pieza":
      return [
        { label: "COLOR", valor: p.color ?? "", unidad: "" },
        { label: "MEDIDA / CAPACIDAD", valor: p.medida ?? "" },
        { label: "PIEZAS POR TARIMA", valor: "" },
        { label: "PIEZAS POR CAMA", valor: "" },
        { label: "TOTAL", valor: "", unidad: "pzas" },
      ];
    case "rollo":
      return [
        { label: "CALIBRE / ANCHO", valor: "", unidad: "" },
        { label: "LARGO POR ROLLO", valor: p.medida ?? "" },
        { label: "ROLLOS POR TARIMA", valor: "" },
        { label: "ROLLOS POR CAMA", valor: "" },
        { label: "TOTAL", valor: "", unidad: "rollos" },
      ];
    default:
      return [
        { label: "COLOR", valor: p.color ?? "", unidad: "" },
        { label: "MEDIDA", valor: p.medida ?? "" },
        { label: "", valor: "" },
        { label: "", valor: "" },
        { label: "TOTAL", valor: "", unidad: "" },
      ];
  }
}

/**
 * Etiqueta amarilla del Kardex (la que va en el protector de plástico del
 * anaquel). Misma distribución que la hoja física (ID grande, capa de
 * movimiento, descripción, código, marca y la fila de cajas por tarima /
 * total), ocupando toda la hoja carta horizontal. En el lugar del logo va
 * el QR, que abre el Kardex de este producto al escanearlo.
 *
 * Se llena sola con los datos del producto; "cajas por tarima", "cajas por
 * cama" y "m² por pieza" se escriben a mano porque el sistema no los guarda.
 * Los renglones de abajo cambian según el tipo de producto.
 */
export default function EtiquetaKardexModal({ product, onClose }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [tipoEt, setTipoEt] = useState<TipoEtiqueta>(() => tipoSugerido(product));
  const [filas, setFilas] = useState<Fila[]>(() => filasPara(tipoSugerido(product), product));
  const [copias, setCopias] = useState(1);
  const [fondo, setFondo] = useState(false);

  const url = `${window.location.origin}/producto/${product.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 700, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const id = productoId(product) || product.code;

  function cambiarTipo(t: TipoEtiqueta) {
    setTipoEt(t);
    setFilas(filasPara(t, product));
  }
  function editarFila(i: number, campo: "label" | "valor" | "unidad", valor: string) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }
  const tipo = ROTACION_LABELS[product.rotacion].toUpperCase();

  function imprimir() {
    if (!qr) return;
    const n = Math.max(1, Math.min(50, Math.floor(copias) || 1));
    const num = (t: string) => {
      const v = Number(t.replace(",", ".").trim());
      return t.trim() !== "" && Number.isFinite(v) ? v : null;
    };
    // En pisos, el TOTAL se calcula solo (cajas por tarima × m² por caja) si no se escribió.
    const f = filas.map((x) => ({ ...x }));
    if (tipoEt === "piso" && f[4] && f[4].valor.trim() === "") {
      const m2 = num(f[1]?.valor ?? "");
      const cajas = num(f[2]?.valor ?? "");
      if (m2 != null && cajas != null) f[4].valor = (Math.round(m2 * cajas * 10) / 10).toString();
    }
    const L = (i: number) => esc((f[i]?.label ?? "").trim().toUpperCase());
    const V = (i: number) => esc((f[i]?.valor ?? "").trim());
    const U = (i: number) => esc((f[i]?.unidad ?? "").trim());
    // Letra que se achica sola cuando el texto no cabe en la celda (ancho en px, tamaño máximo en px),
    // para que ninguna fila crezca y la etiqueta siempre quede en una sola hoja.
    const fs = (t: string, ancho: number, max: number) => {
      const l = t.trim().length;
      return l === 0 ? max : Math.max(11, Math.min(max, Math.floor(ancho / (0.7 * l))));
    };
    // Lo mismo para los nombres de renglón: se ajusta a la palabra más larga (las demás se parten en líneas).
    const fl = (t: string, ancho: number, max: number) => {
      const w = Math.max(1, ...t.trim().split(/\s+/).map((x) => x.length));
      return Math.max(9, Math.min(max, Math.floor(ancho / (0.7 * w))));
    };
    const LS = (i: number, ancho: number, max: number) => `style="font-size:${fl(f[i]?.label ?? "", ancho, max)}px"`;
    const US = (i: number) => `style="font-size:${fs(f[i]?.unidad ?? "", 46, 18)}px"`;
    const VS = (i: number, ancho: number) => `style="font-size:${fs(f[i]?.valor ?? "", ancho, 46)}px"`;
    const stId = `style="font-size:${fs(id, 750, 112)}px"`;
    const stMarca = `style="font-size:${fs(product.brand || "", 400, 35)}px"`;
    const stCodigo = `style="font-size:${fs(product.code, 750, 25)}px"`;
    const largo = product.name.length;
    const tamDesc = largo > 90 ? 30 : largo > 60 ? 38 : 49;

    const etiqueta = (ultima: boolean) => `
      <div class="pagina"${ultima ? ' style="page-break-after:auto"' : ""}>
        <table class="et">
          <colgroup>
            <col style="width:9.2%"><col style="width:12.9%"><col style="width:11.7%"><col style="width:10%">
            <col style="width:11.2%"><col style="width:8.8%"><col style="width:9.4%"><col style="width:21.3%"><col style="width:5.5%">
          </colgroup>
          <tr class="rA">
            <td colspan="2" class="qrc"><img src="${qr}" class="qr" /></td>
            <td colspan="7" class="idc"><div class="idl">ID :</div><div class="idn" ${stId}>${esc(id)}</div></td>
          </tr>
          <tr class="rB">
            <th colspan="2" class="lab chica">CAPA DE MOVIMIENTO:</th>
            <td colspan="7" class="medio">${esc(tipo)}</td>
          </tr>
          <tr class="rC">
            <th colspan="2" class="lab">DESCRIPCION :</th>
            <td colspan="7" class="desc" style="font-size:${tamDesc}px">${esc(product.name)}</td>
          </tr>
          <tr class="rD">
            <th colspan="2" class="lab">CODIGO :</th>
            <td colspan="7" class="cod" ${stCodigo}>${esc(product.code)}</td>
          </tr>
          <tr class="rE">
            <th colspan="2" class="lab">MARCA :</th>
            <td colspan="4" class="marca" ${stMarca}>${esc(product.brand || "")}</td>
            <th class="lab" ${LS(0, 78, 22)}>${L(0)}</th>
            <td class="val" ${VS(0, 195)}>${V(0)}</td>
            <td class="uni" ${US(0)}>${U(0)}</td>
          </tr>
          <tr class="rF">
            <th class="lab chica" ${LS(1, 78, 15)}>${L(1)}</th><td class="val" ${VS(1, 112)}>${V(1)}</td>
            <th class="lab chica" ${LS(2, 100, 15)}>${L(2)}</th><td class="val" ${VS(2, 88)}>${V(2)}</td>
            <th class="lab chica" ${LS(3, 95, 15)}>${L(3)}</th><td class="val" ${VS(3, 76)}>${V(3)}</td>
            <th class="lab chica" ${LS(4, 78, 15)}>${L(4)}</th><td class="val" ${VS(4, 195)}>${V(4)}</td>
            <td class="uni" ${US(4)}>${U(4)}</td>
          </tr>
        </table>
      </div>`;
    const etiquetas = Array.from({ length: n }, (_, i) => etiqueta(i === n - 1)).join("");
    const win = window.open("", "_blank", "width=1000,height=760");
    if (!win) return;
    win.document.write(`
      <html><head><title>Etiqueta Kardex — ${esc(product.code)}</title>
      <style>
        @page { size: letter landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pagina { width: 263mm; height: 190mm; page-break-after: always; break-inside: avoid; }
        table.et { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; border: 4px solid #000;
                   ${fondo ? "background:#fde047;" : ""} }
        .et td, .et th { border: 2px solid #000; padding: 0 1.5mm; overflow: hidden; }
        .et th.lab { text-align: left; font-weight: bold; font-size: 22px; line-height: 1.1; }
        .et th.lab.chica { font-size: 15px; }
        .et td.val { text-align: center; font-weight: bold; font-size: 46px; white-space: nowrap; }
        .et td.uni { font-weight: bold; font-size: 18px; text-align: left; padding-left: 1mm; white-space: nowrap; }
        tr.rA { height: 58mm; }  tr.rB { height: 9mm; }  tr.rC { height: 65mm; }
        tr.rD { height: 13mm; }  tr.rE { height: 15mm; } tr.rF { height: 30mm; }
        td.qrc { text-align: center; vertical-align: middle; padding: 1mm; }
        img.qr { width: 52mm; height: 52mm; display: block; margin: 0 auto; }
        td.idc { text-align: center; vertical-align: middle; }
        .idl { font-size: 42px; font-weight: bold; line-height: 1.1; }
        .idn { font-size: 112px; font-weight: bold; line-height: 1.05; white-space: nowrap; }
        td.medio { text-align: center; font-weight: bold; font-size: 35px; }
        td.desc { text-align: center; vertical-align: middle; font-weight: bold; line-height: 1.15; }
        td.cod { font-weight: bold; font-size: 25px; padding-left: 3mm; white-space: nowrap; }
        td.marca { font-weight: bold; font-size: 35px; padding-left: 3mm; white-space: nowrap; }
      </style></head>
      <body>${etiquetas}
      <script>window.onload = () => window.print();</script></body></html>
    `);
    win.document.close();
  }

  const campo =
    "w-full rounded-lg border border-gigante-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Etiqueta amarilla del Kardex</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl bg-yellow-200 border border-yellow-400 p-3 mb-4 text-gigante-navy">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold">ID: <span className="text-2xl">{id}</span></span>
            <span className="text-xs font-bold">{tipo}</span>
          </div>
          <p className="text-sm font-bold mt-1">{product.name}</p>
          <p className="text-xs mt-1">
            Código {product.code} · Marca {product.brand || "—"}
          </p>
        </div>
        <p className="text-xs text-gigante-muted mb-3">
          Igual que la hoja amarilla física, pero con el QR en lugar del logo y ocupando toda la hoja. ID, capa de movimiento,
          descripción, código y marca se llenan solos. Abajo escribes lo que el sistema no sabe:
        </p>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-gigante-navy">
            Tipo de producto
            <select value={tipoEt} onChange={(e) => cambiarTipo(e.target.value as TipoEtiqueta)} className={campo}>
              {(Object.keys(TIPOS) as TipoEtiqueta[]).map((t) => (
                <option key={t} value={t}>
                  {TIPOS[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-[11px] text-gigante-muted">
              Renglón 1 va junto a la marca; los otros 4 son la fila de abajo. Puedes cambiar los nombres, llenarlos o dejarlos en blanco.
              {tipoEt === "piso" && " En pisos, el TOTAL se calcula solo (m² por caja × cajas por tarima) si lo dejas vacío."}
            </p>
            {filas.map((f, i) => {
              const tieneUnidad = i === 0 || i === filas.length - 1;
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_4.5rem] gap-2 items-center">
                  <input
                    value={f.label}
                    onChange={(e) => editarFila(i, "label", e.target.value)}
                    placeholder="Nombre del renglón"
                    className={`${campo} !py-1.5 font-medium`}
                  />
                  <input
                    value={f.valor}
                    onChange={(e) => editarFila(i, "valor", e.target.value)}
                    placeholder="Valor"
                    className={`${campo} !py-1.5`}
                  />
                  {tieneUnidad ? (
                    <input
                      value={f.unidad ?? ""}
                      onChange={(e) => editarFila(i, "unidad", e.target.value)}
                      placeholder="Unidad"
                      aria-label="Unidad"
                      className={`${campo} !py-1.5`}
                    />
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
          </div>
          <label className="block text-xs font-medium text-gigante-navy">
            Copias (una por hoja)
            <input
              type="number"
              min={1}
              max={50}
              value={copias}
              onChange={(e) => setCopias(Number(e.target.value))}
              className={campo}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gigante-navy">
            <input type="checkbox" checked={fondo} onChange={(e) => setFondo(e.target.checked)} />
            Imprimir fondo amarillo (déjalo apagado si metes la hoja amarilla)
          </label>
        </div>

        <div className="flex gap-3 pt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={imprimir}
            disabled={!qr}
            className="flex-1 flex items-center justify-center gap-2 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
