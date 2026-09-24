import type { AppRole, FaqEntry } from "../../types";
import type { EntradaKB } from "../../data/asistente/tipos";
import { KB_MANUALES } from "../../data/asistente/manuales";
import { KB_PAGINA } from "../../data/asistente/pagina";

// ============================================================
// Motor del Asistente de Consulta
// ============================================================
// No usa inteligencia artificial de pago: compara las palabras de la
// pregunta contra una base de preguntas y respuestas predeterminadas
// (sacadas de los manuales y de la guía de la página) más las
// preguntas frecuentes que Gerencia registra en "Manuales e Información".
// Todo corre en el navegador, sin costo por pregunta.
// ============================================================

export const BASE_CONOCIMIENTO: EntradaKB[] = [...KB_MANUALES, ...KB_PAGINA];

const STOPWORDS = new Set([
  "a", "al", "algo", "algun", "alguna", "alguno", "ante", "antes", "aqui", "asi", "como", "con", "cual", "cuales",
  "cuando", "de", "del", "desde", "donde", "el", "ella", "en", "entre", "era", "es", "esa", "ese", "eso", "esta",
  "estan", "este", "esto", "hace", "hacer", "hago", "la", "las", "le", "les", "lo", "los", "me", "mi", "mis", "muy",
  "ni", "no", "nos", "o", "para", "pero", "por", "porque", "puede", "puedo", "que", "quien", "se", "sea", "ser", "si",
  "sin", "sobre", "solo", "son", "su", "sus", "te", "tengo", "tiene", "tu", "tus", "un", "una", "uno", "unos", "y",
  "ya", "yo", "hola", "oye", "favor", "gracias", "saber", "quiero", "necesito", "dime", "decir", "sabes", "hay",
  "cuanto", "cuanta", "cuantos", "cuantas",
]);

// Sinónimos → palabra "canónica" que usan las claves.
const SINONIMOS: Record<string, string> = {
  jefa: "jefe", patron: "jefe", encargado: "jefe", supervisor: "jefe",
  bodega: "almacen", bodeguero: "almacenista",
  repartidor: "chofer", conductor: "chofer", camion: "camioneta",
  vendedor: "asesor", vendedora: "asesor", vendedores: "asesor",
  cajero: "cajera",
  vacacion: "vacaciones", vacas: "vacaciones", descanso: "vacaciones",
  sueldo: "nomina", salario: "nomina", paga: "nomina",
  acta: "incidencia", actas: "incidencia", reporte: "incidencia",
  correr: "baja", despedir: "baja", despiden: "baja", corren: "baja",
  playera: "camisa", uniforme: "uniforme", ropa: "vestimenta",
  roto: "danada", rota: "danada", quebrado: "danada", quebrada: "danada", estrellado: "danada",
  telefono: "telefono", tel: "telefono", celular: "telefono",
  password: "contrasena", clave: "contrasena",
};

