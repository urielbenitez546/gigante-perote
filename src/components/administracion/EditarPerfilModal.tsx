import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { ROLE_LABELS, type AppRole, type Profile } from "../../types";
import { updateProfile } from "../../hooks/useProfiles";

interface Props {
  profile: Profile;
  isSelf: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_ROLES: AppRole[] = ["gerencia", "ventas", "caja", "almacen", "reparto"];

export default function EditarPerfilModal({ profile, isSelf, onClose, onSuccess }: Props) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [role, setRole] = useState<AppRole>(profile.role);
  const [active, setActive] = useState(profile.active);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setSubmitting(true);
    const { error: err } = await updateProfile(profile.id, {
      fullName: fullName.trim(),
      role: isSelf ? undefined : role,
      active: isSelf ? undefined : active,
    });
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gigante-navy">Editar usuario</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gigante-muted mb-3">{profile.email}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Nombre completo
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              disabled={isSelf}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm disabled:bg-gigante-bg disabled:text-gigante-muted"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between border border-gigante-border rounded-lg px-3 py-2.5">
            <span className="text-sm text-gigante-navy">Cuenta activa</span>
            <button
              type="button"
              disabled={isSelf}
              onClick={() => setActive((prev) => !prev)}
              className={`w-11 h-6 rounded-full relative transition-colors disabled:opacity-40 ${
                active ? "bg-emerald-500" : "bg-gigante-border"
              }`}
              aria-label="Activar o desactivar cuenta"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  active ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {isSelf && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No puedes cambiar tu propio rol ni desactivar tu propia cuenta desde aquí, para evitar
              que te quedes sin acceso. Pídeselo a otro usuario de Gerencia.
            </p>
          )}

          {error && (
            <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
