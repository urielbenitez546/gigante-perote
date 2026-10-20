import { useEffect, useState } from "react";
import { fotoComprimida } from "../../lib/storage";

interface Props {
  file: File;
  alt: string;
  className?: string;
}

/**
 * Vista previa ligera de una foto elegida. Muestra la versión ya reducida
 * (no la original de varios MB) y libera la memoria al quitarla.
 */
export default function MiniaturaFoto({ file, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let creada: string | null = null;
    fotoComprimida(file)
      .then((chica) => {
        if (!vivo) return;
        creada = URL.createObjectURL(chica);
        setUrl(creada);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [file]);

  if (!url) return <div className={`${className ?? ""} bg-gigante-bg animate-pulse`} aria-label={alt} />;
  return <img src={url} alt={alt} className={className} />;
}
