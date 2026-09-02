import type { AppRole, FaqEntry, Manual } from "../types";

// ============================================================
// Buscador por palabras clave — Asistente de Consulta (Etapa 7)
// ============================================================
// A propósito, esto NO es un asistente con inteligencia artificial
// de pago (eso tendría costo por cada pregunta). Es una búsqueda
// simple por coincidencia de palabras sobre los manuales y las
// preguntas frecuentes ya registradas por Gerencia. Vive
// completamente en el navegador, sin llamar a ningún servicio
// externo ni gastar cuota de ninguna API.
// ============================================================

const STOPWORDS = new Set([
  "a", "al", "algo", "algun", "alguna", "algunas", "alguno", "algunos", "ante", "antes",
  "como", "con", "contra", "cual", "cuando", "de", "del", "desde", "donde", "durante",
  "e", "el", "ella", "ellas", "ellos", "en", "entre", "era", "es", "esa", "esas", "ese",
  "eso", "esos", "esta", "estas", "este", "esto", "estos", "hay", "la", "las", "le", "les",
  "lo", "los", "mas", "me", "mi", "mis", "mucho", "muy", "nada", "ni", "no", "nos", "nuestra",
  "nuestro", "o", "os", "otra", "otro", "para", "pero", "poco", "por", "porque", "que",
  "quien", "se", "sea", "si", "sin", "sobre", "solo", "su", "sus", "tambien", "te", "tiene",
  "todo", "todos", "tu", "tus", "un", "una", "unas", "uno", "unos", "y", "ya", "yo",
]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/** Cuenta cuántos tokens de la búsqueda aparecen (como subcadena) en el texto objetivo. */
function scoreAgainst(queryTokens: string[], target: string): number {
  const normalizedTarget = normalize(target);
  let score = 0;
  for (const token of queryTokens) {
    if (normalizedTarget.includes(token)) score += 1;
  }
  return score;
}

function isVisibleToRole(targetRoles: AppRole[] | null, role: AppRole): boolean {
  return !targetRoles || targetRoles.length === 0 || targetRoles.includes(role);
}

export interface FaqSearchResult {
  type: "faq";
  item: FaqEntry;
  score: number;
}

export interface ManualSearchResult {
  type: "manual";
  item: Manual;
  score: number;
}

export type SearchResult = FaqSearchResult | ManualSearchResult;

/**
 * Busca coincidencias en manuales y preguntas frecuentes visibles para
 * el rol dado, ordenadas de mayor a menor relevancia. Si la búsqueda
 * no arroja ningún token útil (ej. el usuario solo escribió
 * palabras vacías), regresa un arreglo vacío.
 */
export function searchManualesYFaq(
  query: string,
  manuals: Manual[],
  faqs: FaqEntry[],
  role: AppRole
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const faqResults: FaqSearchResult[] = faqs
    .filter((f) => isVisibleToRole(f.target_roles, role))
    .map((item) => ({
      type: "faq" as const,
      item,
      score: scoreAgainst(queryTokens, `${item.question} ${item.answer}`),
    }))
    .filter((r) => r.score > 0);

  const manualResults: ManualSearchResult[] = manuals
    .filter((m) => isVisibleToRole(m.target_roles, role))
    .map((item) => ({
      type: "manual" as const,
      item,
      score: scoreAgainst(queryTokens, `${item.title} ${item.description ?? ""}`),
    }))
    .filter((r) => r.score > 0);

  return [...faqResults, ...manualResults].sort((a, b) => b.score - a.score);
}
