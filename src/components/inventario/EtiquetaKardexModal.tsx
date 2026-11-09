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
  const [tamano, setTamano] = useState<"completa" | "media">("completa");
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
    // Hoja completa: carta horizontal (263 × 190 mm). Media hoja: dos etiquetas horizontales por hoja carta
    // vertical, una arriba y otra abajo (cada una de 199 × 128 mm = media carta), para cortar por la mitad.
    // K escala letras y alturas; W escala el ancho disponible de cada celda.
    const media = tamano === "media";
    // Tamaño de la etiqueta en mm. El margen de 7 mm por los cuatro lados lo ponemos nosotros (no el
    // navegador): así queda centrada y la impresora no le corta el borde, sin importar el margen que
    // tenga elegido la ventana de impresión.
    const LW = media ? 201 : 265;
    const LH = media ? 130 : 201;
    const W = (LW * 3.7795) / 994; // escala del ancho respecto al diseño base (994 px de ancho, 190 mm de alto)
    const HK = LH / 190; // escala de las alturas de cada fila
    const K = Math.min(W, HK); // escala de las letras
    const KL = media ? 0.78 : K; // las letras chicas de los nombres de renglón se reducen menos para que se lean
    const L = (i: number) => esc((f[i]?.label ?? "").trim().toUpperCase());
    const V = (i: number) => esc((f[i]?.valor ?? "").trim());
    const U = (i: number) => esc((f[i]?.unidad ?? "").trim());
    // Letra que se achica sola cuando el texto no cabe en la celda (ancho en px, tamaño máximo en px),
    // para que ninguna fila crezca y la etiqueta siempre quede en una sola hoja.
    const fs = (t: string, ancho: number, max: number) => {
      const l = t.trim().length;
      const tope = Math.round(max * K);
      return l === 0 ? tope : Math.max(Math.round(9 * K) + 2, Math.min(tope, Math.floor((ancho * W) / (0.7 * l))));
    };
    // Lo mismo para los nombres de renglón: se ajusta a la palabra más larga (las demás se parten en líneas).
    const fl = (t: string, ancho: number, max: number) => {
      const w = Math.max(1, ...t.trim().split(/\s+/).map((x) => x.length));
      return Math.max(8, Math.min(Math.round(max * KL), Math.floor((ancho * W) / (0.7 * w))));
    };
    const LS = (i: number, ancho: number, max: number) => `style="font-size:${fl(f[i]?.label ?? "", ancho, max)}px"`;
    const US = (i: number) => `style="font-size:${fs(f[i]?.unidad ?? "", 46, 18)}px"`;
    const VS = (i: number, ancho: number) => `style="font-size:${fs(f[i]?.valor ?? "", ancho, 46)}px"`;
    const stId = `style="font-size:${fs(id, 750, 112)}px"`;
    const stMarca = `style="font-size:${fs(product.brand || "", 400, 35)}px"`;
    const stCodigo = `style="font-size:${fs(product.code, 750, 25)}px"`;
    const largo = product.name.length;
    const tamDesc = Math.round((largo > 90 ? 30 : largo > 60 ? 38 : 49) * K);

    const etiqueta = (_ultima: boolean) => `
      <div class="pagina">
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
    // Hoja completa: una etiqueta por hoja. Media hoja: de dos en dos.
    const porHoja = media ? 2 : 1;
    const hojas = Math.ceil(n / porHoja);
    const etiquetas = Array.from({ length: hojas }, (_, h) => {
      const enEstaHoja = Math.min(porHoja, n - h * porHoja);
      return `<div class="hoja"${h === hojas - 1 ? ' style="page-break-after:auto"' : ""}>${Array.from({ length: enEstaHoja }, () => etiqueta(true)).join("")}</div>`;
    }).join("");
    const win = window.open("", "_blank", "width=1000,height=760");
    if (!win) return;
    win.document.write(`
      <html><head><title>Etiqueta Kardex — ${esc(product.code)}</title>
      <style>
        /* Hoja completa: no se fuerza la orientación; la etiqueta se acomoda sola a como esté el papel en la ventana de impresión. */
        @page { ${media ? "size: letter portrait; " : ""}margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Cada .hoja es una hoja carta; el padding de 7 mm es el margen seguro para la impresora. */
        .hoja { box-sizing: border-box; page-break-after: always; break-inside: avoid; overflow: hidden; padding: 7mm; width: ${media ? "215mm" : "279mm"}; height: ${media ? "279mm" : "215mm"}; }
        .pagina { width: ${LW}mm; height: ${LH}mm; break-inside: avoid; ${media ? "margin-bottom: 4mm;" : ""} }
        .pagina:last-child { margin-bottom: 0; }
        ${
          media
            ? ""
            : `/* Si el papel está en vertical (es lo normal en tablet y celular), la etiqueta se gira para llenar toda la hoja. */
        @media print and (orientation: portrait) {
          .hoja { position: relative; width: 215mm; height: 279mm; }
          .pagina { position: absolute; top: 7mm; left: 7mm; transform-origin: 0 0; transform: translateX(${LH}mm) rotate(90deg); }
        }`
        }
        table.et { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; border: ${media ? 3 : 4}px solid #000;
                   ${fondo ? "background:#fde047;" : ""} }
        .et td, .et th { border: ${media ? 1.5 : 2}px solid #000; padding: 0 ${(1.5 * K).toFixed(2)}mm; overflow: hidden; }
        .et th.lab { text-align: left; font-weight: bold; font-size: ${Math.round(22 * K)}px; line-height: 1.1; }
        .et th.lab.chica { font-size: ${Math.round(15 * KL)}px; }
        .et td.val { text-align: center; font-weight: bold; font-size: ${Math.round(46 * K)}px; white-space: nowrap; }
        .et td.uni { font-weight: bold; font-size: ${Math.round(18 * K)}px; text-align: left; padding-left: 1mm; white-space: nowrap; }
        tr.rA { height: ${(58 * HK).toFixed(1)}mm; }  tr.rB { height: ${(11 * HK).toFixed(1)}mm; }  tr.rC { height: ${(63 * HK).toFixed(1)}mm; }
        tr.rD { height: ${(13 * HK).toFixed(1)}mm; }  tr.rE { height: ${(15 * HK).toFixed(1)}mm; } tr.rF { height: ${(30 * HK).toFixed(1)}mm; }
        td.qrc { text-align: center; vertical-align: middle; padding: 1mm; }
        img.qr { width: ${(52 * K).toFixed(1)}mm; height: ${(52 * K).toFixed(1)}mm; display: block; margin: 0 auto; }
        td.idc { text-align: center; vertical-align: middle; }
        .idl { font-size: ${Math.round(42 * K)}px; font-weight: bold; line-height: 1.1; }
        .idn { font-size: ${Math.round(112 * K)}px; font-weight: bold; line-height: 1.05; white-space: nowrap; }
        td.medio { text-align: center; font-weight: bold; font-size: ${Math.round(35 * K)}px; }
        td.desc { text-align: center; vertical-align: middle; font-weight: bold; line-height: 1.15; }
        td.cod { font-weight: bold; font-size: ${Math.round(25 * K)}px; padding-left: 3mm; white-space: nowrap; }
        td.marca { font-weight: bold; font-size: ${Math.round(35 * K)}px; padding-left: 3mm; white-space: nowrap; }
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
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-gigante-navy">
              Tamaño
              <select value={tamano} onChange={(e) => setTamano(e.target.value as "completa" | "media")} className={campo}>
                <option value="completa">Hoja completa (carta horizontal)</option>
                <option value="media">Media hoja (2 horizontales por hoja carta)</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-gigante-navy">
              Copias
              <input
                type="number"
                min={1}
                max={50}
                value={copias}
                onChange={(e) => setCopias(Number(e.target.value))}
                className={campo}
              />
            </label>
          </div>
          <p className="text-[11px] text-gigante-muted">
            {tamano === "completa"
              ? "Una etiqueta por hoja carta que llena toda la hoja. Si el papel está en vertical en la ventana de impresión, la etiqueta se gira sola; si lo pones en horizontal, sale derecha."
              : "Se imprimen de dos en dos en una hoja carta vertical; córtala por la mitad y cada mitad queda como etiqueta horizontal de media hoja."}
          </p>
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
