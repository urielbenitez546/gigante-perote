import { descargarLibro } from "./cobranzaExcel";

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

export async function exportarKardexExcel(d: KardexExportDatos) {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "El Gigante de los Azulejos y Mármoles — Perote";
  const ws = wb.addWorksheet("Kardex", {
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ state: "frozen", ySplit: 8 }],
  });
  ws.columns = [
    { width: 17 }, // fecha
    { width: 24 }, // nombre
    { width: 30 }, // concepto
    { width: 24 }, // referencia
    { width: 11 }, // entrada
    { width: 11 }, // salida
    { width: 13 }, // existencia
  ];

  ws.mergeCells("A1:G1");
  const t = ws.getCell("A1");
  t.value = "KARDEX DE PRODUCTO — FO-GIGANTE-KAR-00";
  t.font = { name: "Calibri", size: 15, bold: true, color: { argb: AZUL } };
  ws.mergeCells("A2:G2");
  ws.getCell("A2").value = "EL GIGANTE DE LOS AZULEJOS Y MÁRMOLES — SUCURSAL PEROTE";
  ws.getCell("A2").font = { name: "Calibri", size: 10, color: { argb: "FF6B7280" } };

  const datos: [string, string][] = [
    ["ID", d.id || "—"],
    ["Código", d.codigo],
    ["Descripción", d.descripcion],
    ["Unidad", d.unidad],
  ];
  datos.forEach(([k, v], i) => {
    const r = 3 + i;
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { name: "Calibri", bold: true, color: { argb: AZUL } };
    ws.mergeCells(r, 2, r, 7);
    ws.getCell(r, 2).value = v;
    ws.getCell(r, 2).font = { name: "Calibri", bold: true, size: 11 };
    ws.getCell(r, 2).alignment = { horizontal: "left" };
  });

  const hdr = 8;
  ["Fecha", "Nombre", "Concepto", "Referencia", "Entrada", "Salida", "Existencia"].forEach((h, i) => {
    const c = ws.getCell(hdr, i + 1);
    c.value = h;
    c.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { horizontal: i >= 4 ? "right" : "left", vertical: "middle" };
  });

  let r = hdr + 1;
  const borde = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
  const filaBase = (n: number, anulada: boolean) => {
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(n, c);
      cell.border = { top: borde, bottom: borde, left: borde, right: borde };
      cell.alignment = { vertical: "top", wrapText: c === 3 || c === 4, horizontal: c >= 5 ? "right" : "left" };
      cell.font = { name: "Calibri", size: 10, color: { argb: anulada ? "FF9CA3AF" : "FF111827" }, strike: anulada && c <= 4 };
      if (anulada) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } };
    }
  };

  // Renglón inicial
  ws.getCell(r, 2).value = "Existencia antes del primer renglón";
  ws.getCell(r, 7).value = d.existenciaInicial;
  filaBase(r, false);
  ws.getCell(r, 2).font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF6B7280" } };
  ws.getCell(r, 7).font = { name: "Calibri", size: 10, bold: true };
  r++;
  const primera = r;

  for (const x of d.renglones) {
    ws.getCell(r, 1).value = fechaHora(x.fechaISO);
    ws.getCell(r, 2).value = x.nombre;
    ws.getCell(r, 3).value = x.concepto;
    ws.getCell(r, 4).value = x.anulado ? `${x.referencia ? x.referencia + " · " : ""}${x.anulado}` : x.referencia;
    if (x.entrada != null) ws.getCell(r, 5).value = x.entrada;
    if (x.salida != null) ws.getCell(r, 6).value = x.salida;
    ws.getCell(r, 7).value = x.existencia;
    filaBase(r, !!x.anulado);
    if (!x.anulado) {
      ws.getCell(r, 5).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
      ws.getCell(r, 6).font = { name: "Calibri", size: 10, bold: true, color: { argb: ROJO } };
      ws.getCell(r, 7).font = { name: "Calibri", size: 10, bold: true };
    }
    if (x.anulado) ws.getRow(r).height = 40;
    for (const c of [5, 6, 7]) ws.getCell(r, c).numFmt = "#,##0.###";
    r++;
  }
  const ultima = r - 1;
  ws.getCell(hdr + 1, 7).numFmt = "#,##0.###";

  // Totales (los renglones anulados no traen entrada/salida, no suman)
  ws.getCell(r, 4).value = "TOTALES";
  ws.getCell(r, 5).value = { formula: `SUM(E${primera}:E${Math.max(ultima, primera)})`, result: d.renglones.reduce((s, x) => s + (x.entrada ?? 0), 0) };
  ws.getCell(r, 6).value = { formula: `SUM(F${primera}:F${Math.max(ultima, primera)})`, result: d.renglones.reduce((s, x) => s + (x.salida ?? 0), 0) };
  ws.getCell(r, 7).value = d.existenciaActual;
  for (let c = 4; c <= 7; c++) {
    const cell = ws.getCell(r, c);
    cell.font = { name: "Calibri", bold: true, size: 11, color: { argb: AZUL } };
    cell.border = { top: { style: "medium", color: { argb: AZUL } } };
    cell.alignment = { horizontal: c === 4 ? "right" : "right" };
    if (c >= 5) cell.numFmt = "#,##0.###";
  }
  r += 2;
  ws.mergeCells(r, 1, r, 7);
  ws.getCell(r, 1).value = `Generado el ${fechaHora(new Date().toISOString())} · Existencia actual: ${d.existenciaActual.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${d.unidad}`;
  ws.getCell(r, 1).font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF6B7280" } };

  ws.pageSetup.printTitlesRow = `${hdr}:${hdr}`;
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
