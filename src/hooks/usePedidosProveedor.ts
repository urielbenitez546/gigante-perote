import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type EstadoPedidoProveedor = "pendiente" | "pedido" | "llego" | "cancelado";

export const ESTADO_PEDIDO_LABELS: Record<EstadoPedidoProveedor, string> = {
  pendiente: "Por pedir",
  pedido: "Ya pedido",
  llego: "Ya llegó",
  cancelado: "Cancelado",
};

export interface PedidoProveedor {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string | null;
  product_id: string | null;
  descripcion: string;
  cantidad: number;
  nota: string | null;
  venta_folio: string | null;
  estado: EstadoPedidoProveedor;
  proveedor: string | null;
  fecha_estimada: string | null;
  created_by: string | null;
  created_at: string;
  pedido_por: string | null;
  pedido_at: string | null;
  llego_por: string | null;
  llego_at: string | null;
  cerrado_por: string | null;
  cerrado_at: string | null;
  motivo_cierre: string | null;
  product: { code: string; unit: string } | null;
}

export function usePedidosProveedor() {
  const [pedidos, setPedidos] = useState<PedidoProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("pedidos_proveedor")
      .select("*, product:products(code, unit)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setPedidos((data as unknown as PedidoProveedor[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { pedidos, loading, error, reload };
}

export interface PedidoProveedorInput {
  cliente: string;
  telefono: string;
  productId: string | null;
  descripcion: string;
  cantidad: number;
  nota: string;
  /** Folio de la venta de la que sale el pedido (cuando se pide desde Nueva venta). */
  ventaFolio?: string;
}

export async function crearPedidoProveedor(i: PedidoProveedorInput) {
  const { data, error } = await supabase.rpc("crear_pedido_proveedor", {
    p_customer_name: i.cliente,
    p_customer_phone: i.telefono.trim() || null,
    p_product_id: i.productId,
    p_descripcion: i.descripcion.trim() || null,
    p_cantidad: i.cantidad,
    p_nota: i.nota.trim() || null,
    p_venta_folio: i.ventaFolio?.trim() || null,
  });
  return { folio: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function marcarPedidoProveedorPedido(id: string, proveedor: string, fechaEstimada: string) {
  const { error } = await supabase.rpc("marcar_pedido_proveedor_pedido", {
    p_id: id,
    p_proveedor: proveedor.trim() || null,
    p_fecha_estimada: fechaEstimada || null,
  });
  return { error: error?.message ?? null };
}

export async function marcarPedidoProveedorLlego(id: string) {
  const { error } = await supabase.rpc("marcar_pedido_proveedor_llego", { p_id: id });
  return { error: error?.message ?? null };
}

export async function cancelarPedidoProveedor(id: string, motivo: string) {
  const { error } = await supabase.rpc("cancelar_pedido_proveedor", { p_id: id, p_motivo: motivo.trim() || null });
  return { error: error?.message ?? null };
}
