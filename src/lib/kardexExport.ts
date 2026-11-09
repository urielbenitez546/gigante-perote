
// ============================================================
// Exportar el Kardex de UN producto: Excel (.xlsx) o página
// imprimible (se guarda como PDF desde la ventana de impresión).
// Mismo formato de papel FO-GIGANTE-KAR-00: Fecha, Nombre,
// Entrada, Salida y Existencia (+ concepto y referencia).
// ============================================================

export interface KardexRenglonExport {
  fechaISO: string;
  nombre: string;
  concepto: string;
  referencia: string;
  entrada: number | null;
  salida: number | null;
  existencia: number;
  /** Texto "Anulado por X el dd/mm/aaaa: motivo" si el renglón fue anulado. */
  anulado: string | null;
}

export interface KardexExportDatos {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  existenciaActual: number;
  existenciaInicial: number;
  renglones: KardexRenglonExport[];
}

const ZONA = "America/Mexico_City";
const AZUL = "FF1F3A5F";
const ROJO = "FFC8102E";
const GRIS = "FFF3F4F6";

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function nombreArchivo(d: KardexExportDatos, ext: string) {
  const limpio = (d.id || d.codigo || "producto").replace(/[^A-Za-z0-9_-]+/g, "_");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
  return `Kardex_${limpio}_${hoy}.${ext}`;
}

