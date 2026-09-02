// ============================================================
// DATOS DEMO — Etapa 2
// ============================================================
// Todo lo definido en este archivo es INFORMACIÓN FICTICIA para
// alimentar el dashboard "Inicio" mientras los módulos reales
// (Inventario, Ventas y Entregas, Repartos, Retiros, Evidencias y
// Cobros) todavía no existen como tablas de Supabase.
//
// Nada de esto representa productos, clientes, empleados, montos
// o políticas reales de la empresa. Cuando se construyan esos
// módulos en etapas posteriores, este archivo se elimina y el
// dashboard pasa a consultar datos reales de la base de datos.
// ============================================================

export const DEMO_DATE_LABEL = "Viernes, 9 de mayo de 2025 (DEMO)";

export const demoStats = {
  repartosHoy: 4,
  porRecogerSucursal: 3,
  cobrosPendientes: 2,
  ventasHoy: 28450,
  mercanciaPendienteEntrega: 12,
};

export const demoInventory = {
  total: 1248,
  disponibles: 812,
  bajoStock: 284,
  sinExistencia: 152,
};

export interface DemoActivityItem {
  id: string;
  icon: "venta" | "reparto" | "cobro" | "entrada";
  title: string;
  subtitle: string;
  time: string;
}

export const demoActivity: DemoActivityItem[] = [
  { id: "1", icon: "venta", title: "Venta registrada (DEMO) a Cliente Uno", subtitle: "Folio V-2451", time: "10:32 a.m." },
  { id: "2", icon: "reparto", title: "Reparto entregado (DEMO) a Cliente Dos", subtitle: "Evidencias cargadas", time: "09:45 a.m." },
  { id: "3", icon: "cobro", title: "Cobro registrado en domicilio (DEMO)", subtitle: "Cliente Tres", time: "09:20 a.m." },
  { id: "4", icon: "entrada", title: "Entrada de mercancía (DEMO)", subtitle: "215 cajas — Producto DEMO A", time: "08:15 a.m." },
];

export interface DemoDelivery {
  id: string;
  cliente: string;
  direccion: string;
  hora: string;
}

export const demoUpcomingDeliveries: DemoDelivery[] = [
  { id: "1", cliente: "Cliente Uno (DEMO)", direccion: "Dirección DEMO #45", hora: "11:00" },
  { id: "2", cliente: "Cliente Dos (DEMO)", direccion: "Dirección DEMO #102", hora: "13:30" },
  { id: "3", cliente: "Cliente Tres (DEMO)", direccion: "Carretera DEMO km 3", hora: "15:30" },
];
