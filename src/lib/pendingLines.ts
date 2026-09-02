import type { SaleWithItems, DeliveryType, PendingLine } from "../types";

/**
 * Devuelve los renglones de una venta que todavía tienen cantidad
 * pendiente (quantity - delivered_quantity > 0) para un tipo de
 * entrega específico ("retiro_sucursal" o "domicilio").
 *
 * NOTA (simplificación documentada): esto no distingue cantidad ya
 * "asignada" a un viaje/reparto pendiente de la que aún no se ha
 * asignado a ninguno. En un pedido con varios viajes en curso al
 * mismo tiempo, es responsabilidad de quien registra el viaje no
 * exceder lo realmente disponible.
 */
export function pendingLinesFor(sale: SaleWithItems, type: DeliveryType): PendingLine[] {
  return sale.sale_items
    .filter((item) => (item.delivery_type ?? sale.delivery_type) === type)
    .map((item) => ({
      sale_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product?.name ?? "",
      product_code: item.product?.code ?? "",
      unit: item.product?.unit ?? "caja",
      pending: item.quantity - item.delivered_quantity,
    }))
    .filter((line) => line.pending > 0);
}
