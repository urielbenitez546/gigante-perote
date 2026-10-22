import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Cobranza from "./pages/cobranza/Cobranza";
import Manuales from "./pages/manuales/Manuales";
import Asistente from "./pages/asistente/Asistente";
import Administracion from "./pages/administracion/Administracion";
import Calculadora from "./pages/calculadora/Calculadora";
import Etiquetas from "./pages/etiquetas/Etiquetas";
import ProductoDetalle from "./pages/productos/ProductoDetalle";
import Gastos from "./pages/gastos/Gastos";
import Capacitacion from "./pages/capacitacion/Capacitacion";
import Kardex from "./pages/kardex/Kardex";
import Kilometraje from "./pages/kilometraje/Kilometraje";
import PorProgramar from "./pages/programacion/PorProgramar";
import EntregasHoy from "./pages/programacion/EntregasHoy";
import Traslados from "./pages/traslados/Traslados";
import Combustible from "./pages/combustible/Combustible";
import Cotizaciones from "./pages/cotizaciones/Cotizaciones";
import ListaPrecios from "./pages/listaprecios/ListaPrecios";
import PreciosEtiquetas from "./pages/precios/PreciosEtiquetas";

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
            <Route path="/producto/:id" element={<ProductoDetalle />} />

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
              path="/kardex"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "almacen", "reparto"]}>
                  <Kardex />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kilometraje"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "almacen"]} moduleKey="kilometraje">
                  <Kilometraje />
                </ProtectedRoute>
              }
            />
            <Route
              path="/por-programar"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "caja", "almacen"]} moduleKey="por-programar" redirectTo="/entregas-hoy">
                  <PorProgramar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entregas-hoy"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "almacen"]}>
                  <EntregasHoy />
                </ProtectedRoute>
              }
            />
            <Route
              path="/traslados"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "almacen"]} moduleKey="traslados">
                  <Traslados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/combustible"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "reparto", "almacen"]}>
                  <Combustible />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotizaciones"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "caja"]}>
                  <Cotizaciones />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lista-precios"
              element={
                <ProtectedRoute allowedRoles={["gerencia"]}>
                  <ListaPrecios />
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
            <Route path="/pedidos" element={<Navigate to="/por-programar" replace />} />
            <Route
              path="/gastos"
              element={
                <ProtectedRoute allowedRoles={["gerencia"]}>
                  <Gastos />
                </ProtectedRoute>
              }
            />
            <Route path="/capacitacion" element={<Capacitacion />} />
            <Route
              path="/precios-etiquetas"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas"]}>
                  <PreciosEtiquetas />
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
              path="/cobranza"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "caja"]}>
                  <Cobranza />
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
              path="/etiquetas"
              element={
                <ProtectedRoute allowedRoles={["gerencia", "ventas", "caja"]}>
                  <Etiquetas />
                </ProtectedRoute>
              }
            />
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
