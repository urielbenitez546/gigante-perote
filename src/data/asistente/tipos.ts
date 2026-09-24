import type { AppRole } from "../../types";

export type CategoriaKB =
  | "empresa"
  | "sucursal"
  | "politicas"
  | "vacaciones"
  | "incidencias"
  | "puestos"
  | "operacion"
  | "pagina"
  | "glosario";

export const CATEGORIA_LABELS: Record<CategoriaKB, string> = {
  empresa: "La empresa",
  sucursal: "Sucursal Perote",
  politicas: "Horario, uniforme y políticas",
  vacaciones: "Vacaciones, permisos y préstamos",
  incidencias: "Incidencias del personal",
  puestos: "Puestos y funciones",
  operacion: "¿Qué hago si...? (operación)",
  pagina: "Cómo usar la página",
  glosario: "Glosario",
};

export const FUENTE_BIENVENIDA = "Manual de Bienvenida e Inducción";
export const FUENTE_PUESTOS = "Manual de Puestos y Funciones";
export const FUENTE_PAGINA = "Guía de uso de la página";

export interface EntradaKB {
  id: string;
  categoria: CategoriaKB;
  /** La pregunta "oficial" que se muestra. */
  pregunta: string;
  /** Otras formas en que la gente lo pregunta (ayudan a encontrarla). */
  variantes?: string[];
  /** Palabras clave de mucho peso (ya sin acentos, en minúsculas). */
  claves: string[];
  /** Respuesta. Cada renglón que empieza con "• " se muestra como viñeta. */
  respuesta: string;
  /** Si se indica, solo la ven estos puestos. */
  roles?: AppRole[];
  link?: { to: string; label: string };
  fuente?: string;
}
