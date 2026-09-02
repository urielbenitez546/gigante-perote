import { useMemo, useState } from "react";
import { Settings, Users, UserCheck, UserX, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProfiles } from "../../hooks/useProfiles";
import { ROLE_LABELS, type Profile } from "../../types";
import EditarPerfilModal from "../../components/administracion/EditarPerfilModal";

export default function Administracion() {
  const { profile: myProfile } = useAuth();
  const { profiles, loading, error, reload } = useProfiles();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  const stats = useMemo(() => {
    const total = profiles.length;
    const activos = profiles.filter((p) => p.active).length;
    const inactivos = total - activos;
    return { total, activos, inactivos };
  }, [profiles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        (p.email ?? "").toLowerCase().includes(term) ||
        ROLE_LABELS[p.role].toLowerCase().includes(term)
    );
  }, [profiles, search]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Settings size={22} /> Administración
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Consulta y edita el nombre, rol y estado (activo/inactivo) de los empleados.
      </p>

      <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg px-3 py-2">
        Crear una cuenta de acceso nueva (correo + contraseña) todavía se hace desde el Dashboard de
        Supabase (Authentication → Users), como en la Etapa 1 — esta pantalla no la reemplaza, solo
        te evita tener que entrar ahí para cambiar un nombre, un rol, o dar de baja a alguien.
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center mb-2">
            <Users size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Empleados</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.total}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2">
            <UserCheck size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Activos</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.activos}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center mb-2">
            <UserX size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Dados de baja</p>
          <p className="text-xl font-bold text-gigante-navy">{stats.inactivos}</p>
        </div>
      </div>

      <div className="relative mt-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gigante-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo o rol..."
          className="w-full rounded-lg border border-gigante-border pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">No se encontraron empleados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gigante-bg text-gigante-muted text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nombre</th>
                <th className="text-left font-medium px-4 py-3">Correo</th>
                <th className="text-left font-medium px-4 py-3">Rol</th>
                <th className="text-left font-medium px-4 py-3">Estado</th>
                <th className="text-right font-medium px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gigante-border">
                  <td className="px-4 py-3 font-medium text-gigante-navy">
                    {p.full_name}
                    {myProfile?.id === p.id && (
                      <span className="ml-1.5 text-[10px] text-gigante-muted">(tú)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gigante-muted">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gigante-navy">{ROLE_LABELS[p.role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        p.active ? "bg-emerald-100 text-emerald-700" : "bg-gigante-red/10 text-gigante-red"
                      }`}
                    >
                      {p.active ? "Activo" : "Dado de baja"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-xs font-semibold text-gigante-red hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditarPerfilModal
          profile={editing}
          isSelf={myProfile?.id === editing.id}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
