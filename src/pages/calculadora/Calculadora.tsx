import { useMemo, useState } from "react";
import { Calculator, ShoppingCart, Warehouse } from "lucide-react";

type Mode = "ventas" | "almacen";
type Unidad = "metros" | "cajas" | "piezas";

const UNIDAD_LABELS: Record<Unidad, string> = {
  metros: "Metros cuadrados (m²)",
  cajas: "Cajas",
  piezas: "Piezas sueltas",
};

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Calculadora() {
  const [mode, setMode] = useState<Mode>("ventas");

  // ------------------------------------------------------------
  // VENTAS: conversor de doble sentido entre Metros, Cajas y
  // Piezas. El campo "m² por pieza" solo se pide cuando de verdad
  // hace falta (si "tengo" o "quiero saber" involucra piezas).
  // ------------------------------------------------------------
  const [ventasM2PorCajaStr, setVentasM2PorCajaStr] = useState("");
  const [ventasM2PorPiezaStr, setVentasM2PorPiezaStr] = useState("");
  const [tengoUnidad, setTengoUnidad] = useState<Unidad>("metros");
  const [quieroUnidad, setQuieroUnidad] = useState<Unidad>("cajas");
  const [tengoValorStr, setTengoValorStr] = useState("");

  const ventasM2PorCaja = toNumber(ventasM2PorCajaStr);
  const ventasM2PorPieza = toNumber(ventasM2PorPiezaStr);
  const necesitaPieza = tengoUnidad === "piezas" || quieroUnidad === "piezas";
  const ventasHasBase =
    ventasM2PorCaja > 0 && (!necesitaPieza || ventasM2PorPieza > 0) && tengoUnidad !== quieroUnidad;

  const conversion = useMemo(() => {
    const valor = toNumber(tengoValorStr);
    if (!ventasHasBase || valor <= 0) return null;

    // 1) Paso intermedio: convertir lo que "tengo" a metros².
    let m2: number;
    if (tengoUnidad === "metros") m2 = valor;
    else if (tengoUnidad === "cajas") m2 = valor * ventasM2PorCaja;
    else m2 = valor * ventasM2PorPieza;

    // 2) De metros² a lo que "quiero saber".
    if (quieroUnidad === "metros") {
      return { resultadoExacto: m2, resultadoRedondeado: null as number | null };
    }
    if (quieroUnidad === "cajas") {
      const exacto = m2 / ventasM2PorCaja;
      return { resultadoExacto: exacto, resultadoRedondeado: Math.ceil(exacto - 1e-9) };
    }
    const exacto = m2 / ventasM2PorPieza;
    return { resultadoExacto: exacto, resultadoRedondeado: Math.ceil(exacto - 1e-9) };
  }, [tengoValorStr, tengoUnidad, quieroUnidad, ventasM2PorCaja, ventasM2PorPieza, ventasHasBase]);

  // ------------------------------------------------------------
  // ALMACÉN: verificar inventario físico (sin cambios).
  // ------------------------------------------------------------
  const [m2PerBoxStr, setM2PerBoxStr] = useState("");
  const [m2PerPieceStr, setM2PerPieceStr] = useState("");
  const [closedBoxesStr, setClosedBoxesStr] = useState("");
  const [loosePiecesStr, setLoosePiecesStr] = useState("");
  const [targetM2Str, setTargetM2Str] = useState("");

  const m2PerBox = toNumber(m2PerBoxStr);
  const m2PerPiece = toNumber(m2PerPieceStr);
  const piecesPerBox = m2PerPiece > 0 ? m2PerBox / m2PerPiece : 0;
  const hasBaseData = m2PerBox > 0 && m2PerPiece > 0;

  const almacenResult = useMemo(() => {
    if (!hasBaseData) return null;
    const closedBoxes = toNumber(closedBoxesStr);
    const loosePieces = toNumber(loosePiecesStr);
    const target = targetM2Str.trim() === "" ? null : toNumber(targetM2Str);
    const m2FromBoxes = closedBoxes * m2PerBox;
    const m2FromPieces = loosePieces * m2PerPiece;
    const total = m2FromBoxes + m2FromPieces;
    const diff = target !== null ? total - target : null;
    return { closedBoxes, loosePieces, target, m2FromBoxes, m2FromPieces, total, diff };
  }, [closedBoxesStr, loosePiecesStr, targetM2Str, m2PerBox, m2PerPiece, hasBaseData]);

  function unidadOptions(exclude: Unidad) {
    return (Object.keys(UNIDAD_LABELS) as Unidad[]).filter((u) => u !== exclude);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Calculator size={22} /> Calculadora de metros y cajas
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Convierte entre metros cuadrados, cajas y piezas sueltas — para cotizar en Ventas o
        verificar el inventario físico en Almacén.
      </p>

      <div className="flex gap-2 mt-5">
        <button
          onClick={() => setMode("ventas")}
          className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2 ${
            mode === "ventas" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
          }`}
        >
          <ShoppingCart size={15} /> Ventas
        </button>
        <button
          onClick={() => setMode("almacen")}
          className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2 ${
            mode === "almacen" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
          }`}
        >
          <Warehouse size={15} /> Almacén
        </button>
      </div>

      {mode === "ventas" ? (
        <>
          <div className="bg-white border border-gigante-border rounded-xl p-5 mt-4">
            <p className="text-sm font-semibold text-gigante-navy mb-3">
              ¿Qué te pregunta o te da el cliente?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">Tengo</label>
                <select
                  value={tengoUnidad}
                  onChange={(e) => {
                    const nueva = e.target.value as Unidad;
                    setTengoUnidad(nueva);
                    if (nueva === quieroUnidad) setQuieroUnidad(unidadOptions(nueva)[0]);
                  }}
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                >
                  {(Object.keys(UNIDAD_LABELS) as Unidad[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIDAD_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">Quiero saber</label>
                <select
                  value={quieroUnidad}
                  onChange={(e) => setQuieroUnidad(e.target.value as Unidad)}
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                >
                  {unidadOptions(tengoUnidad).map((u) => (
                    <option key={u} value={u}>
                      {UNIDAD_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gigante-navy mb-1">
                Cantidad de {UNIDAD_LABELS[tengoUnidad].toLowerCase()} que tiene el cliente
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tengoValorStr}
                onChange={(e) => setTengoValorStr(e.target.value)}
                placeholder="Ej. 44"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-gigante-border grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">
                  M² por caja (etiqueta: "M2 POR CAJA")
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ventasM2PorCajaStr}
                  onChange={(e) => setVentasM2PorCajaStr(e.target.value)}
                  placeholder="Ej. 1.50"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
              {necesitaPieza && (
                <div>
                  <label className="block text-xs font-medium text-gigante-navy mb-1">
                    M² por pieza (etiqueta: "PIEZA")
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={ventasM2PorPiezaStr}
                    onChange={(e) => setVentasM2PorPiezaStr(e.target.value)}
                    placeholder="Ej. 0.10"
                    className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                  />
                </div>
              )}
            </div>

            {!ventasHasBase ? (
              <p className="text-xs text-gigante-muted mt-3">
                Llena la cantidad y los datos del producto de arriba.
              </p>
            ) : conversion ? (
              <div className="mt-4 bg-gigante-bg rounded-lg p-4 space-y-2">
                {quieroUnidad === "metros" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gigante-muted">Eso cubre</span>
                    <span className="text-lg font-bold text-gigante-navy">
                      {fmt(conversion.resultadoExacto)} m²
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gigante-muted">
                        {quieroUnidad === "cajas" ? "Cajas completas necesarias" : "Piezas exactas necesarias"}
                      </span>
                      <span className="text-lg font-bold text-gigante-navy">
                        {conversion.resultadoRedondeado}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gigante-muted">Cantidad exacta (sin redondear)</span>
                      <span className="text-gigante-navy font-medium">
                        {fmt(conversion.resultadoExacto, 3)} {quieroUnidad === "cajas" ? "cajas" : "piezas"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white border border-gigante-border rounded-xl p-5 mt-4">
            <p className="text-sm font-semibold text-gigante-navy mb-1">Datos del producto</p>
            <p className="text-xs text-gigante-muted mb-3">
              Tómalos directo de la etiqueta de la tarima: los renglones "M2 POR CAJA" y "PIEZA".
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">
                  M² por caja (etiqueta: "M2 POR CAJA")
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m2PerBoxStr}
                  onChange={(e) => setM2PerBoxStr(e.target.value)}
                  placeholder="Ej. 1.50"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">
                  M² por pieza (etiqueta: "PIEZA")
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={m2PerPieceStr}
                  onChange={(e) => setM2PerPieceStr(e.target.value)}
                  placeholder="Ej. 0.10"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            {hasBaseData && (
              <p className="text-xs text-gigante-muted mt-2">
                Eso equivale a <strong>{fmt(piecesPerBox, 1)} piezas</strong> por caja.
              </p>
            )}
          </div>

          <div className="bg-white border border-gigante-border rounded-xl p-5 mt-4">
            <p className="text-sm font-semibold text-gigante-navy mb-3">
              Verificar inventario físico contra lo que pide el sistema
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">
                  Cajas cerradas contadas
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={closedBoxesStr}
                  onChange={(e) => setClosedBoxesStr(e.target.value)}
                  placeholder="Ej. 68"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gigante-navy mb-1">
                  Piezas sueltas contadas
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={loosePiecesStr}
                  onChange={(e) => setLoosePiecesStr(e.target.value)}
                  placeholder="Ej. 4"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gigante-navy mb-1">
                Metros que pide el sistema que debe haber (opcional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={targetM2Str}
                onChange={(e) => setTargetM2Str(e.target.value)}
                placeholder="Ej. 110"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
              />
            </div>

            {!hasBaseData ? (
              <p className="text-xs text-gigante-muted mt-3">
                Primero llena los datos del producto de arriba.
              </p>
            ) : almacenResult ? (
              <div className="mt-4 bg-gigante-bg rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gigante-muted">Metros de las cajas cerradas</span>
                  <span className="text-gigante-navy font-medium">{fmt(almacenResult.m2FromBoxes)} m²</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gigante-muted">Metros de las piezas sueltas</span>
                  <span className="text-gigante-navy font-medium">{fmt(almacenResult.m2FromPieces)} m²</span>
                </div>
                <div className="border-t border-gigante-border pt-2 flex items-center justify-between">
                  <span className="text-sm text-gigante-muted">Total contado</span>
                  <span className="text-lg font-bold text-gigante-navy">{fmt(almacenResult.total)} m²</span>
                </div>

                {almacenResult.diff !== null && (
                  <div
                    className={`mt-2 rounded-lg px-3 py-2 text-sm font-medium ${
                      Math.abs(almacenResult.diff) < 0.005
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : almacenResult.diff > 0
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : "bg-gigante-red/10 text-gigante-red border border-gigante-red/20"
                    }`}
                  >
                    {Math.abs(almacenResult.diff) < 0.005
                      ? "✓ Cuadra exacto con lo que pide el sistema."
                      : almacenResult.diff > 0
                      ? `Sobran ${fmt(almacenResult.diff)} m² de lo que pide el sistema.`
                      : `Faltan ${fmt(Math.abs(almacenResult.diff))} m² para completar lo que pide el sistema.`}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
