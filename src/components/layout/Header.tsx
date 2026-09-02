import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, MessageSquareWarning, CheckCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { ROLE_LABELS } from "../../types";
import ReportarProblemaModal from "./ReportarProblemaModal";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function Header() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { notifications, readIds, unreadCount, reload, markAsRead, markAllAsRead } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  if (!profile) return null;

  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleNotificationClick(id: string, linkPath: string | null) {
    await markAsRead(id);
    setNotifOpen(false);
    if (linkPath) navigate(linkPath);
  }

  return (
    <header className="sticky top-0 z-20 bg-gigante-bg/95 backdrop-blur border-b border-gigante-border">
      <div className="flex items-center justify-end gap-3 px-4 md:px-6 h-14">
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-1 text-xs font-medium text-gigante-muted hover:text-gigante-navy border border-gigante-border rounded-lg px-2.5 py-1.5"
          title="Reportar un problema"
        >
          <MessageSquareWarning size={15} />
          <span className="hidden sm:inline">Reportar</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative text-gigante-navy/80 hover:text-gigante-navy"
            aria-label="Notificaciones"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-gigante-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gigante-border">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gigante-border sticky top-0 bg-white">
                <p className="text-sm font-semibold text-gigante-navy">Notificaciones</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[11px] text-gigante-red hover:underline"
                  >
                    <CheckCheck size={13} /> Marcar todas
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-gigante-muted text-center">No hay notificaciones.</p>
              ) : (
                <ul>
                  {notifications.map((n) => {
                    const isUnread = !readIds.has(n.id);
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => handleNotificationClick(n.id, n.link_path)}
                          className={`w-full text-left px-3 py-2.5 border-b border-gigante-border last:border-0 hover:bg-gigante-bg ${
                            isUnread ? "bg-gigante-red/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {isUnread && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gigante-red shrink-0" />}
                            <div className="min-w-0">
                              <p className={`text-xs ${isUnread ? "font-semibold" : "font-medium"} text-gigante-navy`}>
                                {n.title}
                              </p>
                              {n.message && (
                                <p className="text-xs text-gigante-muted mt-0.5 line-clamp-2">{n.message}</p>
                              )}
                              <p className="text-[10px] text-gigante-muted mt-1">{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

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

      {showReportModal && (
        <ReportarProblemaModal
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
            reload();
          }}
        />
      )}
    </header>
  );
}
