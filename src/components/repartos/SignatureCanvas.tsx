import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

interface Props {
  /** Se llama cada vez que la firma cambia: con un File (PNG) cuando hay
   * trazo, o null cuando el canvas está vacío (recién limpiado). */
  onChange: (file: File | null) => void;
}

/**
 * Captura la firma del cliente en un <canvas>, con soporte de mouse y
 * dedo/lápiz táctil (pointer events). No depende de ninguna librería
 * externa. Al soltar el trazo, exporta el canvas como un archivo PNG
 * listo para subirse con uploadPhoto().
 */
export default function SignatureCanvas({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Ajusta la resolución interna del canvas a su tamaño real en
    // pantalla para que el trazo no se vea borroso o cortado.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0E1E42";
    }
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
    setIsEmpty(false);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    exportSignature();
  }

  function exportSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `firma-${Date.now()}.png`, { type: "image/png" });
      onChange(file);
    }, "image/png");
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasDrawnRef.current = false;
    setIsEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="relative border border-dashed border-gigante-border rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {isEmpty && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-gigante-muted pointer-events-none">
            El cliente firma aquí (con el dedo o el mouse)
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleClear}
        disabled={isEmpty}
        className="mt-2 flex items-center gap-1 text-xs text-gigante-muted disabled:opacity-40"
      >
        <Eraser size={14} /> Limpiar firma
      </button>
    </div>
  );
}
