import { useMemo } from "react";
import { useProfiles } from "./useProfiles";

/**
 * Devuelve un mapa { id_de_usuario: nombre_completo } para poder
 * mostrar "quién hizo esto" (vendedor, quién registró, quién cobró,
 * etc.) en cualquier pantalla, a partir de un campo created_by /
 * *_by guardado en la base de datos.
 */
export function useProfileNames() {
  const { profiles, loading } = useProfiles();
  const namesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) {
      map[p.id] = p.full_name;
    }
    return map;
  }, [profiles]);

  function nameFor(userId: string | null | undefined): string {
    if (!userId) return "—";
    return namesById[userId] ?? "Usuario eliminado";
  }

  return { namesById, nameFor, loading };
}
