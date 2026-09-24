import { useState, type FormEvent } from "react";
import { X, Upload } from "lucide-react";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from "../../types";
import { createExpense } from "../../hooks/useExpenses";
import { uploadPhotos } from "../../lib/storage";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RegistrarGastoModal({ onClose, onSuccess }: Props) {
  const [fecha, setFecha] = useState(hoyISO());
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<string>(EXPENSE_PAYMENT_METHODS[0]);
  const [proveedor, setProveedor] = useState("");
  const [notas, setNotas] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const m = Number(monto);
    if (!concepto.trim()) return setError("Escribe en qué se gastó.");
    if (!m || m <= 0) return setError("Pon un monto mayor a cero.");
    if (files.length === 0) return setError("Sube al menos una foto del ticket o comprobante.");

    setSubmitting(true);
    const { paths, error: upErr } = await uploadPhotos("gastos", files);
    if (upErr) {
      setSubmitting(false);
      return setError(`No se pudo subir el comprobante: ${upErr}`);
    }
    const { error: err } = await createExpense({
      fecha,
      concepto: concepto.trim(),
      categoria,
      monto: m,
      metodo_pago: metodo,
      proveedor: proveedor.trim() || null,
      notas: notas.trim() || null,
      photo_paths: paths,
    });
    setSubmitting(false);
    if (err) return setError(err);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gigante-navy">Registrar gasto</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gigante-muted">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                max={hoyISO()}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Monto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">¿En qué se gastó?</label>
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Gasolina camioneta de reparto"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Pago con</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              >
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Proveedor / lugar (opcional)</label>
            <input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Ej. Gasolinera Pemex centro"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Nota (opcional)</label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gigante-navy mb-1">Foto del ticket / factura</label>
            <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer">
              <Upload size={16} />
              <span className="truncate">
                {files.length === 0 ? "Elegir foto(s)" : `${files.length} archivo(s): ${files.map((f) => f.name).join(", ")}`}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            <p className="text-[11px] text-gigante-muted mt-1">
              Los comprobantes son privados: solo Gerencia los puede ver.
            </p>
          </div>

          {error && <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gigante-border text-gigante-navy rounded-lg py-2.5 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold"
            >
              {submitting ? "Guardando..." : "Guardar gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
