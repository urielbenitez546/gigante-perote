import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { AppRole } from "../types";

interface Props {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { session, profile, loading, error, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gigante-muted text-sm">
        Cargando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center bg-white border border-gigante-border rounded-xl p-6">
          <p className="text-sm text-gigante-red font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (profile && !profile.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center bg-white border border-gigante-border rounded-xl p-6">
          <p className="text-sm text-gigante-red font-medium">
            Tu cuenta está dada de baja. Contacta a Gerencia si crees que esto es un error.
          </p>
          <button
            onClick={signOut}
            className="mt-4 text-sm font-semibold text-gigante-navy underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-gigante-muted">No tienes permiso para ver este módulo.</p>
      </div>
    );
  }

  return <>{children}</>;
}
