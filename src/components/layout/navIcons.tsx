import {
  Home,
  Package,
  ShoppingCart,
  Warehouse,
  Truck,
  Camera,
  BookOpen,
  MessageCircle,
  Calculator,
  Settings,
  type LucideIcon,
} from "lucide-react";

export const MODULE_ICONS: Record<string, LucideIcon> = {
  inicio: Home,
  inventario: Package,
  ventas: ShoppingCart,
  retiros: Warehouse,
  repartos: Truck,
  evidencias: Camera,
  manuales: BookOpen,
  asistente: MessageCircle,
  calculadora: Calculator,
  administracion: Settings,
};
