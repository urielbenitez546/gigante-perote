import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { normalizeText } from "../../lib/search";
import { calcularSemaforo, SEMAFORO_LABELS, PRODUCT_UNIT_LABELS, type Product, type SemaforoStatus } from "../../types";

const DOT: Record<SemaforoStatus, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-amber-500",
  rojo: "bg-red-500",
};

interface Props {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  /** Muestra el semáforo y lo disponible en cada resultado (útil al vender). */
  showStock?: boolean;
  /** Productos que no se deben ofrecer (ej. el mismo que se está cambiando). */
  excludeIds?: string[];
  size?: "sm" | "md";
}

/**
 * Buscador de productos: escribe código, nombre o marca y elige de la
 * lista. Sirve aunque el catálogo tenga cientos de productos (un
 * <select> normal se vuelve imposible de usar).
 */
export default function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "Busca por código, nombre o marca...",
  showStock = false,
  excludeIds = [],
  size = "md",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = useMemo(() => {
    const q = normalizeText(query.trim());
    const pool = products.filter((p) => p.active !== false && !excludeIds.includes(p.id));
    if (!q) return pool.slice(0, 20);
    const words = q.split(/\s+/);
    return pool
      .filter((p) => {
        const hay = normalizeText(`${p.code} ${p.name} ${p.brand} ${p.category}`);
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 30);
  }, [products, query, excludeIds]);

  const pad = size === "sm" ? "py-2 text-xs" : "py-2.5 text-sm";

  if (selected && !open) {
    const estado = calcularSemaforo(selected);
    const disp = selected.physical_stock - selected.sold_pending;
    return (
      <div className={`flex items-center gap-2 w-full rounded-lg border border-gigante-border px-3 ${pad} bg-white`}>
        {showStock && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[estado]}`} title={SEMAFORO_LABELS[estado]} />}
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          className="flex-1 min-w-0 text-left truncate text-gigante-navy"
          title="Cambiar producto"
        >
          <span className="font-medium">{selected.code}</span> — {selected.name}
          {showStock && (
            <span className="text-gigante-muted">
              {" "}
              · disp. {disp.toLocaleString("es-MX")} {PRODUCT_UNIT_LABELS[selected.unit]}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQuery("");
            setOpen(true);
          }}
          className="text-gigante-muted shrink-0"
          aria-label="Quitar producto"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gigante-muted" />
      <input
        autoFocus={open}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-gigante-border pl-8 pr-3 ${pad} focus:outline-none focus:ring-2 focus:ring-gigante-navy/30`}
      />
      {open && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gigante-border rounded-lg shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gigante-muted">No se encontró ningún producto.</li>
          ) : (
            results.map((p) => {
              const estado = calcularSemaforo(p);
              const disp = p.physical_stock - p.sold_pending;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gigante-bg flex items-center gap-2"
                  >
                    {showStock && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[estado]}`} />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs text-gigante-navy truncate">
                        <span className="font-semibold">{p.code}</span> — {p.name}
                      </span>
                      <span className="block text-[10px] text-gigante-muted truncate">
                        {p.brand}
                        {showStock && (
                          <>
                            {" · "}
                            <span className={estado === "verde" ? "" : estado === "amarillo" ? "text-amber-700 font-semibold" : "text-red-700 font-semibold"}>
                              {estado === "rojo" ? "Sin existencia" : `Disponible: ${disp.toLocaleString("es-MX")} ${PRODUCT_UNIT_LABELS[p.unit]}`}
                              {estado === "amarillo" && " (se está acabando)"}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
