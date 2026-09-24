import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  Send,
  Bot,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  BookOpen,
  Database,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCheck,
  Plus,
  RotateCcw,
  FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  useManuals,
  useFaqEntries,
  logAssistantQuestion,
  rateAssistantAnswer,
  usePendingAssistantQuestions,
  markAssistantQuestionHandled,
} from "../../hooks/useManuals";
import { publicPhotoUrl } from "../../lib/storage";
import { searchManualesYFaq } from "../../lib/search";
import {
  BASE_CONOCIMIENTO,
  buscar,
  faqAEntrada,
  visiblePara,
  SUGERENCIAS_POR_ROL,
  esRespuestaClara,
  UMBRAL_RELACIONADA,
} from "../../lib/asistente/motor";
import { responderConDatos, type RespuestaDato } from "../../lib/asistente/consultas";
import { CATEGORIA_LABELS, type CategoriaKB, type EntradaKB } from "../../data/asistente/tipos";
import RegistrarFaqModal from "../../components/manuales/RegistrarFaqModal";
import { ROLE_LABELS, type Manual } from "../../types";

interface MensajeUsuario {
  id: string;
  de: "usuario";
  texto: string;
}

interface MensajeBot {
  id: string;
  de: "bot";
  tipo: "kb" | "dato" | "duda" | "nada" | "bienvenida";
  titulo?: string;
  texto: string;
  tabla?: RespuestaDato["tabla"];
  link?: { to: string; label: string };
  fuente?: string;
  relacionadas?: EntradaKB[];
  manuales?: Manual[];
  logId?: string | null;
  calificacion?: boolean;
}

type Mensaje = MensajeUsuario | MensajeBot;

const uid = () => crypto.randomUUID();