/** Descarga el libro tal cual (sin forzar horizontal/A4: el Kardex va vertical en carta). */
async function descargarLibro(wb: import("exceljs").Workbook, nombre: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportarKardexExcel(d: KardexExportDatos) {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "El Gigante de los Azulejos y Mármoles — Perote";
  const ws = wb.addWorksheet("Kardex", {
    pageSetup: {
      orientation: "portrait",
      paperSize: 1 as never, // 1 = carta
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    views: [{ showGridLines: false }],
  });
  // Mismas 5 columnas del formato de papel: Fecha | Nombre | Entrada | Salida | Existencia
  ws.columns = [{ width: 18 }, { width: 46 }, { width: 14 }, { width: 14 }, { width: 16 }];

  const NEGRO = "FF333333";
  const lado = { style: "medium" as const, color: { argb: NEGRO } };
  const fino = { style: "thin" as const, color: { argb: "FF555555" } };
  const caja = (r1: number, c1: number, r2: number, c2: number, b: typeof lado | typeof fino = lado) => {
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(r, c);
        cell.border = {
          top: r === r1 ? b : cell.border?.top,
          bottom: r === r2 ? b : cell.border?.bottom,
          left: c === c1 ? b : cell.border?.left,
          right: c === c2 ? b : cell.border?.right,
        };
      }
  };
  const poner = (ref: string, valor: string, o: { bold?: boolean; size?: number; color?: string; fill?: string; h?: "left" | "center" | "right"; wrap?: boolean } = {}) => {
    const c = ws.getCell(ref);
    c.value = valor;
    c.font = { name: "Arial", size: o.size ?? 9, bold: o.bold ?? false, color: { argb: o.color ?? "FF111111" } };
    c.alignment = { horizontal: o.h ?? "center", vertical: "middle", wrapText: o.wrap ?? true };
    if (o.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
  };

  // ---------- Encabezado (igual que la hoja FO-GIGANTE-KAR-00) ----------
  [1, 2, 3].forEach((r) => (ws.getRow(r).height = 24));
  ws.mergeCells("A1:A3");
  poner("A1", "EL GIGANTE\nDE LOS AZULEJOS Y MÁRMOLES", { bold: true, size: 14 });
  ws.mergeCells("B1:B3");
  poner("B1", "FO-GIGANTE-KAR-00\nFecha de aplicación:\n2024/09/18", { bold: true, size: 11, color: "FFFFFFFF", fill: "FF3A3A3A" });
  poner("C1", "FECHA DE\nELABORACIÓN", { size: 8 });
  poner("D1", "2024/09/17", { size: 9 });
  poner("E1", "ELABORÓ:\nCarlos Tabueña", { size: 8 });
  poner("C2", "FECHA DE\nREVISIÓN", { size: 8 });
  poner("D2", "2024/09/18", { size: 9 });
  poner("E2", "REVISIÓN: 00", { size: 9 });
  poner("C3", "APROBÓ:", { size: 8 });
  ws.mergeCells("D3:E3");
  poner("D3", "Representante del Comité de Cumplimiento\nfecha: 2024/09/18", { size: 8 });
  caja(1, 1, 3, 5);
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 5; c++) {
    const cell = ws.getCell(r, c);
    cell.border = { top: lado, bottom: lado, left: lado, right: lado };
  }

  ws.mergeCells("A4:E4");
  ws.getRow(4).height = 20;
  poner("A4", "FORMATO PARA KARDEX", { bold: true, size: 10 });
  for (let c = 1; c <= 5; c++) ws.getCell(4, c).border = { bottom: lado, left: c === 1 ? lado : undefined, right: c === 5 ? lado : undefined };

  ws.getRow(5).height = 8;

  // ---------- ID y Descripción ----------
  ws.getRow(6).height = 22;
  poner("A6", "ID", { h: "left", size: 10 });
  ws.mergeCells("B6:E6");
  poner("B6", `${d.id || "—"}   ·   ${d.codigo}`, { bold: true, size: 12, h: "left" });
  ws.getRow(7).height = 32;
  poner("A7", "Descripción", { h: "left", size: 10 });
  ws.mergeCells("B7:E7");
  poner("B7", d.descripcion, { bold: true, size: 12, h: "left" });
  for (let r = 6; r <= 7; r++) for (let c = 1; c <= 5; c++) ws.getCell(r, c).border = { top: fino, bottom: fino, left: fino, right: fino };

  ws.getRow(8).height = 8;

  // ---------- Tabla de movimientos ----------
  const hdr = 9;
  ws.getRow(hdr).height = 22;
  ["Fecha", "Nombre", "Entrada", "Salida", "Existencia"].forEach((h, i) => {
    poner(`${"ABCDE"[i]}${hdr}`, h, { size: 10 });
    ws.getCell(hdr, i + 1).border = { top: lado, bottom: fino, left: fino, right: fino };
  });

  const ALTO = 20;
  const FILAS_MIN = 27; // la hoja se completa con renglones rayados en blanco, como la de papel
  let r = hdr + 1;
  const celdasFila = (n: number, anulada: boolean) => {
    ws.getRow(n).height = anulada ? 30 : ALTO;
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(n, c);
      cell.border = { top: fino, bottom: fino, left: fino, right: fino };
      cell.alignment = { vertical: "middle", horizontal: c <= 2 ? "left" : "center", wrapText: c === 2 };
      cell.font = { name: "Arial", size: 10, bold: c >= 3, color: { argb: anulada ? "FF888888" : "FF111111" }, strike: anulada };
      if (anulada) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    }
  };

  // Existencia inicial
  celdasFila(r, false);
  ws.getCell(r, 2).value = "Existencia inicial";
  ws.getCell(r, 2).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF555555" } };
  ws.getCell(r, 5).value = d.existenciaInicial;
  r++;
  const primera = r;

  for (const x of d.renglones) {
    celdasFila(r, !!x.anulado);
    ws.getCell(r, 1).value = fechaDia(x.fechaISO);
    const detalle = [x.referencia, x.concepto].filter(Boolean).join(" · ");
    ws.getCell(r, 2).value = `${x.nombre}${detalle ? "  —  " + detalle : ""}${x.anulado ? "\n" + x.anulado : ""}`;
    if (x.entrada != null) ws.getCell(r, 3).value = x.entrada;
    if (x.salida != null) ws.getCell(r, 4).value = x.salida;
    ws.getCell(r, 5).value = x.existencia;
    r++;
  }
  const ultima = r - 1;
  // Renglones en blanco hasta llenar la hoja
  const usados = d.renglones.length + 1;
  for (let i = usados; i < FILAS_MIN; i++) {
    celdasFila(r, false);
    r++;
  }
  for (let rr = primera - 1; rr < r; rr++) for (const c of [3, 4, 5]) ws.getCell(rr, c).numFmt = "General";
  caja(hdr, 1, r - 1, 5);

  // Totales (los renglones anulados no traen entrada/salida, no suman)
  r++;
  ws.getCell(r, 2).value = "TOTAL ENTRADAS / SALIDAS / EXISTENCIA ACTUAL";
  ws.getCell(r, 3).value = { formula: `SUM(C${primera}:C${Math.max(ultima, primera)})`, result: d.renglones.reduce((s, x) => s + (x.entrada ?? 0), 0) };
  ws.getCell(r, 4).value = { formula: `SUM(D${primera}:D${Math.max(ultima, primera)})`, result: d.renglones.reduce((s, x) => s + (x.salida ?? 0), 0) };
  ws.getCell(r, 5).value = d.existenciaActual;
  for (let c = 2; c <= 5; c++) {
    const cell = ws.getCell(r, c);
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: AZUL } };
    cell.alignment = { horizontal: c === 2 ? "right" : "center", vertical: "middle" };
    cell.border = { top: lado };
    if (c >= 3) cell.numFmt = "General";
  }
  r += 2;
  ws.mergeCells(r, 1, r, 5);
  ws.getCell(r, 1).value = `Generado el ${fechaHora(new Date().toISOString())} · Existencia actual: ${d.existenciaActual.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${d.unidad}`;
  ws.getCell(r, 1).font = { name: "Arial", size: 8, italic: true, color: { argb: "FF6B7280" } };

  ws.pageSetup.printTitlesRow = "1:9";
  ws.headerFooter.oddFooter = "&RPágina &P de &N";
  await descargarLibro(wb, nombreArchivo(d, "xlsx"));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 3 });

