import { useEffect, useRef, useState } from "react";
import { ExternalLink, PlayCircle } from "lucide-react";
import type { TrainingVideo } from "../../types";
import { signedPhotoUrl } from "../../lib/storage";
import { embedUrlFor } from "../../hooks/useTraining";

interface Props {
  video: TrainingVideo;
  /** Se llama cuando el video llega casi al final (solo archivos subidos). */
  onFinished?: () => void;
}

/**
 * Reproduce un video de capacitación: si es archivo subido, pide un link
 * temporal al bucket privado; si es link de YouTube/Drive, lo incrusta.
 */
export default function VideoPlayer({ video, onFinished }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    setSrc(null);
    setLoadError(false);
    if (!video.video_path) return;
    let cancelled = false;
    // 2 horas: suficiente para verlo con calma aunque lo pausen.
    signedPhotoUrl("capacitacion", video.video_path, 7200).then((url) => {
      if (cancelled) return;
      if (url) setSrc(url);
      else setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [video.id, video.video_path]);

  const box = "w-full aspect-video rounded-lg overflow-hidden bg-gigante-navy";

  if (video.video_path) {
    if (loadError) {
      return (
        <div className={`${box} flex items-center justify-center text-white/80 text-sm p-4 text-center`}>
          No se pudo cargar el video. Revisa tu conexión o avísale a Gerencia.
        </div>
      );
    }
    if (!src) {
      return (
        <div className={`${box} flex flex-col items-center justify-center text-white/80 gap-2`}>
          <PlayCircle size={40} />
          <span className="text-xs">Cargando video...</span>
        </div>
      );
    }
    return (
      <video
        key={src}
        src={src}
        controls
        playsInline
        preload="metadata"
        className={`${box} bg-black`}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!finishedRef.current && v.duration > 0 && v.currentTime / v.duration >= 0.9) {
            finishedRef.current = true;
            onFinished?.();
          }
        }}
      />
    );
  }

  const embed = video.video_url ? embedUrlFor(video.video_url) : null;
  if (embed) {
    return (
      <iframe
        src={embed}
        title={video.title}
        className={box}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div className={`${box} flex flex-col items-center justify-center text-white gap-3 p-4 text-center`}>
      <PlayCircle size={40} />
      <a
        href={video.video_url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold underline"
      >
        Abrir video <ExternalLink size={14} />
      </a>
    </div>
  );
}
