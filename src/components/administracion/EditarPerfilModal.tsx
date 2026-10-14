import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  ROLE_LABELS,
  NIVEL_ALMACEN_LABELS,
  PERMISOS,
  permisoPorDefecto,
  tienePermiso,
  type AppRole,
  type NivelAlmacen,
  type PermisoKey,
  type Profile,
} from "../../types";
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
  const [puesto, setPuesto] = useState(profile.puesto ?? "");
  const [role, setRole] = useState<AppRole>(profile.role);
  const [nivel, setNivel] = useState<NivelAlmacen>(profile.nivel_almacen ?? "jefe");
  const [active, setActive] = useState(profile.active);
  const [efectivo, setEfectivo] = useState<Record<PermisoKey, boolean>>(
    () => Object.fromEntries(PERMISOS.map((x) => [x.key, tienePermiso(profile, x.key)])) as Record<PermisoKey, boolean>
  );

  // Al cambiar rol o nivel, los permisos vuelven a lo normal de ese puesto.
  function resetPermisos(r: AppRole, n: NivelAlmacen) {
    setEfectivo(
      Object.fromEntries(PERMISOS.map((x) => [x.key, permisoPorDefecto(r, n, x.key)])) as Record<PermisoKey, boolean>
    );
  }
  const nivelEfectivo: NivelAlmacen = role === "almacen" ? nivel : "jefe";
  const hayCambiosPermisos = PERMISOS.some((x) => efectivo[x.key] !== permisoPorDefecto(role, nivelEfectivo, x.key));
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
      puesto: puesto.trim() || null,
      role: isSelf ? undefined : role,
      nivelAlmacen: nivelEfectivo,
      permisos:
        role === "gerencia"
          ? {}
          : Object.fromEntries(
              PERMISOS.filter((x) => efectivo[x.key] !== permisoPorDefecto(role, nivelEfectivo, x.key)).map((x) => [
                x.key,
                efectivo[x.key],
              ])
            ),
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
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
            <label className="block text-sm font-medium text-gigante-navy mb-1">
              Puesto (opcional)
            </label>
            <input
              value={puesto}
              onChange={(e) => setPuesto(e.target.value)}
              placeholder="Ej. Jefe de Almacén, Auxiliar de Inventario..."
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-gigante-muted mt-1">
              Es solo informativo — se muestra junto a su nombre en el sistema. El rol de abajo es
              el que de verdad controla a qué puede entrar.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value as AppRole;
                setRole(r);
                resetPermisos(r, nivel);
              }}
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

          {role === "almacen" && (
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Nivel en almacén</label>
              <select
                value={nivel}
                onChange={(e) => {
                  const n = e.target.value as NivelAlmacen;
                  setNivel(n);
                  resetPermisos(role, n);
                }}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              >
                {(Object.keys(NIVEL_ALMACEN_LABELS) as NivelAlmacen[]).map((n) => (
                  <option key={n} value={n}>
                    {NIVEL_ALMACEN_LABELS[n]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gigante-muted mt-1">
                Jefe: todo. Auxiliar: opera almacén pero no edita precios ni productos. Almacenista: solo
                consulta y actualiza el Kardex.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gigante-navy">Permisos</label>
              {role !== "gerencia" && hayCambiosPermisos && (
                <button
                  type="button"
                  onClick={() => resetPermisos(role, nivelEfectivo)}
                  className="text-xs text-gigante-red font-medium"
                >
                  Restablecer a lo normal
                </button>
              )}
            </div>
            {role === "gerencia" ? (
              <p className="text-xs text-gigante-muted bg-gigante-bg rounded-lg px-3 py-2">
                Gerencia siempre tiene todos los permisos.
              </p>
            ) : (
              <div className="border border-gigante-border rounded-lg divide-y divide-gigante-border">
                {PERMISOS.map((x) => {
                  const distinto = efectivo[x.key] !== permisoPorDefecto(role, nivelEfectivo, x.key);
                  return (
                    <div key={x.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-gigante-navy">
                          {x.label}
                          {distinto && (
                            <span className="ml-2 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">
                              cambiado
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gigante-muted">{x.ayuda}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEfectivo((prev) => ({ ...prev, [x.key]: !prev[x.key] }))}
                        className={`w-11 h-6 shrink-0 rounded-full relative transition-colors ${
                          efectivo[x.key] ? "bg-emerald-500" : "bg-gigante-border"
                        }`}
                        aria-label={x.label}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            efectivo[x.key] ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
