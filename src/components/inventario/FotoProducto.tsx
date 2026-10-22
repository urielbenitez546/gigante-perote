import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { guardarFotoProducto, errorFotoAmigable } from "../../hooks/useInventory";
import { publicPhotoUrl, uploadPhoto } from "../../lib/storage";
import type { Product } from "../../types";

interface Props {
  product: Product;
  /** Se llama al guardar una foto nueva, para refrescar el producto. */
  onChanged: () => void;
}

/** Foto del producto junto al nombre: sirve para comprobar que el material
 * que se tiene en la mano coincide. La ven todos; la cambian Gerencia,
 * todo almacén y choferes. */
export default function FotoProducto({ product, onChanged }: Props) {
  const { profile } = useAuth();
  const puedeCambiar = profile?.role === "gerencia" || profile?.role === "almacen" || profile?.role === "reparto";
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = publicPhotoUrl("productos-fotos", product.foto_path ?? null);

  async function elegir(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    setSubiendo(true);
    const sub = await uploadPhoto("productos-fotos", file);
    if (sub.error || !sub.path) {
      setSubiendo(false);
      return setError(errorFotoAmigable(sub.error ?? "No se pudo subir la foto."));
    }
    const { error: err } = await guardarFotoProducto(product.id, sub.path);
    setSubiendo(false);
    if (err) return setError(errorFotoAmigable(err));
    onChanged();
  }

  // Sin foto y sin permiso: no se muestra nada (no estorba).
  if (!url && !puedeCambiar) return null;

  return (
    <div className="shrink-0 w-28 sm:w-32">
      {url ? (
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="block w-full aspect-square rounded-xl overflow-hidden border border-gigante-border bg-gigante-bg"
          title="Ver foto más grande"
        >
          <img src={url} alt={`Foto de ${product.name}`} className="w-full h-full object-cover" loading="lazy" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex flex-col items-center justify-center gap-1 w-full aspect-square rounded-xl border-2 border-dashed border-gigante-border text-gigante-muted text-[11px] text-center px-2 hover:bg-gigante-bg disabled:opacity-60"
        >
          <ImagePlus size={20} />
          {subiendo ? "Subiendo..." : "Agregar foto del producto"}
        </button>
      )}

      {url && puedeCambiar && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="mt-1 w-full inline-flex items-center justify-center gap-1 text-[11px] text-gigante-muted underline disabled:opacity-60"
        >
          <Camera size={11} /> {subiendo ? "Subiendo..." : "Cambiar foto"}
        </button>
      )}
      {error && <p className="text-[11px] text-gigante-red mt-1">{error}</p>}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />

      {ampliada && url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setAmpliada(false)}
        >
          <button className="absolute top-4 right-4 text-white" aria-label="Cerrar">
            <X size={28} />
          </button>
          <img src={url} alt={product.name} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
