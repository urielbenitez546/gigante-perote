// Roles funcionales definidos por el negocio.
// OJO: estos son los 5 roles reales del sistema (confirmados). Los nombres
// visuales de las imágenes de referencia ("Gerente", "Auxiliar de Ventas",
// "Auxiliar de Almacén", "Chofer") se mapean a estos roles funcionales.
export type AppRole = "gerencia" | "ventas" | "caja" | "almacen" | "reparto";

// Nivel dentro del rol "almacen". El rol del sistema es el mismo para los tres
// (para no tocar todos los permisos de la base de datos); el nivel decide cuánto
// puede modificar cada quien:
//  - jefe:        todo lo que hace Almacén hoy (incluye editar precio/rotación).
//  - auxiliar:    opera el almacén (entradas, salidas, conteos, facturas, merma,
//                 retiros) pero NO edita precio/rotación ni datos del producto.
//  - almacenista: solo consulta (inventario, pedidos, retiros, calculadora) y
//                 actualiza el Kardex (entrada/salida/conteo). No modifica nada más.
export type NivelAlmacen = "jefe" | "auxiliar" | "almacenista";

export const NIVEL_ALMACEN_LABELS: Record<NivelAlmacen, string> = {
  jefe: "Jefe de almacén",
  auxiliar: "Auxiliar de almacén",
  almacenista: "Almacenista / cargador",
};

/** Nivel efectivo de una persona de Almacén (si no tiene, se asume jefe, como era antes). */
export function nivelAlmacen(p: Pick<Profile, "role" | "nivel_almacen"> | null | undefined): NivelAlmacen | null {
  if (!p || p.role !== "almacen") return null;
  return p.nivel_almacen ?? "jefe";
}

// ----- Permisos por persona -------------------------------------------------
// Cada persona parte de lo que le toca por su rol/nivel; Gerencia puede
// prender o apagar permisos sueltos (se guardan en profiles.permisos).
// OJO: los valores por defecto de abajo deben coincidir con la función
// tiene_permiso() de Supabase (migración 0022).
export type PermisoKey =
  | "editar_precios"
  | "operar_almacen"
  | "kardex"
  | "kardex_entradas"
  | "registrar_facturas"
  | "dar_de_baja"
  | "corregir_cobros"
  | "confirmar_retiros"
  | "pedir_exhibicion"
  | "confirmar_exhibicion"
  | "anular_kardex"
  | "ver_km"
  | "programar_entregas";

export const PERMISOS: { key: PermisoKey; label: string; ayuda: string }[] = [
  { key: "editar_precios", label: "Editar precio, rotación y datos del producto", ayuda: "Botón de lápiz en Inventario." },
  { key: "operar_almacen", label: "Operar almacén desde Inventario", ayuda: "Registrar entradas, salidas, facturas, dar de baja material y conteos." },
  { key: "kardex", label: "Kardex: registrar salidas", ayuda: "Anotar lo que sale de almacén (ej. ventas que se cargan a la camioneta) en el formato del Kardex." },
  { key: "kardex_entradas", label: "Kardex: registrar entradas y conteos", ayuda: "Anotar entradas de mercancía y conteos físicos en el Kardex." },
  { key: "registrar_facturas", label: "Registrar facturas de compra", ayuda: "Botón Registrar factura en Inventario." },
  { key: "dar_de_baja", label: "Dar de baja material dañado", ayuda: "Sin este permiso, la persona solo puede reportar el incidente al Jefe de almacén y a Gerencia." },
  { key: "corregir_cobros", label: "Corregir el monto cobrado de una venta", ayuda: "Caja y Gerencia pueden corregir el cobro, siempre con motivo. Gerencia ve el historial de cambios." },
  { key: "confirmar_retiros", label: "Confirmar retiros en sucursal", ayuda: "Marcar que el cliente ya recogió su mercancía." },
  { key: "pedir_exhibicion", label: "Registrar que exhibió o quitó un producto", ayuda: "Botones “Ya exhibí” / “Ya lo quité” con foto de evidencia en Inventario → Exhibición." },
  { key: "confirmar_exhibicion", label: "Confirmar exhibiciones", ayuda: "Revisar la foto y confirmar o rechazar lo que registran los demás. Nadie confirma su propio registro." },
  { key: "anular_kardex", label: "Anular renglones del Kardex", ayuda: "Corregir un error del Kardex: queda tachado con el motivo, no se borra." },
  { key: "ver_km", label: "Ver kilometraje y repartos del día", ayuda: "Módulo Kilometraje: destinos y km de cada chofer." },
  { key: "programar_entregas", label: "Programar día y hora de entregas", ayuda: "Pantalla Entregas por programar: asignar y cambiar fecha, hora y marcar “esperando proveedor”." },
];

