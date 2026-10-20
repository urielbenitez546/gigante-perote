import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type TipoUnidad = "vehiculo" | "montacargas";

export const TIPO_UNIDAD_LABELS: Record<TipoUnidad, string> = {
  vehiculo: "Vehículo",
  montacargas: "Montacargas",
};

export interface RegistroCombustible {
  id: string;
  tipo_unidad: TipoUnidad;
  unidad: string;
  fecha: string; // yyyy-mm-dd
  litros: number;
  monto: number | null;
  odometro: number | null; // km (vehículo) u horas (montacargas)
  foto_ticket: string | null;
  foto_tablero: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  anulado_at: string | null;
  anulado_por: string | null;
  anulado_motivo: string | null;
}

/** Cada persona ve lo que registró; Gerencia, jefe y auxiliar ven todo (lo decide la base de datos). */
export function useBitacoraCombustible() {
  const [registros, setRegistros] = useState<RegistroCombustible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("bitacora_combustible")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);
    if (err) setError(err.message);
    else {
      setError(null);
      setRegistros((data as RegistroCombustible[] | null) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { registros, loading, error, reload };
}

export interface NuevoRegistroCombustible {
  tipoUnidad: TipoUnidad;
  unidad: string;
  fecha: string;
  litros: number;
  monto: number | null;
  odometro: number | null;
  fotoTicket: string | null;
  fotoTablero: string | null;
  notas: string;
}

export async function registrarCombustible(r: NuevoRegistroCombustible) {
  const { error } = await supabase.rpc("registrar_combustible", {
    p_tipo_unidad: r.tipoUnidad,
    p_unidad: r.unidad,
    p_fecha: r.fecha,
    p_litros: r.litros,
    p_monto: r.monto,
    p_odometro: r.odometro,
    p_foto_ticket: r.fotoTicket,
    p_foto_tablero: r.fotoTablero,
    p_notas: r.notas.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function anularRegistroCombustible(id: string, motivo: string) {
  const { error } = await supabase.rpc("anular_registro_combustible", { p_id: id, p_motivo: motivo });
  return { error: error?.message ?? null };
}
