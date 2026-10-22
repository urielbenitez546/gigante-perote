import type { Workbook, Worksheet, Row, Cell, Borders } from "exceljs";

// ============================================================
// Excel de Cobranza con el mismo formato que lleva Caja:
//  - Hoja del mes con PAGADOS / APARTADOS / ENTREGADOS por vendedor
//  - Columnas VENDEDOR, FECHA, FACTURA, CLIENTE, VENTA, ABONO, SALDO y
//    luego FECHA / ABONO / RECIBO por cada cobranza, SALDO y COMENTARIOS
//  - Hoja TOTAL (por mes y por vendedor) con SISTEMA y DIFERENCIA
// Más: Corte de caja (Ventas y Cobranza) e Historial de pagos.
// Los saldos y totales son fórmulas: si Caja cambia un abono en el Excel,
// todo se recalcula (y la fórmula de saldo ya no tiene el error del original).
// ============================================================

export interface PagoCuentaXLS {
  fechaPago: string; // yyyy-mm-dd
  monto: number;
  tipo: "venta" | "cobranza";
  recibo: string;
}

export interface CuentaXLS {
  vendedor: string;
  folio: string;
  factura: string;
  cliente: string;
  fecha: string; // yyyy-mm-dd (día de la venta)
  total: number;
  entregada: boolean;
  /** Solo pagos vigentes (no anulados). */
  pagos: PagoCuentaXLS[];
}

