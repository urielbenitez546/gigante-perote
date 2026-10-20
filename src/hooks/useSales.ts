import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { SaleWithItems, DeliveryType, ResumenPedidos, TipoPrecio, TipoDocumento, MetodoPagoVenta } from "../types";

export function useSales() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("sales")
      .select("*, sale_items(*, product:products(code, name, unit))")
      .order("created_at", { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setSales((data as unknown as SaleWithItems[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { sales, loading, error, reload };
}

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  delivery_type?: DeliveryType;
  /** 'publico' (precio normal, default) o 'promocion' (aplica el % de descuento del producto). */
  tipo_precio?: TipoPrecio;
}

export interface DatosVentaExtra {
  tipoDocumento: TipoDocumento;
  numeroOrden: string;
  metodoPago: MetodoPagoVenta | "";
  /** Solo si el método es "a meses": anotación libre (ej. "6 meses sin intereses"). */
  mesesNota: string;
}

export async function registerSale(
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  deliveryType: DeliveryType,
  items: SaleItemInput[],
  scheduledPickupDate: string | undefined,
  extra: DatosVentaExtra
) {
  const { data, error } = await supabase.rpc("register_sale", {
    p_customer_name: customerName,
    p_customer_phone: customerPhone || null,
    p_customer_address: customerAddress || null,
    p_delivery_type: deliveryType,
    p_items: items,
    p_scheduled_pickup_date: scheduledPickupDate || null,
    p_tipo_documento: extra.tipoDocumento,
    p_numero_orden: extra.numeroOrden.trim() || null,
    p_metodo_pago: extra.metodoPago || null,
    p_meses_nota: extra.metodoPago === "a_meses" ? extra.mesesNota.trim() || null : null,
  });
  return { folio: data as string | null, error: error?.message ?? null };
}

export interface RetiroItemInput {
  sale_item_id: string;
  quantity: number;
}

/**
 * Registra un retiro en sucursal. Si no se pasan "items", retira TODO
 * lo pendiente de retiro de la venta (comportamiento anterior). Si se
 * pasan "items", retira solo esas cantidades (retiro parcial).
 */
export async function registerRetiro(saleId: string, items?: RetiroItemInput[]) {
  const { error } = await supabase.rpc("register_retiro", {
    p_sale_id: saleId,
    p_items: items ?? null,
  });
  return { error: error?.message ?? null };
}

/** Caja (o Gerencia) registra cuánto pagó el cliente en el mostrador
 * al momento de la venta. Puede ser el total o solo una parte, si el
 * resto se cobra después en la entrega a domicilio. */
export async function registerSalePayment(saleId: string, amount: number) {
  const { error } = await supabase.rpc("register_sale_payment", {
    p_sale_id: saleId,
    p_amount: amount,
  });
  return { error: error?.message ?? null };
}

export interface CobroCajaInput {
  amount: number;
  metodoPago?: MetodoPagoVenta | "";
  numeroFactura?: string;
  mesesNota?: string;
  /** Excepción: pasa a almacén aunque el cliente todavía no pague nada (paga en su domicilio). */
  pasarSinCobro?: boolean;
}

/** Caja registra lo que pagó el cliente (total o parcial) y PASA la venta
 * a almacén. Solo sirve la primera vez; cambiarlo después es "corregirCobroVenta" (con motivo). */
export async function cajaCobrarVenta(saleId: string, c: CobroCajaInput) {
  const { error } = await supabase.rpc("caja_cobrar_venta", {
    p_sale_id: saleId,
    p_amount: c.amount,
    p_metodo_pago: c.metodoPago || null,
    p_numero_factura: c.numeroFactura?.trim() || null,
    p_meses_nota: c.mesesNota?.trim() || null,
    p_pasar_sin_cobro: c.pasarSinCobro ?? false,
  });
  return { error: error?.message ?? null };
}

export interface CorreccionCobroInput {
  monto: number;
  metodoPago?: MetodoPagoVenta | "";
  mesesNota?: string;
  motivo: string;
}

/** Caja o Gerencia corrigen el cobro de una venta que ya pasó a almacén.
 * El motivo es obligatorio y queda en el historial que ve Gerencia. */
export async function corregirCobroVenta(saleId: string, c: CorreccionCobroInput) {
  const { error } = await supabase.rpc("corregir_cobro_venta", {
    p_sale_id: saleId,
    p_monto: c.monto,
    p_metodo_pago: c.metodoPago || null,
    p_meses_nota: c.mesesNota?.trim() || null,
    p_motivo: c.motivo.trim(),
  });
  return { error: error?.message ?? null };
}

export interface CobroHistorialEntry {
  id: string;
  sale_id: string;
  monto_anterior: number;
  monto_nuevo: number;
  metodo_anterior: MetodoPagoVenta | null;
  metodo_nuevo: MetodoPagoVenta | null;
  motivo: string;
  created_by: string | null;
  created_at: string;
}

/** Solo Gerencia puede leerlo (lo controla la base de datos). */
export async function cargarHistorialCobros(saleId: string) {
  const { data, error } = await supabase
    .from("sale_cobro_historial")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });
  return { historial: (data as CobroHistorialEntry[] | null) ?? [], error: error?.message ?? null };
}

export async function guardarFolioFactura(saleId: string, folio: string) {
  const { error } = await supabase.rpc("guardar_folio_factura", { p_sale_id: saleId, p_folio: folio });
  return { error: error?.message ?? null };
}

/** Jefe, auxiliar y Gerencia: día y hora aproximada de entrega. Si ya tenía
 * fecha, cambiarla exige un motivo (queda en el historial). */
export async function programarEntrega(saleId: string, fecha: string, hora: string, motivo: string) {
  const { error } = await supabase.rpc("programar_entrega", {
    p_sale_id: saleId,
    p_fecha: fecha,
    p_hora: hora || null,
    p_motivo: motivo.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function marcarEsperandoProveedor(saleId: string, activo: boolean, nota?: string) {
  const { error } = await supabase.rpc("marcar_esperando_proveedor", {
    p_sale_id: saleId,
    p_activo: activo,
    p_nota: nota?.trim() || null,
  });
  return { error: error?.message ?? null };
}

/** Almacén confirma que ya cargó el material de una entrega inmediata:
 * se descuenta del inventario y queda en el Kardex. */
export async function confirmarEntregaInmediata(saleId: string, items?: RetiroItemInput[]) {
  const { error } = await supabase.rpc("confirmar_entrega_inmediata", {
    p_sale_id: saleId,
    p_items: items ?? null,
  });
  return { error: error?.message ?? null };
}

export interface ProgramacionLogEntry {
  id: string;
  sale_id: string;
  fecha_anterior: string | null;
  hora_anterior: string | null;
  fecha_nueva: string | null;
  hora_nueva: string | null;
  motivo: string | null;
  created_by: string | null;
  created_at: string;
}

export async function cargarHistorialProgramacion(saleId: string) {
  const { data, error } = await supabase
    .from("sale_programacion_log")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });
  return { entries: (data as ProgramacionLogEntry[] | null) ?? [], error: error?.message ?? null };
}

/** Elimina una venta por completo (solo Gerencia, y solo si todavía
 * no se le ha entregado ni cobrado nada). Devuelve a "disponible" lo
 * que esa venta tenía apartado y deja aviso en la campanita. */
export async function deleteSale(saleId: string, motivo: string) {
  const { error } = await supabase.rpc("delete_sale", { p_sale_id: saleId, p_motivo: motivo });
  return { error: error?.message ?? null };
}

/** Cambia lo que falta por entregar de un renglón por otro producto
 * (o por otra cantidad del mismo). Solo Gerencia y Ventas. */
export async function changeSaleItem(
  saleItemId: string,
  newProductId: string,
  newQuantity: number,
  motivo: string
) {
  const { error } = await supabase.rpc("change_sale_item", {
    p_sale_item_id: saleItemId,
    p_new_product_id: newProductId,
    p_new_quantity: newQuantity,
    p_motivo: motivo,
  });
  return { error: error?.message ?? null };
}

/** Revisa apartados por vencer / vencidos y deja aviso en la campanita.
 * No repite avisos, así que se puede llamar cada vez que abre la página. */
export async function revisarApartados() {
  const { data, error } = await supabase.rpc("revisar_apartados");
  return { creadas: (data as number | null) ?? 0, error: error?.message ?? null };
}

/** Ventas con algo pendiente (sin el límite de 100 de useSales). */
export function useOpenSales() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("sales")
      .select("*, sale_items(*, product:products(code, name, unit))")
      .in("status", ["pendiente", "parcial"])
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setSales((data as unknown as SaleWithItems[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { sales, loading, error, reload };
}

export function useResumenPedidos() {
  const [resumen, setResumen] = useState<ResumenPedidos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("resumen_pedidos");
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setResumen(data as ResumenPedidos);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { resumen, loading, error, reload };
}
