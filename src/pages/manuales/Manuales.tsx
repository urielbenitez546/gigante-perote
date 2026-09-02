import { useMemo, useState } from "react";
import { BookOpen, FileText, HelpCircle, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useManuals, useFaqEntries, deleteManual, deleteFaq } from "../../hooks/useManuals";
import { publicPhotoUrl } from "../../lib/storage";
import { MANUAL_CATEGORY_LABELS, ROLE_LABELS, type AppRole } from "../../types";
import RegistrarManualModal from "../../components/manuales/RegistrarManualModal";
import RegistrarFaqModal from "../../components/manuales/RegistrarFaqModal";

type Tab = "manuales" | "faq";

function visibleFor<T extends { target_roles: AppRole[] | null }>(items: T[], role: AppRole): T[] {
  return items.filter((i) => !i.target_roles || i.target_roles.length === 0 || i.target_roles.includes(role));
}

export default function Manuales() {
  const { profile } = useAuth();
  const { manuals, loading: loadingManuals, error: errorManuals, reload: reloadManuals } = useManuals();
  const { faqs, loading: loadingFaqs, error: errorFaqs, reload: reloadFaqs } = useFaqEntries();
  const [tab, setTab] = useState<Tab>("manuales");
  const [showManualModal, setShowManualModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);

  if (!profile) return null;
  const isGerencia = profile.role === "gerencia";

  const visibleManuals = useMemo(() => visibleFor(manuals, profile.role), [manuals, profile.role]);
  const visibleFaqs = useMemo(() => visibleFor(faqs, profile.role), [faqs, profile.role]);

  async function handleDeleteManual(id: string) {
    if (!confirm("¿Eliminar este manual/documento? Esta acción no se puede deshacer.")) return;
    const { error } = await deleteManual(id);
    if (!error) reloadManuals();
  }
  async function handleDeleteFaq(id: string) {
    if (!confirm("¿Eliminar esta pregunta frecuente? Esta acción no se puede deshacer.")) return;
    const { error } = await deleteFaq(id);
    if (!error) reloadFaqs();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
        <BookOpen size={22} /> Manuales e Información
      </h1>
      <p className="text-sm text-gigante-muted mt-1">
        Manual de bienvenida, descripciones de puesto, protocolos y preguntas frecuentes.
      </p>

      <div className="flex items-center justify-between gap-2 mt-5 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("manuales")}
            className={`text-sm font-medium rounded-lg px-4 py-2 ${
              tab === "manuales" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
            }`}
          >
            Manuales ({visibleManuals.length})
          </button>
          <button
            onClick={() => setTab("faq")}
            className={`text-sm font-medium rounded-lg px-4 py-2 ${
              tab === "faq" ? "bg-gigante-navy text-white" : "bg-white border border-gigante-border text-gigante-navy"
            }`}
          >
            Preguntas frecuentes ({visibleFaqs.length})
          </button>
        </div>

        {isGerencia && (
          <button
            onClick={() => (tab === "manuales" ? setShowManualModal(true) : setShowFaqModal(true))}
            className="flex items-center gap-1 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            <Plus size={16} /> {tab === "manuales" ? "Publicar manual" : "Publicar pregunta"}
          </button>
        )}
      </div>

      {(errorManuals || errorFaqs) && (
        <p className="mt-4 text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">
          {errorManuals || errorFaqs}
        </p>
      )}

      {tab === "manuales" && (
        <div className="mt-4 space-y-3">
          {loadingManuals ? (
            <p className="text-sm text-gigante-muted">Cargando...</p>
          ) : visibleManuals.length === 0 ? (
            <p className="text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-6">
              Todavía no hay manuales publicados para tu rol.
            </p>
          ) : (
            visibleManuals.map((m) => {
              const url = publicPhotoUrl("manuales", m.file_path);
              return (
                <div key={m.id} className="bg-white border border-gigante-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gigante-navy text-white flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gigante-navy">{m.title}</p>
                        {m.description && (
                          <p className="text-xs text-gigante-muted mt-0.5">{m.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] bg-gigante-bg text-gigante-navy rounded-full px-2 py-0.5">
                            {MANUAL_CATEGORY_LABELS[m.category]}
                          </span>
                          <span className="text-[10px] text-gigante-muted">
                            {m.target_roles && m.target_roles.length > 0
                              ? m.target_roles.map((r) => ROLE_LABELS[r]).join(", ")
                              : "Todos los roles"}
                          </span>
                        </div>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gigante-red underline mt-2 inline-block"
                          >
                            Ver documento
                          </a>
                        )}
                      </div>
                    </div>
                    {isGerencia && (
                      <button
                        onClick={() => handleDeleteManual(m.id)}
                        className="text-gigante-muted hover:text-gigante-red p-1"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "faq" && (
        <div className="mt-4 space-y-3">
          {loadingFaqs ? (
            <p className="text-sm text-gigante-muted">Cargando...</p>
          ) : visibleFaqs.length === 0 ? (
            <p className="text-sm text-gigante-muted bg-white border border-gigante-border rounded-xl p-6">
              Todavía no hay preguntas frecuentes publicadas para tu rol.
            </p>
          ) : (
            visibleFaqs.map((f) => (
              <div key={f.id} className="bg-white border border-gigante-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gigante-red text-white flex items-center justify-center shrink-0">
                      <HelpCircle size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gigante-navy">{f.question}</p>
                      <p className="text-sm text-gigante-muted mt-1 whitespace-pre-line">{f.answer}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {f.category && (
                          <span className="text-[10px] bg-gigante-bg text-gigante-navy rounded-full px-2 py-0.5">
                            {MANUAL_CATEGORY_LABELS[f.category]}
                          </span>
                        )}
                        <span className="text-[10px] text-gigante-muted">
                          {f.target_roles && f.target_roles.length > 0
                            ? f.target_roles.map((r) => ROLE_LABELS[r]).join(", ")
                            : "Todos los roles"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isGerencia && (
                    <button
                      onClick={() => handleDeleteFaq(f.id)}
                      className="text-gigante-muted hover:text-gigante-red p-1"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showManualModal && (
        <RegistrarManualModal
          onClose={() => setShowManualModal(false)}
          onSuccess={() => {
            setShowManualModal(false);
            reloadManuals();
          }}
        />
      )}
      {showFaqModal && (
        <RegistrarFaqModal
          onClose={() => setShowFaqModal(false)}
          onSuccess={() => {
            setShowFaqModal(false);
            reloadFaqs();
          }}
        />
      )}
    </div>
  );
}
