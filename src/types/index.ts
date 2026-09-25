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
  // Puesto real de la persona (ej. "Jefe de Almacén"), distinto del
  // rol del sistema — solo es informativo, no afecta permisos.
  puesto: string | null;
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
  { key: "pedidos", label: "Pedidos Pendientes", path: "/pedidos", roles: ["gerencia", "ventas", "almacen", "caja"] },
  { key: "retiros", label: "Retiros en Sucursal", path: "/retiros", roles: ["gerencia", "ventas", "almacen"] },
  { key: "repartos", label: "Repartos", path: "/repartos", roles: ["gerencia", "reparto"] },
  { key: "evidencias", label: "Evidencias y Cobros", path: "/evidencias-cobros", roles: ["gerencia", "caja"] },
  { key: "gastos", label: "Gastos", path: "/gastos", roles: ["gerencia"] },
  { key: "capacitacion", label: "Capacitación Express", path: "/capacitacion", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "manuales", label: "Manuales e Información", path: "/manuales", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "asistente", label: "Asistente de Consulta", path: "/asistente", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "calculadora", label: "Calculadora", path: "/calculadora", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "precios", label: "Precios y Etiquetas", path: "/precios-etiquetas", roles: ["gerencia", "ventas"] },
  { key: "etiquetas", label: "Generador de Etiquetas", path: "/etiquetas", roles: ["gerencia", "ventas", "caja"] },
  { key: "administracion", label: "Administración", path: "/administracion", roles: ["gerencia"] },
];

// ============================================================
// Inventario (Etapa 3)
// ============================================================
export type ProductUnit = "caja" | "pieza" | "bolsa" | "rollo" | "m2";

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  caja: "caja",
  pieza: "pieza",
  bolsa: "bolsa",
  rollo: "rollo",
  m2: "m²",
};

export type ProductRotacion = "incorporacion" | "muy_lento" | "lento" | "medio" | "rapido" | "obsoleto";

export const ROTACION_LABELS: Record<ProductRotacion, string> = {
  incorporacion: "Incorporación",
  muy_lento: "Muy lento",
  lento: "Lento",
  medio: "Medio",
  rapido: "Rápido",
  obsoleto: "Obsoleto",
};

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
  rotacion: ProductRotacion;
  descuento_porcentaje: number;
  stock_minimo: number;
  exhibition_stock: number;
  last_counted_at: string | null;
  exhibido: boolean;
  exhibido_desde: string | null;
  exhibido_ubicacion: string | null;
  zona_id: string | null;
  color: string | null;
  medida: string | null;
  tipo: string | null;
  calidad: string | null;
  medida_caja: string | null;
  /** Tamaño de etiqueta fijado a mano; null = automático por tipo de producto. */
  tamano_etiqueta?: "carta" | "media" | "cuarto" | "octavo" | null;
  external_id: string | null;
  active: boolean;
  created_at: string;
}

export type SemaforoStatus = "verde" | "amarillo" | "rojo";

export const SEMAFORO_LABELS: Record<SemaforoStatus, string> = {
  verde: "Hay suficiente",
  amarillo: "Se está acabando",
  rojo: "Se acabó",
};

/** Calcula el semáforo de un producto: verde si hay de sobra sobre su
 * mínimo, amarillo si ya llegó al mínimo (pero todavía queda algo),
 * rojo si ya no queda nada disponible para vender. */
export function calcularSemaforo(product: Product): SemaforoStatus {
  const disponible = product.physical_stock - product.sold_pending;
  if (disponible <= 0) return "rojo";
  if (disponible <= product.stock_minimo) return "amarillo";
  return "verde";
}

export type MovementType =
  | "entrada"
  | "salida"
  | "ajuste"
  | "merma"
  | "exhibicion"
  | "regreso_exhibicion"
  | "conteo";

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
export type NotificationType =
  | "general"
  | "manual"
  | "reparto_incidencia"
  | "stock_bajo"
  | "stock_agotado"
  | "venta_eliminada"
  | "venta_modificada"
  | "conteo_descuadre"
  | "apartado_por_vencer"
  | "apartado_vencido"
  | "exhibicion_quitar"
  | "exhibicion_poner"
  | "exhibicion_revision"
  | "exhibicion_rechazada"
  | "etiquetas_por_cambiar";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  target_roles: AppRole[] | null;
  link_path: string | null;
  related_delivery_id: string | null;
  related_product_id: string | null;
  related_sale_id: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// Exhibición, conteo físico, pedidos, gastos y capacitación
// ============================================================
export interface DisplayMovement {
  id: string;
  product_id: string;
  tipo: "sale" | "regresa";
  quantity: number;
  ubicacion: string | null;
  notas: string | null;
  photo_path: string | null;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, "code" | "name" | "unit">;
}

export interface InventoryCount {
  id: string;
  product_id: string;
  sistema: number;
  contado: number;
  diferencia: number;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, "code" | "name" | "unit">;
}

