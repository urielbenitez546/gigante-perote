import { useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_MODULES } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { MODULE_ICONS } from "./navIcons";
import { MoreHorizontal, X } from "lucide-react";

export default function BottomNav() {
  const { profile } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!profile) return null;

  const visibleModules = NAV_MODULES.filter((m) => m.roles.includes(profile.role));
  const primary = visibleModules.slice(0, 3);
  const rest = visibleModules.slice(3);

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl p-3 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="font-semibold text-gigante-navy">Más opciones</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            {rest.map((mod) => {
              const Icon = MODULE_ICONS[mod.key];
              return (
                <NavLink
                  key={mod.key}
                  to={mod.path}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm ${
                      isActive ? "bg-gigante-red/10 text-gigante-red font-medium" : "text-gigante-navy"
                    }`
                  }
                >
                  {Icon && <Icon size={18} />}
                  {mod.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gigante-navy text-white flex items-stretch justify-around h-16 z-30 border-t border-white/10">
        {primary.map((mod) => {
          const Icon = MODULE_ICONS[mod.key];
          return (
            <NavLink
              key={mod.key}
              to={mod.path}
              end={mod.path === "/"}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? "text-gigante-red" : "text-white/80"
                }`
              }
            >
              {Icon && <Icon size={20} />}
              {mod.label.split(" ")[0]}
            </NavLink>
          );
        })}
        {rest.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-white/80"
          >
            <MoreHorizontal size={20} />
            Más
          </button>
        )}
      </nav>
    </>
  );
}
