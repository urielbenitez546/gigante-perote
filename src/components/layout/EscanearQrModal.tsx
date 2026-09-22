import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { X, ScanLine, ExternalLink } from "lucide-react";

interface Props {
  onClose: () => void;
}

type Estado = "iniciando" | "escaneando" | "sin_permiso" | "no_disponible";

export default function EscanearQrModal({ onClose }: Props) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [resultadoAjeno, setResultadoAjeno] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelado = false;

    async function iniciarCamara() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("no_disponible");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setEstado("escaneando");
        tick();
      } catch {
        if (!cancelado) setEstado("sin_permiso");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        manejarResultado(code.data);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    function manejarResultado(texto: string) {
      detener();
      const marcador = `${window.location.origin}/producto/`;
      if (texto.startsWith(marcador)) {
        const id = texto.slice(marcador.length).split(/[/?#]/)[0];
        onClose();
        navigate(`/producto/${id}`);
      } else {
        setResultadoAjeno(texto);
      }
    }

    iniciarCamara();

    function detener() {
      cancelado = true;
      cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      streamRef.current = null;
    }

    return detener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-white rounded-2xl p-5 overflow-y-auto"
        style={{
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "92vw",
          maxWidth: "24rem",
          maxHeight: "calc(100vh - 32px)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy flex items-center gap-2">
            <ScanLine size={20} /> Escanear código QR
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        {resultadoAjeno ? (
          <div>
            <p className="text-sm text-gigante-navy mb-2">
              Esto no es un producto de tu sistema, pero esto es lo que decía el código:
            </p>
            <p className="text-xs bg-gigante-bg rounded-lg px-3 py-2 break-all">{resultadoAjeno}</p>
            {/^https?:\/\//.test(resultadoAjeno) && (
              <a
                href={resultadoAjeno}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm text-gigante-red mt-3"
              >
                <ExternalLink size={14} /> Abrir de todos modos
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-square max-h-[55vh] mx-auto">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {estado === "escaneando" && (
                <div className="absolute inset-6 border-2 border-white/70 rounded-xl pointer-events-none" />
              )}
              {estado === "iniciando" && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  Abriendo cámara...
                </div>
              )}
            </div>

            {estado === "sin_permiso" && (
              <p className="text-sm text-gigante-red mt-3">
                No se pudo acceder a la cámara. Revisa que le hayas dado permiso a este sitio, o usa la
                cámara de tu celular directamente para escanear la etiqueta.
              </p>
            )}
            {estado === "no_disponible" && (
              <p className="text-sm text-gigante-red mt-3">
                Tu navegador no permite usar la cámara desde aquí. Usa la cámara de tu celular
                directamente para escanear la etiqueta.
              </p>
            )}
            {estado === "escaneando" && (
              <p className="text-xs text-gigante-muted mt-3 text-center">
                Apunta la cámara al código QR de la etiqueta.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