export function permisoPorDefecto(
  role: AppRole,
  nivel: NivelAlmacen | null | undefined,
  key: PermisoKey
): boolean {
  if (role === "gerencia") return true;
  const n = role === "almacen" ? (nivel ?? "jefe") : null;
  const operativo = n === "jefe" || n === "auxiliar";
  switch (key) {
    case "editar_precios":
      return n === "jefe";
    case "operar_almacen":
      return operativo;
    case "kardex":
      return role === "almacen";
    case "kardex_entradas":
      return operativo;
    case "registrar_facturas":
    case "dar_de_baja":
      return n === "jefe";
    case "corregir_cobros":
      return role === "caja";
    case "confirmar_retiros":
      return role === "ventas" || operativo;
    case "pedir_exhibicion":
      return role === "ventas" || role === "almacen";
    case "confirmar_exhibicion":
      return n === "jefe";
    case "anular_kardex":
      return n === "jefe";
    case "ver_km":
    case "programar_entregas":
      return operativo;
  }
}

export function tienePermiso(
  p: Pick<Profile, "role" | "nivel_almacen" | "permisos"> | null | undefined,
  key: PermisoKey
): boolean {
  if (!p) return false;
  if (p.role === "gerencia") return true;
  const o = p.permisos?.[key];
  if (typeof o === "boolean") return o;
  return permisoPorDefecto(p.role, p.nivel_almacen, key);
}

export interface Profile {
  id: string; // = auth.users.id
  full_name: string;
  email: string | null;
  role: AppRole;
  // Puesto real de la persona (ej. "Jefe de Almacén"), distinto del
  // rol del sistema — solo es informativo, no afecta permisos.
  puesto: string | null;
  nivel_almacen?: NivelAlmacen | null;
  permisos?: Partial<Record<PermisoKey, boolean>> | null;
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
  /** Si se indica, además del rol hace falta este permiso (por ejemplo, jefe y auxiliar pero no almacenistas). */
  permiso?: PermisoKey;
  /** Si se indica, el permiso de arriba solo se exige a estos roles (los demás lo ven por su rol). */
  permisoRoles?: AppRole[];
}

/** ¿Este módulo le corresponde a esta persona? (rol + permiso si el módulo lo pide) */
export function moduloVisible(
  profile: Pick<Profile, "role" | "nivel_almacen" | "permisos"> | null | undefined,
  m: NavModule
): boolean {
  if (!profile || !m.roles.includes(profile.role)) return false;
  if (!m.permiso) return true;
  if (m.permisoRoles && !m.permisoRoles.includes(profile.role)) return true;
  return tienePermiso(profile, m.permiso);
}

