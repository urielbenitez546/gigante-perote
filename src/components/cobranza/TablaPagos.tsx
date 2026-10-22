import { Pencil } from "lucide-react";
import {
  ORIGEN_PAGO_LABELS,
  TIPO_PAGO_LABELS,
  fechaCorta,
  metodoLabel,
  type PagoRow,
} from "../../hooks/useCobranza";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  pagos: PagoRow[];
  vendedor: (id: string | null | undefined) => string;
  onAbrir: (p: PagoRow) => void;
  /** Muestra la columna de tipo (venta/cobranza) y el estado. Para el historial. */
  mostrarTipo?: boolean;
  puedeCorregir: boolean;
  vacio?: string;
}

const BADGE: Record<string, string> = {
  venta: "bg-emerald-100 text-emerald-700",
  cobranza: "bg-blue-100 text-blue-700",
};

export default function TablaPagos({ pagos, vendedor, onAbrir, mostrarTipo, puedeCorregir, vacio }: Props) {
  if (pagos.length === 0) {
    return <p className="p-5 text-sm text-gigante-muted">{vacio ?? "No hay pagos en este periodo."}</p>;
  }
  return (
    <>
      {/* Escritorio */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gigante-bg text-gigante-muted text-xs">
            <tr>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">En caja</th>
              <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">Pagó el</th>
              {mostrarTipo && <th className="text-left font-medium px-3 py-2.5">Tipo</th>}
              <th className="text-left font-medium px-3 py-2.5">Folio / Factura</th>
              <th className="text-left font-medium px-3 py-2.5">Cliente</th>
              <th className="text-left font-medium px-3 py-2.5">Vendedor</th>
              <th className="text-left font-medium px-3 py-2.5">Método</th>
              <th className="text-left font-medium px-3 py-2.5">Cómo entró</th>
              <th className="text-left font-medium px-3 py-2.5">Recibo</th>
              <th className="text-right font-medium px-3 py-2.5">Monto</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} className={`border-t border-gigante-border ${p.anulado ? "opacity-50" : ""}`}>
                <td className="px-3 py-2.5 whitespace-nowrap text-gigante-navy">{fechaCorta(p.fecha_caja)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-gigante-muted">{fechaCorta(p.fecha_pago)}</td>
                {mostrarTipo && (
                  <td className="px-3 py-2.5">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${BADGE[p.tipo]}`}>{TIPO_PAGO_LABELS[p.tipo]}</span>
                  </td>
                )}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="font-medium text-gigante-navy">{p.sale?.folio}</span>
                  {p.sale?.numero_factura && <span className="block text-[11px] text-gigante-muted">{p.sale.numero_factura}</span>}
                </td>
                <td className="px-3 py-2.5 text-gigante-navy">{p.sale?.customer_name}</td>
                <td className="px-3 py-2.5 text-gigante-muted">{vendedor(p.sale?.created_by)}</td>
                <td className="px-3 py-2.5 text-gigante-muted whitespace-nowrap">{metodoLabel(p.metodo)}</td>
                <td className="px-3 py-2.5 text-gigante-muted whitespace-nowrap">{ORIGEN_PAGO_LABELS[p.origen]}</td>
                <td className="px-3 py-2.5 text-gigante-muted">{p.recibo || "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gigante-navy whitespace-nowrap">
                  {money(p.monto)}
                  {p.anulado && <span className="block text-[10px] font-normal text-gigante-red">ANULADO</span>}
                  {!p.anulado && p.editado && <span className="block text-[10px] font-normal text-amber-700">corregido</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <button onClick={() => onAbrir(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-gigante-red hover:underline">
                    <Pencil size={12} /> {puedeCorregir && !p.anulado ? "Corregir" : "Ver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Celular */}
      <div className="md:hidden divide-y divide-gigante-border">
        {pagos.map((p) => (
          <div key={p.id} className={`p-4 ${p.anulado ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gigante-navy">
                {p.sale?.folio}
                {p.sale?.numero_factura ? ` · ${p.sale.numero_factura}` : ""}
              </p>
              <p className="text-sm font-bold text-gigante-navy">{money(p.monto)}</p>
            </div>
            <p className="text-sm text-gigante-navy">{p.sale?.customer_name}</p>
            <p className="text-xs text-gigante-muted mt-0.5">
              {metodoLabel(p.metodo)} · {ORIGEN_PAGO_LABELS[p.origen]}
              {p.recibo ? ` · Recibo ${p.recibo}` : ""}
            </p>
            <p className="text-xs text-gigante-muted">
              En caja {fechaCorta(p.fecha_caja)} · pagó el {fechaCorta(p.fecha_pago)} · {vendedor(p.sale?.created_by)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {mostrarTipo && <span className={`text-[11px] rounded-full px-2 py-0.5 ${BADGE[p.tipo]}`}>{TIPO_PAGO_LABELS[p.tipo]}</span>}
              {p.anulado && <span className="text-[11px] text-gigante-red font-semibold">ANULADO</span>}
              {!p.anulado && p.editado && <span className="text-[11px] text-amber-700">corregido</span>}
              <button onClick={() => onAbrir(p)} className="ml-auto text-xs font-semibold text-gigante-red">
                {puedeCorregir && !p.anulado ? "Corregir" : "Ver"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
