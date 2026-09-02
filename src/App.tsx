import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/auth/Login";
import Inicio from "./pages/Inicio";
import Inventario from "./pages/inventario/Inventario";
import Ventas from "./pages/ventas/Ventas";
import Retiros from "./pages/retiros/Retiros";
import Repartos from "./pages/repartos/Repartos";
import RepartoDetalle from "./pages/repartos/RepartoDetalle";
import EvidenciasCobros from "./pages/evidencias/EvidenciasCobros";
import Manuales from "./pages/manuales/Manuales";
import Asistente from "./pages/asistente/Asistente";
import Administracion from "./pages/administracion/Administracion";
import Calculadora from "./pages/calculadora/Calculadora";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Inicio />} />

            {/* Módulos pendientes de construir en etapas posteriores.
                Cada uno queda como placeholder para que la navegación
                del sidebar / accesos rápidos no se rompa mientras tanto. */}
            <Route
              path="/inventario"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "almacen"]}>
                  <Inventario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ventas"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "caja"]}>
                  <Ventas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/retiros"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "almacen"]}>
                  <Retiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repartos"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "reparto", "caja", "ventas", "almacen"]}>
                  <Repartos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repartos/:id"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "reparto", "caja", "ventas", "almacen"]}>
                  <RepartoDetalle />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evidencias-cobros"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "caja"]}>
                  <EvidenciasCobros />
                </ProtectedRoute>
              }
            />
            <Route path="/manuales" element={<Manuales />} />
            <Route path="/asistente" element={<Asistente />} />
            <Route path="/calculadora" element={<Calculadora />} />
            <Route
              path="/administracion"
              element={
                <ProtectedRoute allowedRoles={["gerencia"]}>
                  <Administracion />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
