import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, Plus, Upload, X, CheckCircle2, Clock } from "lucide-react";
import { useDeliveries, updateDelivery, createAdditionalDelivery } from "../../hooks/useDeliveries";
import {
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type DeliveryStatus,
  type PaymentMethod,
} from "../../types";
import { pendingLinesFor } from "../../lib/pendingLines";
import { uploadPhoto, uploadPhotos, publicPhotoUrl } from "../../lib/storage";
import ConfirmarEntregaParcialModal from "../../components/ventas/ConfirmarEntregaParcialModal";
import SignatureCanvas from "../../components/repartos/SignatureCanvas";

const STATUS_OPTIONS: DeliveryStatus[] = ["pendiente", "en_camino", "entregado", "incidencia"];
const PAYMENT_METHODS: PaymentMethod[] = ["efectivo", "transferencia", "tarjeta"];

export default function RepartoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deliveries, loading, reload } = useDeliveries();
  const delivery = deliveries.find((d) => d.id === id);

  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [driverName, setDriverName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [initialKm, setInitialKm] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showViajeModal, setShowViajeModal] = useState(false);

  // Evidencia de entrega (Etapa 6): solo aplica al capturar el paso a "entregado".
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [amountCollected, setAmountCollected] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [amountTouched, setAmountTouched] = useState(false);

  useEffect(() => {
    if (delivery && !initialized) {
      setDriverName(delivery.driver_name ?? "");
      setVehicle(delivery.vehicle ?? "");
      setInitialKm(delivery.initial_km != null ? String(delivery.initial_km) : "");
      setCurrentKm(delivery.current_km != null ? String(delivery.current_km) : "");
      setNotes(delivery.notes ?? "");
      setInitialized(true);
    }
  }, [delivery, initialized]);

  const itemsForThisTrip = useMemo(() => {
    if (!delivery) return [];
    if (delivery.items && delivery.items.length > 0) {
      return delivery.items.map((ref) => {
        const saleItem = delivery.sale.sale_items.find((si) => si.id === ref.sale_item_id);
        return {
          id: ref.sale_item_id,
          code: saleItem?.product?.code ?? "",
          name: saleItem?.product?.name ?? "",
          unit: saleItem?.product?.unit ?? "",
          quantity: ref.quantity,
          unitPrice: saleItem?.unit_price ?? 0,
        };
      });
    }
    // Reparto antiguo sin desglose: se asume que cubre todo lo pendiente a domicilio.
    return delivery.sale.sale_items
      .filter((si) => (si.delivery_type ?? delivery.sale.delivery_type) === "domicilio")
      .map((si) => ({
        id: si.id,
        code: si.product?.code ?? "",
        name: si.product?.name ?? "",
        unit: si.product?.unit ?? "",
        quantity: si.quantity - si.delivered_quantity,
        unitPrice: si.unit_price,
      }));
  }, [delivery]);

  const tripTotal = useMemo(
    () => itemsForThisTrip.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [itemsForThisTrip]
  );

  // Sugiere el monto a cobrar (el total de este viaje) sin pisar lo que
  // el chofer ya haya escrito a mano.
  useEffect(() => {
    if (delivery && delivery.status !== "entregado" && !amountTouched && tripTotal > 0) {
      setAmountCollected(tripTotal.toFixed(2));
    }
  }, [delivery, tripTotal, amountTouched]);

  const remainingDomicilio = delivery ? pendingLinesFor(delivery.sale, "domicilio") : [];
  const willMarkAsEntregado = !!delivery && delivery.status !== "entregado" && status === "entregado";

  function handlePhotoFiles(files: FileList | null) {
    if (!files) return;
    setPhotoFiles((prev) => [...prev, ...Array.from(files)]);
  }
  function removePhotoFile(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!delivery) return;
    setError(null);

    if (willMarkAsEntregado) {
      if (!signatureFile) {
        setError("Falta capturar la firma del cliente.");
        return;
      }
      if (photoFiles.length === 0) {
        setError("Falta al menos una foto de evidencia de la entrega.");
        return;
      }
      if (!amountCollected || Number(amountCollected) < 0) {
        setError("Indica el monto cobrado (puede ser 0 si no aplica).");
        return;
      }
      if (!paymentMethod) {
        setError("Indica el método de pago.");
        return;
      }
    }

    setSaving(true);

    let signaturePath: string | undefined;
    let photoPaths: string[] | undefined;

    if (willMarkAsEntregado) {
      const sigResult = await uploadPhoto("repartos-firmas", signatureFile!);
      if (sigResult.error) {
        setSaving(false);
        setError(`No se pudo subir la firma: ${sigResult.error}`);
        return;
      }
      signaturePath = sigResult.path!;

      const photosResult = await uploadPhotos("repartos-evidencia", photoFiles);
      if (photosResult.error) {
        setSaving(false);
        setError(`No se pudieron subir las fotos: ${photosResult.error}`);
        return;
      }
      photoPaths = photosResult.paths;
    }

    const { error: err } = await updateDelivery(delivery.id, {
      status: status || undefined,
      driverName: driverName || undefined,
      vehicle: vehicle || undefined,
      initialKm: initialKm ? Number(initialKm) : undefined,
      currentKm: currentKm ? Number(currentKm) : undefined,
      notes: notes || undefined,
      signaturePath,
      photoPaths,
      amountCollected: willMarkAsEntregado ? Number(amountCollected) : undefined,
      paymentMethod: willMarkAsEntregado ? (paymentMethod as PaymentMethod) : undefined,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setStatus("");
    reload();
  }

  if (loading) {
    return <p className="text-sm text-gigante-muted">Cargando...</p>;
  }
  if (!delivery) {
    return <p className="text-sm text-gigante-muted">No se encontró este reparto.</p>;
  }

  const sale = delivery.sale;
  const yaEntregado = delivery.status === "entregado";
  const signatureUrl = publicPhotoUrl("repartos-firmas", delivery.signature_path);
  const photoUrls = (delivery.photo_paths ?? []).map((p) => publicPhotoUrl("repartos-evidencia", p));

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate("/repartos")}
        className="flex items-center gap-1 text-sm text-gigante-muted mb-3"
      >
        <ArrowLeft size={16} /> Volver al listado
      </button>

      <div className="bg-white border border-gigante-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold text-gigante-navy">{sale.customer_name}</h1>
            <p className="text-sm text-gigante-muted">{sale.customer_address}</p>
            {sale.customer_phone && (
              <p className="text-sm text-gigante-muted flex items-center gap-1 mt-1">
                <Phone size={14} /> {sale.customer_phone}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gigante-muted">Folio de venta</p>
            <p className="font-semibold text-gigante-navy">{sale.folio}</p>
            <p className="text-lg font-bold text-gigante-navy mt-1">
              ${sale.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-gigante-border pt-4">
          <p className="text-sm font-semibold text-gigante-navy mb-2">
            Productos de este viaje ({itemsForThisTrip.length})
          </p>
          <ul className="space-y-1">
            {itemsForThisTrip.map((item) => (
              <li key={item.id} className="text-sm text-gigante-muted flex justify-between">
                <span>
                  {item.code} — {item.name}
                </span>
                <span>
                  {item.quantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gigante-muted text-right mt-1">
            Total de este viaje: ${tripTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </p>

          {remainingDomicilio.length > 0 && delivery.status !== "entregado" && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-amber-800">
                Esta venta todavía tiene material pendiente de entregar a domicilio que no va en este
                viaje (por ejemplo, un pedido grande repartido en varios viajes).
              </p>
              <button
                onClick={() => setShowViajeModal(true)}
                className="flex items-center gap-1 text-xs font-semibold text-gigante-red whitespace-nowrap"
              >
                <Plus size={14} /> Registrar viaje adicional
              </button>
            </div>
          )}
        </div>

        {/* Evidencia y cobro ya registrados (reparto entregado) */}
        {yaEntregado && (
          <div className="mt-5 border-t border-gigante-border pt-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <p className="text-sm font-semibold text-gigante-navy">Evidencia de entrega</p>
              {delivery.payment_confirmed_at ? (
                <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-1">
                  <CheckCircle2 size={13} /> Cobro confirmado por Caja
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-1">
                  <Clock size={13} /> Cobro pendiente de confirmar en Caja
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gigante-muted mb-1">Firma del cliente</p>
                {signatureUrl ? (
                  <a href={signatureUrl} target="_blank" rel="noreferrer">
                    <img
                      src={signatureUrl}
                      alt="Firma del cliente"
                      className="border border-gigante-border rounded-lg bg-white h-24 object-contain"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-gigante-muted">Sin firma registrada</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gigante-muted mb-1">
                  Monto cobrado y método de pago
                </p>
                <p className="text-sm text-gigante-navy font-semibold">
                  ${(delivery.amount_collected ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}{" "}
                  <span className="font-normal text-gigante-muted">
                    ({delivery.payment_method ? PAYMENT_METHOD_LABELS[delivery.payment_method] : "—"})
                  </span>
                </p>
                {delivery.payment_confirmed_at && (
                  <p className="text-xs text-gigante-muted mt-1">
                    Confirmado el {new Date(delivery.payment_confirmed_at).toLocaleString("es-MX")}
                  </p>
                )}
              </div>
            </div>

            {photoUrls.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gigante-muted mb-1">Fotos de evidencia ({photoUrls.length})</p>
                <div className="flex flex-wrap gap-2">
                  {photoUrls.map((url, i) => (
                    <a key={i} href={url ?? undefined} target="_blank" rel="noreferrer">
                      <img
                        src={url ?? undefined}
                        alt={`Evidencia ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gigante-border"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-gigante-border pt-4">
          <p className="text-sm font-semibold text-gigante-navy mb-3">
            Estado actual: <span className="font-normal">{DELIVERY_STATUS_LABELS[delivery.status]}</span>
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Cambiar estado a</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              >
                <option value="">Sin cambio</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {DELIVERY_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Chofer</label>
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Nombre del chofer (DEMO)"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gigante-navy mb-1">Vehículo</label>
              <input
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Ej. Camión 01 (DEMO)"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gigante-navy mb-1">Km inicial</label>
                <input
                  type="number"
                  value={initialKm}
                  onChange={(e) => setInitialKm(e.target.value)}
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gigante-navy mb-1">Km actual</label>
                <input
                  type="number"
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gigante-navy mb-1">
                Notas / incidencia (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej. Cliente no localizado, se reprogramó, etc."
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {willMarkAsEntregado && (
            <div className="mt-4 border border-gigante-border rounded-lg p-4 bg-gigante-bg/50">
              <p className="text-sm font-semibold text-gigante-navy mb-1">
                Evidencia de entrega (obligatoria)
              </p>
              <p className="text-xs text-gigante-muted mb-3">
                Para marcar este reparto como "Entregado" necesitas capturar la firma del cliente, al
                menos una foto de evidencia y el cobro.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gigante-navy mb-1">
                    Firma del cliente
                  </label>
                  <SignatureCanvas onChange={setSignatureFile} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gigante-navy mb-1">
                    Fotos de evidencia
                  </label>
                  <label className="flex items-center gap-2 border border-dashed border-gigante-border rounded-lg px-3 py-3 text-sm text-gigante-muted cursor-pointer hover:bg-white bg-white">
                    <Upload size={16} />
                    Toca para tomar/seleccionar fotos
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handlePhotoFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {photoFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {photoFiles.map((file, i) => (
                        <div key={i} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Foto ${i + 1}`}
                            className="w-16 h-16 object-cover rounded-lg border border-gigante-border"
                          />
                          <button
                            type="button"
                            onClick={() => removePhotoFile(i)}
                            className="absolute -top-1.5 -right-1.5 bg-gigante-navy text-white rounded-full p-0.5"
                            aria-label="Quitar foto"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gigante-navy mb-1">
                    Monto cobrado
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountCollected}
                    onChange={(e) => {
                      setAmountCollected(e.target.value);
                      setAmountTouched(true);
                    }}
                    className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                  />
                  <p className="text-xs text-gigante-muted mt-1">
                    Sugerido según el total de este viaje: $
                    {tripTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gigante-navy mb-1">
                    Método de pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                  >
                    <option value="">Selecciona...</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-3 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                Al guardar, se descontará la existencia física de los productos de este viaje. El cobro
                quedará pendiente de confirmación en Caja hasta que reciba físicamente el dinero.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full sm:w-auto bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-5 py-2.5"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      <Link to="/repartos" className="inline-block mt-4 text-xs text-gigante-muted">
        &larr; Regresar a Repartos
      </Link>

      {showViajeModal && (
        <ConfirmarEntregaParcialModal
          title={`Viaje adicional — ${sale.folio}`}
          description="Indica qué productos y cantidades van en este nuevo viaje."
          lines={remainingDomicilio}
          submitLabel="Registrar viaje"
          onClose={() => setShowViajeModal(false)}
          onConfirm={(selected) => createAdditionalDelivery(sale.id, selected)}
          onSuccess={() => {
            setShowViajeModal(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
