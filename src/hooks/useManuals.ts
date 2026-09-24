import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppRole, FaqEntry, Manual, ManualCategory } from "../types";

export function useManuals() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("manuals")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setManuals((data as unknown as Manual[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { manuals, loading, error, reload };
}

export interface ManualInput {
  title: string;
  description: string | null;
  category: ManualCategory;
  targetRoles: AppRole[] | null;
  filePath: string | null;
}

export async function registerManual(input: ManualInput) {
  const { error } = await supabase.from("manuals").insert({
    title: input.title,
    description: input.description,
    category: input.category,
    target_roles: input.targetRoles,
    file_path: input.filePath,
  });
  return { error: error?.message ?? null };
}

export async function deleteManual(id: string) {
  const { error } = await supabase.from("manuals").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export function useFaqEntries() {
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("faq_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setFaqs((data as unknown as FaqEntry[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { faqs, loading, error, reload };
}

export interface FaqInput {
  question: string;
  answer: string;
  category: ManualCategory | null;
  targetRoles: AppRole[] | null;
}

export async function registerFaq(input: FaqInput) {
  const { error } = await supabase.from("faq_entries").insert({
    question: input.question,
    answer: input.answer,
    category: input.category,
    target_roles: input.targetRoles,
  });
  return { error: error?.message ?? null };
}

export async function deleteFaq(id: string) {
  const { error } = await supabase.from("faq_entries").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ============================================================
// Registro de preguntas del Asistente
// ============================================================
export interface AssistantQuestion {
  id: string;
  pregunta: string;
  respondida: boolean;
  respuesta_id: string | null;
  util: boolean | null;
  atendida: boolean;
  role: AppRole | null;
  user_id: string | null;
  created_at: string;
}

/** Guarda la pregunta (sin detener al usuario si falla). Devuelve su id. */
export async function logAssistantQuestion(
  pregunta: string,
  respondida: boolean,
  respuestaId: string | null,
  role: AppRole
): Promise<string | null> {
  const { data, error } = await supabase
    .from("assistant_questions")
    .insert({ pregunta: pregunta.slice(0, 500), respondida, respuesta_id: respuestaId, role })
    .select("id")
    .single();
  if (error) return null;
  return (data as { id: string }).id;
}

export async function rateAssistantAnswer(id: string, util: boolean) {
  await supabase.from("assistant_questions").update({ util }).eq("id", id);
}

/** Para Gerencia: preguntas sin respuesta o que "no sirvieron". */
export function usePendingAssistantQuestions(enabled: boolean) {
  const [questions, setQuestions] = useState<AssistantQuestion[]>([]);
  const [stats, setStats] = useState<{ total: number; respondidas: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data }, { data: todas }] = await Promise.all([
      supabase
        .from("assistant_questions")
        .select("*")
        .eq("atendida", false)
        .or("respondida.eq.false,util.eq.false")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("assistant_questions").select("respondida").gte("created_at", hace30).limit(5000),
    ]);
    setQuestions((data as AssistantQuestion[]) ?? []);
    const t = (todas as { respondida: boolean }[]) ?? [];
    setStats({ total: t.length, respondidas: t.filter((x) => x.respondida).length });
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { questions, stats, loading, reload };
}

export async function markAssistantQuestionHandled(id: string) {
  const { error } = await supabase.from("assistant_questions").update({ atendida: true }).eq("id", id);
  return { error: error?.message ?? null };
}
