import { supabase } from "./supabaseClient";

export type PhotoBucket = "facturas" | "merma" | "repartos-firmas" | "repartos-evidencia" | "manuales" | "gastos" | "capacitacion" | "exhibicion" | "kardex-soporte" | "bitacora";

/**
 * Sube una foto a un bucket de Supabase Storage y devuelve la ruta
 * guardada (para usarse luego con getPublicUrl) o un error.
 */
/**
 * Reduce una foto antes de subirla: máximo 1280 px de largo y JPEG a calidad
 * 0.6. Una foto de celular de 3–6 MB queda en ~100–250 KB y se sigue viendo
 * bien (evidencia, facturas, tableros). Así el espacio gratis de Supabase
 * (1 GB) alcanza para miles de fotos. Si algo falla, se sube la original.
 */
async function comprimirFoto(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    if (file.size < 150 * 1024) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const MAX = 1280;
    const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.6));
    if (!blob || blob.size >= file.size) return file;
    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadPhoto(
  bucket: PhotoBucket,
  original: File
): Promise<{ path: string | null; error: string | null }> {
  // La firma es un dibujo chico: no se toca.
  const file = bucket === "repartos-firmas" ? original : await comprimirFoto(original);
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

/**
 * Link temporal para buckets PRIVADOS (ej. "gastos"): no se puede ver
 * con un link público, así que se pide uno que dura unos minutos.
 */
export async function signedPhotoUrl(
  bucket: PhotoBucket,
  path: string,
  seconds = 300
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) return null;
  return data.signedUrl;
}
