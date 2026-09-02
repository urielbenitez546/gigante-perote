import { NavLink } from "react-router-dom";
import { NAV_MODULES } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { MODULE_ICONS } from "./navIcons";

export default function Sidebar() {
  const { profile } = useAuth();
  if (!profile) return null;

  const visibleModules = NAV_MODULES.filter((m) => m.roles.includes(profile.role));

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gigante-navy text-white h-screen sticky top-0">
      <div className="flex flex-col items-center gap-2 py-6 border-b border-white/10">
        <div className="w-16 h-16 rounded-full border-2 border-white/30 flex items-center justify-center bg-white/5">
          <span className="text-2xl font-bold text-gigante-red">G</span>
        </div>
        <div className="text-center leading-tight">
          <p className="font-bold tracking-wide text-sm">EL GIGANTE</p>
          <p className="text-[10px] tracking-widest text-white/70">DE LOS AZULEJOS Y MÁRMOLES</p>
        </div>
        <p className="text-xs text-white/60 mt-1">Sucursal Perote</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {visibleModules.map((mod) => {
          const Icon = MODULE_ICONS[mod.key];
          return (
            <NavLink
              key={mod.key}
              to={mod.path}
              end={mod.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-gigante-red text-white font-medium"
                    : "text-white/80 hover:bg-white/10"
                }`
              }
            >
              {Icon && <Icon size={18} />}
              {mod.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-white/60">
        ¿Necesitas ayuda?
        <br />
        Comunícate con tu jefe o gerente.
      </div>
    </aside>
  );
}
