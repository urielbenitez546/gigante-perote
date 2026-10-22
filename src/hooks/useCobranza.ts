import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfiles } from "./useProfiles";

// ============================================================
// Cobranza y Corte de Caja: libro de pagos (venta / cobranza)
// ============================================================

export type TipoPago = "venta" | "cobranza";
export type OrigenPago = "caja" | "chofer" | "abono";

export const TIPO_PAGO_LABELS: Record<TipoPago, string> = { venta: "Venta", cobranza: "Cobranza" };
export const ORIGEN_PAGO_LABELS: Record<OrigenPago, string> = {
  caja: "En Caja",
  chofer: "Cobró el chofer",
  abono: "Abono",
};

export const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  a_meses: "A meses",
  sin_metodo: "Sin método",
};

export const metodoLabel = (m: string | null | undefined) => METODO_LABELS[m ?? "sin_metodo"] ?? m ?? "Sin método";

export interface VentaResumen {
  id: string;
  folio: string;
  numero_factura: string | null;
  customer_name: string;
  created_at: string;
  created_by: string | null;
  total: number;
  amount_paid: number;
  status: "pendiente" | "parcial" | "entregada" | "cancelada";
  liberada_almacen_at: string | null;
}

export interface PagoRow {
  id: string;
  sale_id: string;
  monto: number;
  metodo: string | null;
  origen: OrigenPago;
  fecha_pago: string; // yyyy-mm-dd
  fecha_caja: string; // yyyy-mm-dd
  tipo: TipoPago;
  tipo_manual: boolean;
  recibo: string | null;
  comentario: string | null;
  registrado_por: string | null;
  created_at: string;
  editado: boolean;
  anulado: boolean;
  anulado_motivo: string | null;
  anulado_at: string | null;
  sale?: VentaResumen | null;
}

export interface CuentaCobranza {
  venta: VentaResumen;
  pagos: PagoRow[]; // solo los no anulados, de más viejo a más nuevo
  saldo: number;
}

const VENTA_COLS = "id, folio, numero_factura, customer_name, created_at, created_by, total, amount_paid, status, liberada_almacen_at";

const num = (v: unknown) => Number(v ?? 0);

function normalizaPago(r: Record<string, unknown>): PagoRow {
  const p = r as unknown as PagoRow;
  return { ...p, monto: num(p.monto) };
}

function normalizaVenta(v: VentaResumen): VentaResumen {
  return { ...v, total: num(v.total), amount_paid: num(v.amount_paid) };
}

// ------------------------------------------------------------
// Fechas "de México" (la sucursal está en esa zona)
// ------------------------------------------------------------
const fmtMX = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });

/** yyyy-mm-dd de un momento, en hora de México. */
export function fechaMX(d: Date | string): string {
  return fmtMX.format(typeof d === "string" ? new Date(d) : d);
}

export function hoyMX(): string {
  return fechaMX(new Date());
}

/** Suma (o resta) días a una fecha yyyy-mm-dd. */
export function sumarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function fechaCorta(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ------------------------------------------------------------
// Pagos de un rango de fechas de Caja (corte e historial)
// ------------------------------------------------------------
export function usePagos(desde: string, hasta: string) {
  const [pagos, setPagos] = useState<PagoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("sale_pagos")
      .select(`*, sale:sales(${VENTA_COLS})`)
      .gte("fecha_caja", desde)
      .lte("fecha_caja", hasta)
      .order("fecha_caja", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (err) {
      setError(err.message);
      setPagos([]);
    } else {
      setError(null);
      setPagos(
        ((data as unknown as Record<string, unknown>[]) ?? []).map((r) => {
          const p = normalizaPago(r);
          if (p.sale) p.sale = normalizaVenta(p.sale);
          return p;
        })
      );
    }
    setLoading(false);
  }, [desde, hasta]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { pagos, loading, error, reload };
}

// ------------------------------------------------------------
// Cuentas por cobrar (ventas con saldo) y, si se pide, las liquidadas recientes
// ------------------------------------------------------------
async function pagosDeVentas(ids: string[]): Promise<PagoRow[]> {
  const out: PagoRow[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data, error } = await supabase
      .from("sale_pagos")
      .select("*")
      .in("sale_id", chunk)
      .eq("anulado", false)
      .order("fecha_pago", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    for (const r of (data as unknown as Record<string, unknown>[]) ?? []) out.push(normalizaPago(r));
  }
  return out;
}

export async function cargarCuentas(opts: { conSaldo: boolean; creadasDesde?: string; creadasHasta?: string }): Promise<CuentaCobranza[]> {
  const ventas = new Map<string, VentaResumen>();

  if (opts.conSaldo) {
    const { data, error } = await supabase.from("ventas_con_saldo").select(VENTA_COLS).limit(5000);
    if (error) throw new Error(error.message);
    for (const v of (data as unknown as VentaResumen[]) ?? []) ventas.set(v.id, normalizaVenta(v));
  }

  if (opts.creadasDesde) {
    let q = supabase
      .from("sales")
      .select(VENTA_COLS)
      .neq("status", "cancelada")
      .not("liberada_almacen_at", "is", null)
      .gte("created_at", `${opts.creadasDesde}T00:00:00-06:00`)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (opts.creadasHasta) q = q.lt("created_at", `${sumarDias(opts.creadasHasta, 1)}T00:00:00-06:00`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const v of (data as unknown as VentaResumen[]) ?? []) ventas.set(v.id, normalizaVenta(v));
  }

  const lista = [...ventas.values()];
  const pagos = await pagosDeVentas(lista.map((v) => v.id));
  const porVenta = new Map<string, PagoRow[]>();
  for (const p of pagos) {
    const arr = porVenta.get(p.sale_id) ?? [];
    arr.push(p);
    porVenta.set(p.sale_id, arr);
  }
  return lista.map((venta) => ({
    venta,
    pagos: porVenta.get(venta.id) ?? [],
    saldo: Math.round((venta.total - venta.amount_paid) * 100) / 100,
  }));
}

export function useCuentas(incluirLiquidadas: boolean) {
  const [cuentas, setCuentas] = useState<CuentaCobranza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const hace90 = sumarDias(hoyMX(), -90);
      const lista = await cargarCuentas({ conSaldo: true, creadasDesde: incluirLiquidadas ? hace90 : undefined });
      setCuentas(lista);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
      setCuentas([]);
    }
    setLoading(false);
  }, [incluirLiquidadas]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { cuentas, loading, error, reload };
}

