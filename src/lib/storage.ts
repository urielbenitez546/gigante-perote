import { supabase } from "./supabaseClient";

export type PhotoBucket = "facturas" | "merma" | "repartos-firmas" | "repartos-evidencia" | "manuales";

/**
 * Sube una foto a un bucket de Supabase Storage y devuelve la ruta
 * guardada (para usarse luego con getPublicUrl) o un error.
 */
export async function uploadPhoto(
  bucket: PhotoBucket,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    return { path: null, error: error.message };
  }
  return { path, error: null };
}

/**
 * Sube varias fotos al mismo bucket. Se detiene en el primer error
 * (no deja evidencia a medias) y devuelve solo las rutas ya subidas
 * hasta ese momento para que quien llame decida si reintenta.
 */
export async function uploadPhotos(
  bucket: PhotoBucket,
  files: File[]
): Promise<{ paths: string[]; error: string | null }> {
  const paths: string[] = [];
  for (const file of files) {
    const { path, error } = await uploadPhoto(bucket, file);
    if (error || !path) {
      return { paths, error: error ?? "No se pudo subir una de las fotos" };
    }
    paths.push(path);
  }
  return { paths, error: null };
}

export function publicPhotoUrl(bucket: PhotoBucket, path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
