import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppNotification } from "../types";

const POLL_INTERVAL_MS = 25_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [{ data: notifData, error: notifErr }, { data: readsData, error: readsErr }] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("notification_reads").select("notification_id"),
    ]);

    if (notifErr) {
      setError(notifErr.message);
    } else if (readsErr) {
      setError(readsErr.message);
    } else {
      setError(null);
      setNotifications((notifData as unknown as AppNotification[]) ?? []);
      setReadIds(new Set((readsData ?? []).map((r) => r.notification_id as string)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  async function markAsRead(id: string) {
    setReadIds((prev) => new Set(prev).add(id));
    await supabase.rpc("mark_notification_read", { p_notification_id: id });
  }

  async function markAllAsRead() {
    setReadIds(new Set(notifications.map((n) => n.id)));
    await supabase.rpc("mark_all_notifications_read");
  }

  return { notifications, readIds, unreadCount, loading, error, reload, markAsRead, markAllAsRead };
}

export async function reportIssue(message: string) {
  const { error } = await supabase.rpc("report_issue", { p_message: message });
  return { error: error?.message ?? null };
}

/** Reporta un incidente de material dañado: le llega al Jefe de almacén y a
 * Gerencia, que son quienes deciden si se da de baja. */
export async function reportIncidenteMaterial(productId: string, quantity: number | null, description: string) {
  const { error } = await supabase.rpc("reportar_incidente_material", {
    p_product_id: productId,
    p_quantity: quantity,
    p_description: description,
  });
  return { error: error?.message ?? null };
}