export const NAV_MODULES: NavModule[] = [
  { key: "inicio", label: "Inicio", path: "/", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "inventario", label: "Inventario", path: "/inventario", roles: ["gerencia", "ventas", "almacen"] },
  { key: "kardex", label: "Kardex", path: "/kardex", roles: ["gerencia", "almacen", "reparto"] },
  { key: "kilometraje", label: "Kilometraje", path: "/kilometraje", roles: ["gerencia", "almacen"], permiso: "ver_km" },
  { key: "ventas", label: "Ventas y Entregas", path: "/ventas", roles: ["gerencia", "ventas", "caja"] },
  { key: "por-programar", label: "Entregas por programar", path: "/por-programar", roles: ["gerencia", "ventas", "caja", "almacen"], permiso: "programar_entregas", permisoRoles: ["almacen"] },
  { key: "entregas-hoy", label: "Entregas de hoy", path: "/entregas-hoy", roles: ["gerencia", "almacen"] },
  { key: "traslados", label: "Traslados a sucursales", path: "/traslados", roles: ["gerencia", "ventas", "almacen"], permiso: "operar_almacen", permisoRoles: ["almacen"] },
  { key: "combustible", label: "Combustible y montacargas", path: "/combustible", roles: ["gerencia", "reparto", "almacen"] },
  { key: "cotizaciones", label: "Cotizaciones", path: "/cotizaciones", roles: ["gerencia", "ventas", "caja"] },
  { key: "retiros", label: "Retiros en Sucursal", path: "/retiros", roles: ["gerencia", "ventas", "almacen"] },
  { key: "repartos", label: "Repartos", path: "/repartos", roles: ["gerencia", "reparto"] },
  { key: "cobranza", label: "Cobranza y Corte", path: "/cobranza", roles: ["gerencia", "caja"] },
  { key: "evidencias", label: "Evidencias y Cobros", path: "/evidencias-cobros", roles: ["gerencia", "caja"] },
  { key: "gastos", label: "Gastos", path: "/gastos", roles: ["gerencia"] },
  { key: "capacitacion", label: "Capacitación Express", path: "/capacitacion", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "manuales", label: "Manuales e Información", path: "/manuales", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "asistente", label: "Asistente de Consulta", path: "/asistente", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "calculadora", label: "Calculadora", path: "/calculadora", roles: ["gerencia", "ventas", "caja", "almacen", "reparto"] },
  { key: "precios", label: "Precios y Etiquetas", path: "/precios-etiquetas", roles: ["gerencia", "ventas"] },
  { key: "lista-precios", label: "Lista de precios público", path: "/lista-precios", roles: ["gerencia"] },
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
  /** Precio público con IVA de una lista aparte (Helvex, Proyecta...). null = no aplica. */
  precio_lista?: number | null;
  precio_lista_fuente?: string | null;
  precio_lista_at?: string | null;
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

/** Precio público de un producto: el de su lista (Excel de la marca) si la
 * tiene; si no, el de SIGAM. Igual que cobra register_sale en el servidor. */
export function precioPublico(p: Pick<Product, "unit_price" | "precio_lista">): number {
  return p.precio_lista != null ? Number(p.precio_lista) : Number(p.unit_price);
}

/** Precio de promoción: para productos con lista de precios es el de SIGAM
 * tal cual (sin descuento extra); para los demás, el de siempre
 * (unit_price menos el % de descuento). */
export function precioPromocion(
  p: Pick<Product, "unit_price" | "precio_lista" | "descuento_porcentaje">
): number {
  if (p.precio_lista != null) return Number(p.unit_price);
  return Number(p.unit_price) * (1 - Number(p.descuento_porcentaje ?? 0) / 100);
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
  // Etapa 2: documento, pago, paso por Caja y programación
  tipo_documento: TipoDocumento;
  numero_orden: string | null;
  numero_factura: string | null;
  metodo_pago: MetodoPagoVenta | null;
  meses_nota: string | null;
  estado_pago: EstadoPago;
  liberada_almacen_at: string | null;
  liberada_almacen_por: string | null;
  liberada_sin_cobro: boolean;
  fecha_programada: string | null; // yyyy-mm-dd
  hora_programada: string | null; // HH:MM:SS
  programada_por: string | null;
  programada_at: string | null;
  esperando_proveedor: boolean;
  proveedor_nota: string | null;
  proveedor_desde: string | null;
}

export type TipoDocumento = "nota" | "factura";
export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  nota: "Nota sencilla",
  factura: "Factura",
};

export type MetodoPagoVenta = "efectivo" | "tarjeta_debito" | "tarjeta_credito" | "transferencia" | "a_meses";
export const METODO_PAGO_VENTA_LABELS: Record<MetodoPagoVenta, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta de débito",
  tarjeta_credito: "Tarjeta de crédito",
  transferencia: "Transferencia",
  a_meses: "A meses",
};

export type EstadoPago = "pendiente" | "parcial" | "pagado";
export const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  pendiente: "Sin pago",
  parcial: "Pago parcial",
  pagado: "Pagado",
};

export type TipoPrecio = "publico" | "promocion";

export const TIPO_PRECIO_LABELS: Record<TipoPrecio, string> = {
  publico: "Precio Público",
  promocion: "Precio Promoción",
};

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  delivery_type: DeliveryType | null;
  delivered_quantity: number;
  tipo_precio: TipoPrecio;
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
  | "etiquetas_por_cambiar"
  | "entrega_inmediata"
  | "venta_por_programar"
  | "solicitud_traslado"
  | "cobro_corregido";

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
  /** A quién le tocó imprimir y colocar esta etiqueta (reparto al azar). */
  asignado_a?: string | null;
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
  revertido_at: string | null;
  revertido_por: string | null;
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
