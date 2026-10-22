import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Printer, Plus } from "lucide-react";
import { PRODUCT_UNIT_LABELS, ROTACION_LABELS, productoId, type Product } from "../../types";

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

/** Renglones que se llenan a mano según el tipo; lo que el sistema ya sabe viene precargado. */
function filasPara(tipo: TipoEtiqueta, p: Product): Fila[] {
  switch (tipo) {
    case "piso":
      return [
        { label: "M² por caja", valor: p.medida_caja ?? "" },
        { label: "Cajas por tarima", valor: "" },
        { label: "M² por pza", valor: "" },
      ];
    case "bulto":
      return [
        { label: "Peso por bulto", valor: p.medida ?? "" },
        { label: "Bultos por tarima", valor: "" },
        { label: "Rendimiento / uso", valor: "" },
      ];
    case "pieza":
      return [
        { label: "Medida / capacidad", valor: p.medida ?? "" },
        { label: "Color", valor: p.color ?? "" },
        { label: "Piezas por tarima", valor: "" },
      ];
    case "rollo":
      return [
        { label: "Largo por rollo", valor: p.medida ?? "" },
        { label: "Rollos por tarima", valor: "" },
        { label: "Calibre / ancho", valor: "" },
      ];
    default:
      return [
        { label: "Medida", valor: p.medida ?? "" },
        { label: "Color", valor: p.color ?? "" },
        { label: "", valor: "" },
      ];
  }
}

/**
 * Etiqueta amarilla del Kardex (la que va en el protector de plástico del
 * anaquel). Se llena sola con los datos del producto; solo "cajas por
 * tarima" y "m² por pieza" se escriben a mano porque el sistema no los
 * guarda. El QR abre el Kardex de este producto al escanearlo.
 *
 * Los renglones de abajo cambian según el tipo de producto (piso, bulto,
 * pieza, rollo u otro) y se pueden renombrar, quitar o agregar.
 */
export default function EtiquetaKardexModal({ product, onClose }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [tipoEt, setTipoEt] = useState<TipoEtiqueta>(() => tipoSugerido(product));
  const [filas, setFilas] = useState<Fila[]>(() => filasPara(tipoSugerido(product), product));
  const [copias, setCopias] = useState(1);
  const [porHoja, setPorHoja] = useState<1 | 2>(1);
  const [fondo, setFondo] = useState(false);

  const url = `${window.location.origin}/producto/${product.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 300, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const id = productoId(product) || product.code;
  const seVendePor = PRODUCT_UNIT_LABELS[product.unit].toUpperCase();

  function cambiarTipo(t: TipoEtiqueta) {
    setTipoEt(t);
    setFilas(filasPara(t, product));
  }
  function editarFila(i: number, campo: keyof Fila, valor: string) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }
  const tipo = ROTACION_LABELS[product.rotacion].toUpperCase();

  function imprimir() {
    if (!qr) return;
    const n = Math.max(1, Math.min(50, Math.floor(copias) || 1));
    const etiqueta = (pagina: number) => `
      <div class="et">
        <div class="cab">
          <div class="id"><span>ID :</span><b>${esc(id)}</b></div>
          <div class="tipo">${esc(tipo)}</div>
        </div>
        <div class="cuerpo">
          <div class="desc">${esc(product.name)}</div>
          <table>
            <tr><th>CÓDIGO</th><td>${esc(product.code)}</td></tr>
            <tr><th>MARCA</th><td>${esc(product.brand || "")}</td></tr>
            <tr><th>SE VENDE POR</th><td>${esc(seVendePor)}</td></tr>
            ${filas
              .filter((f) => f.label.trim() !== "")
              .map((f) => `<tr><th>${esc(f.label.trim().toUpperCase())}</th><td>${esc(f.valor)}</td></tr>`)
              .join("")}
          </table>
          <img src="${qr}" class="qr" />
        </div>
        <div class="pie">Página ${pagina} de ____ · FO-GIGANTE-KAR-00</div>
      </div>`;
    const etiquetas = Array.from({ length: n }, (_, i) => etiqueta(i + 1)).join("");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Etiqueta Kardex — ${esc(product.code)}</title>
      <style>
        @page { size: letter landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; }
        .hoja { display: grid; grid-template-columns: 1fr; gap: 6mm; }
        .et { border: 2px solid #000; padding: 5mm; page-break-inside: avoid; ${fondo ? "background:#fde047;" : ""}
              height: ${porHoja === 1 ? "190mm" : "92mm"}; display:flex; flex-direction:column; }
        .cab { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:3mm; }
        .id span { font-size: ${porHoja === 1 ? "34px" : "22px"}; font-weight:bold; margin-right:8px; }
        .id b { font-size: ${porHoja === 1 ? "84px" : "46px"}; }
        .tipo { font-size: ${porHoja === 1 ? "30px" : "20px"}; font-weight:bold; }
        .cuerpo { flex:1; display:grid; grid-template-columns: 1fr auto; gap: 4mm; align-content:start; padding-top:3mm; }
        .desc { grid-column: 1 / 3; font-size: ${porHoja === 1 ? "34px" : "22px"}; font-weight:bold; text-align:center; }
        table { border-collapse: collapse; width: 100%; font-size: ${porHoja === 1 ? "22px" : "14px"}; }
        th { text-align:left; border:1px solid #000; padding: 2mm; width: 45%; }
        td { border:1px solid #000; padding: 2mm; font-weight:bold; }
        .qr { width: ${porHoja === 1 ? "60mm" : "36mm"}; height: ${porHoja === 1 ? "60mm" : "36mm"}; align-self:center; }
        .pie { font-size: 11px; text-align:right; }
      </style></head>
      <body><div class="hoja">${etiquetas}</div>
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
          ID, tipo, descripción, código, marca y unidad se llenan solos. Los renglones cambian según el tipo de producto:
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
              Renglones de la etiqueta (puedes cambiar el nombre, llenarlos o quitarlos). “Se vende por: {seVendePor.toLowerCase()}” sale solo.
            </p>
            {filas.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
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
                <button
                  type="button"
                  onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
                  aria-label="Quitar renglón"
                  className="text-gigante-muted hover:text-gigante-red"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {filas.length < 6 && (
              <button
                type="button"
                onClick={() => setFilas((fs) => [...fs, { label: "", valor: "" }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-gigante-navy underline"
              >
                <Plus size={13} /> Agregar renglón
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-xs font-medium text-gigante-navy">
              Etiquetas por hoja
              <select value={porHoja} onChange={(e) => setPorHoja(Number(e.target.value) as 1 | 2)} className={campo}>
                <option value={1}>1 (hoja completa)</option>
                <option value={2}>2 (media hoja)</option>
              </select>
            </label>
          </div>
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