export interface ResumenPedidos {
  ventas_pendientes: number;
  ventas_parciales: number;
  ventas_entregadas_mes: number;
  monto_apartado: number;
  monto_entregado: number;
  monto_por_entregar: number;
  por_tipo: { retiro_sucursal: number; domicilio: number };
  productos: {
    id: string;
    code: string;
    name: string;
    unit: ProductUnit;
    vendido: number;
    entregado: number;
    por_entregar: number;
    fisico: number;
    ventas: number;
  }[];
}

/** Plazo que tiene el cliente para recoger o recibir su material. */
export const DIAS_PLAZO_APARTADO = 30;
export const DIAS_AVISO_APARTADO = 5;

/** Días que le quedan a un apartado (negativo = ya venció). */
export function diasRestantesApartado(createdAt: string, ref: Date = new Date()): number {
  const inicio = new Date(createdAt);
  const vence = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + DIAS_PLAZO_APARTADO);
  const hoy = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((vence.getTime() - hoy.getTime()) / 86_400_000);
}

export const EXPENSE_CATEGORIES = [
  "Combustible",
  "Mantenimiento de camioneta",
  "Papelería y oficina",
  "Limpieza",
  "Servicios (luz, agua, internet)",
  "Reparaciones del local",
  "Comida / viáticos",
  "Fletes y maniobras",
  "Otro",
] as const;

export const EXPENSE_PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"] as const;

export interface Expense {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  metodo_pago: string | null;
  proveedor: string | null;
  notas: string | null;
  photo_paths: string[];
  created_by: string | null;
  created_at: string;
}

export interface TrainingProgress {
  user_id: string;
  lesson_key: string;
  completed_at: string;
}

export interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  responsabilidades: string[];
  roles: AppRole[] | null;
  video_path: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  orden: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

/** Clave con la que se guarda en training_progress que un video ya se vio. */
export const videoLessonKey = (videoId: string) => `video:${videoId}`;

/** ID del sistema de la empresa (el "Id" del Excel de inventario). */
export function productoId(p: Pick<Product, "external_id" | "code">): string {
  return p.external_id != null && String(p.external_id).trim() !== "" ? String(p.external_id) : "";
}

/** ¿El producto coincide con lo buscado? Busca por ID, código, nombre y marca. */
export function productoCoincide(p: Product, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase();
  if (!q) return true;
  return (
    productoId(p).toLowerCase().includes(q) ||
    p.code.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q)
  );
}

// ============================================================
// Auditoría de exhibición
// ============================================================
export type EstadoExhibicion = "ok" | "falta_exhibir" | "quitar" | "sin_stock";

/**
 * Regla del Gerente: todo lo que tiene existencia disponible debe estar
 * exhibido, y lo que ya no tiene debe quitarse de exhibición.
 */
export function estadoExhibicion(p: Pick<Product, "physical_stock" | "sold_pending" | "exhibido">): EstadoExhibicion {
  const disponible = p.physical_stock - p.sold_pending;
  if (disponible > 0) return p.exhibido ? "ok" : "falta_exhibir";
  return p.exhibido ? "quitar" : "sin_stock";
}

export interface DisplayRequest {
  id: string;
  product_id: string;
  tipo: "exhibir" | "retirar";
  cantidad: number;
  muestra: string | null;
  ubicacion: string | null;
  notas: string | null;
  photo_path: string | null;
  estado: "pendiente" | "confirmada" | "rechazada";
  solicitado_por: string | null;
  solicitado_at: string;
  revisado_por: string | null;
  revisado_at: string | null;
  comentario_revision: string | null;
  product?: Pick<Product, "code" | "name" | "unit" | "external_id">;
}

// ============================================================
// Actualización de precios y etiquetas
// ============================================================
export interface StoreZone {
  id: string;
  nombre: string;
  vendedor_id: string | null;
  orden: number;
}

export interface DiscountRule {
  rotacion: ProductRotacion;
  descuento: number;
}

export interface LabelQueueItem {
  id: string;
  product_id: string;
  batch_id: string | null;
  rotacion_antes: ProductRotacion | null;
  rotacion_despues: ProductRotacion | null;
  precio_antes: number | null;
  precio_despues: number | null;
  descuento_antes: number | null;
  descuento_despues: number | null;
  estado: "pendiente" | "impresa" | "colocada";
  impresa_at: string | null;
  colocada_por: string | null;
  colocada_at: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface LabelBatch {
  id: string;
  nombre: string;
  filas: number;
  actualizados: number;
  no_encontrados: string[];
  created_by: string | null;
  created_at: string;
}

export interface ResultadoActualizacion {
  lote_id: string | null;
  cambiados: number;
  sin_cambio: number;
  no_encontrados: string[];
  rotaciones_no_reconocidas: string[];
  detalle: {
    id: string;
    nombre: string;
    rotacion_antes: string;
    rotacion_despues: string;
    precio_antes: number;
    precio_despues: number;
    descuento_antes: number;
    descuento_despues: number;
  }[];
}
