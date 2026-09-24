import type { AppRole } from "../types";

// ============================================================
// Capacitación Express
// ============================================================
// Lecciones cortas (2–3 min) para aprender a usar la página según
// el área de cada quien. Cada lección tiene: para qué sirve, los
// pasos, un tip, un botón para ir a practicar y UNA pregunta rápida.
// Al contestarla bien, la lección queda como aprendida y Gerencia
// puede ver el avance de todo el equipo.
//
// Para agregar o cambiar lecciones basta con editar esta lista
// (no hace falta tocar la base de datos). Si cambias el "key" de una
// lección, el avance guardado de esa lección se pierde.
// ============================================================

export interface Lesson {
  key: string;
  title: string;
  roles: AppRole[];
  minutos: number;
  path: string;
  paraQue: string;
  pasos: string[];
  tip?: string;
  pregunta: { texto: string; opciones: string[]; correcta: number; explicacion: string };
}

const TODOS: AppRole[] = ["gerencia", "ventas", "caja", "almacen", "reparto"];

export const LESSONS: Lesson[] = [
  // ---------------- Para todos ----------------
  {
    key: "general-navegar",
    title: "Tu primer recorrido por la página",
    roles: TODOS,
    minutos: 2,
    path: "/",
    paraQue:
      "Saber dónde está cada cosa. La página solo te muestra los módulos de tu área, así que lo que ves en el menú es justo lo que te toca.",
    pasos: [
      "En computadora, el menú está a la izquierda. En celular, abajo (toca “Más” para ver el resto de módulos).",
      "“Inicio” te da el resumen del día según tu puesto.",
      "Arriba a la derecha está tu nombre: ahí cierras sesión.",
      "El botón “Escanear” lee el código QR de una etiqueta y te abre la ficha del producto.",
    ],
    tip: "Si algo no aparece en tu menú, no es un error: es que tu puesto no lo usa.",
    pregunta: {
      texto: "No ves “Gastos” en tu menú. ¿Qué significa?",
      opciones: ["La página está fallando", "Tu puesto no tiene acceso a ese módulo", "Hay que recargar"],
      correcta: 1,
      explicacion: "Cada quien ve solo los módulos de su área.",
    },
  },
  {
    key: "general-campanita",
    title: "La campanita y el botón Reportar",
    roles: TODOS,
    minutos: 2,
    path: "/",
    paraQue:
      "La campanita te avisa lo importante: productos que se acaban, incidencias de reparto, apartados por vencer, cambios en ventas. “Reportar” sirve para avisar un problema a todos.",
    pasos: [
      "El número rojo en la campanita = avisos que no has leído.",
      "Toca un aviso para ir directo a lo que habla (un producto, un reparto, una venta).",
      "Si ves un problema (algo roto, faltante, cliente molesto), usa “Reportar” y escríbelo en una frase.",
    ],
    tip: "La campanita NO avisa cada venta a propósito, para que no se llene: solo avisa lo que necesita atención.",
    pregunta: {
      texto: "Viste 3 cajas rotas en el pasillo. ¿Qué haces en la página?",
      opciones: ["Nada, alguien más lo verá", "Usar el botón “Reportar”", "Esperar a que suene la campanita"],
      correcta: 1,
      explicacion: "“Reportar” le avisa a todos al instante.",
    },
  },
  {
    key: "general-asistente",
    title: "Resolver dudas sin interrumpir a nadie",
    roles: TODOS,
    minutos: 2,
    path: "/manuales",
    paraQue: "Encontrar horarios, funciones de tu puesto, políticas y respuestas a preguntas frecuentes.",
    pasos: [
      "En “Manuales e Información” están los manuales y las preguntas frecuentes de la empresa.",
      "En “Asistente de Consulta” escribe tu duda con tus palabras (ej. “cómo hago una devolución”).",
      "Si no encuentras la respuesta, pregúntale a tu jefe inmediato o al gerente.",
    ],
    pregunta: {
      texto: "¿Dónde buscas primero cuál es el horario de comida?",
      opciones: ["En Manuales / Asistente de Consulta", "En Inventario", "En Repartos"],
      correcta: 0,
      explicacion: "Las políticas y horarios están en Manuales y el Asistente.",
    },
  },

  // ---------------- Ventas ----------------
  {
    key: "ventas-semaforo",
    title: "El semáforo: ¿sí hay para vender?",
    roles: ["ventas", "gerencia", "almacen"],
    minutos: 2,
    path: "/inventario",
    paraQue: "Saber al momento si un producto tiene existencia antes de ofrecérselo al cliente.",
    pasos: [
      "🟢 Verde: hay suficiente.",
      "🟡 Amarillo: se está acabando. Confirma con almacén antes de prometer cantidades grandes.",
      "🔴 Rojo: ya no hay disponible. Ofrece otro producto parecido.",
      "“Disponible” = lo que hay en almacén MENOS lo que ya está apartado para otros clientes.",
      "En Inicio, la lista “Antes de vender, checa esto” te dice qué se está acabando hoy.",
    ],
    tip: "Si un producto en exhibición está en rojo, avisa a almacén para cambiar la muestra por otro que sí haya.",
    pregunta: {
      texto: "Un piso está en 🟡 amarillo y el cliente quiere 80 cajas. ¿Qué haces?",
      opciones: ["Lo vendo sin revisar", "Confirmo con almacén cuánto hay antes de prometer", "Le digo que no hay"],
      correcta: 1,
      explicacion: "Amarillo = quedan pocas; confirma antes de comprometerte.",
    },
  },
  {
    key: "ventas-nueva-venta",
    title: "Registrar una venta",
    roles: ["ventas", "gerencia"],
    minutos: 3,
    path: "/ventas",
    paraQue: "Dejar la venta en el sistema para que Caja cobre, Almacén aparte el material y Reparto lo entregue.",
    pasos: [
      "En “Ventas y Entregas” toca “Nueva venta”.",
      "Escribe el nombre del cliente y elige el tipo de entrega: se lo lleva ya, recoge en sucursal o a domicilio.",
      "Busca cada producto por código o nombre; a un lado ves el semáforo y cuánto hay disponible.",
      "Si una parte se la lleva hoy y otra se le entrega después, cambia el tipo de entrega de ESE producto.",
      "Registra la venta y dale al cliente su folio para pasar a Caja.",
    ],
    tip: "Usa la Calculadora para saber cuántas cajas necesita el cliente según sus m².",
    pregunta: {
      texto: "El cliente se lleva el monomando hoy y los pisos se los llevamos mañana. ¿Cómo lo registras?",
      opciones: [
        "Dos ventas separadas",
        "Una venta; el monomando “se lo lleva ya” y los pisos “a domicilio”",
        "Todo a domicilio",
      ],
      correcta: 1,
      explicacion: "Cada producto puede tener su propio tipo de entrega dentro de la misma venta.",
    },
  },
  {
    key: "ventas-cambio-producto",
    title: "Cambiar un producto en una venta ya hecha",
    roles: ["ventas", "gerencia"],
    minutos: 2,
    path: "/ventas",
    paraQue: "Cuando el cliente cambia de opinión (otro color, otro modelo) sin tener que cancelar toda la venta.",
    pasos: [
      "Abre la venta en “Ventas y Entregas” o en “Pedidos Pendientes”.",
      "En el producto a cambiar toca “Cambiar por otro producto”.",
      "Elige el producto nuevo, la cantidad y escribe el motivo.",
      "Revisa el total nuevo: si ya había pagado, la página te dice si Caja debe regresar dinero o cobrar la diferencia.",
    ],
    tip: "Solo se cambia lo que falta por entregar. Lo que el cliente ya se llevó se queda igual.",
    pregunta: {
      texto: "El cliente ya se llevó 10 de 30 cajas y quiere cambiar el resto. ¿Qué se cambia?",
      opciones: ["Las 30 cajas", "Solo las 20 que faltan", "No se puede cambiar"],
      correcta: 1,
      explicacion: "Lo ya entregado se queda; se cambia solo lo pendiente.",
    },
  },
  {
    key: "ventas-apartados",
    title: "Pedidos pendientes y apartados que vencen",
    roles: ["ventas", "gerencia", "almacen", "caja"],
    minutos: 2,
    path: "/pedidos",
    paraQue: "Ver qué pedidos siguen abiertos y cuáles están por vencer (el cliente tiene 1 mes para recoger o recibir).",
    pasos: [
      "Entra a “Pedidos Pendientes”.",
      "Arriba ves cuánto dinero en material falta entregar y cuánto ya se entregó.",
      "Usa los filtros “Vencidos” y “Por vencer” para saber a quién llamar hoy.",
      "Toca un pedido para ver su detalle, cambiar productos o (Gerencia) eliminarlo.",
    ],
    pregunta: {
      texto: "¿Cuánto tiempo tiene el cliente para recoger o recibir su material?",
      opciones: ["1 semana", "1 mes", "No hay límite"],
      correcta: 1,
      explicacion: "El plazo es de 1 mes; 5 días antes llega un aviso.",
    },
  },

  // ---------------- Caja ----------------
  {
    key: "caja-cobro",
    title: "Registrar el cobro en caja",
    roles: ["caja", "gerencia"],
    minutos: 2,
    path: "/ventas",
    paraQue: "Dejar registrado cuánto pagó el cliente al momento de la venta (total o anticipo).",
    pasos: [
      "El cliente llega con su folio. Búscalo en “Ventas y Entregas” y ábrelo.",
      "Toca “Registrar cobro en caja” y escribe cuánto pagó.",
      "Si pagó solo una parte, el resto queda “Pendiente de cobro” para la entrega.",
    ],
    tip: "Si una venta se modifica después de cobrada, te llega aviso a la campanita con la diferencia.",
    pregunta: {
      texto: "El total es $1,000 y el cliente deja $700. ¿Qué registras?",
      opciones: ["$1,000", "$700", "Nada hasta que pague todo"],
      correcta: 1,
      explicacion: "Se registra lo que realmente pagó; el resto queda pendiente.",
    },
  },
  {
    key: "caja-evidencias",
    title: "Confirmar cobros de reparto",
    roles: ["caja", "gerencia"],
    minutos: 2,
    path: "/evidencias-cobros",
    paraQue: "Cerrar cada reparto cuando el chofer te entrega el dinero que cobró.",
    pasos: [
      "Entra a “Evidencias y Cobros”.",
      "Revisa la foto de entrega, la firma y el monto que dice el chofer.",
      "Cuenta el dinero y confirma el cobro. Si no coincide, escríbelo en la nota.",
    ],
    pregunta: {
      texto: "¿Quién da la confirmación final de que el reparto y su cobro quedaron cerrados?",
      opciones: ["El chofer", "Caja", "Almacén"],
      correcta: 1,
      explicacion: "El chofer marca “entregado”, pero Caja confirma el cobro.",
    },
  },

  // ---------------- Almacén ----------------
  {
    key: "almacen-entradas",
    title: "Entradas, facturas y merma",
    roles: ["almacen", "gerencia"],
    minutos: 3,
    path: "/inventario",
    paraQue: "Que el sistema sepa exactamente qué entra y qué se daña.",
    pasos: [
      "Cuando llega mercancía con factura: “Registrar factura”, captura productos y sube foto de la factura.",
      "Entrada sin factura: “Registrar entrada”.",
      "Material roto o dañado: “Dar de baja”, con motivo y foto.",
    ],
    tip: "Captura en el momento: lo que se deja “para al rato” es lo que luego descuadra.",
    pregunta: {
      texto: "Se rompieron 2 cajas al descargar. ¿Qué registras?",
      opciones: ["Nada", "Dar de baja (merma) con foto", "Una venta"],
      correcta: 1,
      explicacion: "Lo dañado va como merma con evidencia.",
    },
  },
  {
    key: "almacen-exhibicion",
    title: "Material para exhibición",
    roles: ["almacen", "gerencia"],
    minutos: 2,
    path: "/inventario?tab=exhibicion",
    paraQue: "Registrar lo que sale de bodega para ponerse de muestra en la tienda, sin confundirlo con merma.",
    pasos: [
      "En Inventario toca “Exhibición” → “Sacar a la tienda”.",
      "Elige el producto, la cantidad y dónde se va a exhibir (ej. “Pared 3”). Puedes subir foto.",
      "Cuando se quite la muestra, en la pestaña “Exhibición” toca “Regresar” y vuelve a estar disponible.",
    ],
    tip: "Si en la pestaña Exhibición un producto sale en amarillo o rojo, conviene cambiar la muestra por uno que sí haya.",
    pregunta: {
      texto: "Sacas 1 caja de piso para ponerla de muestra. ¿Cómo la registras?",
      opciones: ["Como merma", "Como exhibición", "No se registra"],
      correcta: 1,
      explicacion: "Exhibición es distinto de merma: el material no se perdió y puede regresar.",
    },
  },
  {
    key: "almacen-conteo",
    title: "Conteo físico diario (adiós al descuadre)",
    roles: ["almacen", "gerencia"],
    minutos: 3,
    path: "/inventario?tab=conteos",
    paraQue: "Que lo que dice el sistema sea lo que de verdad hay, para que Ventas pueda confiar en él.",
    pasos: [
      "Cada día entra a Inventario → pestaña “Conteos físicos”.",
      "Ahí está la lista “Sugeridos para contar hoy” (unos 10 productos).",
      "Toca “Contar”, ve a bodega, cuenta y escribe lo que contaste. No te mostramos lo que dice el sistema, para que el conteo sea honesto.",
      "Si no cuadra, el sistema se corrige solo y le avisa a Gerencia.",
    ],
    tip: "La “Confiabilidad” de arriba es el % de conteos que cuadraron. La meta es 90% o más.",
    pregunta: {
      texto: "¿Por qué no te muestra lo que dice el sistema antes de contar?",
      opciones: ["Por un error", "Para contar “a ciegas” y no copiar el número", "Porque no importa"],
      correcta: 1,
      explicacion: "Contar a ciegas evita escribir el mismo número sin contar de verdad.",
    },
  },
  {
    key: "almacen-retiros",
    title: "Entregar en mostrador (retiros en sucursal)",
    roles: ["almacen", "ventas", "gerencia"],
    minutos: 2,
    path: "/retiros",
    paraQue: "Registrar cuando el cliente viene a recoger su material, aunque se lleve solo una parte.",
    pasos: [
      "Entra a “Retiros en Sucursal” y busca el folio del cliente.",
      "Toca “Confirmar retiro”. Por defecto se marca todo; baja la cantidad si solo se lleva una parte.",
      "Lo que falte queda pendiente para su siguiente visita.",
    ],
    pregunta: {
      texto: "El cliente compró 40 cajas y hoy se lleva 10. ¿Qué haces?",
      opciones: ["Confirmo las 40", "Confirmo 10 y quedan 30 pendientes", "Espero a que se lleve todo"],
      correcta: 1,
      explicacion: "Se confirma solo lo que se lleva; el resto queda pendiente.",
    },
  },

  // ---------------- Reparto ----------------
  {
    key: "reparto-entrega",
    title: "Entregar un reparto con evidencia",
    roles: ["reparto", "gerencia"],
    minutos: 3,
    path: "/repartos",
    paraQue: "Que cada entrega quede comprobada en la página (ya no por WhatsApp).",
    pasos: [
      "En “Repartos” abre el pedido que vas a entregar y márcalo “En camino”.",
      "Al llegar: toma foto del material entregado y pide la firma del cliente en la pantalla.",
      "Registra cuánto cobraste y cómo pagó. Marca “Entregado”.",
      "Si algo sale mal (no está el cliente, falta material), márcalo como “Incidencia” y explica.",
    ],
    tip: "El dinero que cobras se lo entregas a Caja; Caja confirma el cierre.",
    pregunta: {
      texto: "¿Dónde subes la foto de evidencia de la entrega?",
      opciones: ["Por WhatsApp al gerente", "En el reparto, dentro de la página", "No hace falta"],
      correcta: 1,
      explicacion: "La evidencia va en la página para que quede ligada al pedido.",
    },
  },

  // ---------------- Gerencia ----------------
  {
    key: "gerencia-gastos",
    title: "Gastos con comprobante",
    roles: ["gerencia"],
    minutos: 2,
    path: "/gastos",
    paraQue: "Llevar el control de los gastos de la sucursal con su ticket, en un solo lugar.",
    pasos: [
      "Entra a “Gastos” → “Registrar gasto”.",
      "Pon fecha, monto, en qué se gastó y la categoría. Sube foto del ticket o factura (obligatorio).",
      "Arriba ves el total del mes y cuánto se va en cada categoría. Toca una categoría para filtrar.",
    ],
    tip: "Los comprobantes son privados: solo Gerencia puede abrirlos.",
    pregunta: {
      texto: "¿Quién puede ver los comprobantes de gastos?",
      opciones: ["Todos", "Solo Gerencia", "Caja y Gerencia"],
      correcta: 1,
      explicacion: "El módulo de gastos es exclusivo de Gerencia.",
    },
  },
  {
    key: "gerencia-equipo",
    title: "Usuarios, puestos y avance de capacitación",
    roles: ["gerencia"],
    minutos: 2,
    path: "/administracion",
    paraQue: "Dar de alta al personal con el rol correcto y ver quién ya terminó su capacitación.",
    pasos: [
      "La cuenta (correo y contraseña) se crea en Supabase; luego en “Administración” le pones su nombre, rol (qué módulos ve) y puesto.",
      "En “Capacitación Express” → pestaña “Avance del equipo” ves qué lecciones terminó cada quien.",
      "A un empleado nuevo pídele que termine su capacitación en su primer día.",
    ],
    pregunta: {
      texto: "Entra un almacenista nuevo. ¿Qué rol le das?",
      opciones: ["Gerencia", "Almacén", "Ventas"],
      correcta: 1,
      explicacion: "El rol define qué módulos ve; dale solo el de su área.",
    },
  },
];

export function lessonsForRole(role: AppRole): Lesson[] {
  return LESSONS.filter((l) => l.roles.includes(role));
}
