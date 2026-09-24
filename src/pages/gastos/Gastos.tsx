import { useMemo, useState } from "react";
import { Receipt, Plus, Trash2, Paperclip } from "lucide-react";
import { useExpenses, deleteExpense } from "../../hooks/useExpenses";
import { useProfileNames } from "../../hooks/useProfileNames";
import { signedPhotoUrl } from "../../lib/storage";
import RegistrarGastoModal from "../../components/gastos/RegistrarGastoModal";
import type { Expense } from "../../types";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangoDelMes(offset: number): { desde: string; hasta: string; label: string } {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + offset + 1, 0);
  const label = inicio.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return { desde: isoDate(inicio), hasta: isoDate(fin), label: label.charAt(0).toUpperCase() + label.slice(1) };
}

export default function Gastos() {
  const [mesOffset, setMesOffset] = useState(0);
  const rango = rangoDelMes(mesOffset);
  const { expenses, loading, error, reload } = useExpenses(rango.desde, rango.hasta);
  const { nameFor } = useProfileNames();
  const [showModal, setShowModal] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.monto), 0), [expenses]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.categoria, (map.get(e.categoria) ?? 0) + Number(e.monto));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const visibles = categoriaFiltro === "Todas" ? expenses : expenses.filter((e) => e.categoria === categoriaFiltro);

  async function verComprobante(path: string) {
    const url = await signedPhotoUrl("gastos", path);
    if (url) window.open(url, "_blank", "noopener");
    else setActionError("No se pudo abrir el comprobante.");
  }

  async function borrar(expense: Expense) {
    setActionError(null);
    const { error: err } = await deleteExpense(expense);
    setConfirmDelete(null);
    if (err) setActionError(err);
    else reload();
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <Receipt size={22} /> Gastos de la sucursal
          </h1>
          <p className="text-sm text-gigante-muted mt-1">Solo Gerencia. Cada gasto lleva su foto de comprobante.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2.5"
        >
          <Plus size={16} /> Registrar gasto
        </button>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={() => setMesOffset((m) => m - 1)}
          className="border border-gigante-border rounded-lg px-3 py-1.5 text-sm text-gigante-navy"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-gigante-navy w-40 text-center">{rango.label}</p>
        <button
          onClick={() => setMesOffset((m) => Math.min(0, m + 1))}
          disabled={mesOffset === 0}
          className="border border-gigante-border rounded-lg px-3 py-1.5 text-sm text-gigante-navy disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {(error || actionError) && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {error ?? actionError}
          {error?.includes("expenses") && " — ¿ya corriste la migración 0027b en Supabase?"}
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Total del mes</p>
          <p className="text-2xl font-bold text-gigante-navy">{money(total)}</p>
          <p className="text-[11px] text-gigante-muted">{expenses.length} gasto(s)</p>
        </div>
        <div className="md:col-span-2 bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted mb-2">Por categoría</p>
          {porCategoria.length === 0 ? (
            <p className="text-sm text-gigante-muted">Sin gastos este mes.</p>
          ) : (
            <ul className="space-y-1.5">
              {porCategoria.map(([cat, monto]) => (
                <li key={cat}>
                  <button
                    onClick={() => setCategoriaFiltro(categoriaFiltro === cat ? "Todas" : cat)}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between text-xs">
                      <span className={categoriaFiltro === cat ? "font-semibold text-gigante-red" : "text-gigante-navy"}>
                        {cat}
                      </span>
                      <span className="text-gigante-navy font-medium">{money(monto)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gigante-bg overflow-hidden mt-0.5">
                      <div className="h-full bg-gigante-navy" style={{ width: `${total > 0 ? (monto / total) * 100 : 0}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {categoriaFiltro !== "Todas" && (
          <div className="px-4 py-2 bg-gigante-bg text-xs flex justify-between">
            <span>
              Mostrando solo: <strong>{categoriaFiltro}</strong>
            </span>
            <button onClick={() => setCategoriaFiltro("Todas")} className="text-gigante-red hover:underline">
              Ver todas
            </button>
          </div>
        )}
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">No hay gastos registrados en este periodo.</p>
        ) : (
          <ul className="divide-y divide-gigante-border">
            {visibles.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gigante-navy">{e.concepto}</p>
                    <p className="text-[11px] text-gigante-muted">
                      {new Date(e.fecha + "T12:00:00").toLocaleDateString("es-MX")} · {e.categoria}
                      {e.metodo_pago && ` · ${e.metodo_pago}`}
                      {e.proveedor && ` · ${e.proveedor}`} · Registró {nameFor(e.created_by)}
                    </p>
                    {e.notas && <p className="text-[11px] text-gigante-muted mt-0.5">{e.notas}</p>}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {e.photo_paths.map((path, idx) => (
                        <button
                          key={path}
                          onClick={() => verComprobante(path)}
                          className="inline-flex items-center gap-1 text-[11px] text-gigante-red hover:underline"
                        >
                          <Paperclip size={11} /> Comprobante {e.photo_paths.length > 1 ? idx + 1 : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gigante-navy">{money(Number(e.monto))}</p>
                    {confirmDelete === e.id ? (
                      <div className="flex gap-2 mt-1 text-[11px]">
                        <button onClick={() => setConfirmDelete(null)} className="text-gigante-muted">
                          No
                        </button>
                        <button onClick={() => borrar(e)} className="text-gigante-red font-semibold">
                          Sí, borrar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(e.id)}
                        className="mt-1 text-gigante-muted hover:text-gigante-red"
                        aria-label="Borrar gasto"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <RegistrarGastoModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            setMesOffset(0);
            reload();
          }}
        />
      )}
    </div>
  );
}