export interface PagoCorteXLS {
  fechaCaja: string;
  fechaPago: string;
  tipo: "venta" | "cobranza";
  folio: string;
  factura: string;
  cliente: string;
  vendedor: string;
  metodo: string;
  origen: string;
  recibo: string;
  monto: number;
  anulado: boolean;
  editado: boolean;
  motivoAnulacion: string;
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const MES_CORTO = ["ENE", "FEB", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGO", "SEP", "OCT", "NOV", "DIC"];
export const nombreMes = (m: number) => MESES[m - 1];
export const nombreMesCorto = (m: number) => MES_CORTO[m - 1];

const MONEY = '"$"#,##0.00;[Red]-"$"#,##0.00';
const FECHA = "dd/mm/yyyy";
const THIN: Partial<Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};
const GRIS = "FFE5E7EB";
const AMARILLO = "FFFFFF00";
const AZUL = "FF0000FF";
const ROJO = "FFFF0000";

const r2 = (n: number) => Math.round(n * 100) / 100;

function fechaDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Letra de columna (1 = A). */
export function letra(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function estilo(cell: Cell, o: { bold?: boolean; size?: number; color?: string; fill?: string; fmt?: string; align?: "left" | "center" | "right"; border?: boolean; wrap?: boolean }) {
  cell.font = { name: "Calibri", size: o.size ?? 11, bold: o.bold ?? false, color: o.color ? { argb: o.color } : undefined };
  if (o.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
  if (o.fmt) cell.numFmt = o.fmt;
  cell.alignment = { horizontal: o.align ?? "center", vertical: "middle", wrapText: o.wrap ?? false };
  if (o.border !== false) cell.border = THIN;
}

function titulo(ws: Worksheet, lineas: { texto: string; size: number; color: string }[], hasta: number) {
  lineas.forEach((l, i) => {
    const row = i + 1;
    ws.mergeCells(row, 1, row, Math.max(hasta, 6));
    const c = ws.getCell(row, 1);
    c.value = l.texto;
    c.font = { name: "Calibri", size: l.size, bold: true, color: { argb: l.color } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(row).height = l.size + 10;
  });
}

// ------------------------------------------------------------
// Cálculo de una cuenta (una factura)
// ------------------------------------------------------------
function desglose(c: CuentaXLS) {
  const delDia = c.pagos.filter((p) => p.tipo === "venta");
  const cobranzas = c.pagos.filter((p) => p.tipo === "cobranza").sort((a, b) => a.fechaPago.localeCompare(b.fechaPago));
  const abonoDia = r2(delDia.reduce((s, p) => s + p.monto, 0));
  const saldo = r2(c.total - abonoDia - cobranzas.reduce((s, p) => s + p.monto, 0));
  return { abonoDia, cobranzas, saldo };
}

export const tieneSaldo = (c: CuentaXLS) => desglose(c).saldo > 0.005;

// ------------------------------------------------------------
// Tabla de cuentas (mismas columnas que el Excel de Caja)
// ------------------------------------------------------------
interface OpcTabla {
  nTrip: number;
  extras: boolean; // FOLIO, MES, AÑO al final (para las hojas acumuladas)
}

function posiciones(nTrip: number) {
  const primerTrip = 8;
  const saldoFinal = primerTrip + 3 * nTrip;
  return {
    comentarios: saldoFinal + 1,
    folio: saldoFinal + 2,
    mes: saldoFinal + 3,
    anio: saldoFinal + 4,
    saldoFinal,
    colFecha: (k: number) => primerTrip + 3 * k,
    colAbono: (k: number) => primerTrip + 3 * k + 1,
    colRecibo: (k: number) => primerTrip + 3 * k + 2,
  };
}

function anchos(ws: Worksheet, nTrip: number, extras: boolean) {
  const pos = posiciones(nTrip);
  const w = (c: number, ancho: number) => (ws.getColumn(c).width = ancho);
  w(1, 16); w(2, 12); w(3, 13); w(4, 38); w(5, 15); w(6, 15); w(7, 15);
  for (let k = 0; k < nTrip; k++) {
    w(pos.colFecha(k), 12); w(pos.colAbono(k), 15); w(pos.colRecibo(k), 10);
  }
  w(pos.saldoFinal, 16); w(pos.comentarios, 30);
  if (extras) { w(pos.folio, 11); w(pos.mes, 6); w(pos.anio, 7); }
}

function encabezado(ws: Worksheet, fila: number, nTrip: number, extras: boolean): Row {
  const pos = posiciones(nTrip);
  const row = ws.getRow(fila);
  const set = (c: number, t: string) => {
    const cell = row.getCell(c);
    cell.value = t;
    estilo(cell, { bold: true, size: 12, fill: GRIS });
  };
  ["VENDEDOR", "FECHA", "FACTURA", "CLIENTE", "VENTA", "ABONO", "SALDO"].forEach((t, i) => set(i + 1, t));
  for (let k = 0; k < nTrip; k++) {
    set(pos.colFecha(k), "FECHA");
    set(pos.colAbono(k), "ABONO");
    set(pos.colRecibo(k), "RECIBO");
  }
  set(pos.saldoFinal, "SALDO");
  set(pos.comentarios, "COMENTARIOS");
  if (extras) { set(pos.folio, "FOLIO"); set(pos.mes, "MES"); set(pos.anio, "AÑO"); }
  row.height = 26;
  return row;
}

function filaCuenta(ws: Worksheet, fila: number, c: CuentaXLS, o: OpcTabla) {
  const pos = posiciones(o.nTrip);
  const d = desglose(c);
  const row = ws.getRow(fila);
  const put = (col: number, value: Cell["value"], fmt?: string, extra?: { color?: string; bold?: boolean; align?: "left" | "center" | "right" }) => {
    const cell = row.getCell(col);
    cell.value = value;
    estilo(cell, { fmt, size: 11, bold: extra?.bold, color: extra?.color, align: extra?.align });
  };

  put(1, c.vendedor);
  put(2, fechaDate(c.fecha), FECHA);
  put(3, c.factura || c.folio);
  put(4, c.cliente, undefined, { align: "left" });
  put(5, r2(c.total), MONEY);
  put(6, d.abonoDia > 0 ? d.abonoDia : null, MONEY);
  put(7, { formula: `E${fila}-F${fila}`, result: r2(c.total - d.abonoDia) }, MONEY, { color: ROJO, bold: true });

  const abonoCols: string[] = [];
  for (let k = 0; k < o.nTrip; k++) {
    const p = d.cobranzas[k];
    put(pos.colFecha(k), p ? fechaDate(p.fechaPago) : null, FECHA);
    put(pos.colAbono(k), p ? r2(p.monto) : null, MONEY);
    put(pos.colRecibo(k), p ? p.recibo || null : null);
    abonoCols.push(`${letra(pos.colAbono(k))}${fila}`);
  }
  // Saldo final = SALDO - cada abono. (Sin el error de la fórmula original.)
  const formula = abonoCols.length ? `G${fila}-${abonoCols.join("-")}` : `G${fila}`;
  put(pos.saldoFinal, { formula, result: d.saldo }, MONEY, { bold: true });
  put(pos.comentarios, null);

  if (o.extras) {
    const [y, m] = c.fecha.split("-").map(Number);
    put(pos.folio, c.folio);
    put(pos.mes, m);
    put(pos.anio, y);
  }
  row.height = 20;
}

/** Escribe encabezado + cuentas (+ subtotal). Devuelve la fila siguiente y la celda del subtotal. */
function bloqueCuentas(ws: Worksheet, fila: number, cuentas: CuentaXLS[], o: OpcTabla, subtotal: string | null) {
  encabezado(ws, fila, o.nTrip, o.extras);
  const pos = posiciones(o.nTrip);
  let r = fila + 1;
  const primera = r;
  for (const c of cuentas) {
    filaCuenta(ws, r, c, o);
    r++;
  }
  const ultima = r - 1;
  let celdaSubtotal: string | null = null;
  if (subtotal !== null) {
    const colL = letra(pos.saldoFinal);
    const etiqueta = ws.getRow(r).getCell(pos.saldoFinal - 1);
    etiqueta.value = subtotal;
    estilo(etiqueta, { bold: true, fill: AMARILLO, align: "right" });
    const cell = ws.getRow(r).getCell(pos.saldoFinal);
    const total = r2(cuentas.reduce((s, c) => s + desglose(c).saldo, 0));
    cell.value = cuentas.length ? { formula: `SUM(${colL}${primera}:${colL}${ultima})`, result: total } : 0;
    estilo(cell, { bold: true, size: 14, fill: AMARILLO, fmt: MONEY });
    celdaSubtotal = `${colL}${r}`;
    r++;
  }
  return { siguiente: r, celdaSubtotal, primera, ultima };
}

function porVendedor(cuentas: CuentaXLS[]): [string, CuentaXLS[]][] {
  const m = new Map<string, CuentaXLS[]>();
  for (const c of cuentas) {
    const arr = m.get(c.vendedor) ?? [];
    arr.push(c);
    m.set(c.vendedor, arr);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([v, arr]) => [v, arr.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.folio.localeCompare(y.folio))]);
}

const maxCobranzas = (cuentas: CuentaXLS[], minimo: number) =>
  Math.max(minimo, ...cuentas.map((c) => c.pagos.filter((p) => p.tipo === "cobranza").length));

function seccionTitulo(ws: Worksheet, fila: number, texto: string) {
  const c = ws.getCell(fila, 5);
  c.value = texto;
  c.font = { name: "Calibri", size: 20, bold: true, color: { argb: ROJO } };
  c.alignment = { horizontal: "center" };
  ws.getRow(fila).height = 30;
}

// ------------------------------------------------------------
// 1) Cobranza del mes (formato de Caja)
// ------------------------------------------------------------
export interface DatosMes {
  anio: number;
  mes: number; // 1-12
  sucursal: string;
  /** Todas las ventas hechas en el mes (pagadas o no). */
  cuentasMes: CuentaXLS[];
  /** Todas las que hoy tienen saldo, de cualquier mes. */
  cuentasConSaldo: CuentaXLS[];
  ventasDelMes: number; // pagos tipo venta que entraron a Caja en el mes
  cobranzaDelMes: number; // pagos tipo cobranza que entraron a Caja en el mes
}

export function libroCobranzaMes(wb: Workbook, d: DatosMes) {
  const wsTotal = wb.addWorksheet("TOTAL", { views: [{ showGridLines: false }] });
  const wsMes = wb.addWorksheet(nombreMesCorto(d.mes), { views: [{ showGridLines: false }] });
  const wsAp = wb.addWorksheet("APARTADOS", { views: [{ showGridLines: false }] });
  const wsEn = wb.addWorksheet("ENTREGADOS", { views: [{ showGridLines: false }] });

  const cabecera = (ws: Worksheet, extra: string, anchoCols: number) =>
    titulo(
      ws,
      [
        { texto: "PISOS AZULEJOS Y SANITARIOS DEL GOLFO, S.A. DE C.V.", size: 16, color: AZUL },
        { texto: `SUCURSAL: ${d.sucursal}`, size: 14, color: "FF0066FF" },
        { texto: extra, size: 12, color: "FF111111" },
      ],
      anchoCols
    );

  // ---- Hoja del mes ----
  const pagados = d.cuentasMes.filter((c) => !tieneSaldo(c));
  const aparts = d.cuentasMes.filter((c) => tieneSaldo(c) && !c.entregada);
  const entreg = d.cuentasMes.filter((c) => tieneSaldo(c) && c.entregada);
  const nTrip = maxCobranzas(d.cuentasMes, 3);
  const opMes: OpcTabla = { nTrip, extras: false };
  const ultimaCol = posiciones(nTrip).comentarios;
  cabecera(
    wsMes,
    `${nombreMes(d.mes)} ${d.anio}  ·  VENTA DEL MES: $${d.ventasDelMes.toLocaleString("en-US", { minimumFractionDigits: 2 })}  ·  COBRANZA DEL MES: $${d.cobranzaDelMes.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ultimaCol
  );
  anchos(wsMes, nTrip, false);
  wsMes.views = [{ showGridLines: false, state: "frozen", ySplit: 3 }];

  let fila = 5;
  seccionTitulo(wsMes, fila, "PAGADOS");
  fila += 2;
  const bPag = bloqueCuentas(wsMes, fila, pagados.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.folio.localeCompare(b.folio)), opMes, null);
  fila = bPag.siguiente + 2;

  const subtotalesAp: string[] = [];
  seccionTitulo(wsMes, fila, "APARTADOS");
  fila += 2;
  const vendAp = porVendedor(aparts);
  if (!vendAp.length) {
    wsMes.getCell(fila, 1).value = "Sin apartados con saldo en este mes.";
    fila += 2;
  }
  for (const [v, arr] of vendAp) {
    wsMes.getCell(fila, 1).value = `VENDEDOR: ${v}`;
    wsMes.getCell(fila, 1).font = { name: "Calibri", bold: true, size: 12 };
    fila++;
    const b = bloqueCuentas(wsMes, fila, arr, opMes, "TOTAL");
    if (b.celdaSubtotal) subtotalesAp.push(b.celdaSubtotal);
    fila = b.siguiente + 1;
  }

  fila += 1;
  const subtotalesEn: string[] = [];
  seccionTitulo(wsMes, fila, "ENTREGADOS");
  fila += 2;
  const vendEn = porVendedor(entreg);
  if (!vendEn.length) {
    wsMes.getCell(fila, 1).value = "Sin entregados con saldo en este mes.";
    fila += 2;
  }
  for (const [v, arr] of vendEn) {
    wsMes.getCell(fila, 1).value = `VENDEDOR: ${v}`;
    wsMes.getCell(fila, 1).font = { name: "Calibri", bold: true, size: 12 };
    fila++;
    const b = bloqueCuentas(wsMes, fila, arr, opMes, "TOTAL");
    if (b.celdaSubtotal) subtotalesEn.push(b.celdaSubtotal);
    fila = b.siguiente + 1;
  }

  // Totales generales del mes
  fila += 1;
  const posM = posiciones(nTrip);
  const totalLinea = (texto: string, celdas: string[], valor: number) => {
    wsMes.mergeCells(fila, posM.saldoFinal - 3, fila, posM.saldoFinal - 1);
    const e = wsMes.getRow(fila).getCell(posM.saldoFinal - 3);
    e.value = texto;
    estilo(e, { bold: true, fill: AMARILLO, align: "right" });
    const c = wsMes.getRow(fila).getCell(posM.saldoFinal);
    c.value = celdas.length ? { formula: celdas.join("+"), result: valor } : 0;
    estilo(c, { bold: true, size: 14, fill: AMARILLO, fmt: MONEY });
    fila++;
  };
  totalLinea("TOTAL APARTADOS DEL MES", subtotalesAp, r2(aparts.reduce((s, c) => s + desglose(c).saldo, 0)));
  totalLinea("TOTAL ENTREGADOS DEL MES", subtotalesEn, r2(entreg.reduce((s, c) => s + desglose(c).saldo, 0)));

  // ---- Hojas acumuladas (todo lo que hoy tiene saldo) ----
  const apTodas = d.cuentasConSaldo.filter((c) => !c.entregada);
  const enTodas = d.cuentasConSaldo.filter((c) => c.entregada);

  const acumulada = (ws: Worksheet, lista: CuentaXLS[], nombre: string) => {
    const orden = [...lista].sort((a, b) => a.vendedor.localeCompare(b.vendedor) || a.fecha.localeCompare(b.fecha) || a.folio.localeCompare(b.folio));
    const nt = maxCobranzas(orden, 4);
    const op: OpcTabla = { nTrip: nt, extras: true };
    const pos = posiciones(nt);
    cabecera(ws, `${nombre} CON SALDO (todos los meses)`, pos.anio);
    anchos(ws, nt, true);
    const b = bloqueCuentas(ws, 5, orden, op, "TOTAL");
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: 5 }];
    if (orden.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + orden.length, column: pos.anio } };
    return { saldoCol: letra(pos.saldoFinal), vendedorCol: "A", mesCol: letra(pos.mes), anioCol: letra(pos.anio), hoja: nombre, filas: b };
  };
  const refAp = acumulada(wsAp, apTodas, "APARTADOS");
  const refEn = acumulada(wsEn, enTodas, "ENTREGADOS");

  // ---- Hoja TOTAL ----
  cabecera(wsTotal, `RESUMEN ${d.anio}`, 8);
  [3, 14, 3, 14, 14, 3].forEach((w, i) => (wsTotal.getColumn(i + 1).width = w));
  wsTotal.getColumn(2).width = 30;
  wsTotal.getColumn(3).width = 18;
  wsTotal.getColumn(5).width = 26;
  wsTotal.getColumn(6).width = 18;

  const sumifsMes = (ref: typeof refAp, n: number) =>
    `SUMIFS(${ref.hoja}!$${ref.saldoCol}:$${ref.saldoCol},${ref.hoja}!$${ref.mesCol}:$${ref.mesCol},${n},${ref.hoja}!$${ref.anioCol}:$${ref.anioCol},${d.anio})`;
  const sumifsVend = (ref: typeof refAp, celdaVend: string) =>
    `SUMIFS(${ref.hoja}!$${ref.saldoCol}:$${ref.saldoCol},${ref.hoja}!$A:$A,${celdaVend})`;

  const saldoMes = (lista: CuentaXLS[], n: number) =>
    r2(lista.filter((c) => Number(c.fecha.slice(5, 7)) === n && Number(c.fecha.slice(0, 4)) === d.anio).reduce((s, c) => s + desglose(c).saldo, 0));

  const tablaMeses = (colIni: number, tituloT: string, ref: typeof refAp, lista: CuentaXLS[]) => {
    const t = wsTotal.getCell(10, colIni);
    t.value = tituloT;
    t.font = { name: "Calibri", bold: true, size: 14, color: { argb: ROJO } };
    ["MES", "TOTAL"].forEach((h, i) => {
      const c = wsTotal.getCell(12, colIni + i);
      c.value = h;
      estilo(c, { bold: true, fill: GRIS });
    });
    for (let n = 1; n <= 12; n++) {
      const a = wsTotal.getCell(12 + n, colIni);
      a.value = MESES[n - 1];
      estilo(a, { align: "left" });
      const b = wsTotal.getCell(12 + n, colIni + 1);
      b.value = { formula: sumifsMes(ref, n), result: saldoMes(lista, n) };
      estilo(b, { fmt: MONEY });
    }
    const e = wsTotal.getCell(25, colIni);
    e.value = `TOTAL ${tituloT.split(" ")[0]}`;
    estilo(e, { bold: true, fill: AMARILLO, align: "left" });
    const f = wsTotal.getCell(25, colIni + 1);
    const colL = letra(colIni + 1);
    f.value = { formula: `SUM(${colL}13:${colL}24)`, result: r2(Array.from({ length: 12 }, (_, i) => saldoMes(lista, i + 1)).reduce((s, x) => s + x, 0)) };
    estilo(f, { bold: true, fill: AMARILLO, fmt: MONEY });
    return `${colL}25`;
  };
  tablaMeses(2, "ENTREGADOS POR MES", refEn, enTodas);
  tablaMeses(5, "APARTADOS POR MES", refAp, apTodas);

  const vendedores = [...new Set(d.cuentasConSaldo.map((c) => c.vendedor))].sort();
  const saldoVend = (lista: CuentaXLS[], v: string) => r2(lista.filter((c) => c.vendedor === v).reduce((s, c) => s + desglose(c).saldo, 0));
  const tablaVend = (colIni: number, tituloT: string, ref: typeof refAp, lista: CuentaXLS[]) => {
    const base = 28;
    const t = wsTotal.getCell(base, colIni);
    t.value = tituloT;
    t.font = { name: "Calibri", bold: true, size: 14, color: { argb: ROJO } };
    ["VENDEDOR", "TOTAL"].forEach((h, i) => {
      const c = wsTotal.getCell(base + 2, colIni + i);
      c.value = h;
      estilo(c, { bold: true, fill: GRIS });
    });
    vendedores.forEach((v, i) => {
      const a = wsTotal.getCell(base + 3 + i, colIni);
      a.value = v;
      estilo(a, { align: "left" });
      const b = wsTotal.getCell(base + 3 + i, colIni + 1);
      b.value = { formula: sumifsVend(ref, `${letra(colIni)}${base + 3 + i}`), result: saldoVend(lista, v) };
      estilo(b, { fmt: MONEY });
    });
    const fin = base + 3 + vendedores.length;
    const e = wsTotal.getCell(fin, colIni);
    e.value = "TOTAL";
    estilo(e, { bold: true, fill: AMARILLO, align: "left" });
    const colL = letra(colIni + 1);
    const f = wsTotal.getCell(fin, colIni + 1);
    f.value = vendedores.length
      ? { formula: `SUM(${colL}${base + 3}:${colL}${fin - 1})`, result: r2(lista.reduce((s, c) => s + desglose(c).saldo, 0)) }
      : 0;
    estilo(f, { bold: true, fill: AMARILLO, fmt: MONEY });
    return { celda: `${colL}${fin}`, fila: fin };
  };
  const tvE = tablaVend(2, "ENTREGADOS POR VENDEDOR", refEn, enTodas);
  const tvA = tablaVend(5, "APARTADOS POR VENDEDOR", refAp, apTodas);

  const filaCuadre = Math.max(tvE.fila, tvA.fila) + 3;
  const totalGeneral = r2(d.cuentasConSaldo.reduce((s, c) => s + desglose(c).saldo, 0));
  const put = (r: number, c: number, v: Cell["value"], o: Parameters<typeof estilo>[1]) => {
    const cell = wsTotal.getCell(r, c);
    cell.value = v;
    estilo(cell, o);
  };
  put(filaCuadre, 2, "TOTAL POR COBRAR:", { bold: true, align: "left" });
  put(filaCuadre, 3, { formula: `${tvE.celda}+${tvA.celda}`, result: totalGeneral }, { bold: true, fmt: MONEY });
  put(filaCuadre + 2, 2, "SISTEMA (saldo de SIGAM)", { bold: true, align: "left", fill: AMARILLO });
  put(filaCuadre + 2, 3, null, { fmt: MONEY, fill: AMARILLO });
  put(filaCuadre + 3, 2, "DIFERENCIA", { bold: true, align: "left" });
  put(filaCuadre + 3, 3, { formula: `C${filaCuadre}-C${filaCuadre + 2}`, result: totalGeneral }, { bold: true, fmt: MONEY });
  wsTotal.getCell(filaCuadre + 5, 2).value = "El saldo se calcula solo con los pagos registrados en el sistema (Cobranza y Corte).";
  wsTotal.getCell(filaCuadre + 5, 2).font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
}

// ------------------------------------------------------------
// 2) Corte de caja (Ventas y Cobranza)
// ------------------------------------------------------------
export interface DatosCorte {
  desde: string;
  hasta: string;
  sucursal: string;
  pagos: PagoCorteXLS[]; // solo vigentes
}

const COLS_PAGO = ["FECHA EN CAJA", "FECHA DE PAGO", "FOLIO", "FACTURA", "CLIENTE", "VENDEDOR", "MÉTODO", "CÓMO ENTRÓ", "RECIBO", "MONTO"];
const ANCHOS_PAGO = [14, 14, 11, 12, 36, 14, 18, 18, 10, 16];

function hojaListaPagos(ws: Worksheet, titulo1: string, lista: PagoCorteXLS[]) {
  ws.mergeCells(1, 1, 1, 10);
  const t = ws.getCell(1, 1);
  t.value = titulo1;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: AZUL } };
  t.alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;
  COLS_PAGO.forEach((h, i) => {
    const c = ws.getRow(3).getCell(i + 1);
    c.value = h;
    estilo(c, { bold: true, size: 12, fill: GRIS });
    ws.getColumn(i + 1).width = ANCHOS_PAGO[i];
  });
  ws.getRow(3).height = 24;
  lista.forEach((p, i) => {
    const r = 4 + i;
    const vals: Cell["value"][] = [fechaDate(p.fechaCaja), fechaDate(p.fechaPago), p.folio, p.factura, p.cliente, p.vendedor, p.metodo, p.origen, p.recibo, r2(p.monto)];
    vals.forEach((v, j) => {
      const c = ws.getRow(r).getCell(j + 1);
      c.value = v;
      estilo(c, { fmt: j < 2 ? FECHA : j === 9 ? MONEY : undefined, align: j === 4 ? "left" : "center" });
    });
  });
  const fin = 4 + lista.length;
  const e = ws.getRow(fin).getCell(9);
  e.value = "TOTAL";
  estilo(e, { bold: true, fill: AMARILLO });
  const c = ws.getRow(fin).getCell(10);
  c.value = lista.length ? { formula: `SUM(J4:J${fin - 1})`, result: r2(lista.reduce((s, p) => s + p.monto, 0)) } : 0;
  estilo(c, { bold: true, size: 13, fill: AMARILLO, fmt: MONEY });
  ws.views = [{ state: "frozen", ySplit: 3 }];
  if (lista.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + lista.length, column: 10 } };
  return { totalCell: `J${fin}`, ultima: fin - 1 };
}

export function libroCorte(wb: Workbook, d: DatosCorte) {
  const ventas = d.pagos.filter((p) => p.tipo === "venta" && !p.anulado);
  const cobranza = d.pagos.filter((p) => p.tipo === "cobranza" && !p.anulado);
  const orden = (a: PagoCorteXLS, b: PagoCorteXLS) => a.fechaCaja.localeCompare(b.fechaCaja) || a.folio.localeCompare(b.folio);
  ventas.sort(orden);
  cobranza.sort(orden);

  const rango = d.desde === d.hasta ? d.desde.split("-").reverse().join("/") : `${d.desde.split("-").reverse().join("/")} al ${d.hasta.split("-").reverse().join("/")}`;
  const wsRes = wb.addWorksheet("RESUMEN", { views: [{ showGridLines: false }] });
  const wsV = wb.addWorksheet("VENTAS");
  const wsC = wb.addWorksheet("COBRANZA");
  const lv = hojaListaPagos(wsV, `VENTAS (pagos del mismo día de la venta) · ${rango}`, ventas);
  const lc = hojaListaPagos(wsC, `COBRANZA (pagos de días posteriores a la venta) · ${rango}`, cobranza);

  wsRes.mergeCells(1, 1, 1, 6);
  const t = wsRes.getCell(1, 1);
  t.value = `CORTE DE CAJA · ${d.sucursal}`;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: AZUL } };
  t.alignment = { horizontal: "center" };
  wsRes.mergeCells(2, 1, 2, 6);
  const t2 = wsRes.getCell(2, 1);
  t2.value = `Periodo: ${rango}`;
  t2.font = { name: "Calibri", size: 12, bold: true };
  t2.alignment = { horizontal: "center" };
  [26, 18, 18, 18, 14, 14].forEach((w, i) => (wsRes.getColumn(i + 1).width = w));

  const celda = (r: number, c: number, v: Cell["value"], o: Parameters<typeof estilo>[1]) => {
    const cell = wsRes.getCell(r, c);
    cell.value = v;
    estilo(cell, o);
  };
  const sumV = r2(ventas.reduce((s, p) => s + p.monto, 0));
  const sumC = r2(cobranza.reduce((s, p) => s + p.monto, 0));
  ["", "MONTO", "MOVIMIENTOS"].forEach((h, i) => celda(4, i + 1, h || null, { bold: true, fill: GRIS }));
  celda(5, 1, "VENTA", { bold: true, align: "left" });
  celda(5, 2, { formula: `VENTAS!${lv.totalCell}`, result: sumV }, { fmt: MONEY, bold: true });
  celda(5, 3, { formula: `COUNTA(VENTAS!C4:C${Math.max(lv.ultima, 4)})`, result: ventas.length }, {});
  celda(6, 1, "COBRANZA", { bold: true, align: "left" });
  celda(6, 2, { formula: `COBRANZA!${lc.totalCell}`, result: sumC }, { fmt: MONEY, bold: true });
  celda(6, 3, { formula: `COUNTA(COBRANZA!C4:C${Math.max(lc.ultima, 4)})`, result: cobranza.length }, {});
  celda(7, 1, "TOTAL EN CAJA", { bold: true, align: "left", fill: AMARILLO });
  celda(7, 2, { formula: "B5+B6", result: r2(sumV + sumC) }, { fmt: MONEY, bold: true, size: 14, fill: AMARILLO });
  celda(7, 3, { formula: "C5+C6", result: ventas.length + cobranza.length }, { bold: true, fill: AMARILLO });

  // Por método
  const metodos = [...new Set([...ventas, ...cobranza].map((p) => p.metodo))].sort();
  let r = 10;
  wsRes.getCell(r - 1, 1).value = "POR MÉTODO DE PAGO";
  wsRes.getCell(r - 1, 1).font = { bold: true, size: 13, color: { argb: ROJO } };
  ["MÉTODO", "VENTA", "COBRANZA", "TOTAL"].forEach((h, i) => celda(r, i + 1, h, { bold: true, fill: GRIS }));
  const rm = (hoja: string, colCrit: string, ref: string) => `SUMIFS(${hoja}!$J$4:$J$5000,${hoja}!$${colCrit}$4:$${colCrit}$5000,${ref})`;
  metodos.forEach((m, i) => {
    const fila = r + 1 + i;
    const v = r2(ventas.filter((p) => p.metodo === m).reduce((s, p) => s + p.monto, 0));
    const c = r2(cobranza.filter((p) => p.metodo === m).reduce((s, p) => s + p.monto, 0));
    celda(fila, 1, m, { align: "left" });
    celda(fila, 2, { formula: rm("VENTAS", "G", `A${fila}`), result: v }, { fmt: MONEY });
    celda(fila, 3, { formula: rm("COBRANZA", "G", `A${fila}`), result: c }, { fmt: MONEY });
    celda(fila, 4, { formula: `B${fila}+C${fila}`, result: r2(v + c) }, { fmt: MONEY, bold: true });
  });
  r = r + 2 + metodos.length;

  // Por vendedor
  const vendedores = [...new Set([...ventas, ...cobranza].map((p) => p.vendedor))].sort();
  wsRes.getCell(r, 1).value = "POR VENDEDOR (de la venta)";
  wsRes.getCell(r, 1).font = { bold: true, size: 13, color: { argb: ROJO } };
  r++;
  ["VENDEDOR", "VENTA", "COBRANZA", "TOTAL"].forEach((h, i) => celda(r, i + 1, h, { bold: true, fill: GRIS }));
  vendedores.forEach((vn, i) => {
    const fila = r + 1 + i;
    const v = r2(ventas.filter((p) => p.vendedor === vn).reduce((s, p) => s + p.monto, 0));
    const c = r2(cobranza.filter((p) => p.vendedor === vn).reduce((s, p) => s + p.monto, 0));
    celda(fila, 1, vn, { align: "left" });
    celda(fila, 2, { formula: rm("VENTAS", "F", `A${fila}`), result: v }, { fmt: MONEY });
    celda(fila, 3, { formula: rm("COBRANZA", "F", `A${fila}`), result: c }, { fmt: MONEY });
    celda(fila, 4, { formula: `B${fila}+C${fila}`, result: r2(v + c) }, { fmt: MONEY, bold: true });
  });
  r = r + 2 + vendedores.length;

  // Por día en que entró a Caja
  const dias = [...new Set([...ventas, ...cobranza].map((p) => p.fechaCaja))].sort();
  wsRes.getCell(r, 1).value = "POR DÍA (cuando entró a Caja)";
  wsRes.getCell(r, 1).font = { bold: true, size: 13, color: { argb: ROJO } };
  r++;
  ["DÍA", "VENTA", "COBRANZA", "TOTAL"].forEach((h, i) => celda(r, i + 1, h, { bold: true, fill: GRIS }));
  dias.forEach((dia, i) => {
    const fila = r + 1 + i;
    const v = r2(ventas.filter((p) => p.fechaCaja === dia).reduce((s, p) => s + p.monto, 0));
    const c = r2(cobranza.filter((p) => p.fechaCaja === dia).reduce((s, p) => s + p.monto, 0));
    celda(fila, 1, fechaDate(dia), { align: "left", fmt: FECHA });
    celda(fila, 2, { formula: rm("VENTAS", "A", `A${fila}`), result: v }, { fmt: MONEY });
    celda(fila, 3, { formula: rm("COBRANZA", "A", `A${fila}`), result: c }, { fmt: MONEY });
    celda(fila, 4, { formula: `B${fila}+C${fila}`, result: r2(v + c) }, { fmt: MONEY, bold: true });
  });
}

// ------------------------------------------------------------
// 3) Historial de pagos (lo que se ve en pantalla, con filtros)
// ------------------------------------------------------------
export function libroHistorial(wb: Workbook, titulo1: string, pagos: PagoCorteXLS[]) {
  const ws = wb.addWorksheet("HISTORIAL");
  const cols = ["FECHA EN CAJA", "FECHA DE PAGO", "TIPO", "FOLIO", "FACTURA", "CLIENTE", "VENDEDOR", "MÉTODO", "CÓMO ENTRÓ", "RECIBO", "MONTO", "ESTADO", "MOTIVO DE ANULACIÓN"];
  const anchosH = [14, 14, 11, 11, 12, 36, 14, 18, 18, 10, 16, 12, 34];
  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1);
  t.value = titulo1;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: AZUL } };
  t.alignment = { horizontal: "center" };
  ws.getRow(1).height = 28;
  cols.forEach((h, i) => {
    const c = ws.getRow(3).getCell(i + 1);
    c.value = h;
    estilo(c, { bold: true, size: 12, fill: GRIS });
    ws.getColumn(i + 1).width = anchosH[i];
  });
  pagos.forEach((p, i) => {
    const r = 4 + i;
    const estado = p.anulado ? "ANULADO" : p.editado ? "CORREGIDO" : "VIGENTE";
    const vals: Cell["value"][] = [
      fechaDate(p.fechaCaja), fechaDate(p.fechaPago), p.tipo === "venta" ? "VENTA" : "COBRANZA", p.folio, p.factura, p.cliente,
      p.vendedor, p.metodo, p.origen, p.recibo, r2(p.monto), estado, p.motivoAnulacion,
    ];
    vals.forEach((v, j) => {
      const c = ws.getRow(r).getCell(j + 1);
      c.value = v;
      estilo(c, { fmt: j < 2 ? FECHA : j === 10 ? MONEY : undefined, align: j === 5 || j === 12 ? "left" : "center", color: p.anulado ? "FF9CA3AF" : undefined });
    });
  });
  const fin = 4 + pagos.length;
  const e = ws.getRow(fin).getCell(10);
  e.value = "TOTAL VIGENTE";
  estilo(e, { bold: true, fill: AMARILLO });
  const c = ws.getRow(fin).getCell(11);
  c.value = pagos.length
    ? { formula: `SUMIFS(K4:K${fin - 1},L4:L${fin - 1},"<>ANULADO")`, result: r2(pagos.filter((p) => !p.anulado).reduce((s, p) => s + p.monto, 0)) }
    : 0;
  estilo(c, { bold: true, size: 13, fill: AMARILLO, fmt: MONEY });
  ws.views = [{ state: "frozen", ySplit: 3 }];
  if (pagos.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + pagos.length, column: cols.length } };
}

/** Para imprimir: hoja horizontal, todo el ancho en una página. */
export function ajustarImpresion(wb: Workbook) {
  wb.eachSheet((ws) => {
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });
}

/** Descarga un libro en el navegador. */
export async function descargarLibro(wb: Workbook, nombre: string) {
  ajustarImpresion(wb);
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
