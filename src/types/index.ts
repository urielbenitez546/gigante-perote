// Roles funcionales definidos por el negocio.
// OJO: estos son los 5 roles reales del sistema (confirmados). Los nombres
// visuales de las imágenes de referencia ("Gerente", "Auxiliar de Ventas",
// "Auxiliar de Almacén", "Chofer") se mapean a estos roles funcionales.
export type AppRole = "gerencia" | "ventas" | "caja" | "almacen" | "reparto";

export interface Profile {
  id: string; // = auth.users.id
  full_name: string;
  email: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  gerencia: "Gerencia",
  ventas: "Ventas",
  caja: "Caja",
  almacen: "Almacén",
  reparto: "Reparto",
};

// Módulos de navegación disponibles y qué roles pueden verlos.
// Se usa tanto en el Sidebar/BottomNav como referencia para futuras etapas.
export interface NavModule {
  key: string;
  label: string;
  path: string;
  roles: AppRole[]; // roles que pueden ver este módulo
}

export const NAV_MODULES: NavModule[] = [
  { key: "inicio", label: "Inicio", path: "/", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "inventario", label: "Inventario", path: "/inventario", roles: ["gerencia", "ventas", "almacen"] },
  { key: "ventas", label: "Ventas y Entregas", path: "/ventas", roles: ["gerencia", "ventas", "caja"] },
  { key: "retiros", label: "Retiros en Sucursal", path: "/retiros", roles: ["gerencia", "ventas", "almacen"] },
  { key: "repartos", label: "Repartos", path: "/repartos", roles: ["gerencia", "reparto"] },
  { key: "evidencias", label: "Evidencias y Cobros", path: "/evidencias-cobros", roles: ["gerencia", "caja"] },
  { key: "manuales", label: "Manuales e Información", path: "/manuales", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "asistente", label: "Asistente de Consulta", path: "/asistente", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "calculadora", label: "Calculadora", path: "/calculadora", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "administracion", label: "Administración", path: "/administracion", roles: ["gerencia"] },
];

// ============================================================
// Inventario (Etapa 3)
// ============================================================
export type ProductUnit = "caja" | "pieza" | "bolsa" | "rollo";

export interface Product {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: string;
  unit: ProductUnit;
  physical_stock: number;
  sold_pending: number;
  unit_price: number;
  active: boolean;
  created_at: string;
}

export type MovementType = "entrada" | "salida" | "ajuste" | "merma";

export interface InventoryMovement {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  created_by: string | null;
  created_at: string;
  // Se agrega en el frontend al hacer join con products
  product?: Pick<Product, "code" | "name">;
}

// ============================================================
// Ventas y Entregas / Retiros en Sucursal (Etapa 4)
// ============================================================
export type DeliveryType = "inmediata" | "retiro_sucursal" | "domicilio";
export type SaleStatus = "pendiente" | "parcial" | "entregada" | "cancelada";

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  inmediata: "Entrega inmediata",
  retiro_sucursal: "Retiro en sucursal",
  domicilio: "Entrega a domicilio",
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

export interface Sale {
  id: string;
  folio: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_type: DeliveryType;
  status: SaleStatus;
  total: number;
  amount_paid: number;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  created_by: string | null;
  created_at: string;
  delivered_at: string | null;
  scheduled_pickup_date: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  delivery_type: DeliveryType | null;
  delivered_quantity: number;
  product?: Pick<Product, "code" | "name" | "unit">;
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItem[];
}

// Un renglón de venta pendiente (usado en Retiros/Repartos para armar
// selecciones de "cuánto entrego ahora").
export interface PendingLine {
  sale_item_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  unit: ProductUnit;
  pending: number; // quantity - delivered_quantity
}

// ============================================================
// Repartos (Etapa 5)
// ============================================================
export type DeliveryStatus = "pendiente" | "en_camino" | "entregado" | "incidencia";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pendiente: "Pendiente",
  en_camino: "En camino",
  entregado: "Entregado",
  incidencia: "Incidencia",
};

export interface DeliveryItemRef {
  sale_item_id: string;
  product_id: string;
  quantity: number;
}

// ============================================================
// Evidencias y Cobros (Etapa 6)
// ============================================================
export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export interface Delivery {
  id: string;
  sale_id: string;
  status: DeliveryStatus;
  driver_name: string | null;
  vehicle: string | null;
  initial_km: number | null;
  current_km: number | null;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  items: DeliveryItemRef[] | null;
  signature_path: string | null;
  photo_paths: string[] | null;
  amount_collected: number | null;
  payment_method: PaymentMethod | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  payment_notes: string | null;
  sale: SaleWithItems;
}

// ============================================================
// Facturas de proveedores y Merma
// ============================================================
export interface PurchaseInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  product?: Pick<Product, "code" | "name" | "unit" | "brand" | "category">;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier: string;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
  purchase_invoice_items: PurchaseInvoiceItem[];
}

export interface MaterialWriteOff {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, "code" | "name" | "unit">;
}

// ============================================================
// Manuales e Información + Asistente de Consulta (Etapa 7)
// ============================================================
export type ManualCategory = "bienvenida" | "puesto" | "protocolo" | "politica" | "otro";

export const MANUAL_CATEGORY_LABELS: Record<ManualCategory, string> = {
  bienvenida: "Bienvenida",
  puesto: "Descripción de puesto",
  protocolo: "Protocolo",
  politica: "Política",
  otro: "Otro",
};

export interface Manual {
  id: string;
  title: string;
  description: string | null;
  category: ManualCategory;
  // null = aplica para todos los roles
  target_roles: AppRole[] | null;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: ManualCategory | null;
  target_roles: AppRole[] | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Notificaciones (campanita)
// ============================================================
export type NotificationType = "general" | "manual" | "reparto_incidencia";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  target_roles: AppRole[] | null;
  link_path: string | null;
  related_delivery_id: string | null;
  created_by: string | null;
  created_at: string;
}
