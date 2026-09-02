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
