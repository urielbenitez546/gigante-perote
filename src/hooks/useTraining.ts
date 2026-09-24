import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { TrainingProgress, TrainingVideo } from "../types";

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

// ============================================================
// Videos de capacitación
// ============================================================

/** Videos visibles para quien tiene la sesión (la base filtra por puesto;
 * Gerencia recibe todos, incluidos los ocultos). */
export function useTrainingVideos() {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("training_videos")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setVideos((data as TrainingVideo[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { videos, loading, error, reload };
}

export const MAX_VIDEO_MB = 50;

export interface TrainingVideoInput {
  title: string;
  description: string | null;
  responsabilidades: string[];
  roles: TrainingVideo["roles"];
  video_path: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  orden: number;
  active: boolean;
}

/** Sube el archivo de video al bucket privado "capacitacion". */
export async function uploadTrainingVideo(
  file: File
): Promise<{ path: string | null; error: string | null }> {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    return {
      path: null,
      error: `El video pesa ${(file.size / 1024 / 1024).toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB. Súbelo a YouTube como "no listado" y pega el link.`,
    };
  }
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("capacitacion").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "video/mp4",
  });
  return { path: error ? null : path, error: error?.message ?? null };
}

export async function saveTrainingVideo(input: TrainingVideoInput, id?: string) {
  const { error } = id
    ? await supabase.from("training_videos").update(input).eq("id", id)
    : await supabase.from("training_videos").insert(input);
  return { error: error?.message ?? null };
}

export async function deleteTrainingVideo(video: TrainingVideo) {
  const { error } = await supabase.from("training_videos").delete().eq("id", video.id);
  if (!error && video.video_path) {
    await supabase.storage.from("capacitacion").remove([video.video_path]);
  }
  return { error: error?.message ?? null };
}

/** Convierte links de YouTube / Google Drive a su versión para incrustar. */
export function embedUrlFor(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com") {
      if (u.pathname.startsWith("/embed/")) return u.toString();
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = m?.[1] ?? u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    return null;
  } catch {
    return null;
  }
}
