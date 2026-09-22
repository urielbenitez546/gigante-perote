import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { X, Printer } from "lucide-react";
import type { Product } from "../../types";

interface Props {
  product: Product;
  onClose: () => void;
}

export default function CodigoQrModal({ product, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = `${window.location.origin}/producto/${product.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1 })
      .then(setDataUrl)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo generar el código QR."));
  }, [url]);

  function handlePrint() {
    if (!dataUrl) return;
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>QR — ${product.code}</title></head>
        <body style="font-family: Arial, sans-serif; text-align:center; padding:24px;">
          <img src="${dataUrl}" style="width:280px;height:280px;" />
          <p style="font-size:14px;font-weight:bold;margin-top:12px;">${product.code} — ${product.name}</p>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 text-center">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gigante-navy">Código QR</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gigante-navy mb-3">
          {product.code} — {product.name}
        </p>

        {error && <p className="text-sm text-gigante-red">{error}</p>}
        {!error && !dataUrl && <p className="text-sm text-gigante-muted py-10">Generando código QR...</p>}
        {dataUrl && (
          <img src={dataUrl} alt={`Código QR de ${product.name}`} className="mx-auto rounded-lg border border-gigante-border" />
        )}

        <p className="text-xs text-gigante-muted mt-3">
          Al escanearlo, cualquier colaborador con sesión iniciada ve el precio, el descuento y la
          existencia de este producto.
        </p>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            disabled={!dataUrl}
            className="flex-1 flex items-center justify-center gap-2 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
