import type { AppRole, NivelAlmacen } from "../types";

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
  /** Solo para rol Almacén: qué niveles la ven (jefe, auxiliar, almacenista). Sin esto la ven todos. */
  niveles?: NivelAlmacen[];
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
    paraQue:
      "Dejar la venta en el sistema. Primero pasa a Caja; cuando Caja la cobra, llega a Almacén para entregarla.",
    pasos: [
      "En “Ventas y Entregas” toca “Nueva venta”.",
      "Escribe el nombre del cliente y elige el tipo de entrega: se lo lleva ya, recoge en sucursal o a domicilio.",
      "Elige el método de pago: efectivo, tarjeta de débito o crédito, transferencia o “A meses” (ahí solo anotas los meses; Caja ve los intereses).",
      "Busca cada producto por código o nombre; a un lado ves el semáforo y cuánto hay disponible. Las cantidades pueden llevar decimales.",
      "Si una parte se la lleva hoy y otra se le entrega después, cambia el tipo de entrega de ESE producto.",
      "Registra la venta y manda al cliente a Caja con su folio. Almacén no la ve hasta que Caja cobre.",
    ],
    tip: "Usa la Calculadora para saber cuántas cajas necesita el cliente según sus m².",
    pregunta: {
      texto: "Registraste una venta y el cliente quiere que el almacén la prepare ya. ¿Qué falta?",
      opciones: [
        "Nada, almacén la ve de inmediato",
        "Que pase por Caja y Caja registre el pago",
        "Avisarle a Gerencia",
      ],
      correcta: 1,
      explicacion: "Toda venta pasa primero por Caja. Cuando Caja registra el pago, la venta llega a Almacén.",
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
    title: "Entregas pendientes y apartados que vencen",
    roles: ["ventas", "gerencia", "caja"],
    minutos: 2,
    path: "/por-programar",
    paraQue: "Ver qué ventas siguen sin entregarse, para cuándo están programadas y cuáles están por vencer (el cliente tiene 1 mes para recoger o recibir).",
    pasos: [
      "Entra a “Entregas por programar”. Tú solo la consultas: el día y la hora los asigna el Jefe de almacén.",
      "Usa “Sin fecha asignada”, “Ya programadas” y “A domicilio” para saber cuándo le toca a cada cliente.",
      "Usa el filtro “Apartado por vencer” para saber a quién llamar hoy.",
      "Toca el folio para ver el detalle, cambiar productos o (Gerencia) eliminarla.",
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
    title: "Cobrar y pasar la venta a almacén",
    roles: ["caja", "gerencia"],
    minutos: 3,
    path: "/ventas",
    paraQue:
      "Registrar cuánto pagó el cliente. Al hacerlo, la venta llega a Almacén (y, si es entrega inmediata, les suena el aviso para cargar).",
    pasos: [
      "En “Ventas y Entregas” entra al filtro “Esperando Caja” y busca la venta del cliente.",
      "Toca “Confirmar cobro” en esa fila.",
      "Escribe cuánto pagó (el total o un anticipo) y confirma el método de pago. Si es “A meses”, anota los meses.",
      "Toca “Confirmar cobro y pasar a almacén”.",
      "Excepción: si el cliente pagará todo al recibir en su domicilio, usa “Pasar a almacén sin cobro”. El chofer cobrará el total.",
      "Lo que falte por pagar queda como saldo: el chofer lo ve en su reparto para cobrarlo.",
      "Si te equivocaste en el monto: toca “Corregir cobro”, escribe el monto correcto y el motivo. Gerencia ve el cambio.",
    ],
    tip: "Corregir un cobro siempre pide el motivo; queda guardado el monto de antes y de después.",
    pregunta: {
      texto: "El total es $1,000, el cliente deja $700 y el resto lo paga al recibir. ¿Qué pasa al registrar $700?",
      opciones: [
        "La venta se queda en Caja hasta que pague todo",
        "La venta pasa a almacén y el chofer verá $300 por cobrar",
        "La venta se cancela",
      ],
      correcta: 1,
      explicacion: "Con un pago parcial la venta ya pasa a almacén, y el saldo se calcula solo para el chofer.",
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
      "Al confirmar, ese dinero baja el saldo de la venta y queda en “Cobranza y Corte” (como venta si fue el mismo día de la compra, o como cobranza si fue otro día).",
    ],
    pregunta: {
      texto: "¿Quién da la confirmación final de que el reparto y su cobro quedaron cerrados?",
      opciones: ["El chofer", "Caja", "Almacén"],
      correcta: 1,
      explicacion: "El chofer marca “entregado”, pero Caja confirma el cobro.",
    },
  },
  {
    key: "caja-cobranza",
    title: "Corte de caja: venta y cobranza",
    roles: ["caja", "gerencia"],
    minutos: 4,
    path: "/cobranza",
    paraQue:
      "Ver tu corte del día o de la semana con la venta y la cobranza ya separadas, revisar cobros de días anteriores y descargar todo en Excel.",
    pasos: [
      "Entra a “Cobranza y Corte”. Venta es lo que el cliente pagó el mismo día de su compra (en caja o al chofer). Cobranza es lo que pagó en un día posterior. El sistema lo separa solo por las fechas.",
      "En “Corte de caja” elige Hoy, Últimos 7 días, Esta semana, Este mes o tus propias fechas. Verás Venta, Cobranza y el total, por método de pago y por vendedor.",
      "Toca “Guardar corte” para dejarlo asentado. Si después corriges un pago de esos días, el corte te avisa que cambió.",
      "Toca “Descargar Excel” para bajar el corte (hojas RESUMEN, VENTAS y COBRANZA).",
      "En “Historial de cobros” busca por fecha, cliente, folio, factura o recibo. Ya no tienes que regresar a revisar los días anteriores.",
      "En “Por cobrar” ves lo que falta por cobrar (Apartados y Entregados). Toca “Registrar abono” cuando un cliente venga a pagar otra parte: se registra con su fecha y número de recibo. Cuando el saldo llega a cero, la cuenta sale sola de la lista.",
      "Si te equivocaste: en el Historial toca “Corregir” en ese pago, cambia lo que haga falta y escribe el motivo. Si el pago no existe, anúlalo. Todo queda en la bitácora.",
      "Para bajar tu Excel con el formato de siempre (TOTAL, mes, APARTADOS y ENTREGADOS), usa “Descargar en el formato de Caja” en “Por cobrar”.",
    ],
    tip: "El cobro que el chofer reportó entra al sistema cuando tú lo confirmas en “Evidencias y Cobros”: ahí baja el saldo de la venta.",
    pregunta: {
      texto: "El cliente compró el lunes, dejó $500 ese día y el martes trajo otros $300. ¿Cómo se clasifica cada pago?",
      opciones: [
        "Los dos son venta",
        "$500 es venta y $300 es cobranza",
        "Los dos son cobranza",
      ],
      correcta: 1,
      explicacion: "Lo que se paga el mismo día de la compra es venta; lo que se paga otro día es cobranza.",
    },
  },

  // ---------------- Almacén: para todos (jefe, auxiliar y almacenistas) ----------------
  {
    key: "almacen-escanear",
    title: "Escanear la etiqueta de un producto",
    roles: ["almacen", "gerencia"],
    minutos: 1,
    path: "/kardex",
    paraQue: "Llegar al producto en un segundo, sin escribir nada: solo apuntas la cámara al código QR de la etiqueta amarilla.",
    pasos: [
      "Arriba a la derecha toca “Escanear” y permite la cámara.",
      "Apunta al cuadro QR de la etiqueta amarilla del producto.",
      "Elige: “Abrir Kardex” (para anotar lo que sale) o “Ver inventario” (solo para ver).",
    ],
    tip: "Si el QR no lee, acércate un poco y que no le dé reflejo de luz.",
    pregunta: {
      texto: "Solo quieres ver cuántas piezas hay de un producto. ¿Qué eliges al escanear?",
      opciones: ["Abrir Kardex", "Ver inventario", "Reportar"],
      correcta: 1,
      explicacion: "“Ver inventario” solo te muestra el producto, sin tocar nada.",
    },
  },
  {
    key: "almacen-kardex",
    title: "Kardex: anota lo que sale de almacén",
    roles: ["almacen", "gerencia"],
    minutos: 2,
    path: "/kardex",
    paraQue: "Es la hoja blanca del Kardex, pero en la página. Cada vez que sacas material para cargarlo a la camioneta, lo anotas aquí y la existencia se actualiza sola.",
    pasos: [
      "En el menú azul entra a “Kardex” y busca el producto (por ID, código o nombre) o escanéalo.",
      "Abajo de la tabla está el renglón amarillo. En “Salida” escribe cuánto sacas.",
      "En el cuadro de abajo escribe el folio de la venta (ejemplo: V-1004) o el motivo.",
      "Toca “Guardar renglón”. Listo: la columna “Existencia” ya se actualizó.",
    ],
    tip: "No te deja sacar más de lo que hay. Si te sale un error rojo, léelo: dice qué falta.",
    pregunta: {
      texto: "Vas a cargar 5 cajas a la camioneta. ¿Qué escribes?",
      opciones: ["5 en “Entrada”", "5 en “Salida” y el folio de la venta", "Nada, se hace solo"],
      correcta: 1,
      explicacion: "Lo que sale va en “Salida” con el folio, para que cuadre con la venta.",
    },
  },
  {
    key: "almacen-ver",
    title: "Ver el inventario (sin modificar nada)",
    roles: ["almacen", "gerencia"],
    minutos: 2,
    path: "/inventario",
    paraQue: "Saber qué hay, cuánto hay y qué se está acabando.",
    pasos: [
      "Entra a “Inventario” y escribe en el buscador el ID, código o nombre.",
      "“Existencia física” es lo que hay en bodega. “Disponibles” es lo que se puede vender (ya sin lo apartado).",
      "El puntito de color te avisa: verde = hay suficiente, amarillo = se está acabando, rojo = se acabó.",
    ],
    tip: "El relojito de cada renglón abre el historial (Kardex) de ese producto.",
    pregunta: {
      texto: "El puntito de un producto está en rojo. ¿Qué significa?",
      opciones: ["Hay de sobra", "Se acabó", "Está en oferta"],
      correcta: 1,
      explicacion: "Rojo = ya no queda nada disponible para vender.",
    },
  },
  {
    key: "almacen-calculadora",
    title: "La calculadora de metros y cajas",
    roles: ["almacen", "gerencia"],
    minutos: 1,
    path: "/calculadora",
    paraQue: "Hacer cuentas de cajas, piezas y metros sin errores, por ejemplo al contar o preparar un pedido.",
    pasos: [
      "Entra a “Calculadora” y toca el botón “Almacén”.",
      "Escribe cuántos m² trae cada caja (viene en la etiqueta).",
      "Escribe las cajas y piezas sueltas que tienes. Te da el total en m².",
    ],
    pregunta: {
      texto: "Tienes 10 cajas y 3 piezas sueltas. ¿Cómo sacas el total en m²?",
      opciones: ["A ojo", "Con la calculadora, modo “Almacén”", "Preguntando al cliente"],
      correcta: 1,
      explicacion: "La calculadora suma cajas y piezas por ti.",
    },
  },

  // ---------------- Almacén: jefe y auxiliar ----------------
  {
    key: "almacen-entradas",
    title: "Registrar una entrada (llegó mercancía)",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 2,
    path: "/inventario",
    paraQue: "Que el sistema sepa cuánto material llegó.",
    pasos: [
      "En “Inventario” toca el botón rojo “Registrar entrada”.",
      "Elige el producto y escribe la cantidad que llegó.",
      "En referencia escribe de dónde viene (ejemplo: número de remisión). Toca guardar.",
    ],
    tip: "También puedes anotarla en el Kardex del producto, en la columna “Entrada”.",
    pregunta: {
      texto: "Llegó un camión con 20 cajas. ¿Dónde lo anotas?",
      opciones: ["En “Registrar entrada”", "En “Salida” del Kardex", "No se anota"],
      correcta: 0,
      explicacion: "Lo que llega es una entrada.",
    },
  },
  {
    key: "almacen-conteo",
    title: "Conteo físico: contar lo que de verdad hay",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 2,
    path: "/inventario?tab=conteos",
    paraQue: "Que lo que dice la página sea lo que hay en bodega.",
    pasos: [
      "En “Inventario” entra a la pestaña “Conteos físicos”.",
      "Toca “Contar” en uno de los productos sugeridos de hoy.",
      "Ve a bodega, cuenta y escribe lo que contaste. No te mostramos lo que dice el sistema, para que el conteo sea honesto.",
    ],
    tip: "Si no cuadra, el sistema se corrige solo y le avisa a Gerencia. No pasa nada: sirve para encontrar errores.",
    pregunta: {
      texto: "¿Por qué no te muestra lo que dice el sistema antes de contar?",
      opciones: ["Por un error", "Para que cuentes de verdad y no copies el número", "Porque no importa"],
      correcta: 1,
      explicacion: "Contar “a ciegas” evita escribir el mismo número sin contar.",
    },
  },
  {
    key: "almacen-exhibicion",
    title: "Exhibición: lo que hay debe estar en la tienda",
    roles: ["almacen", "ventas", "gerencia"],
    minutos: 2,
    path: "/inventario?tab=exhibicion",
    paraQue: "Que todo producto con existencia esté exhibido, y que lo que se acabó se quite.",
    pasos: [
      "En “Inventario” entra a la pestaña “Exhibición”. Ahí ves qué falta exhibir y qué hay que quitar.",
      "Cuando pongas un producto en la tienda: “Ya lo exhibí”, toma la foto y escribe dónde quedó.",
      "Cuando se acabe un producto exhibido, quítalo y toca “Ya lo quité”.",
      "Si eres Jefe de almacén: en “Por confirmar” revisa la foto de tus compañeros y confirma que sí sea cierto (o recházalo con el motivo).",
    ],
    tip: "Gerencia o el Jefe de almacén revisan tu foto. Si la rechazan, te llega el motivo a la campanita. Nadie confirma su propio registro.",
    pregunta: {
      texto: "Un producto exhibido se quedó sin existencia. ¿Qué haces?",
      opciones: ["Lo dejo en la tienda", "Lo quito y toco “Ya lo quité”", "Lo marco como dañado"],
      correcta: 1,
      explicacion: "Lo que ya no hay se quita de la tienda y queda registrado.",
    },
  },
  {
    key: "almacen-programar",
    title: "Programar entregas: día y hora",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 3,
    path: "/por-programar",
    paraQue: "Asignar día y hora aproximada a las ventas que Caja ya pasó a almacén, y moverlas cuando algo cambie.",
    pasos: [
      "Abre “Entregas por programar”. Te suena la campanita cuando llega una venta nueva.",
      "En “Sin fecha asignada” toca “Asignar día y hora” y elige el día y la hora aproximada.",
      "Cada venta muestra lo que el chofer debe cobrar: si ya está pagada dice “nada que cobrar”.",
      "Si el cliente pidió material que no hay en almacén, toca “Esperando proveedor” y anota qué se pidió. Cuando llegue, toca “Ya llegó el material”.",
      "Para cambiar un día u hora, toca “Cambiar día/hora” y escribe el motivo: queda guardado en el historial.",
      "Usa “Lista por día” o “Semana” para ver cómo viene la carga de entregas.",
    ],
    tip: "Las entregas atrasadas salen en rojo con la palabra “Atrasada”.",
    pregunta: {
      texto: "Vas a mover una entrega de martes a jueves. ¿Qué te pide el sistema?",
      opciones: ["Nada, solo guardas", "El motivo del cambio", "Autorización de Caja"],
      correcta: 1,
      explicacion: "Todo cambio de fecha u hora lleva un motivo, y queda en el historial.",
    },
  },
  {
    key: "almacen-entregas-hoy",
    title: "Entregas de hoy: qué toca preparar",
    roles: ["almacen"],
    minutos: 1,
    path: "/entregas-hoy",
    paraQue: "Ver solo lo que toca hoy: lo inmediato primero, y después lo que el Jefe de almacén programó.",
    pasos: [
      "Abre “Entregas de hoy” en el menú.",
      "Arriba, en rojo, está lo de entrega inmediata: es lo primero que se carga.",
      "Abajo ves lo que el Jefe programó para hoy (y si algo quedó atrasado) con el material de cada pedido.",
      "El día y la hora de cada entrega los asigna el Jefe de almacén; tú no tienes que programar nada.",
    ],
    tip: "La pantalla se actualiza sola cada medio minuto y te suena el aviso cuando entra una venta inmediata.",
    pregunta: {
      texto: "Entra una venta de entrega inmediata mientras preparas un pedido programado. ¿Qué atiendes primero?",
      opciones: ["El pedido programado", "La entrega inmediata, porque el cliente está esperando", "Ninguno hasta que el jefe diga"],
      correcta: 1,
      explicacion: "Lo inmediato va hasta arriba porque el cliente se lleva el material ahora.",
    },
  },
  {
    key: "almacen-inmediata",
    title: "Entrega inmediata: cargar y confirmar",
    roles: ["almacen", "gerencia"],
    minutos: 2,
    path: "/entregas-hoy",
    paraQue: "Cuando el cliente se lleva el material hoy, cargarlo y dejar el descuento en el Kardex.",
    pasos: [
      "Cuando Caja cobra una entrega inmediata, suena la campanita: toca el aviso para abrir “Entregas de hoy”.",
      "Lo inmediato sale hasta arriba, en rojo: ahí ves qué material hay que buscar y cargar.",
      "Ya cargado, toca “Ya lo cargué”. Puedes confirmar solo una parte si no se llevó todo.",
      "Al confirmar, el material se descuenta del inventario y queda en el Kardex.",
    ],
    tip: "Hasta que no confirmes la carga, el material sigue contando como apartado en almacén.",
    pregunta: {
      texto: "¿Cuándo se descuenta del inventario una entrega inmediata?",
      opciones: ["Cuando Ventas registra la venta", "Cuando almacén confirma la carga", "Cuando Caja cobra"],
      correcta: 1,
      explicacion: "El descuento se hace al confirmar la carga, para que el Kardex refleje lo que de verdad salió.",
    },
  },
  {
    key: "ventas-traslado-responder",
    title: "Responder cuando una sucursal pide material",
    roles: ["ventas", "gerencia"],
    minutos: 2,
    path: "/traslados",
    paraQue: "Avisar a almacén si ya vendiste o prometiste material que otra sucursal está pidiendo, para no quedar mal con tu cliente.",
    pasos: [
      "Cuando una sucursal pide material suena la campanita: toca el aviso para abrir “Traslados a sucursales”.",
      "Abre la solicitud y toca “Responder”.",
      "Elige “Ya vendí”, “Ya comprometí” o “No tengo nada comprometido”, y escribe cuánto.",
      "Anota solo lo que todavía NO registraste como venta en el sistema: lo ya registrado se descuenta solo.",
      "Puedes cambiar tu respuesta mientras la solicitud siga abierta.",
    ],
    tip: "Contestar aunque no tengas nada (“No tengo nada comprometido”) le ahorra a almacén esperar.",
    pregunta: {
      texto: "Ya registraste la venta de 20 cajas en el sistema. Una sucursal pide ese material. ¿Qué respondes?",
      opciones: [
        "Ya vendí 20 cajas",
        "No tengo nada comprometido (esas 20 ya están apartadas en el sistema)",
        "Nada, no es mi problema",
      ],
      correcta: 1,
      explicacion: "Lo ya registrado se descuenta solo del disponible; contarlo otra vez lo restaría doble.",
    },
  },
  {
    key: "almacen-traslados",
    title: "Traslados a otras sucursales",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 3,
    path: "/traslados",
    paraQue: "Mandar material a otra sucursal sin descuadrar el inventario ni quitarle a un cliente lo que ya se vendió.",
    pasos: [
      "Si una sucursal te pide material, toca “Nueva solicitud”: elige sucursal, producto y cantidad. Les llega un aviso a los vendedores.",
      "Los vendedores responden si ya vendieron o comprometieron algo. En la tarjeta ves Existencia, Apartado, Comprometido y lo que queda “Libre para trasladar”.",
      "Cuando vayas a enviar, toca “Enviar traslado”, confirma la cantidad y, si quieres, agrega una foto.",
      "El traslado sale del inventario y queda en el Kardex como “Traslado a …”.",
      "Si ya no se necesita, “Cancelar solicitud” con un motivo. Para un envío sin solicitud previa usa “Traslado directo”.",
    ],
    tip: "El sistema no te deja enviar más de lo disponible (lo apartado en ventas no cuenta).",
    pregunta: {
      texto: "Hay 200 en existencia, 20 apartados en ventas y los vendedores comprometieron 30. ¿Cuánto queda libre para trasladar?",
      opciones: ["200", "180", "150"],
      correcta: 2,
      explicacion: "200 − 20 apartados − 30 comprometidos = 150.",
    },
  },
  {
    key: "almacen-foto-kardex",
    title: "Foto de apoyo en el Kardex",
    roles: ["almacen", "gerencia", "reparto"],
    minutos: 2,
    path: "/kardex",
    paraQue: "Dejar como prueba la foto de la factura, remisión o del material junto al renglón del Kardex.",
    pasos: [
      "En el Kardex del producto, al anotar una entrada o salida, toca “Foto de apoyo (opcional)” y toma o elige la foto.",
      "Guarda el renglón: la foto queda pegada a él (se comprime sola para no gastar espacio).",
      "Si olvidaste la foto, en el renglón toca “+ Agregar foto”. Solo se puede agregar si no tenía una.",
      "Para verla toca “Ver foto de apoyo”. La pueden subir y ver Gerencia, todo almacén y los choferes.",
    ],
    pregunta: {
      texto: "Guardaste una entrada sin foto. ¿Qué haces?",
      opciones: ["Nada, ya no se puede", "En ese renglón tocas “+ Agregar foto”", "Anulas el renglón y lo capturas otra vez"],
      correcta: 1,
      explicacion: "Un renglón sin foto permite agregarla después; una vez puesta, ya no se cambia.",
    },
  },
  {
    key: "combustible-registrar",
    title: "Registrar una carga de combustible",
    roles: ["reparto", "almacen", "gerencia"],
    minutos: 2,
    path: "/combustible",
    paraQue: "Llevar la bitácora de gasolina (vehículos) y del montacargas con la foto del ticket y del tablero.",
    pasos: [
      "Entra a “Combustible y montacargas”. Reparto registra vehículos y Almacén registra el montacargas.",
      "Escribe la unidad (placas, número o nombre; si ya la usaste, te la sugiere), los litros y el importe.",
      "Escribe el kilometraje (vehículo) o las horas (montacargas) que marca el tablero.",
      "Toma la foto del ticket y la del tablero y toca “Registrar carga”.",
      "Si te equivocas de capturista, avisa a Gerencia: solo ella puede anular un registro.",
    ],
    tip: "El sistema no deja capturar un kilometraje menor al último de esa unidad: si te marca error, revisa el tablero.",
    pregunta: {
      texto: "Cargaste gasolina y el sistema dice que tu kilometraje es menor al último registro. ¿Qué haces?",
      opciones: ["Cambias el número hasta que lo acepte", "Revisas el tablero y la unidad que elegiste", "Dejas de registrar"],
      correcta: 1,
      explicacion: "Puede ser un error de captura o que elegiste otra unidad; la bitácora solo sirve si los números son reales.",
    },
  },
  {
    key: "ventas-cotizaciones",
    title: "Hacer una cotización y convertirla en venta",
    roles: ["ventas", "gerencia"],
    minutos: 2,
    path: "/cotizaciones",
    paraQue: "Darle al cliente un presupuesto por escrito sin apartar material, y registrarlo como venta si decide comprar.",
    pasos: [
      "En “Cotizaciones” toca “Nueva cotización”, escribe el cliente y los productos (precio público o promoción).",
      "Elige la vigencia en días y, si quieres, una nota para el cliente.",
      "Toca “Imprimir” para entregársela (también puedes guardarla como PDF desde el diálogo de impresión).",
      "Si el cliente compra, toca “Convertir en venta”: se llena sola la venta; completa entrega, documento y pago, y regístrala.",
      "Si ya no compra, “Cancelar” con un motivo.",
    ],
    tip: "Una cotización NO aparta el material ni baja el inventario; hasta que se convierte en venta, el disponible sigue siendo de todos.",
    pregunta: {
      texto: "Hiciste una cotización de 100 cajas. ¿Esas cajas quedan apartadas para el cliente?",
      opciones: ["Sí, desde que la creas", "No, hasta que se convierte en venta", "Solo si Caja la cobra"],
      correcta: 1,
      explicacion: "La cotización es solo un presupuesto; el material se aparta al registrar la venta.",
    },
  },
  {
    key: "almacen-retiros",
    title: "Entregar en mostrador (retiros en sucursal)",
    roles: ["almacen", "ventas", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 2,
    path: "/retiros",
    paraQue: "Anotar cuando el cliente viene a recoger su material, aunque se lleve solo una parte.",
    pasos: [
      "Entra a “Retiros en Sucursal” y busca el folio del cliente.",
      "Toca “Confirmar retiro”. Baja la cantidad si solo se lleva una parte.",
      "Lo que falte queda pendiente para su siguiente visita.",
    ],
    pregunta: {
      texto: "El cliente compró 40 cajas y hoy se lleva 10. ¿Qué confirmas?",
      opciones: ["Las 40", "Solo 10, y quedan 30 pendientes", "Ninguna"],
      correcta: 1,
      explicacion: "Se confirma solo lo que se lleva.",
    },
  },
  {
    key: "almacen-etiqueta",
    title: "Imprimir la etiqueta amarilla",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe", "auxiliar"],
    minutos: 2,
    path: "/kardex",
    paraQue: "Sacar una etiqueta nueva de un producto, ya con sus datos y su código QR, sin escribirla a mano.",
    pasos: [
      "Entra a “Kardex”, busca el producto y toca “Etiqueta amarilla”.",
      "El ID, la descripción, el código, la marca y “Se vende por” ya vienen llenos. Elige el “Tipo de producto” (piso, bulto, pieza, rollo u otro): los renglones cambian solos y puedes renombrarlos, llenarlos, quitarlos o agregar otro.",
      "Elige cuántas copias quieres. Si vas a usar la hoja amarilla, deja apagado “Imprimir fondo amarillo”.",
      "Toca “Imprimir”, mete la hoja amarilla en la impresora y listo.",
    ],
    pregunta: {
      texto: "Vas a imprimir en hoja amarilla. ¿Qué haces con “Imprimir fondo amarillo”?",
      opciones: ["Lo dejo apagado", "Lo prendo", "Da igual"],
      correcta: 0,
      explicacion: "La hoja ya es amarilla; si lo prendes, gastas tinta.",
    },
  },

  // ---------------- Almacén: solo jefe ----------------
  {
    key: "almacen-facturas",
    title: "Registrar una factura de compra",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe"],
    minutos: 2,
    path: "/inventario",
    paraQue: "Dejar guardada la factura del proveedor junto con lo que llegó.",
    pasos: [
      "En “Inventario” toca “Registrar factura”.",
      "Captura los productos y las cantidades que vienen en la factura.",
      "Sube la foto de la factura y guarda.",
    ],
    tip: "Hazlo en el momento de recibir; lo que se deja para después es lo que luego no cuadra.",
    pregunta: {
      texto: "¿Quién registra las facturas de compra?",
      opciones: ["El jefe de almacén", "Cualquiera", "El chofer"],
      correcta: 0,
      explicacion: "Es una tarea del jefe de almacén (y Gerencia).",
    },
  },
  {
    key: "almacen-baja",
    title: "Dar de baja material dañado",
    roles: ["almacen", "gerencia"],
    niveles: ["jefe"],
    minutos: 2,
    path: "/inventario",
    paraQue: "Quitar del sistema el material que se rompió o ya no sirve.",
    pasos: [
      "Cuando el auxiliar reporta un incidente, te llega un aviso a la campanita. Revisa qué pasó.",
      "En “Inventario” toca “Dar de baja”, elige el producto y la cantidad.",
      "Escribe el motivo y guarda. Queda registrado quién lo dio de baja.",
    ],
    tip: "Solo el jefe de almacén y Gerencia dan de baja. Los demás reportan.",
    pregunta: {
      texto: "Se rompieron 2 cajas. ¿Quién las da de baja en el sistema?",
      opciones: ["El almacenista", "El jefe de almacén o Gerencia", "Caja"],
      correcta: 1,
      explicacion: "El resto del equipo reporta; la baja la hace el jefe o Gerencia.",
    },
  },

  // ---------------- Almacén: solo auxiliar ----------------
  {
    key: "almacen-incidente",
    title: "Reportar material dañado",
    roles: ["almacen", "gerencia"],
    niveles: ["auxiliar"],
    minutos: 1,
    path: "/inventario",
    paraQue: "Avisarle al jefe de almacén y a Gerencia cuando algo se rompió o no está bien.",
    pasos: [
      "En “Inventario” toca “Reportar incidente”.",
      "Elige el producto, la cantidad y escribe qué pasó.",
      "Toca enviar. Le llega al jefe de almacén y a Gerencia; ellos hacen la baja.",
    ],
    tip: "Tú no das de baja: solo avisas. Entre más claro escribas qué pasó, mejor.",
    pregunta: {
      texto: "Se cayó una caja y se rompió. ¿Qué haces en la página?",
      opciones: ["“Dar de baja”", "“Reportar incidente”", "Nada"],
      correcta: 1,
      explicacion: "El auxiliar reporta; el jefe o Gerencia hacen la baja.",
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

  {
    key: "reparto-incidencia",
    title: "Si no pudiste entregar",
    roles: ["reparto", "gerencia"],
    minutos: 1,
    path: "/repartos",
    paraQue: "Avisar cuando una entrega no se pudo hacer, para que no se pierda el pedido.",
    pasos: [
      "Abre el pedido en “Repartos”.",
      "Cambia el estado a “Incidencia”.",
      "En notas escribe qué pasó (no estaba el cliente, faltó material, etc.) y guarda.",
    ],
    pregunta: {
      texto: "Llegaste y no había nadie. ¿Qué haces?",
      opciones: ["Marco “Entregado”", "Marco “Incidencia” y escribo qué pasó", "No hago nada"],
      correcta: 1,
      explicacion: "Nunca marques entregado algo que no se entregó.",
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

/** Lecciones de una persona: por rol y, en Almacén, por nivel (jefe, auxiliar, almacenista). */
export function lessonsForRole(role: AppRole, nivel?: NivelAlmacen | null): Lesson[] {
  return LESSONS.filter((l) => {
    if (!l.roles.includes(role)) return false;
    if (role === "almacen" && l.niveles) return l.niveles.includes(nivel ?? "jefe");
    return true;
  });
}
