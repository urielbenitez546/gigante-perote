import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { TrainingProgress } from "../types";

/**
 * Avance de la capacitación. Cada quien ve el suyo; Gerencia recibe el
 * de todo el equipo (lo filtra la base de datos con RLS).
 */
export function useTrainingProgress() {
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from("training_progress").select("*");
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setProgress((data as TrainingProgress[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { progress, loading, error, reload };
}

export async function markLessonDone(lessonKey: string) {
  const { error } = await supabase
    .from("training_progress")
    .upsert({ lesson_key: lessonKey }, { onConflict: "user_id,lesson_key", ignoreDuplicates: true });
  return { error: error?.message ?? null };
}

export async function resetLesson(userId: string, lessonKey: string) {
  const { error } = await supabase
    .from("training_progress")
    .delete()
    .eq("user_id", userId)
    .eq("lesson_key", lessonKey);
  return { error: error?.message ?? null };
}
