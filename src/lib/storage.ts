import { supabase } from "./supabaseClient";

export type PhotoBucket = "facturas" | "merma" | "repartos-firmas" | "repartos-evidencia" | "manuales" | "gastos" | "capacitacion" | "exhibicion" | "kardex-soporte" | "bitacora" | "productos-fotos";

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
    // Se decodifica ya reducida (mucho más rápido en el celular que abrir la foto completa).
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image", resizeWidth: 1280, resizeQuality: "medium" });
    } catch {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    }
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

// La compresión se hace una sola vez por foto y se guarda: así, si ya se preparó
// al elegirla, al guardar solo queda subirla.
const comprimidas = new WeakMap<File, Promise<File>>();

export function fotoComprimida(file: File): Promise<File> {
  let p = comprimidas.get(file);
  if (!p) {
    p = comprimirFoto(file);
    comprimidas.set(file, p);
  }
  return p;
}

/**
 * Empieza a preparar (reducir) cada foto en cuanto se elige, sin esperar a
 * "Guardar". Se activa una sola vez al abrir la app.
 */
export function iniciarPrecompresion() {
  document.addEventListener(
    "change",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.type !== "file" || !t.files) return;
      for (const f of Array.from(t.files)) {
        if (f.type.startsWith("image/")) fotoComprimida(f).catch(() => undefined);
      }
    },
    true
  );
}

export async function uploadPhoto(
  bucket: PhotoBucket,
  original: File
): Promise<{ path: string | null; error: string | null }> {
  // La firma es un dibujo chico: no se toca.
  const file = bucket === "repartos-firmas" ? original : await fotoComprimida(original);
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  // Si la señal del celular falla a media subida, se reintenta solo (hasta 3 veces).
  // Los errores de permisos o de tamaño no se reintentan: no se arreglan solos.
  let ultimoError = "";
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (!error) return { path, error: null };
      ultimoError = error.message;
      if (/security|policy|permission|not found|bucket|exceed|too large|mime/i.test(error.message)) break;
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : "No se pudo subir la foto";
    }
    if (intento < 3) await new Promise((r) => setTimeout(r, 800 * intento));
  }
  if (/row-level security|policy|permission|not allowed|violates/i.test(ultimoError)) {
    ultimoError = "Tu usuario no tiene permiso para subir fotos aquí. Avisa a Gerencia (falta correr el SQL de actualización en Supabase).";
  } else if (/bucket.*not found/i.test(ultimoError)) {
    ultimoError = "Falta crear el espacio de fotos en Supabase. Avisa a Gerencia (falta correr el SQL de actualización).";
  } else if (/failed to fetch|network|load failed|timeout/i.test(ultimoError)) {
    ultimoError = "No se pudo subir la foto por la señal. Revisa tu internet y vuelve a intentarlo.";
  }
  return { path: null, error: ultimoError || "No se pudo subir la foto" };
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
  // Las fotos se suben al mismo tiempo (más rápido que una por una).
  const resultados = await Promise.all(files.map((f) => uploadPhoto(bucket, f)));
  const paths = resultados.filter((r) => r.path && !r.error).map((r) => r.path as string);
  const fallo = resultados.find((r) => r.error || !r.path);
  if (fallo) return { paths, error: fallo.error ?? "No se pudo subir una de las fotos" };
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
