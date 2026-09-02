import { useMemo, useState } from "react";
import { Calculator, ShoppingCart, Warehouse } from "lucide-react";

type Mode = "ventas" | "almacen";

function toNumber(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function Calculadora() {
  const [mode, setMode] = useState<Mode>("ventas");

  // Datos del producto (comunes a ambos modos) — se capturan de la
  // etiqueta de la tarima/caja (m² por caja y piezas por caja).
  const [m2PerBoxStr, setM2PerBoxStr] = useState("");
  const [piecesPerBoxStr, setPiecesPerBoxStr] = useState("");

  // Modo Ventas
  const [m2NeededStr, setM2NeededStr] = useState("");

  // Modo Almacén
  const [closedBoxesStr, setClosedBoxesStr] = useState("");
  const [loosePiecesStr, setLoosePiecesStr] = useState("");
  const [targetM2Str, setTargetM2Str] = useState("");

  const m2PerBox = toNumber(m2PerBoxStr);
  const piecesPerBox = toNumber(piecesPerBoxStr);
  const m2PerPiece = piecesPerBox > 0 ? m2PerBox / piecesPerBox : 0;
  const hasBaseData = m2PerBox > 0 && piecesPerBox > 0;

  const ventasResult = useMemo(() => {
    const m2Needed = toNumber(m2NeededStr);
    if (!hasBaseData || m2Needed <= 0) return null;
    const boxesExact = m2Needed / m2PerBox;
    const boxesRounded = Math.ceil(boxesExact - 1e-9);
    const m2Covered = boxesRounded * m2PerBox;
    const surplus = m2Covered - m2Needed;
    const piecesExact = m2PerPiece > 0 ? Math.ceil(m2Needed / m2PerPiece - 1e-9) : 0;
    return { m2Needed, boxesExact, boxesRounded, m2Covered, surplus, piecesExact };
  }, [m2NeededStr, m2PerBox, m2PerPiece, hasBaseData]);

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

      <div className="bg-white border border-gigante-border rounded-xl p-5 mt-4">
        <p className="text-sm font-semibold text-gigante-navy mb-1">Datos del producto</p>
        <p className="text-xs text-gigante-muted mb-3">
          Tómalos de la etiqueta de la tarima o de la caja (m² que cubre una caja y cuántas piezas
          trae).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gigante-navy mb-1">m² por caja</label>
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
            <label className="block text-xs font-medium text-gigante-navy mb-1">Piezas por caja</label>
            <input
              type="number"
              min="0"
              step="1"
              value={piecesPerBoxStr}
              onChange={(e) => setPiecesPerBoxStr(e.target.value)}
              placeholder="Ej. 6"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        {hasBaseData && (
          <p className="text-xs text-gigante-muted mt-2">
            Eso equivale a <strong>{fmt(m2PerPiece, 4)} m²</strong> por pieza suelta.
          </p>
        )}
      </div>

      {mode === "ventas" ? (
        <div className="bg-white border border-gigante-border rounded-xl p-5 mt-4">
          <p className="text-sm font-semibold text-gigante-navy mb-3">
            ¿Cuántas cajas necesita el cliente?
          </p>
          <div>
            <label className="block text-xs font-medium text-gigante-navy mb-1">
              Metros cuadrados que necesita cubrir
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={m2NeededStr}
              onChange={(e) => setM2NeededStr(e.target.value)}
              placeholder="Ej. 32"
              className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
            />
          </div>

          {!hasBaseData ? (
            <p className="text-xs text-gigante-muted mt-3">
              Primero llena los datos del producto de arriba.
            </p>
          ) : ventasResult ? (
            <div className="mt-4 bg-gigante-bg rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gigante-muted">Cajas completas a vender</span>
                <span className="text-lg font-bold text-gigante-navy">{ventasResult.boxesRounded}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gigante-muted">Eso cubre</span>
                <span className="text-gigante-navy font-medium">{fmt(ventasResult.m2Covered)} m²</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gigante-muted">Le sobrarían</span>
                <span className={`font-medium ${ventasResult.surplus > 0 ? "text-amber-700" : "text-gigante-navy"}`}>
                  {fmt(ventasResult.surplus)} m²
                </span>
              </div>
              <div className="border-t border-gigante-border pt-2 flex items-center justify-between text-xs">
                <span className="text-gigante-muted">O, si le vendes piezas sueltas en vez de cajas completas</span>
                <span className="text-gigante-navy font-medium">{ventasResult.piecesExact} piezas</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
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
      )}
    </div>
  );
}
