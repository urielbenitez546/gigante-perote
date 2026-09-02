import { useState } from "react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../types";

export default function Header() {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!profile) return null;

  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 bg-gigante-bg/95 backdrop-blur border-b border-gigante-border">
      <div className="flex items-center justify-end gap-4 px-4 md:px-6 h-14">
        <button className="relative text-gigante-navy/80 hover:text-gigante-navy" aria-label="Notificaciones">
          <Bell size={20} />
          {/* El contador real de notificaciones (basado en eventos DEMO) se conecta en la Etapa 2 */}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-gigante-navy text-white flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-sm font-medium text-gigante-navy">{profile.full_name}</p>
              <p className="text-[11px] text-gigante-muted">Rol: {ROLE_LABELS[profile.role]}</p>
            </div>
            <ChevronDown size={16} className="text-gigante-muted" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gigante-border py-1">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gigante-navy hover:bg-gigante-bg"
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