function fechaDia(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Renglones por hoja en el formato impreso (la hoja se completa con renglones en blanco, como la de papel). */
const FILAS_POR_HOJA = 27;

/**
 * Abre el Kardex en el mismo formato que la hoja de papel FO-GIGANTE-KAR-00 (encabezado con logo,
 * datos del formato, ID y descripción, y la tabla Fecha / Nombre / Entrada / Salida / Existencia
 * con renglones rayados hasta llenar la hoja) y lanza la impresión; ahí mismo se puede guardar como PDF.
 * Si existe /logo-gigante.png en el sitio, se usa como logo; si no, sale el nombre en letras.
 */
export function imprimirKardex(d: KardexExportDatos): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;

  type Fila = { fecha: string; nombre: string; detalle: string; ent: string; sal: string; exi: string; an: boolean };
  const datos: Fila[] = [
    { fecha: "", nombre: "", detalle: "Existencia inicial", ent: "", sal: "", exi: num(d.existenciaInicial), an: false },
    ...d.renglones.map((x) => ({
      fecha: fechaDia(x.fechaISO),
      nombre: x.nombre,
      detalle: `${x.referencia ? x.referencia : ""}${x.referencia && x.concepto ? " · " : ""}${x.concepto}${x.anulado ? " — " + x.anulado : ""}`,
      ent: x.entrada != null ? num(x.entrada) : "",
      sal: x.salida != null ? num(x.salida) : "",
      exi: num(x.existencia),
      an: !!x.anulado,
    })),
  ];
  const paginas = Math.max(1, Math.ceil(datos.length / FILAS_POR_HOJA));
  const logo = `${window.location.origin}/logo-gigante.png`;

  const encabezado = `
  <table class="enc">
    <tr>
      <td class="logo" rowspan="2">
        <img src="${esc(logo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="marca" style="display:none"><b>EL GIGANTE</b><span>DE LOS AZULEJOS Y MÁRMOLES</span></div>
      </td>
      <td class="oscuro" colspan="2"><b>FO-GIGANTE-KAR-00</b><br><b>Fecha de aplicación:<br>2024/09/18</b></td>
      <td class="c">FECHA DE<br>ELABORACIÓN</td>
      <td class="c">2024/09/17</td>
      <td class="c" colspan="2"><b>ELABORÓ:</b><br>Carlos Tabueña</td>
    </tr>
    <tr>
      <td class="c">FECHA DE<br>REVISIÓN</td>
      <td class="c">2024/09/18</td>
      <td class="c">REVISIÓN:</td>
      <td class="c">00</td>
      <td class="c">APROBÓ:</td>
      <td class="c peq">Representante del Comité de Cumplimiento<br>fecha: 2024/09/18</td>
    </tr>
  </table>
  <div class="barra">FORMATO PARA KARDEX</div>
  <table class="idt"><tr>
    <td class="k">ID</td><td class="idv">${esc(d.id || "—")}</td>
    <td class="k">Descripción</td><td class="vac"></td><td class="desc">${esc(d.descripcion)}</td>
  </tr></table>`;

  const hojas: string[] = [];
  for (let p = 0; p < paginas; p++) {
    const trozo = datos.slice(p * FILAS_POR_HOJA, (p + 1) * FILAS_POR_HOJA);
    let filas = "";
    for (let i = 0; i < FILAS_POR_HOJA; i++) {
      const f = trozo[i];
      if (!f) {
        filas += `<tr><td></td><td></td><td></td><td></td><td></td></tr>`;
        continue;
      }
      filas += `<tr class="${f.an ? "an" : ""}">
        <td>${esc(f.fecha)}</td>
        <td class="nom"><b>${esc(f.nombre)}</b>${f.detalle ? ` <span class="det">${esc(f.detalle)}</span>` : ""}</td>
        <td class="n">${esc(f.ent)}</td><td class="n">${esc(f.sal)}</td><td class="n ex">${esc(f.exi)}</td></tr>`;
    }
    hojas.push(`<section class="pg">${encabezado}
      <table class="mov">
        <thead><tr><th style="width:15%">Fecha</th><th>Nombre</th><th style="width:14%">Entrada</th><th style="width:14%">Salida</th><th style="width:16%">Existencia</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="pie">página ${p + 1} de ${paginas}</div></section>`);
  }

  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Kardex ${esc(d.id || d.codigo)}</title>
<style>
@page { size: letter portrait; margin: 8mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 10px; }
.pg { position: relative; width: 100%; height: 262mm; page-break-after: always; overflow: hidden; }
.pg:last-child { page-break-after: auto; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.enc td { border: 1.5px solid #333; padding: 2mm 1.5mm; text-align: center; vertical-align: middle; font-size: 9.5px; }
.enc .logo { width: 30%; }
.enc .logo img { max-width: 100%; max-height: 24mm; }
.marca b { display: block; font-size: 17px; letter-spacing: .5px; }
.marca span { display: block; font-size: 6.5px; letter-spacing: .3px; }
.enc .oscuro { background: #3a3a3a; color: #fff; font-size: 10.5px; width: 24%; line-height: 1.25; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.enc .c { font-size: 8.5px; line-height: 1.3; }
.enc .peq { font-size: 7px; }
.barra { border: 1.5px solid #333; border-top: 0; text-align: center; font-weight: bold; padding: 2.2mm 0; font-size: 10px; letter-spacing: .3px; }
.idt { margin-top: 5mm; border: 1.5px solid #333; }
.idt td { border: 1px solid #333; padding: 2.2mm 2mm; font-size: 10px; }
.idt .k { width: 11%; font-weight: normal; text-align: left; }
.idt .idv { width: 21%; text-align: center; font-weight: bold; font-size: 11px; }
.idt .vac { width: 5%; }
.idt .desc { font-weight: bold; font-size: 11px; }
.idt td:nth-child(3) { width: 14%; }
.mov { margin-top: 3mm; border: 1.5px solid #333; }
.mov th { border: 1px solid #333; padding: 2.5mm 1mm; font-weight: normal; font-size: 10px; text-align: center; }
.mov td { border: 1px solid #555; height: 7mm; padding: 0 1.5mm; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mov td.n { text-align: center; font-weight: bold; }
.mov td.ex { font-size: 11px; }
.mov .det { font-size: 8px; color: #555; font-weight: normal; }
.mov tr.an td { color: #888; text-decoration: line-through; background: #f1f1f1; }
.pie { position: absolute; right: 2mm; bottom: 0; font-size: 10px; color: #444; }
</style></head><body>${hojas.join("")}
<script>window.onload=function(){setTimeout(function(){window.print();},300)}</script>
</body></html>`);
  w.document.close();
  return true;
}
