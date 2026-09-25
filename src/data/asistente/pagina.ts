import { FUENTE_PAGINA as FP, type EntradaKB } from "./tipos";

// ============================================================
// Cómo usar la página + glosario. Si cambia una pantalla, actualiza
// aquí la respuesta para que el asistente no dé pasos viejos.
// ============================================================

export const KB_PAGINA: EntradaKB[] = [
  {
    id: "pag-nueva-venta",
    categoria: "pagina",
    pregunta: "¿Cómo registro una venta en la página?",
    variantes: ["como hago una venta", "capturar venta", "nueva venta"],
    claves: ["registrar", "venta", "nueva", "capturar", "vender"],
    respuesta:
      "• Ve a “Ventas y Entregas” → “Nueva venta”.\n" +
      "• Escribe el cliente y el tipo de entrega: se lo lleva ya, recoge en sucursal o a domicilio.\n" +
      "• Busca cada producto por código o nombre: verás su semáforo y cuánto hay disponible.\n" +
      "• Si una parte se la lleva hoy y otra se le entrega después, cambia el tipo de entrega de ESE producto.\n" +
      "• Registra y dale el folio al cliente para pasar a Caja.",
    roles: ["gerencia", "ventas"],
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FP,
  },
  {
    id: "pag-cambiar-producto",
    categoria: "pagina",
    pregunta: "¿Cómo cambio un producto de una venta que ya se hizo?",
    variantes: ["el cliente quiere otro color", "cambiar producto de la venta", "modificar venta"],
    claves: ["cambiar", "cambio", "producto", "modificar", "venta", "color", "otro"],
    respuesta:
      "Abre la venta (en Ventas o en Pedidos Pendientes) → en el producto toca “Cambiar por otro producto” → elige el nuevo, la cantidad y el motivo. Solo se cambia lo que falta por entregar; se recalcula el total y, si ya había pagado, Caja recibe aviso de cuánto regresar o cobrar.",
    roles: ["gerencia", "ventas"],
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FP,
  },
  {
    id: "pag-eliminar-venta",
    categoria: "pagina",
    pregunta: "¿Cómo cancelo o elimino una venta?",
    variantes: ["borrar venta", "cancelar pedido", "venta capturada mal", "como cancelo una venta", "cancelar venta"],
    claves: ["eliminar", "cancelar", "borrar", "venta", "error", "captura"],
    respuesta:
      "Solo Gerencia puede: abre la venta → “Eliminar esta venta” y escribe el motivo. Se permite solo si no se ha entregado nada, ningún reparto va en camino y Caja no tiene cobro (si ya cobró, primero se corrige el cobro a $0 y se regresa el dinero). Si el cliente solo quiere cambiar algo, mejor usa “Cambiar por otro producto”.",
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FP,
  },
  {
    id: "pag-cobro-caja",
    categoria: "pagina",
    pregunta: "¿Cómo registro el cobro en Caja?",
    variantes: ["el cliente ya pago", "registrar anticipo", "pago parcial"],
    claves: ["cobro", "cobrar", "pago", "pago", "anticipo", "caja", "registrar"],
    respuesta:
      "En “Ventas y Entregas” abre la venta con el folio del cliente → “Registrar cobro en caja” → escribe cuánto pagó. Si dejó solo un anticipo, lo que falta queda como “Pendiente de cobro” (por ejemplo, para cobrarse en la entrega).",
    roles: ["gerencia", "caja"],
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FP,
  },
  {
    id: "pag-retiro",
    categoria: "pagina",
    pregunta: "¿Cómo registro que el cliente recogió su material en la sucursal?",
    variantes: ["cliente viene a recoger", "retiro parcial", "se lleva una parte"],
    claves: ["recoger", "recogio", "retiro", "retiros", "sucursal", "parcial", "mostrador"],
    respuesta:
      "En “Retiros en Sucursal” busca el folio → “Confirmar retiro”. Por defecto marca todo lo pendiente; baja la cantidad si solo se lleva una parte y el resto queda para su siguiente visita.",
    roles: ["gerencia", "ventas", "almacen"],
    link: { to: "/retiros", label: "Ir a Retiros" },
    fuente: FP,
  },
  {
    id: "pag-reparto",
    categoria: "pagina",
    pregunta: "¿Cómo entrego un reparto en la página (foto, firma y cobro)?",
    variantes: ["como marco entregado", "subir evidencia de entrega", "firma del cliente"],
    claves: ["reparto", "entregado", "evidencia", "foto", "firma", "entrega", "marcar"],
    respuesta:
      "En “Repartos” abre el pedido → márcalo “En camino” al salir. Al entregar: toma foto del material, pide la firma del cliente en la pantalla, registra cuánto cobraste y el método de pago, y marca “Entregado”. Ya no se manda por WhatsApp: todo queda ligado al pedido.",
    roles: ["gerencia", "reparto"],
    link: { to: "/repartos", label: "Ir a Repartos" },
    fuente: FP,
  },
  {
    id: "pag-incidencia-reparto",
    categoria: "pagina",
    pregunta: "¿Cómo reporto un problema en una entrega (incidencia de reparto)?",
    variantes: ["no estaba el cliente", "cliente rechazo material", "problema en la entrega"],
    claves: ["incidencia", "reparto", "problema", "entrega", "rechazo", "cliente", "reportar"],
    respuesta:
      "Abre el reparto y cambia su estado a “Incidencia” explicando qué pasó (no estaba el cliente, rechazó material, faltó algo, falla de la unidad...). Le llega aviso a todos en la campanita. Avísale también al Jefe de Almacén.",
    link: { to: "/repartos", label: "Ir a Repartos" },
    fuente: FP,
  },
  {
    id: "pag-evidencias",
    categoria: "pagina",
    pregunta: "¿Cómo confirma Caja el cobro de un reparto?",
    claves: ["confirmar", "cobro", "reparto", "evidencias", "caja"],
    respuesta:
      "En “Evidencias y Cobros” revisa la foto, la firma y el monto que registró el chofer; cuenta el dinero que te entrega y confirma el cobro. Si no coincide, escríbelo en la nota.",
    roles: ["gerencia", "caja"],
    link: { to: "/evidencias-cobros", label: "Ir a Evidencias y Cobros" },
    fuente: FP,
  },
  {
    id: "pag-entradas",
    categoria: "pagina",
    pregunta: "¿Cómo registro mercancía que llegó (factura o entrada)?",
    variantes: ["llego un proveedor", "capturar factura", "entrada de mercancia"],
    claves: ["entrada", "factura", "proveedor", "llego", "recepcion", "mercancia", "registrar"],
    respuesta:
      "En Inventario: si viene con factura, “Registrar factura” (captura productos y sube foto de la factura); si no, “Registrar entrada”. Captúralo en el momento: lo que se deja para después es lo que luego descuadra.",
    roles: ["gerencia", "almacen"],
    link: { to: "/inventario", label: "Ir a Inventario" },
    fuente: FP,
  },
  {
    id: "pag-exhibicion",
    categoria: "pagina",
    pregunta: "¿Cómo funciona la exhibición de productos?",
    variantes: ["ya exhibi un producto", "poner de muestra en la tienda", "quitar de exhibicion", "auditoria de exhibicion"],
    claves: ["exhibicion", "exhibir", "exhibido", "muestra", "tienda", "quitar", "auditoria"],
    respuesta:
      "Regla del Gerente: todo lo que tiene existencia debe estar exhibido y lo que se acabó se quita de la tienda.\n" +
      "• En Inventario → pestaña “Exhibición” ves lo que falta exhibir, lo que hay que quitar y lo que está por confirmar.\n" +
      "• Cuando coloques un producto: “Ya lo exhibí” → foto (obligatoria), dónde quedó, cómo es la muestra y cuánto material tomaste del almacén.\n" +
      "• Cuando lo quites: “Ya lo quité” (y cuánto material regresa).\n" +
      "• Gerencia revisa la foto y confirma o rechaza. Todo queda en el historial para auditoría.\n" +
      "• Si un producto exhibido se acaba, o llega mercancía de uno sin exhibir, a todos les llega aviso en la campanita.",
    link: { to: "/inventario?tab=exhibicion", label: "Ir a Exhibición" },
    fuente: FP,
  },
  {
    id: "pag-conteo",
    categoria: "pagina",
    pregunta: "¿Cómo hago un conteo físico de inventario?",
    variantes: ["contar inventario", "inventario ciclico", "corregir existencia"],
    claves: ["conteo", "contar", "fisico", "inventario", "ciclico", "corregir", "existencia"],
    respuesta:
      "Inventario → pestaña “Conteos físicos”. Ahí está la lista “Sugeridos para contar hoy”: toca “Contar”, ve a bodega, cuenta y escribe lo que hay (no se muestra lo que dice el sistema, para contar a ciegas). Si no cuadra, se corrige solo y Gerencia recibe aviso. La meta de “Confiabilidad” es 90% o más.",
    roles: ["gerencia", "almacen"],
    link: { to: "/inventario?tab=conteos", label: "Ir a Conteos" },
    fuente: FP,
  },
  {
    id: "pag-semaforo",
    categoria: "pagina",
    pregunta: "¿Qué significan los colores del semáforo de inventario?",
    variantes: ["punto amarillo", "punto rojo", "que es el semaforo"],
    claves: ["semaforo", "colores", "verde", "amarillo", "rojo", "punto"],
    respuesta:
      "• 🟢 Verde: hay suficiente.\n" +
      "• 🟡 Amarillo: se está acabando (llegó a su mínimo). Confirma con Almacén antes de prometer cantidades grandes.\n" +
      "• 🔴 Rojo: ya no hay disponible para vender.\n" +
      "“Disponible” = existencia en almacén menos lo apartado para otros clientes. El mínimo de cada producto lo ponen Gerencia o Almacén.",
    link: { to: "/inventario", label: "Ir a Inventario" },
    fuente: FP,
  },
  {
    id: "pag-apartados",
    categoria: "pagina",
    pregunta: "¿Cuánto tiempo tiene el cliente para recoger su material? (apartados)",
    variantes: ["vence el apartado", "cliente no ha recogido", "plazo para recoger"],
    claves: ["apartado", "apartados", "vence", "vencido", "plazo", "recoger", "mes"],
    respuesta:
      "El cliente tiene 1 mes desde que compra para recoger o recibir su material. 5 días antes llega aviso a la campanita y otro cuando ya venció. No se cancela solo: Gerencia decide si se le llama, se le da más tiempo o se elimina la venta. Pregúntame “¿qué apartados están vencidos?” para ver la lista.",
    link: { to: "/pedidos", label: "Ir a Pedidos Pendientes" },
    fuente: FP,
  },
  {
    id: "pag-etiquetas",
    categoria: "pagina",
    pregunta: "¿Cómo hago etiquetas de precio con código QR?",
    variantes: ["como imprimo etiquetas", "hacer etiquetas"],
    claves: ["etiqueta", "etiquetas", "qr", "imprimir", "precio"],
    respuesta:
      "En “Generador de Etiquetas” busca el producto real del inventario, elige tamaño y orientación, agrégalo a la lista e imprime. El QR lleva a la ficha del producto; cualquiera puede leerlo con el botón “Escanear” de arriba.",
    roles: ["gerencia", "ventas", "caja"],
    link: { to: "/etiquetas", label: "Ir a Etiquetas" },
    fuente: FP,
  },
  {
    id: "pag-calculadora",
    categoria: "pagina",
    pregunta: "¿Cómo calculo cuántas cajas necesita un cliente?",
    variantes: ["metros a cajas", "cuantas cajas para x metros"],
    claves: ["calculadora", "metros", "m2", "cajas", "calcular", "cuantificar", "necesito"],
    respuesta:
      "Usa la “Calculadora” → pestaña Ventas: pon los m² que trae cada caja, las piezas por caja y los metros que necesita el cliente; te dice cuántas cajas completas comprar y cuánto le sobra. La pestaña Almacén sirve para contar cajas y piezas sueltas y ver si cuadra con el sistema.",
    link: { to: "/calculadora", label: "Ir a Calculadora" },
    fuente: FP,
  },
  {
    id: "pag-campanita",
    categoria: "pagina",
    pregunta: "¿Para qué sirve la campanita y el botón Reportar?",
    claves: ["campanita", "notificaciones", "avisos", "reportar", "problema"],
    respuesta:
      "La campanita avisa lo importante: productos que se acaban, incidencias de reparto, apartados por vencer, cambios o ventas eliminadas, descuadres de inventario. Toca un aviso para ir directo a lo que habla. “Reportar” sirve para avisar un problema a todos al instante (algo roto, faltante, un cliente molesto).",
    fuente: FP,
  },
  {
    id: "pag-no-veo-modulo",
    categoria: "pagina",
    pregunta: "No veo un módulo en mi menú, ¿por qué?",
    variantes: ["no me aparece", "no tengo acceso"],
    claves: ["aparece", "menu", "acceso", "modulo", "falta"],
    respuesta:
      "Cada puesto solo ve los módulos de su área (por ejemplo, Gastos es solo de Gerencia). Si crees que necesitas acceso a algo para tu trabajo, pídeselo al Gerente: él cambia tu rol en “Administración”.",
    fuente: FP,
  },
  {
    id: "pag-contrasena",
    categoria: "pagina",
    pregunta: "Olvidé mi contraseña o no puedo entrar, ¿qué hago?",
    claves: ["contrasena", "password", "entrar", "sesion", "olvide", "acceso", "cuenta"],
    respuesta:
      "Avísale al Gerente de sucursal: las cuentas (correo y contraseña) las administra él y puede restablecer tu acceso.",
    fuente: FP,
  },
  {
    id: "pag-capacitacion",
    categoria: "pagina",
    pregunta: "¿Dónde aprendo a usar la página o mi puesto?",
    claves: ["capacitacion", "aprender", "videos", "lecciones", "curso", "entrenamiento"],
    respuesta:
      "En “Capacitación Express” tienes videos de tu puesto y lecciones rápidas de 2–3 minutos con una pregunta al final. Tu avance se guarda y Gerencia puede verlo.",
    link: { to: "/capacitacion", label: "Ir a Capacitación" },
    fuente: FP,
  },
  {
    id: "pag-gastos",
    categoria: "pagina",
    pregunta: "¿Cómo registro un gasto de la sucursal?",
    claves: ["gasto", "gastos", "ticket", "comprobante", "gasolina", "compra"],
    respuesta:
      "Solo Gerencia: “Gastos” → “Registrar gasto”: fecha, monto, concepto, categoría y foto del ticket o factura (obligatoria). Arriba ves el total del mes y por categoría.",
    roles: ["gerencia"],
    link: { to: "/gastos", label: "Ir a Gastos" },
    fuente: FP,
  },

  {
    id: "pag-precios-etiquetas",
    categoria: "pagina",
    pregunta: "¿Cómo actualizo precios, rotación y etiquetas cuando llega el Excel?",
    variantes: ["llego el excel de rotacion", "etiquetas por cambiar", "como hago las etiquetas rojas", "actualizar descuentos"],
    claves: ["excel", "rotacion", "etiquetas", "roja", "descuento", "actualizar", "zona", "imprimir"],
    respuesta:
      "• Gerencia: “Precios y Etiquetas” → “Subir Excel de rotación”. Revisa qué columna es el ID y la rotación, toca “Ver qué va a cambiar” y luego “Aplicar”. El sistema calcula el descuento (del Excel o de la tabla por rotación) y el precio final.\n" +
      "• Solo los productos que cambiaron pasan a “Etiquetas por cambiar”, repartidos por zona (pared izquierda, centro, pared derecha).\n" +
      "• Cada vendedor abre “Mis zonas”, selecciona todo, toca “Imprimir” y se abre el generador con todas sus etiquetas listas: roja (precio de antes tachado y %) si tiene descuento, azul si no.\n" +
      "• Al pegarlas, “Ya las coloqué”. Gerencia ve el avance por zona.",
    roles: ["gerencia", "ventas"],
    link: { to: "/precios-etiquetas", label: "Ir a Precios y Etiquetas" },
    fuente: FP,
  },

  // ---------------------------------------------------------- GLOSARIO
  {
    id: "glo-lote-tono-calibre",
    categoria: "glosario",
    pregunta: "¿Qué es lote, tono y calibre?",
    claves: ["que", "significa", "lote", "tono", "calibre"],
    respuesta:
      "• Lote: grupo de producción de un piso o azulejo; piezas de distinto lote pueden variar.\n" +
      "• Tono: variación de color entre producciones del mismo modelo.\n" +
      "• Calibre: variación en el tamaño real de las piezas.\n" +
      "Para que un piso quede uniforme, todo el pedido debe salir del mismo lote, tono y calibre.",
    fuente: "Glosario",
  },
  {
    id: "glo-merma",
    categoria: "glosario",
    pregunta: "¿Qué es una merma?",
    claves: ["que", "merma", "significa"],
    respuesta:
      "Material que se pierde o daña (roto, defectuoso) y ya no se puede vender. Se da de baja del inventario con motivo y foto. No confundir con exhibición: el material de muestra no se pierde, solo está en la tienda.",
    fuente: "Glosario",
  },
  {
    id: "glo-corte-arqueo",
    categoria: "glosario",
    pregunta: "¿Qué es el arqueo y el corte de caja?",
    claves: ["arqueo", "corte", "significa", "que"],
    respuesta:
      "El arqueo es contar el dinero y valores que hay en caja; el corte es comparar ese conteo contra lo que registró el sistema en el día. Lo hace Caja y lo supervisa Gerencia.",
    fuente: "Glosario",
  },
  {
    id: "glo-cfdi-tpv",
    categoria: "glosario",
    pregunta: "¿Qué es CFDI y TPV?",
    claves: ["cfdi", "tpv", "terminal", "factura", "electronica"],
    respuesta:
      "• CFDI: la factura electrónica (Comprobante Fiscal Digital por Internet).\n• TPV: la terminal punto de venta para cobrar con tarjeta.",
    fuente: "Glosario",
  },
  {
    id: "glo-disponible",
    categoria: "glosario",
    pregunta: "¿Qué diferencia hay entre existencia física, apartado y disponible?",
    claves: ["existencia", "fisica", "apartado", "disponible", "diferencia", "pendiente"],
    respuesta:
      "• Existencia física: lo que hay en almacén.\n" +
      "• Vendido pendiente (apartado): lo que ya se vendió pero el cliente no ha recogido o no se ha entregado.\n" +
      "• Disponible: física − apartado. Es lo único que se puede ofrecer a un cliente nuevo.\n" +
      "• En exhibición: lo que está de muestra en la tienda (no cuenta como disponible).",
    fuente: "Glosario",
  },
];