function normalize(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function stem(word: string): string {
  let w = SINONIMOS[word] ?? word;
  if (w.length > 5 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("s")) w = w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// Palabras muy generales: cuentan poco para decidir la respuesta.
const GENERICAS = new Set(["tienda", "gigante", "pagina", "sistema", "trabajo", "cliente"]);

interface Indexada {
  entrada: EntradaKB;
  claves: Set<string>;
  texto: Set<string>;
  frases: string[];
}

const frase = (t: string) => tokens(t).join(" ");

function indexar(e: EntradaKB): Indexada {
  return {
    entrada: e,
    claves: new Set(e.claves.flatMap((c) => tokens(c))),
    texto: new Set(tokens([e.pregunta, ...(e.variantes ?? [])].join(" "))),
    frases: [e.pregunta, ...(e.variantes ?? [])].map(frase).filter((f) => f.length > 0),
  };
}

/** Comparten raíz: "imprimo" ~ "imprimir", "vacacion" ~ "vacaciones". */
function mismaRaiz(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

/** Convierte una pregunta frecuente de Gerencia al mismo formato. */
export function faqAEntrada(f: FaqEntry): EntradaKB {
  return {
    id: `faq-${f.id}`,
    categoria: "politicas",
    pregunta: f.question,
    claves: tokens(f.question),
    respuesta: f.answer,
    roles: f.target_roles && f.target_roles.length > 0 ? f.target_roles : undefined,
    fuente: "Preguntas frecuentes de Gerencia",
  };
}

export function visiblePara(e: EntradaKB, role: AppRole): boolean {
  return role === "gerencia" || !e.roles || e.roles.includes(role);
}

export interface Coincidencia {
  entrada: EntradaKB;
  puntaje: number;
  /** true si la respuesta es de otra área (el puesto no la ve). */
  oculta?: boolean;
}

let cacheBase: Indexada[] | null = null;

/** Busca las entradas que mejor contestan la pregunta. */
export function buscar(pregunta: string, role: AppRole, faqs: FaqEntry[] = []): Coincidencia[] {
  const q = tokens(pregunta);
  if (q.length === 0) return [];
  const fraseQ = q.join(" ");
  const esDefinicion = /^\s*¿?\s*(que es|que son|que significa|que quiere decir)/.test(normalize(pregunta));
  if (!cacheBase) cacheBase = BASE_CONOCIMIENTO.map(indexar);
  const todas = [...cacheBase, ...faqs.map((f) => indexar(faqAEntrada(f)))];

  const resultados: Coincidencia[] = [];
  for (const idx of todas) {
    let puntaje = 0;
    let acertadas = 0;
    for (const t of q) {
      const peso = GENERICAS.has(t) ? 0.3 : 1;
      if (idx.claves.has(t)) {
        puntaje += 3 * peso;
        acertadas += peso;
      } else if (idx.texto.has(t)) {
        puntaje += 1.5 * peso;
        acertadas += peso;
      } else {
        // Coincidencia parcial por raíz de la palabra.
        for (const c of [...idx.claves, ...idx.texto]) {
          if (mismaRaiz(t, c)) {
            puntaje += 1.2 * peso;
            acertadas += peso;
            break;
          }
        }
      }
    }
    if (puntaje === 0) continue;
    const totalPeso = q.reduce((s, t) => s + (GENERICAS.has(t) ? 0.3 : 1), 0);
    const cobertura = acertadas / totalPeso;
    let final = puntaje * (0.5 + 0.5 * cobertura);
    // Bono si la pregunta es (casi) igual a una forma registrada.
    if (idx.frases.some((f) => f === fraseQ)) final += 5;
    else if (idx.frases.some((f) => f.includes(" ") && (fraseQ.includes(f) || (q.length >= 2 && f.includes(fraseQ))))) final += 2;
    if (esDefinicion && idx.entrada.categoria === "glosario") final *= 1.5;
    resultados.push({ entrada: idx.entrada, puntaje: final, oculta: !visiblePara(idx.entrada, role) });
  }
  return resultados.sort((a, b) => b.puntaje - a.puntaje);
}

export const UMBRAL_RESPUESTA = 2.5;
export const UMBRAL_RELACIONADA = 1.5;

/**
 * ¿La mejor coincidencia es lo bastante clara para contestar directo?
 * Sí si supera el umbral, o si es razonable y le saca ventaja a la segunda.
 */
export function esRespuestaClara(r: Coincidencia[]): boolean {
  if (!r[0]) return false;
  if (r[0].puntaje >= UMBRAL_RESPUESTA) return !r[1] || r[0].puntaje - r[1].puntaje >= 0.5 || r[0].puntaje >= 5;
  return r[0].puntaje >= 2 && (!r[1] || r[0].puntaje - r[1].puntaje >= 1);
}

/** Preguntas sugeridas al abrir el asistente, según el puesto. */
export const SUGERENCIAS_POR_ROL: Record<AppRole, string[]> = {
  gerencia: [
    "¿Qué productos se están acabando?",
    "¿Hay incidencias de reparto abiertas?",
    "¿Qué apartados están vencidos?",
    "¿Cuánto se vendió hoy?",
    "¿Cómo vamos con los conteos de inventario?",
    "¿Cuánto puedo prestar a un colaborador?",
  ],
  ventas: [
    "¿Cuánto hay de piso beige?",
    "¿Qué productos se están acabando?",
    "¿Qué camisa me toca hoy?",
    "¿Cómo cambio un producto de una venta?",
    "¿Qué apartados están por vencer?",
    "¿Qué es lote, tono y calibre?",
  ],
  caja: [
    "¿Qué cobros están pendientes?",
    "¿Cuánto se vendió hoy?",
    "¿Qué camisa me toca hoy?",
    "¿Cómo registro el cobro en Caja?",
    "¿Qué hago si hay una diferencia en el corte?",
    "¿Con cuántas incidencias me dan de baja?",
  ],
  almacen: [
    "¿Qué productos se están acabando?",
    "¿Cuánto hay de tinaco?",
    "¿Qué hago si encuentro mercancía dañada?",
    "¿Cómo hago un conteo físico?",
    "¿Qué hay por entregar?",
    "¿Cuál es el uniforme de Almacén?",
  ],
  reparto: [
    "¿Qué repartos hay pendientes?",
    "¿Hay incidencias de reparto abiertas?",
    "¿Cómo entrego un reparto en la página?",
    "¿A quién le entrego el dinero que cobré?",
    "¿Qué hago si la camioneta tiene una falla?",
    "¿Con cuántas incidencias me dan de baja?",
  ],
};
