import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock } from "lucide-react";
import { useDeliveries } from "../../hooks/useDeliveries";
import { publicPhotoUrl } from "../../lib/storage";
import { useProfileNames } from "../../hooks/useProfileNames";
import { PAYMENT_METHOD_LABELS, type Delivery } from "../../types";
import ConfirmarCobroModal from "../../components/repartos/ConfirmarCobroModal";

type Tab = "pendientes" | "confirmados";

export default function EvidenciasCobros() {
  const { deliveries, loading, error, reload } = useDeliveries();
  const { nameFor } = useProfileNames();
  const [tab, setTab] = useState<Tab>("pendientes");
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);

  const entregados = useMemo(() => deliveries.filter((d) => d.status === "entregado"), [deliveries]);
  const pendientes = useMemo(
    () => entregados.filter((d) => !d.payment_confirmed_at),
    [entregados]
  );
  const confirmados = useMemo(
    () => entregados.filter((d) => !!d.payment_confirmed_at),
    [entregados]
  );

  const list = tab === "pendientes" ? pendientes : confirmados;
  const totalPendiente = useMemo(
    () => pendientes.reduce((sum, d) => sum + (d.amount_collected ?? 0), 0),
    [pendientes]
  );

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Camera size={22} /> Evidencias y Cobros
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Confirma el dinero recibido de los repartos ya entregados, con su firma y evidencia fotográfica.
      </p>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center mb-2">
            <Clock size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Cobros pendientes por confirmar</p>
          <p className="text-xl font-bold text-gigante-navy">{pendientes.length}</p>
          <p className="text-xs text-gigante-muted mt-1">
            Suma: ${totalPendiente.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gigante-muted">Cobros confirmados</p>
          <p className="text-xl font-bold text-gigante-navy">{confirmados.length}</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 mt-5">
        <button
          onClick={() => setTab("pendientes")}
          className={`text-sm font-medium rounded-lg px-4 py-2 ${
            tab === "pendientes" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
          }`}
        >
          Pendientes ({pendientes.length})
        </button>
        <button
          onClick={() => setTab("confirmados")}
          className={`text-sm font-medium rounded-lg px-4 py-2 ${
            tab === "confirmados" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
          }`}
        >
          Confirmados ({confirmados.length})
        </button>
      </div>

      <div className="mt-4 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : list.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">
            {tab === "pendientes"
              ? "No hay cobros pendientes de confirmar."
              : "Todavía no se ha confirmado ningún cobro."}
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gigante-bg text-gigante-muted text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-3">Entregado</th>
                <th className="text-left font-medium px-4 py-3">Folio</th>
                <th className="text-left font-medium px-4 py-3">Cliente</th>
                <th className="text-left font-medium px-4 py-3">Chofer</th>
                <th className="text-right font-medium px-4 py-3">Monto</th>
                <th className="text-left font-medium px-4 py-3">Método</th>
                <th className="text-left font-medium px-4 py-3">Evidencia</th>
                <th className="text-right font-medium px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const signatureUrl = publicPhotoUrl("repartos-firmas", d.signature_path);
                const photoCount = d.photo_paths?.length ?? 0;
                return (
                  <tr key={d.id} className="border-t border-gigante-border align-top">
                    <td className="px-4 py-3 text-gigante-muted whitespace-nowrap">
                      {d.delivered_at ? new Date(d.delivered_at).toLocaleString("es-MX") : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gigante-navy">{d.sale?.folio ?? "—"}</td>
                    <td className="px-4 py-3 text-gigante-navy">{d.sale?.customer_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gigante-muted">{d.driver_name || "—"}</td>
                    <td className="px-4 py-3 text-right text-gigante-navy font-semibold">
                      ${(d.amount_collected ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-gigante-muted">
                      {d.payment_method ? PAYMENT_METHOD_LABELS[d.payment_method] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        {signatureUrl ? (
                          <a href={signatureUrl} target="_blank" rel="noreferrer" className="text-gigante-red underline">
                            Firma
                          </a>
                        ) : (
                          <span className="text-gigante-muted">Sin firma</span>
                        )}
                        <span className="text-gigante-muted">·</span>
                        <span className="text-gigante-muted">{photoCount} foto(s)</span>
                      </div>
                      {tab === "confirmados" && d.payment_notes && (
                        <p className="text-xs text-gigante-muted mt-1">Nota: {d.payment_notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tab === "pendientes" ? (
                        <button
                          onClick={() => setActiveDelivery(d)}
                          className="text-xs font-semibold text-gigante-red hover:underline whitespace-nowrap"
                        >
                          Confirmar cobro
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 whitespace-nowrap">
                          {d.payment_confirmed_at
                            ? `${new Date(d.payment_confirmed_at).toLocaleDateString("es-MX")} — ${nameFor(
                                d.payment_confirmed_by
                              )}`
                            : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {activeDelivery && (
        <ConfirmarCobroModal
          delivery={activeDelivery}
          onClose={() => setActiveDelivery(null)}
          onSuccess={() => {
            setActiveDelivery(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
