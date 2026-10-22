import { useState } from "react";
import { Wallet } from "lucide-react";
import CorteTab from "./CorteTab";
import HistorialTab from "./HistorialTab";
import PorCobrarTab from "./PorCobrarTab";

type Tab = "corte" | "historial" | "porcobrar";

const TABS: [Tab, string][] = [
  ["corte", "Corte de caja"],
  ["historial", "Historial de cobros"],
  ["porcobrar", "Por cobrar"],
];

/**
 * Cobranza y Corte de Caja (Caja y Gerencia).
 * VENTA = pagos del mismo día de la venta; COBRANZA = pagos de días posteriores.
 */
export default function Cobranza() {
  const [tab, setTab] = useState<Tab>("corte");
  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <Wallet size={22} /> Cobranza y Corte
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        <strong>Venta</strong> es lo que el cliente paga el mismo día de su compra (en caja o al chofer). <strong>Cobranza</strong> es lo que paga en un día
        posterior.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gigante-border overflow-x-auto">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === k ? "border-gigante-red text-gigante-red" : "border-transparent text-gigante-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "corte" && <CorteTab />}
        {tab === "historial" && <HistorialTab />}
        {tab === "porcobrar" && <PorCobrarTab />}
      </div>
    </div>
  );
}
