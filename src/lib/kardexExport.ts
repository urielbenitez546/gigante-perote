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

/** Abre una página limpia con el Kardex y lanza la impresión (ahí mismo se puede "Guardar como PDF"). */
export function imprimirKardex(d: KardexExportDatos): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  const totE = d.renglones.reduce((s, x) => s + (x.entrada ?? 0), 0);
  const totS = d.renglones.reduce((s, x) => s + (x.salida ?? 0), 0);
  const filas = d.renglones
    .map(
      (x) => `<tr class="${x.anulado ? "an" : ""}">
        <td>${esc(fechaHora(x.fechaISO))}</td>
        <td><b>${esc(x.nombre)}</b><br><span class="s">${esc(x.concepto)}${x.referencia ? " · " + esc(x.referencia) : ""}</span>${
          x.anulado ? `<br><span class="s rojo">${esc(x.anulado)}</span>` : ""
        }</td>
        <td class="n ent">${x.entrada != null ? num(x.entrada) : ""}</td>
        <td class="n sal">${x.salida != null ? num(x.salida) : ""}</td>
        <td class="n"><b>${num(x.existencia)}</b></td></tr>`
    )
    .join("");
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Kardex ${esc(d.id || d.codigo)}</title>
<style>
@page { size: letter portrait; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; margin: 0; }
h1 { font-size: 16px; margin: 0; color: #1f3a5f; }
.sub { color: #6b7280; font-size: 10px; margin: 2px 0 10px; }
.ficha { display: grid; grid-template-columns: auto 1fr; border: 1px solid #9ca3af; margin-bottom: 10px; }
.ficha div { padding: 4px 8px; border-bottom: 1px solid #d1d5db; }
.ficha .k { background: #f3f4f6; font-weight: bold; color: #1f3a5f; border-right: 1px solid #d1d5db; }
.ficha div:nth-last-child(-n+2) { border-bottom: 0; }
table { width: 100%; border-collapse: collapse; }
th { background: #1f3a5f; color: #fff; text-align: left; padding: 5px 6px; font-size: 10.5px; }
th.n, td.n { text-align: right; }
td { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
.s { color: #6b7280; font-size: 9.5px; }
.rojo { color: #c8102e; }
.ent { color: #047857; font-weight: bold; }
.sal { color: #c8102e; font-weight: bold; }
tr.an td { background: #f3f4f6; color: #9ca3af; text-decoration: line-through; }
tr.an td .s.rojo { text-decoration: none; display: inline-block; }
tr.tot td { border-top: 2px solid #1f3a5f; font-weight: bold; color: #1f3a5f; }
.pie { margin-top: 8px; color: #6b7280; font-size: 9px; }
</style></head><body>
<h1>KARDEX DE PRODUCTO</h1>
<div class="sub">FO-GIGANTE-KAR-00 · El Gigante de los Azulejos y Mármoles — Sucursal Perote</div>
<div class="ficha">
  <div class="k">ID</div><div><b>${esc(d.id || "—")}</b> · ${esc(d.codigo)}</div>
  <div class="k">Descripción</div><div>${esc(d.descripcion)}</div>
  <div class="k">Unidad</div><div>${esc(d.unidad)}</div>
</div>
<table>
<thead><tr><th style="width:105px">Fecha</th><th>Nombre / concepto</th><th class="n" style="width:62px">Entrada</th><th class="n" style="width:62px">Salida</th><th class="n" style="width:78px">Existencia</th></tr></thead>
<tbody>
<tr><td>—</td><td><i style="color:#6b7280">Existencia antes del primer renglón</i></td><td></td><td></td><td class="n"><b>${num(d.existenciaInicial)}</b></td></tr>
${filas}
<tr class="tot"><td></td><td style="text-align:right">TOTALES</td><td class="n">${num(totE)}</td><td class="n">${num(totS)}</td><td class="n">${num(d.existenciaActual)}</td></tr>
</tbody></table>
<div class="pie">Generado el ${esc(fechaHora(new Date().toISOString()))} · Existencia actual: ${num(d.existenciaActual)} ${esc(d.unidad)}. Los renglones tachados fueron anulados.</div>
<script>window.onload=function(){setTimeout(function(){window.print();},300)}</script>
</body></html>`);
  w.document.close();
  return true;
}