// ------------------------------------------------------------
// Acciones
// ------------------------------------------------------------
export interface AbonoInput {
  monto: number;
  metodo: string;
  recibo: string;
  fecha: string; // yyyy-mm-dd
  comentario: string;
}

export async function registrarAbono(saleId: string, a: AbonoInput) {
  const { error } = await supabase.rpc("registrar_abono", {
    p_sale_id: saleId,
    p_monto: a.monto,
    p_metodo: a.metodo || null,
    p_recibo: a.recibo || null,
    p_fecha: a.fecha || null,
    p_comentario: a.comentario || null,
  });
  return { error: error?.message ?? null };
}

export interface CorreccionPagoInput {
  monto: number;
  metodo: string;
  recibo: string;
  fechaPago: string;
  fechaCaja: string;
  /** "" = que el sistema lo decida por las fechas. */
  tipo: TipoPago | "";
  motivo: string;
}

export async function corregirPago(pagoId: string, c: CorreccionPagoInput) {
  const { error } = await supabase.rpc("corregir_pago", {
    p_pago_id: pagoId,
    p_monto: c.monto,
    p_metodo: c.metodo || null,
    p_recibo: c.recibo || null,
    p_fecha_pago: c.fechaPago || null,
    p_fecha_caja: c.fechaCaja || null,
    p_tipo: c.tipo || null,
    p_motivo: c.motivo,
  });
  return { error: error?.message ?? null };
}

export async function anularPago(pagoId: string, motivo: string) {
  const { error } = await supabase.rpc("anular_pago", { p_pago_id: pagoId, p_motivo: motivo });
  return { error: error?.message ?? null };
}

export interface PagoLogEntry {
  id: string;
  accion: "registro" | "correccion" | "anulacion";
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  motivo: string | null;
  por: string | null;
  at: string;
}

export async function cargarBitacoraPago(pagoId: string) {
  const { data, error } = await supabase
    .from("sale_pagos_log")
    .select("id, accion, antes, despues, motivo, por, at")
    .eq("pago_id", pagoId)
    .order("at", { ascending: true });
  return { log: (data as unknown as PagoLogEntry[]) ?? [], error: error?.message ?? null };
}

export interface CorteGuardado {
  id: string;
  desde: string;
  hasta: string;
  ventas_total: number;
  ventas_n: number;
  cobranza_total: number;
  cobranza_n: number;
  nota: string | null;
  creado_por: string | null;
  created_at: string;
  modificado: boolean;
  ventas_actual: number;
  cobranza_actual: number;
}

export async function guardarCorte(desde: string, hasta: string, nota: string) {
  const { error } = await supabase.rpc("guardar_corte", { p_desde: desde, p_hasta: hasta, p_nota: nota || null });
  return { error: error?.message ?? null };
}

export function useCortesGuardados() {
  const [cortes, setCortes] = useState<CorteGuardado[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("cortes_con_estado");
    setCortes(
      ((data as unknown as CorteGuardado[]) ?? []).map((c) => ({
        ...c,
        ventas_total: num(c.ventas_total),
        cobranza_total: num(c.cobranza_total),
        ventas_actual: num(c.ventas_actual),
        cobranza_actual: num(c.cobranza_actual),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { cortes, loading, reload };
}

// ------------------------------------------------------------
// Nombre corto del vendedor (como lo escribe Caja en su Excel)
// ------------------------------------------------------------
export function useVendedorNombre() {
  const { profiles } = useProfiles();
  return useCallback(
    (id: string | null | undefined): string => {
      if (!id) return "SIN VENDEDOR";
      const p = profiles.find((x) => x.id === id);
      if (!p) return "SIN VENDEDOR";
      return (p.full_name || "").trim().split(/\s+/)[0].toUpperCase() || "SIN VENDEDOR";
    },
    [profiles]
  );
}
