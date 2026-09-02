import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Delivery, DeliveryStatus, PaymentMethod } from "../types";

export function useDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("deliveries")
      .select("*, sale:sales(*, sale_items(*, product:products(code, name, unit)))")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setDeliveries((data as unknown as Delivery[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { deliveries, loading, error, reload };
}

export interface UpdateDeliveryInput {
  status?: DeliveryStatus;
  driverName?: string;
  vehicle?: string;
  initialKm?: number;
  currentKm?: number;
  notes?: string;
  /** Obligatorios (junto con photoPaths, amountCollected y paymentMethod)
   * la primera vez que status pasa a "entregado" — ver update_delivery. */
  signaturePath?: string;
  photoPaths?: string[];
  amountCollected?: number;
  paymentMethod?: PaymentMethod;
}

export async function updateDelivery(deliveryId: string, input: UpdateDeliveryInput) {
  const { error } = await supabase.rpc("update_delivery", {
    p_delivery_id: deliveryId,
    p_status: input.status ?? null,
    p_driver_name: input.driverName ?? null,
    p_vehicle: input.vehicle ?? null,
    p_initial_km: input.initialKm ?? null,
    p_current_km: input.currentKm ?? null,
    p_notes: input.notes ?? null,
    p_signature_path: input.signaturePath ?? null,
    p_photo_paths: input.photoPaths ?? null,
    p_amount_collected: input.amountCollected ?? null,
    p_payment_method: input.paymentMethod ?? null,
  });
  return { error: error?.message ?? null };
}

/** Caja (o Gerencia) confirma que recibió físicamente el dinero del
 * chofer y da por cerrado el cobro de ese reparto. */
export async function confirmDeliveryPayment(deliveryId: string, notes?: string) {
  const { error } = await supabase.rpc("confirm_delivery_payment", {
    p_delivery_id: deliveryId,
    p_notes: notes ?? null,
  });
  return { error: error?.message ?? null };
}

export interface DeliveryItemInput {
  sale_item_id: string;
  product_id: string;
  quantity: number;
}

/** Crea un viaje/reparto adicional para lo que falte entregar a domicilio de una venta. */
export async function createAdditionalDelivery(saleId: string, items: DeliveryItemInput[]) {
  const { data, error } = await supabase.rpc("create_additional_delivery", {
    p_sale_id: saleId,
    p_items: items,
  });
  return { deliveryId: data as string | null, error: error?.message ?? null };
}
