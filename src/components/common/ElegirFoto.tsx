import { Camera, Image as ImageIcon } from "lucide-react";

interface Props {
  /** Recibe los archivos elegidos (o la foto recién tomada). */
  onFiles: (files: File[]) => void;
  /** Permite elegir varias a la vez desde la galería. */
  multiple?: boolean;
  /** Qué acepta el botón de galería/archivo. Por defecto solo imágenes. */
  accept?: string;
  etiquetaCamara?: string;
  etiquetaGaleria?: string;
  /** Botones más chicos (para renglones y tablas). */
  compacto?: boolean;
  /** Botones uno debajo del otro, a todo el ancho. */
  vertical?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dos opciones siempre a la vista, en TODO lugar donde se sube una foto:
 *  - "Tomar foto": abre la cámara del celular en ese momento.
 *  - "Galería": elige una foto (o archivo) que ya está en el teléfono o la computadora.
 * En computadora, "Tomar foto" abre el selector de archivos (o la cámara web, según el navegador).
 */
export default function ElegirFoto({
  onFiles,
  multiple = false,
  accept = "image/*",
  etiquetaCamara = "Tomar foto",
  etiquetaGaleria = "Galería",
  compacto = false,
  vertical = false,
  disabled = false,
  className = "",
}: Props) {
  const boton = `inline-flex items-center justify-center gap-1.5 font-medium border border-gigante-border rounded-lg text-gigante-navy bg-white select-none ${
    compacto ? "text-[11px] px-2 py-1.5" : "text-sm px-3 py-2.5"
  } ${vertical ? "w-full" : ""} ${disabled ? "opacity-60 pointer-events-none" : "cursor-pointer hover:bg-gigante-bg active:bg-gigante-bg"}`;
  const icono = compacto ? 12 : 16;

  function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    // Se limpia para poder volver a elegir la misma foto.
    e.target.value = "";
    if (archivos.length > 0) onFiles(archivos);
  }

  return (
    <div className={`${vertical ? "flex flex-col" : "flex flex-wrap items-center"} gap-2 ${className}`}>
      <label className={boton}>
        <Camera size={icono} />
        {etiquetaCamara}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={disabled} onChange={alElegir} />
      </label>
      <label className={boton}>
        <ImageIcon size={icono} />
        {etiquetaGaleria}
        <input type="file" accept={accept} multiple={multiple} className="hidden" disabled={disabled} onChange={alElegir} />
      </label>
    </div>
  );
}
