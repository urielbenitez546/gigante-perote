import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type EstadoSolicitud = "abierta" | "atendida" | "cancelada";
export type TipoRespuesta = "ya_vendi" | "ya_comprometi" | "sin_compromiso";

export const TIPO_RESPUESTA_LABELS: Record<TipoRespuesta, string> = {
  ya_vendi: "Ya vendí",
  ya_comprometi: "Ya comprometí",
  sin_compromiso: "No tengo nada comprometido",
};

export interface RespuestaSolicitud {
  id: string;
  solicitud_id: string;
  tipo: TipoRespuesta;
  cantidad: number;
  nota: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SolicitudTraslado {
  id: string;
  sucursal: string;
  product_id: string;
  cantidad: number;
  nota: string | null;
  estado: EstadoSolicitud;
  cantidad_enviada: number | null;
  movimiento_id: string | null;
  created_by: string | null;
  created_at: string;
  cerrada_por: string | null;
  cerrada_at: string | null;
  motivo_cierre: string | null;
  product: { code: string; name: string; unit: string } | null;
  respuestas: RespuestaSolicitud[];
}

export function useSolicitudesTraslado() {
  const [solicitudes, setSolicitudes] = useState<SolicitudTraslado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [{ data: sols, error: e1 }, { data: resps, error: e2 }] = await Promise.all([
      supabase
        .from("solicitudes_traslado")
        .select("*, product:products(code, name, unit)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("solicitud_traslado_respuestas").select("*").order("created_at", { ascending: true }),
    ]);
    if (e1 || e2) {
      setError((e1 ?? e2)?.message ?? "Error al cargar");
    } else {
      setError(null);
      const porSolicitud = new Map<string, RespuestaSolicitud[]>();
      for (const r of (resps as RespuestaSolicitud[] | null) ?? []) {
        porSolicitud.set(r.solicitud_id, [...(porSolicitud.get(r.solicitud_id) ?? []), r]);
      }
      setSolicitudes(
        ((sols as unknown as Omit<SolicitudTraslado, "respuestas">[] | null) ?? []).map((s) => ({
          ...s,
          respuestas: porSolicitud.get(s.id) ?? [],
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  return { solicitudes, loading, error, reload };
}

export interface TrasladoEnviado {
  id: string;
  quantity: number;
  destino: string;
  reference: string | null;
  created_at: string;
  created_by: string | null;
  anulado_at: string | null;
  foto_path: string | null;
  product: { code: string; name: string; unit: string } | null;
}

/** Traslados ya enviados (salidas del Kardex con destino). */
export function useTrasladosEnviados() {
  const [traslados, setTraslados] = useState<TrasladoEnviado[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("inventory_movements")
      .select("id, quantity, destino, reference, created_at, created_by, anulado_at, foto_path, product:products(code, name, unit)")
      .not("destino", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);
    if (err) setError(err.message);
    else {
      setError(null);
      setTraslados((data as unknown as TrasladoEnviado[]) ?? []);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { traslados, error, reload };
}

export async function crearSolicitudTraslado(sucursal: string, productId: string, cantidad: number, nota: string) {
  const { error } = await supabase.rpc("crear_solicitud_traslado", {
    p_sucursal: sucursal,
    p_product_id: productId,
    p_cantidad: cantidad,
    p_nota: nota.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function responderSolicitudTraslado(
  solicitudId: string,
  tipo: TipoRespuesta,
  cantidad: number,
  nota: string
) {
  const { error } = await supabase.rpc("responder_solicitud_traslado", {
    p_solicitud_id: solicitudId,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_nota: nota.trim() || null,
  });
  return { error: error?.message ?? null };
}

/** Registra el traslado (salida del Kardex con destino). Devuelve el id del renglón del Kardex. */
export async function registrarTraslado(
  productId: string,
  sucursal: string,
  cantidad: number,
  nota: string,
  solicitudId?: string
) {
  const { data, error } = await supabase.rpc("registrar_traslado", {
    p_product_id: productId,
    p_sucursal: sucursal,
    p_cantidad: cantidad,
    p_nota: nota.trim() || null,
    p_solicitud_id: solicitudId ?? null,
  });
  return { movimientoId: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function cancelarSolicitudTraslado(solicitudId: string, motivo: string) {
  const { error } = await supabase.rpc("cancelar_solicitud_traslado", {
    p_solicitud_id: solicitudId,
    p_motivo: motivo,
  });
  return { error: error?.message ?? null };
}