/** Pinta el texto respetando saltos de línea y viñetas "• ". */
function TextoFormateado({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  return (
    <div className="space-y-1">
      {lineas.map((l, i) =>
        l.startsWith("• ") ? (
          <div key={i} className="flex gap-2">
            <span className="text-gigante-red">•</span>
            <span>{l.slice(2)}</span>
          </div>
        ) : (
          <p key={i}>{l}</p>
        )
      )}
    </div>
  );
}

function BurbujaBot({
  m,
  onPreguntar,
  onCalificar,
}: {
  m: MensajeBot;
  onPreguntar: (e: EntradaKB) => void;
  onCalificar: (m: MensajeBot, util: boolean) => void;
}) {
  const esDato = m.tipo === "dato";
  return (
    <div className="flex gap-2 items-start">
      <div className="w-8 h-8 rounded-full bg-gigante-navy text-white flex items-center justify-center shrink-0">
        <Bot size={16} />
      </div>
      <div className="min-w-0 flex-1 max-w-[46rem]">
        <div className="bg-white border border-gigante-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gigante-navy">
          {m.titulo && (
            <p className="font-semibold mb-1.5 flex items-center gap-1.5">
              {esDato && <Database size={14} className="text-emerald-600" />}
              {m.titulo}
            </p>
          )}
          <TextoFormateado texto={m.texto} />

          {m.tabla && m.tabla.filas.length > 0 && (
            <div className="mt-3 overflow-x-auto border border-gigante-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gigante-bg text-gigante-muted">
                  <tr>
                    {m.tabla.columnas.map((c, i) => (
                      <th key={i} className="text-left font-medium px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.tabla.filas.map((f, i) => (
                    <tr key={i} className="border-t border-gigante-border">
                      {f.map((c, j) => (
                        <td key={j} className="px-2.5 py-1.5 align-top">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {m.manuales && m.manuales.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gigante-muted">Documentos que pueden ayudarte:</p>
              {m.manuales.map((doc) => {
                const url = publicPhotoUrl("manuales", doc.file_path);
                return (
                  <a
                    key={doc.id}
                    href={url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-gigante-red hover:underline"
                  >
                    <FileText size={12} /> {doc.title}
                  </a>
                );
              })}
            </div>
          )}

          {(m.link || m.fuente) && (
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              {m.link ? (
                <Link
                  to={m.link.to}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-navy rounded-lg px-3 py-1.5"
                >
                  <ExternalLink size={12} /> {m.link.label}
                </Link>
              ) : (
                <span />
              )}
              {m.fuente && (
                <span className="inline-flex items-center gap-1 text-[10px] text-gigante-muted">
                  {esDato ? <Database size={10} /> : <BookOpen size={10} />} {m.fuente}
                </span>
              )}
            </div>
          )}
        </div>

        {(m.tipo === "kb" || m.tipo === "dato") && m.logId && (
          <div className="flex items-center gap-2 mt-1 ml-1 text-[11px] text-gigante-muted">
            {m.calificacion === undefined ? (
              <>
                ¿Te sirvió?
                <button onClick={() => onCalificar(m, true)} className="hover:text-emerald-600" aria-label="Sí me sirvió">
                  <ThumbsUp size={13} />
                </button>
                <button onClick={() => onCalificar(m, false)} className="hover:text-gigante-red" aria-label="No me sirvió">
                  <ThumbsDown size={13} />
                </button>
              </>
            ) : m.calificacion ? (
              <span className="text-emerald-600">¡Gracias! 👍</span>
            ) : (
              <span>Gracias, se lo haré saber a Gerencia para mejorar la respuesta.</span>
            )}
          </div>
        )}

        {m.relacionadas && m.relacionadas.length > 0 && (
          <div className="mt-2 ml-1">
            <p className="text-[11px] text-gigante-muted mb-1">
              {m.tipo === "duda" ? "¿Quisiste decir...?" : "También te puede servir:"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {m.relacionadas.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onPreguntar(r)}
                  className="text-xs text-left rounded-full border border-gigante-border bg-white px-3 py-1 text-gigante-navy hover:border-gigante-navy"
                >
                  {r.pregunta}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreguntasPendientes({ onFaqCreada }: { onFaqCreada: () => void }) {
  const { questions, stats, loading, reload } = usePendingAssistantQuestions(true);
  const [creando, setCreando] = useState<{ id: string; pregunta: string } | null>(null);

  const pct = stats && stats.total > 0 ? Math.round((stats.respondidas / stats.total) * 100) : null;

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Preguntas (30 días)</p>
          <p className="text-xl font-bold text-gigante-navy">{stats?.total ?? "…"}</p>
        </div>
        <div className="bg-white border border-gigante-border rounded-xl p-4">
          <p className="text-xs text-gigante-muted">Contestadas por el asistente</p>
          <p className="text-xl font-bold text-gigante-navy">{pct === null ? "—" : `${pct}%`}</p>
        </div>
      </div>
      <p className="text-xs text-gigante-muted mt-3">
        Aquí aparecen las dudas reales del equipo que el asistente no supo contestar o cuya respuesta “no sirvió”. Crea la
        respuesta y desde ese momento el asistente ya la sabe.
      </p>
      <div className="mt-3 bg-white border border-gigante-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gigante-muted">Cargando...</p>
        ) : questions.length === 0 ? (
          <p className="p-6 text-sm text-gigante-muted">✅ No hay preguntas pendientes.</p>
        ) : (
          <ul className="divide-y divide-gigante-border">
            {questions.map((q) => (
              <li key={q.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gigante-navy">“{q.pregunta}”</p>
                  <p className="text-[11px] text-gigante-muted">
                    {q.role ? ROLE_LABELS[q.role] : "—"} · {new Date(q.created_at).toLocaleString("es-MX")} ·{" "}
                    {q.respondida ? "👎 la respuesta no le sirvió" : "sin respuesta"}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  <button
                    onClick={() => setCreando({ id: q.id, pregunta: q.pregunta })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-gigante-red rounded-lg px-2.5 py-1"
                  >
                    <Plus size={12} /> Crear respuesta
                  </button>
                  <button
                    onClick={async () => {
                      await markAssistantQuestionHandled(q.id);
                      reload();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-gigante-muted hover:text-gigante-navy"
                  >
                    <CheckCheck size={12} /> Ya está atendida
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creando && (
        <RegistrarFaqModal
          initialQuestion={creando.pregunta}
          onClose={() => setCreando(null)}
          onSuccess={async () => {
            await markAssistantQuestionHandled(creando.id);
            setCreando(null);
            reload();
            onFaqCreada();
          }}
        />
      )}
    </div>
  );
}

export default function Asistente() {
  const { profile } = useAuth();
  const { manuals } = useManuals();
  const { faqs, reload: reloadFaqs } = useFaqEntries();
  const [vista, setVista] = useState<"chat" | "explorar" | "pendientes">("chat");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [abierta, setAbierta] = useState<CategoriaKB | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const role = profile?.role ?? "ventas";
  const nombre = profile?.full_name?.split(" ")[0] ?? "";

  const bienvenida: MensajeBot = useMemo(
    () => ({
      id: "bienvenida",
      de: "bot",
      tipo: "bienvenida",
      texto:
        `¡Hola${nombre ? `, ${nombre}` : ""}! 👋 Soy el asistente de la sucursal. Puedo ayudarte con:\n` +
        "• Dudas de los manuales: horario, uniforme, vacaciones, permisos, incidencias, funciones de cada puesto.\n" +
        "• Cómo usar la página: ventas, retiros, repartos, inventario, etiquetas...\n" +
        "• Datos en vivo: cuánto hay de un producto, precios, qué se está acabando, repartos, incidencias, apartados, un folio (ej. V-1001).\n" +
        "Escríbeme con tus palabras o toca una sugerencia.",
    }),
    [nombre]
  );

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pensando]);

  const faqEntradas = useMemo(() => faqs.map(faqAEntrada), [faqs]);

  function respuestaDeEntrada(e: EntradaKB, extra?: Partial<MensajeBot>): MensajeBot {
    return {
      id: uid(),
      de: "bot",
      tipo: "kb",
      titulo: e.pregunta,
      texto: e.respuesta,
      link: e.link,
      fuente: e.fuente,
      ...extra,
    };
  }

  async function preguntar(pregunta: string, entradaDirecta?: EntradaKB) {
    const q = pregunta.trim();
    if (!q || !profile) return;
    setVista("chat");
    setMensajes((prev) => [...prev, { id: uid(), de: "usuario", texto: q }]);
    setTexto("");
    setPensando(true);

    let respuesta: MensajeBot;
    let respondida = true;
    let respuestaId: string | null = null;

    const todas = buscar(q, role, faqs);
    // Si lo que mejor contesta es una tarea de otra área, se dice así.
    const deOtraArea = !entradaDirecta && todas[0]?.oculta && esRespuestaClara(todas) ? todas[0].entrada : null;
    const coincidencias = todas.filter((c) => !c.oculta);

    if (entradaDirecta) {
      respuesta = respuestaDeEntrada(entradaDirecta, {
        relacionadas: coincidencias.filter((c) => c.entrada.id !== entradaDirecta.id && c.puntaje >= UMBRAL_RELACIONADA).slice(0, 3).map((c) => c.entrada),
      });
      respuestaId = entradaDirecta.id;
    } else {
      let dato: RespuestaDato | null = null;
      try {
        dato = await responderConDatos(q, role);
      } catch {
        dato = null;
      }
      if (!dato && deOtraArea) {
        respuesta = {
          id: uid(),
          de: "bot",
          tipo: "kb",
          titulo: deOtraArea.pregunta,
          texto: `Eso le corresponde a ${(deOtraArea.roles ?? []).map((r) => ROLE_LABELS[r]).join(" / ")}. Si lo necesitas, pídeselo a tu Gerente de sucursal.`,
          fuente: deOtraArea.fuente,
        };
        respuestaId = deOtraArea.id;
      } else if (dato) {
        respuesta = {
          id: uid(),
          de: "bot",
          tipo: "dato",
          ...dato,
          relacionadas: esRespuestaClara(coincidencias) ? [coincidencias[0].entrada] : [],
        };
        respuestaId = `dato:${dato.titulo}`;
      } else if (esRespuestaClara(coincidencias)) {
        const mejor = coincidencias[0].entrada;
        respuesta = respuestaDeEntrada(mejor, {
          relacionadas: coincidencias.slice(1).filter((c) => c.puntaje >= UMBRAL_RELACIONADA).slice(0, 3).map((c) => c.entrada),
        });
        respuestaId = mejor.id;
      } else if (coincidencias[0] && coincidencias[0].puntaje >= UMBRAL_RELACIONADA) {
        respondida = false;
        respuesta = {
          id: uid(),
          de: "bot",
          tipo: "duda",
          texto: "No estoy seguro de haber entendido. ¿Es alguna de estas?",
          relacionadas: coincidencias.slice(0, 4).map((c) => c.entrada),
        };
      } else {
        respondida = false;
        const docs = searchManualesYFaq(q, manuals, [], role)
          .filter((r) => r.type === "manual")
          .slice(0, 3)
          .map((r) => r.item as Manual);
        respuesta = {
          id: uid(),
          de: "bot",
          tipo: "nada",
          titulo: "No encontré una respuesta para eso 🤔",
          texto:
            "Intenta con otras palabras (por ejemplo: “vacaciones”, “uniforme”, “cuánto hay de piso gris”) o pregúntale a tu Gerente de sucursal.\nYa guardé tu pregunta para que Gerencia agregue la respuesta.",
          manuales: docs,
          link: { to: "/manuales", label: "Ver Manuales e Información" },
        };
      }
    }

    const logId = await logAssistantQuestion(q, respondida, respuestaId, role);
    setMensajes((prev) => [...prev, { ...respuesta, logId }]);
    setPensando(false);
  }

  async function calificar(m: MensajeBot, util: boolean) {
    setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, calificacion: util } : x)));
    if (m.logId) await rateAssistantAnswer(m.logId, util);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    preguntar(texto);
  }

  const porCategoria = useMemo(() => {
    const todas = [...BASE_CONOCIMIENTO, ...faqEntradas].filter((e) => visiblePara(e, role));
    const map = new Map<CategoriaKB, EntradaKB[]>();
    for (const e of todas) map.set(e.categoria, [...(map.get(e.categoria) ?? []), e]);
    return map;
  }, [faqEntradas, role]);

  if (!profile) return null;
  const isGerencia = profile.role === "gerencia";

  return (
    <div className="max-w-5xl flex flex-col" style={{ minHeight: "calc(100vh - 9rem)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gigante-navy flex items-center gap-2">
            <MessageCircle size={22} /> Asistente de Consulta
          </h1>
          <p className="text-sm text-gigante-muted mt-1">
            Resuelve tus dudas con los manuales de la sucursal y los datos del sistema.
          </p>
        </div>
        {vista === "chat" && mensajes.length > 0 && (
          <button
            onClick={() => setMensajes([])}
            className="inline-flex items-center gap-1.5 text-xs text-gigante-muted hover:text-gigante-navy border border-gigante-border rounded-lg px-3 py-1.5"
          >
            <RotateCcw size={13} /> Nueva conversación
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        {(
          [
            ["chat", "Chat"],
            ["explorar", "Todas las preguntas"],
            ...(isGerencia ? [["pendientes", "Preguntas sin respuesta"]] : []),
          ] as [typeof vista, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVista(key)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1.5 border ${
              vista === key ? "bg-gigante-navy text-white border-gigante-navy" : "border-gigante-border text-gigante-navy bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "chat" && (
        <>
          <div className="flex-1 mt-4 space-y-4">
            <BurbujaBot m={bienvenida} onPreguntar={(e) => preguntar(e.pregunta, e)} onCalificar={calificar} />
            {mensajes.length === 0 && (
              <div className="flex flex-wrap gap-2 ml-10">
                {SUGERENCIAS_POR_ROL[role].map((s) => (
                  <button
                    key={s}
                    onClick={() => preguntar(s)}
                    className="text-xs rounded-full border border-gigante-navy/30 bg-gigante-navy/5 px-3 py-1.5 text-gigante-navy hover:bg-gigante-navy hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {mensajes.map((m) =>
              m.de === "usuario" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-gigante-navy text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                    {m.texto}
                  </div>
                </div>
              ) : (
                <BurbujaBot key={m.id} m={m} onPreguntar={(e) => preguntar(e.pregunta, e)} onCalificar={calificar} />
              )
            )}
            {pensando && (
              <div className="flex gap-2 items-center ml-1 text-xs text-gigante-muted">
                <Bot size={14} /> Buscando...
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form onSubmit={onSubmit} className="sticky bottom-16 md:bottom-2 mt-4 flex gap-2 bg-gigante-bg py-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu pregunta... ej. ¿cuánto hay de piso gris? · ¿qué camisa me toca hoy?"
              className="flex-1 min-w-0 rounded-xl border border-gigante-border px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
            />
            <button
              type="submit"
              disabled={pensando || !texto.trim()}
              className="flex items-center gap-1.5 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4"
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </>
      )}

      {vista === "explorar" && (
        <div className="mt-4 space-y-2 max-w-3xl">
          {Array.from(porCategoria.entries()).map(([cat, entradas]) => (
            <div key={cat} className="bg-white border border-gigante-border rounded-xl overflow-hidden">
              <button
                onClick={() => setAbierta(abierta === cat ? null : cat)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-gigante-navy">
                  {CATEGORIA_LABELS[cat]} <span className="text-gigante-muted font-normal">({entradas.length})</span>
                </span>
                {abierta === cat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {abierta === cat && (
                <ul className="border-t border-gigante-border divide-y divide-gigante-border">
                  {entradas.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => preguntar(e.pregunta, e)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gigante-navy hover:bg-gigante-bg flex items-center gap-2"
                      >
                        <HelpCircle size={14} className="text-gigante-red shrink-0" /> {e.pregunta}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="text-[11px] text-gigante-muted pt-2">
            Las respuestas vienen del Manual de Bienvenida e Inducción, el Manual de Puestos y Funciones, la guía de uso de
            la página y las preguntas que registra Gerencia.
          </p>
        </div>
      )}

      {vista === "pendientes" && isGerencia && (
        <div className="mt-4">
          <PreguntasPendientes onFaqCreada={reloadFaqs} />
        </div>
      )}
    </div>
  );
}
