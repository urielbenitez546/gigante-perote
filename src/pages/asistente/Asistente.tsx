import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, FileText, HelpCircle, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useManuals, useFaqEntries } from "../../hooks/useManuals";
import { publicPhotoUrl } from "../../lib/storage";
import { searchManualesYFaq, type SearchResult } from "../../lib/search";
import { MANUAL_CATEGORY_LABELS } from "../../types";

export default function Asistente() {
  const { profile } = useAuth();
  const { manuals, loading: loadingManuals } = useManuals();
  const { faqs, loading: loadingFaqs } = useFaqEntries();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const loading = loadingManuals || loadingFaqs;

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const found = searchManualesYFaq(query, manuals, faqs, profile.role);
    setResults(found);
    setLastQuery(query);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <MessageCircle size={22} /> Asistente de Consulta
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Escribe tu duda y busca coincidencias en los manuales y preguntas frecuentes registrados.
      </p>

      <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">
        Este asistente <strong>no usa inteligencia artificial de pago</strong>: busca por palabras
        clave dentro de lo que Gerencia ha publicado en{" "}
        <Link to="/manuales" className="underline">
          Manuales e Información
        </Link>
        . Si no encuentra nada, pregúntale directamente a tu jefe de área.
      </div>

      <form onSubmit={handleSearch} className="mt-5 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. ¿Qué hago si falta material en el pedido?"
          className="flex-1 rounded-lg border border-gigante-border px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2.5"
        >
          <Search size={16} /> Buscar
        </button>
      </form>

      {loading && <p className="mt-4 text-sm text-gigante-muted">Cargando información...</p>}

      {!loading && results !== null && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="bg-white border border-gigante-border rounded-xl p-5 text-center">
              <p className="text-sm text-gigante-navy font-medium">
                No encontré nada sobre "{lastQuery}".
              </p>
              <p className="text-xs text-gigante-muted mt-1">
                Intenta con otras palabras, o consulta directamente Manuales e Información.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <div key={`${r.type}-${r.item.id}`} className="bg-white border border-gigante-border rounded-xl p-4">
                  {r.type === "faq" ? (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center shrink-0">
                        <HelpCircle size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gigante-navy">{r.item.question}</p>
                        <p className="text-sm text-gigante-muted mt-1 whitespace-pre-line">{r.item.answer}</p>
                        {r.item.category && (
                          <span className="inline-block mt-1.5 text-[10px] bg-gigante-bg text-gigante-navy rounded-full px-2 py-0.5">
                            {MANUAL_CATEGORY_LABELS[r.item.category]}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gigante-navy">{r.item.title}</p>
                        {r.item.description && (
                          <p className="text-xs text-gigante-muted mt-0.5">{r.item.description}</p>
                        )}
                        <span className="inline-block mt-1.5 text-[10px] bg-gigante-bg text-gigante-navy rounded-full px-2 py-0.5">
                          {MANUAL_CATEGORY_LABELS[r.item.category]}
                        </span>
                        {(() => {
                          const url = publicPhotoUrl("manuales", r.item.file_path);
                          return url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-gigante-red underline mt-2 block"
                            >
                              Ver documento
                            </a>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
