import { FUENTE_PAGINA as FP, type EntradaKB } from "./tipos";

// ============================================================
// Funciones nuevas de la página (Kardex digital, foto del producto,
// entregas, traslados, combustible, cotizaciones, cobranza y corte,
// etiquetas, administración). Si cambia una pantalla, actualiza aquí.
// ============================================================

export const KB_NUEVAS: EntradaKB[] = [
  // ---------------- Kardex y fotos ----------------
  {
    id: "kar-anotar",
    categoria: "pagina",
    pregunta: "¿Cómo anoto una entrada o una salida en el Kardex?",
    variantes: ["kardex digital", "anotar en el kardex", "llenar el kardex", "como saco material en el kardex", "hoja blanca del kardex"],
    claves: ["kardex", "anotar", "salida", "entrada", "renglon", "guardar"],
    respuesta:
      "• Entra a “Kardex” y busca el producto por ID, código o nombre (o escanea el QR de su etiqueta amarilla).\n" +
      "• Abajo de la tabla está el renglón amarillo: pon la cantidad en “Entrada” o en “Salida” (solo una de las dos).\n" +
      "• Si es salida, escribe el folio de la venta (ej. V-1004) o el motivo. No te deja sacar más de lo que hay.\n" +
      "• Toca “Guardar renglón”: la columna “Existencia” se actualiza sola.\n" +
      "• Cada quien anota solo lo que su permiso le deja: salidas, entradas o ambas.",
    roles: ["gerencia", "almacen"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-chofer",
    categoria: "pagina",
    pregunta: "¿Qué puedo hacer en el Kardex como chofer?",
    variantes: ["el chofer puede ver el kardex", "kardex reparto", "kardex para choferes"],
    claves: ["kardex", "chofer", "reparto", "consultar"],
    respuesta:
      "• Puedes consultar el Kardex de cualquier producto y su historial.\n" +
      "• Puedes agregar y ver la foto de apoyo de un renglón y la foto del producto.\n" +
      "• No anotas entradas ni salidas: eso lo hace Almacén.",
    roles: ["reparto"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-foto-apoyo",
    categoria: "pagina",
    pregunta: "¿Cómo agrego la foto de apoyo en el Kardex?",
    variantes: ["subir foto al kardex", "foto del renglon", "agregar foto kardex", "adjuntar foto kardex", "foto de apoyo"],
    claves: ["foto", "apoyo", "kardex", "subir", "adjuntar", "renglon"],
    respuesta:
      "• En un renglón NUEVO: toca “Foto de apoyo (opcional)”, elige o toma la foto, escribe la cantidad y toca “Guardar renglón”. La foto se guarda junto con el renglón (si no escribes cantidad, no se guarda nada).\n" +
      "• En un renglón que ya existe y no tiene foto: toca “+ Agregar foto” debajo del nombre. Solo se puede agregar una vez.\n" +
      "• Para verla, toca “Ver foto de apoyo” en ese renglón.\n" +
      "• La suben y la ven Gerencia, todo Almacén y los choferes. Ventas y Caja no la ven.",
    roles: ["gerencia", "almacen", "reparto"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-foto-no-guarda",
    categoria: "pagina",
    pregunta: "La foto no se guarda o no me deja subirla, ¿qué hago?",
    variantes: ["no se sube la foto", "error al subir foto", "la foto no aparece", "no aparece la foto", "no puedo subir foto", "no me deja agregar foto", "no se guarda la foto del kardex", "donde subo la foto del material", "la foto desaparece"],
    claves: ["foto", "subir", "guarda", "error", "aparece", "permiso"],
    respuesta:
      "• Primero revisa que escribiste la cantidad: en un renglón nuevo la foto se guarda junto con el renglón.\n" +
      "• Si sale un mensaje rojo de que falta permiso o falta crear el espacio de fotos, avisa a Gerencia: falta correr el SQL de fotos en Supabase (0032 y 0034) y recargar la página con Ctrl+F5.\n" +
      "• Si la foto pesa mucho y tarda, espera unos segundos: la página la reduce antes de subirla.\n" +
      "• Si sigue fallando, usa el botón Reportar con una captura del mensaje.",
    roles: ["gerencia", "almacen", "reparto"],
    fuente: FP,
  },
  {
    id: "kar-foto-producto",
    categoria: "pagina",
    pregunta: "¿Cómo pongo la foto del producto junto al nombre?",
    variantes: ["poner foto al producto", "cambiar foto del producto", "foto junto al nombre", "ver si coincide el producto", "imagen del producto"],
    claves: ["foto", "producto", "nombre", "coincide", "imagen", "cambiar"],
    respuesta:
      "• La foto del producto aparece a un lado del nombre en el Kardex y en la ficha del producto, para comprobar que el material que tienes en la mano coincide.\n" +
      "• Si el producto no tiene foto, toca el cuadro “Agregar foto del producto”. Si ya tiene, toca “Cambiar foto”.\n" +
      "• También puedes ponerla al guardar un renglón del Kardex: si el producto no tiene foto y marcas “Usar también como foto del producto”, se queda como foto del producto.\n" +
      "• Toca la foto para verla grande. La ven todos los que pueden abrir ese producto; la cambian Gerencia, Almacén y choferes.",
    roles: ["gerencia", "almacen", "reparto"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-foto-producto-ver",
    categoria: "pagina",
    pregunta: "¿Para qué sirve la foto que sale junto al nombre del producto?",
    variantes: ["la foto del producto", "foto del producto en inventario", "imagen junto al nombre"],
    claves: ["foto", "producto", "nombre", "imagen", "coincide"],
    respuesta:
      "Es la foto de referencia del producto: sirve para comprobar que el material que se muestra o se carga es el correcto (color, diseño, empaque). Tócala para verla más grande. Si un producto no tiene foto, avisa a Almacén para que la agregue.",
    roles: ["ventas", "caja"],
    fuente: FP,
  },
  {
    id: "kar-anular",
    categoria: "pagina",
    pregunta: "¿Cómo anulo un renglón del Kardex que anoté mal?",
    variantes: ["corregir kardex", "me equivoque en el kardex", "borrar renglon kardex", "error en el kardex", "tachar renglon"],
    claves: ["anular", "kardex", "renglon", "equivoque", "corregir", "borrar", "error"],
    respuesta:
      "• Solo el Jefe de almacén y Gerencia (permiso “Anular renglones del Kardex”) pueden.\n" +
      "• En el renglón toca “Anular” y escribe el motivo.\n" +
      "• El renglón queda tachado con quién lo anuló y por qué, y la existencia se corrige sola. No se borra nada.\n" +
      "• Si no tienes el permiso, avisa al Jefe de almacén.",
    roles: ["gerencia", "almacen"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-etiqueta-amarilla",
    categoria: "pagina",
    pregunta: "¿Cómo imprimo la etiqueta amarilla del Kardex?",
    variantes: ["etiqueta amarilla", "imprimir etiqueta del kardex", "etiqueta qr kardex", "se vende por caja bolsa pieza"],
    claves: ["etiqueta", "amarilla", "kardex", "imprimir", "qr"],
    respuesta:
      "• En el Kardex del producto toca “Etiqueta amarilla”.\n" +
      "• La etiqueta ya viene elegida según el tipo de producto (cemento o adhesivo = bulto, tinaco = pieza, etc.).\n" +
      "• Los renglones se pueden renombrar, llenar, quitar o agregar hasta 6. Siempre sale “Se vende por: caja, bolsa, pieza…”.\n" +
      "• Imprímela y pégala en el producto: su QR abre directo el Kardex.",
    roles: ["gerencia", "almacen"],
    link: { to: "/kardex", label: "Ir al Kardex" },
    fuente: FP,
  },
  {
    id: "kar-escanear",
    categoria: "pagina",
    pregunta: "¿Cómo escaneo el QR de una etiqueta?",
    variantes: ["escanear qr", "boton escanear", "leer qr con el celular", "abrir producto con qr"],
    claves: ["escanear", "qr", "etiqueta", "camara", "boton"],
    respuesta:
      "• Toca el botón “Escanear” (arriba, junto a Reportar) y apunta la cámara al QR de la etiqueta.\n" +
      "• Se abre el producto: su Kardex, existencia y foto.\n" +
      "• Si la cámara no abre, revisa que el navegador tenga permiso para usarla.",
    roles: ["gerencia", "almacen", "reparto", "ventas"],
    fuente: FP,
  },

  // ---------------- Entregas ----------------
  {
    id: "ent-hoy-cargar",
    categoria: "pagina",
    pregunta: "¿Cómo confirmo que ya cargué una entrega?",
    variantes: ["ya lo cargue", "entrega inmediata", "llego una venta inmediata", "que hago con una entrega inmediata", "confirmar carga", "cargar material a la camioneta"],
    claves: ["entregas", "hoy", "cargue", "carga", "inmediata", "confirmar"],
    respuesta:
      "• Entra a “Entregas de hoy”. Lo de entrega inmediata sale arriba, en rojo: es lo primero que se carga. Abajo está lo programado para hoy.\n" +
      "• Ya cargado el material, toca “Ya lo cargué”. Puedes confirmar solo una parte si no se llevó todo.\n" +
      "• Al confirmar, el material se descuenta del inventario y queda en el Kardex. Hasta entonces sigue apartado.\n" +
      "• La pantalla se actualiza sola y suena el aviso cuando entra una venta inmediata.",
    roles: ["gerencia", "almacen"],
    link: { to: "/entregas-hoy", label: "Ir a Entregas de hoy" },
    fuente: FP,
  },
  {
    id: "ent-programar",
    categoria: "pagina",
    pregunta: "¿Cómo programo el día y la hora de una entrega?",
    variantes: ["programar entrega", "asignar dia y hora", "cambiar fecha de entrega", "esperando proveedor", "mover una entrega"],
    claves: ["programar", "entrega", "dia", "hora", "fecha", "asignar", "proveedor"],
    respuesta:
      "• Abre “Entregas por programar” y, en “Sin fecha asignada”, toca “Asignar día y hora”.\n" +
      "• Para cambiar un día u hora toca “Cambiar día/hora” y escribe el motivo: queda en el historial.\n" +
      "• Si falta material del proveedor, toca “Esperando proveedor” y anota qué se pidió; cuando llegue, “Ya llegó el material”.\n" +
      "• Usa “Lista por día” o “Semana” para ver la carga. Las atrasadas salen en rojo.\n" +
      "• Solo lo hace quien tiene el permiso “Programar entregas” (Jefe y auxiliar de almacén, y Gerencia).",
    roles: ["gerencia", "almacen"],
    link: { to: "/por-programar", label: "Ir a Entregas por programar" },
    fuente: FP,
  },
  {
    id: "ent-por-programar-consulta",
    categoria: "pagina",
    pregunta: "¿Para cuándo está programada la entrega de mi cliente?",
    variantes: ["cuando le toca a mi cliente", "entregas por programar", "ya tiene fecha la entrega"],
    claves: ["entrega", "programada", "cliente", "fecha", "cuando", "pendientes"],
    respuesta:
      "• Abre “Entregas por programar”: ahí solo consultas, el día y la hora los asigna el Jefe de almacén.\n" +
      "• Usa “Sin fecha asignada”, “Ya programadas” y “A domicilio” para ubicar a tu cliente.\n" +
      "• El filtro “Apartado por vencer” te dice a quién llamar hoy.\n" +
      "• Toca el folio para ver el detalle o cambiar un producto.",
    roles: ["ventas", "caja"],
    link: { to: "/por-programar", label: "Ir a Entregas por programar" },
    fuente: FP,
  },
  {
    id: "ent-km",
    categoria: "pagina",
    pregunta: "¿Dónde veo el kilometraje y los destinos de los choferes?",
    variantes: ["kilometraje del dia", "cuantos km recorrio el chofer", "recorrido de la camioneta"],
    claves: ["kilometraje", "km", "chofer", "destinos", "recorrido", "camioneta"],
    respuesta:
      "Entra a “Kilometraje”: muestra, por día, cada chofer y camioneta con sus destinos, los km de cada entrega y la suma final. Lo ven Gerencia y quien tenga el permiso “Ver kilometraje”. Cambia el día con las flechas.",
    roles: ["gerencia", "almacen"],
    link: { to: "/kilometraje", label: "Ir a Kilometraje" },
    fuente: FP,
  },

  // ---------------- Traslados, combustible, cotizaciones ----------------
  {
    id: "tras-responder",
    categoria: "pagina",
    pregunta: "¿Cómo respondo cuando otra sucursal pide material?",
    variantes: ["solicitud de traslado", "ya vendi o comprometi", "responder traslado", "sucursal pide material"],
    claves: ["traslado", "sucursal", "pide", "responder", "comprometi", "vendi"],
    respuesta:
      "• Cuando llega la solicitud suena la campanita: tócala para abrir “Traslados a sucursales”.\n" +
      "• Abre la solicitud → “Responder” → elige “Ya vendí”, “Ya comprometí” o “No tengo nada comprometido” y la cantidad.\n" +
      "• Anota solo lo que NO has registrado como venta en el sistema: lo ya registrado se descuenta solo.\n" +
      "• Puedes cambiar tu respuesta mientras la solicitud siga abierta.",
    roles: ["gerencia", "ventas"],
    link: { to: "/traslados", label: "Ir a Traslados" },
    fuente: FP,
  },
  {
    id: "tras-enviar",
    categoria: "pagina",
    pregunta: "¿Cómo envío un traslado a otra sucursal?",
    variantes: ["nueva solicitud de traslado", "traslado directo", "mandar material a otra sucursal", "enviar traslado"],
    claves: ["traslado", "enviar", "sucursal", "solicitud", "material", "libre"],
    respuesta:
      "• “Nueva solicitud”: elige sucursal, producto y cantidad; a los vendedores les llega un aviso.\n" +
      "• En la tarjeta ves Existencia, Apartado, Comprometido y lo “Libre para trasladar”.\n" +
      "• Para enviar, toca “Enviar traslado”, confirma la cantidad y, si quieres, agrega foto. Sale del inventario y queda en el Kardex como “Traslado a …”.\n" +
      "• Para un envío sin solicitud previa usa “Traslado directo”. Para cancelar, “Cancelar solicitud” con motivo.\n" +
      "• El sistema no deja enviar más de lo disponible.",
    roles: ["gerencia", "almacen"],
    link: { to: "/traslados", label: "Ir a Traslados" },
    fuente: FP,
  },
  {
    id: "comb-registrar",
    categoria: "pagina",
    pregunta: "¿Cómo registro una carga de combustible o del montacargas?",
    variantes: ["registrar gasolina", "cargar gasolina", "ticket de gasolina", "horas del montacargas", "combustible y montacargas"],
    claves: ["combustible", "gasolina", "montacargas", "carga", "litros", "ticket", "registrar"],
    respuesta:
      "• Entra a “Combustible y montacargas”. Reparto registra vehículos y Almacén registra el montacargas.\n" +
      "• Escribe la unidad (placas, número o nombre), los litros y el importe.\n" +
      "• Escribe el kilometraje (vehículo) o las horas (montacargas) que marca el tablero.\n" +
      "• Toma la foto del ticket y la del tablero → “Registrar carga”.\n" +
      "• No acepta un kilometraje menor al último de esa unidad. Si te equivocas, solo Gerencia puede anular el registro.",
    roles: ["gerencia", "reparto", "almacen"],
    link: { to: "/combustible", label: "Ir a Combustible" },
    fuente: FP,
  },
  {
    id: "comb-error-km",
    categoria: "pagina",
    pregunta: "El combustible me dice que el kilometraje es menor, ¿qué hago?",
    variantes: ["kilometraje menor al ultimo", "error de kilometraje", "no acepta el kilometraje"],
    claves: ["kilometraje", "menor", "error", "combustible", "tablero", "unidad"],
    respuesta:
      "Revisa el tablero y que elegiste la unidad correcta: puede ser un error de captura o estar registrando en otra camioneta. No cambies el número hasta que lo acepte; la bitácora solo sirve con datos reales. Si el último registro de esa unidad estuvo mal, pide a Gerencia que lo anule.",
    roles: ["gerencia", "reparto", "almacen"],
    link: { to: "/combustible", label: "Ir a Combustible" },
    fuente: FP,
  },
  {
    id: "coti-hacer",
    categoria: "pagina",
    pregunta: "¿Cómo hago una cotización y la convierto en venta?",
    variantes: ["presupuesto para el cliente", "nueva cotizacion", "imprimir cotizacion", "convertir cotizacion en venta"],
    claves: ["cotizacion", "presupuesto", "convertir", "imprimir", "vigencia"],
    respuesta:
      "• En “Cotizaciones” toca “Nueva cotización”: cliente, productos (precio público o promoción), vigencia en días y una nota si quieres.\n" +
      "• “Imprimir” para dársela (también guardas el PDF desde el diálogo de impresión).\n" +
      "• Si el cliente compra: “Convertir en venta”, completa entrega, documento y pago, y regístrala.\n" +
      "• Si ya no compra: “Cancelar” con un motivo.\n" +
      "• Una cotización NO aparta material ni baja el inventario.",
    roles: ["gerencia", "ventas", "caja"],
    link: { to: "/cotizaciones", label: "Ir a Cotizaciones" },
    fuente: FP,
  },
  {
    id: "venta-promo",
    categoria: "pagina",
    pregunta: "¿Cómo vendo un producto a precio promoción?",
    variantes: ["precio publico o promocion", "vender en promocion", "elegir precio promocion", "cobrar precio de promocion"],
    claves: ["promocion", "precio", "publico", "vender", "selector", "descuento"],
    respuesta:
      "• En “Nueva venta” (y en cotizaciones), los productos que tienen promoción muestran un selector: “Precio público” o “Promoción”.\n" +
      "• Elige el que corresponde y el total se recalcula.\n" +
      "• Si un producto no muestra el selector, no tiene promoción vigente.",
    roles: ["gerencia", "ventas"],
    link: { to: "/ventas", label: "Ir a Ventas" },
    fuente: FP,
  },

  // ---------------- Cobranza y corte ----------------
  {
    id: "cob-donde",
    categoria: "pagina",
    pregunta: "¿Dónde veo el corte de caja de hoy?",
    variantes: ["corte de caja", "corte del dia", "cobranza y corte", "ver el corte", "cuanto entro hoy a caja"],
    claves: ["corte", "caja", "hoy", "cobranza", "venta", "total"],
    respuesta:
      "• Entra a “Cobranza y Corte” → pestaña “Corte de caja”.\n" +
      "• Elige el día (o un rango, por ejemplo la semana) y verás VENTA y COBRANZA separadas, con subtotales por método de pago.\n" +
      "• Venta = el cliente pagó el mismo día de la compra. Cobranza = pagó en un día posterior (aunque se lo dé al chofer).\n" +
      "• Puedes guardar el corte y descargarlo en Excel.",
    roles: ["gerencia", "caja"],
    link: { to: "/cobranza", label: "Ir a Cobranza y Corte" },
    fuente: FP,
  },
  {
    id: "cob-historial",
    categoria: "pagina",
    pregunta: "¿Cómo busco un cobro de días anteriores?",
    variantes: ["historial de cobros", "buscar un pago", "cobros de la semana pasada", "buscar por fecha o cliente", "no regresar a revisar ventas"],
    claves: ["historial", "cobros", "buscar", "fecha", "anteriores", "pago", "cliente"],
    respuesta:
      "• “Cobranza y Corte” → pestaña “Historial de cobros”.\n" +
      "• Filtra por fechas y escribe cliente, folio, factura, método o recibo en el buscador.\n" +
      "• Cada renglón muestra si fue venta o cobranza, quién lo registró y por qué canal entró (caja, chofer o abono).\n" +
      "• “Descargar Excel” baja lo que estás viendo.",
    roles: ["gerencia", "caja"],
    link: { to: "/cobranza", label: "Ir a Cobranza y Corte" },
    fuente: FP,
  },
  {
    id: "cob-porcobrar",
    categoria: "pagina",
    pregunta: "¿Cómo veo quién me debe y cuánto?",
    variantes: ["cuentas por cobrar", "saldos pendientes", "clientes con saldo", "quien debe", "cuentas liquidadas"],
    claves: ["cobrar", "saldo", "debe", "cuentas", "liquidadas", "pendiente", "abono"],
    respuesta:
      "• “Cobranza y Corte” → pestaña “Por cobrar”: lista las ventas con saldo, con el total, lo pagado y lo que falta.\n" +
      "• Cuando el cliente liquida, la cuenta sale sola de la lista (puedes mostrar las liquidadas con el filtro).\n" +
      "• Desde ahí toca “Registrar abono” para anotar un pago.",
    roles: ["gerencia", "caja"],
    link: { to: "/cobranza", label: "Ir a Cobranza y Corte" },
    fuente: FP,
  },
  {
    id: "cob-guardar-corte",
    categoria: "pagina",
    pregunta: "¿Cómo guardo el corte y qué pasa si corrijo un pago después?",
    variantes: ["guardar corte de caja", "corte guardado cambio", "corregir despues de guardar el corte", "modificar el corte"],
    claves: ["guardar", "corte", "corregir", "cambio", "modificar", "guardado"],
    respuesta:
      "• En “Corte de caja” toca “Guardar corte” (puedes poner una nota). Queda en “Cortes guardados”.\n" +
      "• Si después corriges o anulas un pago de esos días, el corte guardado muestra “Cambió después de guardarse” con los totales de ahora.\n" +
      "• Así tienes tu corte siempre a la mano y sabes si algo se movió. Corregir un pago pide un motivo y queda en bitácora.",
    roles: ["gerencia", "caja"],
    link: { to: "/cobranza", label: "Ir a Cobranza y Corte" },
    fuente: FP,
  },
  {
    id: "cob-excel-formato",
    categoria: "pagina",
    pregunta: "¿Puedo descargar el Excel de cobranza con el mismo formato de siempre?",
    variantes: ["excel de cobranza del mes", "formato de caja en excel", "descargar cobranza octubre", "excel del corte semanal"],
    claves: ["excel", "cobranza", "formato", "descargar", "mes", "semanal"],
    respuesta:
      "Sí. En “Cobranza y Corte” usa “Descargar Excel”: baja el libro del mes con las hojas TOTAL, el mes, APARTADOS y ENTREGADOS con el mismo formato que ya usas y las fórmulas listas. También puedes bajar el corte de un rango (semanal) y el historial.",
    roles: ["gerencia", "caja"],
    link: { to: "/cobranza", label: "Ir a Cobranza y Corte" },
    fuente: FP,
  },
  {
    id: "cob-chofer-confirmar",
    categoria: "pagina",
    pregunta: "El chofer me entregó el dinero de un cobro, ¿cómo lo registro?",
    variantes: ["dinero del chofer", "confirmar cobro del chofer", "recibir el dinero del reparto", "cobro de reparto"],
    claves: ["chofer", "dinero", "cobro", "confirmar", "reparto", "evidencias"],
    respuesta:
      "• Entra a “Evidencias y Cobros”, abre el reparto entregado y confirma el cobro que trae el chofer.\n" +
      "• Al confirmarlo, ese pago baja el saldo de la venta y entra en tu corte: es venta si el cliente pagó el mismo día de la compra, o cobranza si fue otro día.\n" +
      "• Si el monto del chofer no cuadra, corrígelo con motivo en “Cobranza y Corte”.",
    roles: ["gerencia", "caja"],
    link: { to: "/evidencias-cobros", label: "Ir a Evidencias y Cobros" },
    fuente: FP,
  },

  // ---------------- Etiquetas y precios ----------------
  {
    id: "etq-promo",
    categoria: "pagina",
    pregunta: "¿Cómo hago las etiquetas de promoción (roja y azul)?",
    variantes: ["etiqueta roja", "etiqueta azul", "etiquetas rojas y azules", "etiqueta de promocion", "agregar las 2 etiquetas", "imprimir promocion"],
    claves: ["etiqueta", "promocion", "roja", "azul", "descuento", "imprimir"],
    respuesta:
      "• En el “Generador de Etiquetas” busca el producto: si tiene promoción, lo detecta solo.\n" +
      "• Toca “Agregar las 2 etiquetas”: la azul lleva el precio original y la roja solo el precio de promoción con la cinta PROMOCIÓN (sin precio tachado).\n" +
      "• Se imprimen las dos para que el cliente vea el descuento. También puedes elegir el color a mano.",
    roles: ["gerencia", "ventas", "caja"],
    link: { to: "/etiquetas", label: "Ir al Generador de Etiquetas" },
    fuente: FP,
  },
  {
    id: "adm-usuarios",
    categoria: "pagina",
    pregunta: "¿Cómo doy de alta a un usuario y qué permisos le doy?",
    variantes: ["crear usuario", "dar de alta empleado", "permisos de almacen", "nivel almacenista jefe auxiliar", "cambiar rol de un usuario"],
    claves: ["usuario", "alta", "permisos", "rol", "administracion", "nivel", "puesto"],
    respuesta:
      "• La cuenta (correo y contraseña) se crea en Supabase; luego en “Administración” le pones nombre, rol y puesto.\n" +
      "• En Almacén elige el nivel: Jefe, Auxiliar o Almacenista; cada nivel trae permisos por defecto.\n" +
      "• Puedes prender o apagar permisos sueltos (Kardex, anular renglones, programar entregas, corregir cobros, ver kilometraje, etc.).\n" +
      "• El rol define qué módulos ve: dale solo el de su área.",
    roles: ["gerencia"],
    link: { to: "/administracion", label: "Ir a Administración" },
    fuente: FP,
  },
  {
    id: "lista-precios-info",
    categoria: "pagina",
    pregunta: "¿Para qué sirve la “Lista de precios público”?",
    variantes: ["precio de lista helvex proyecta", "lista de precios de marca", "precio publico con iva"],
    claves: ["lista", "precios", "publico", "marca", "iva", "helvex", "proyecta"],
    respuesta:
      "Guarda los precios públicos con IVA de las listas de las marcas (por ejemplo Helvex o Proyecta). Cuando un producto tiene precio de lista, ese es el precio público que se cobra y el precio de SIGAM pasa a verse como promoción. Solo Gerencia la administra.",
    roles: ["gerencia"],
    link: { to: "/lista-precios", label: "Ir a Lista de precios" },
    fuente: FP,
  },
];
