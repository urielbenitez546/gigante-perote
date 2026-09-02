import { useProfiles } from "./useProfiles";

/**
 * Da acceso a "quién hizo esto" (vendedor, quién registró, quién
 * cobró, etc.) a partir de un campo created_by / *_by guardado en la
 * base de datos. nameFor() devuelve "Nombre (Puesto)" si la persona
 * tiene un puesto capturado, o solo "Nombre" si no.
 */
export function useProfileNames() {
  const { profiles, loading } = useProfiles();

  function nameFor(userId: string | null | undefined): string {
    if (!userId) return "—";
    const p = profiles.find((pr) => pr.id === userId);
    if (!p) return "Usuario eliminado";
    return p.puesto ? `${p.full_name} (${p.puesto})` : p.full_name;
  }

  return { nameFor, loading };
}
