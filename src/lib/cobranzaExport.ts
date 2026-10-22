import { supabase } from "./supabaseClient";
import {
  ORIGEN_PAGO_LABELS,
  cargarCuentas,
  fechaMX,
  metodoLabel,
  sumarDias,
  type CuentaCobranza,
  type PagoRow,
} from "../hooks/useCobranza";
import {
  descargarLibro,
  libroCobranzaMes,
  libroCorte,
  libroHistorial,
  nombreMes,
  type CuentaXLS,
  type PagoCorteXLS,
} from "./cobranzaExcel";

const SUCURSAL = "EL GIGANTE DE LOS AZULEJOS Y MARMOLES — PEROTE";

type NombreVendedor = (id: string | null | undefined) => string;

async function nuevoLibro() {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  return new ExcelJS.Workbook();
}

function aPagoCorte(p: PagoRow, vend: NombreVendedor): PagoCorteXLS {
  return {
    fechaCaja: p.fecha_caja,
    fechaPago: p.fecha_pago,
    tipo: p.tipo,
    folio: p.sale?.folio ?? "",
    factura: p.sale?.numero_factura ?? "",
    cliente: p.sale?.customer_name ?? "",
    vendedor: vend(p.sale?.created_by),
    metodo: metodoLabel(p.metodo),
    origen: ORIGEN_PAGO_LABELS[p.origen] ?? p.origen,
    recibo: p.recibo ?? "",
    monto: p.monto,
    anulado: p.anulado,
    editado: p.editado,
    motivoAnulacion: p.anulado_motivo ?? "",
  };
}

function aCuentaXLS(c: CuentaCobranza, vend: NombreVendedor): CuentaXLS {
  return {
    vendedor: vend(c.venta.created_by),
    folio: c.venta.folio,
    factura: c.venta.numero_factura ?? "",
    cliente: c.venta.customer_name,
    fecha: fechaMX(c.venta.created_at),
    total: c.venta.total,
    entregada: c.venta.status === "entregada",
    pagos: c.pagos
      .filter((p) => !p.anulado)
      .map((p) => ({ fechaPago: p.fecha_pago, monto: p.monto, tipo: p.tipo, recibo: p.recibo ?? "" })),
  };
}

const rangoTexto = (desde: string, hasta: string) =>
  desde === hasta ? desde : `${desde}_a_${hasta}`;

export async function descargarCorteExcel(pagos: PagoRow[], desde: string, hasta: string, vend: NombreVendedor) {
  const wb = await nuevoLibro();
  libroCorte(wb, {
    desde,
    hasta,
    sucursal: SUCURSAL,
    pagos: pagos.filter((p) => !p.anulado).map((p) => aPagoCorte(p, vend)),
  });
  await descargarLibro(wb, `CORTE_CAJA_PEROTE_${rangoTexto(desde, hasta)}.xlsx`);
}

export async function descargarHistorialExcel(pagos: PagoRow[], desde: string, hasta: string, vend: NombreVendedor) {
  const wb = await nuevoLibro();
  libroHistorial(
    wb,
    `HISTORIAL DE COBROS · ${desde.split("-").reverse().join("/")} al ${hasta.split("-").reverse().join("/")}`,
    pagos.map((p) => aPagoCorte(p, vend))
  );
  await descargarLibro(wb, `HISTORIAL_COBROS_PEROTE_${rangoTexto(desde, hasta)}.xlsx`);
}

/** Excel de cobranza del mes, con el formato de Caja. */
export async function descargarCobranzaMesExcel(anio: number, mes: number, vend: NombreVendedor) {
  const mm = String(mes).padStart(2, "0");
  const primero = `${anio}-${mm}-01`;
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const ultimo = `${anio}-${mm}-${String(ultimoDia).padStart(2, "0")}`;

  const [delMes, conSaldo, { data: pagosMes, error }] = await Promise.all([
    cargarCuentas({ conSaldo: false, creadasDesde: primero, creadasHasta: ultimo }),
    cargarCuentas({ conSaldo: true }),
    supabase.from("sale_pagos").select("monto, tipo").gte("fecha_caja", primero).lte("fecha_caja", ultimo).eq("anulado", false).limit(10000),
  ]);
  if (error) throw new Error(error.message);
  let ventas = 0;
  let cobranza = 0;
  for (const p of (pagosMes as { monto: number; tipo: string }[]) ?? []) {
    if (p.tipo === "venta") ventas += Number(p.monto);
    else cobranza += Number(p.monto);
  }

  const wb = await nuevoLibro();
  libroCobranzaMes(wb, {
    anio,
    mes,
    sucursal: SUCURSAL,
    cuentasMes: delMes.map((c) => aCuentaXLS(c, vend)),
    cuentasConSaldo: conSaldo.map((c) => aCuentaXLS(c, vend)),
    ventasDelMes: Math.round(ventas * 100) / 100,
    cobranzaDelMes: Math.round(cobranza * 100) / 100,
  });
  await descargarLibro(wb, `COBRANZA_${nombreMes(mes)}_${anio}_SUC._PEROTE.xlsx`);
}

export { sumarDias };
