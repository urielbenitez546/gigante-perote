import { FUENTE_BIENVENIDA as MB, FUENTE_PUESTOS as MP, type EntradaKB } from "./tipos";

// ============================================================
// Preguntas y respuestas sacadas de:
//  - Manual de Bienvenida e Inducción (sucursal Perote, 2026)
//  - Manual de Puestos y Funciones (sucursal Perote, 2026)
// Si Recursos Humanos actualiza una política, cambia aquí la
// respuesta (el propio manual dice que manda la versión más reciente).
// ============================================================

export const KB_MANUALES: EntradaKB[] = [
  // ---------------------------------------------------------- EMPRESA
  {
    id: "empresa-historia",
    categoria: "empresa",
    pregunta: "¿Cuál es la historia de la empresa?",
    variantes: ["cuando se fundo la empresa", "como empezo el gigante", "desde cuando existe"],
    claves: ["historia", "fundacion", "inicio", "origen", "1994", "comienzos", "anos"],
    respuesta:
      "La primera tienda nació en 1994 en Poza Rica, Veracruz, de la mano de su fundador Jorge Alberto Cienfuegos Villanueva (1946-2019). Empezó vendiendo materiales para construcción (cemento, varilla, grava y arena) con 14 personas.\n" +
      "• 1995: se abren Martínez de la Torre y Tuxpan.\n" +
      "• 1996: se formaliza el Grupo Martínez Cienfuegos; en 1999 ya eran 12 sucursales.\n" +
      "• 2000: se crea el departamento de Sistemas y Auditorías Administrativas.\n" +
      "• 2013: el grupo se desvincula y nace el Grupo G100.\n" +
      "• 2015: 21 sucursales. 2023: se crea Recursos Humanos y Programación. 2024: se crea Compras.",
    fuente: `${MB}, 5.1`,
  },
  {
    id: "empresa-fundador",
    categoria: "empresa",
    pregunta: "¿Quién fundó El Gigante de los Azulejos y Mármoles?",
    variantes: ["quien fundo la empresa", "quien es el dueno"],
    claves: ["fundador", "fundo", "dueno", "creador", "cienfuegos"],
    respuesta:
      "El fundador fue Jorge Alberto Cienfuegos Villanueva (1946-2019), quien abrió la primera tienda en 1994 en Poza Rica, Veracruz.",
    fuente: `${MB}, 5.1`,
  },
  {
    id: "empresa-tamano",
    categoria: "empresa",
    pregunta: "¿Cuántas sucursales y colaboradores tiene la empresa?",
    variantes: ["que tan grande es la empresa", "en cuantos estados esta", "cuantas sucursales tiene el gigante", "cuantas tiendas hay"],
    claves: ["sucursales", "tiendas", "estados", "colaboradores", "empleados", "tamano"],
    respuesta:
      "Actualmente la empresa está en 7 estados de la República, con 50 sucursales en la región del Golfo de México y más de 500 colaboradores. Su mayor presencia está en Veracruz.",
    fuente: `${MB}, 5.1`,
  },
  {
    id: "empresa-mision",
    categoria: "empresa",
    pregunta: "¿Cuál es la misión de la empresa?",
    claves: ["mision"],
    respuesta: "Misión: Generar confianza en los clientes a través de nuestra calidad en el servicio.",
    fuente: `${MB}, 5.3`,
  },
  {
    id: "empresa-vision",
    categoria: "empresa",
    pregunta: "¿Cuál es la visión de la empresa?",
    claves: ["vision"],
    respuesta:
      "Visión: Ser la marca líder mexicana, manteniendo nuestra posición como una organización sólida que le permita mejorar la calidad y estilo de vida de nuestros clientes, colaboradores, proveedores y socios.",
    fuente: `${MB}, 5.4`,
  },
  {
    id: "empresa-proposito",
    categoria: "empresa",
    pregunta: "¿Cuál es el propósito de la empresa?",
    claves: ["proposito"],
    respuesta:
      "Nuestro propósito: Mejorar la calidad de vida de los clientes, colaboradores y proveedores, con productos de calidad a precios accesibles.",
    fuente: `${MB}, 5.5`,
  },
  {
    id: "empresa-valores",
    categoria: "empresa",
    pregunta: "¿Cuáles son los valores de la empresa?",
    claves: ["valores", "valor"],
    respuesta:
      "• Calidad humana: cuidar los vínculos humanos y respetar la dignidad de cada colaborador.\n" +
      "• Respeto: con clientes y proveedores, sin ofensas ni ironías.\n" +
      "• Crecimiento: mejorar habilidades y conocimientos mientras trabajamos.\n" +
      "• Honestidad: ser confiables, honrados y actuar con la verdad.\n" +
      "• Aprendizaje continuo: aprender cosas nuevas con las herramientas que da la empresa.\n" +
      "• Orientación al cliente: lo primordial es el servicio al cliente.\n" +
      "• Eficiencia: resolver problemas de forma óptima usando bien los recursos.",
    fuente: `${MB}, 5.6`,
  },
  {
    id: "empresa-cultura",
    categoria: "empresa",
    pregunta: "¿Cómo es la cultura de la empresa?",
    claves: ["cultura", "ambiente", "familia"],
    respuesta:
      "“Somos una gran familia empresarial donde crecemos y aprendemos juntos. Respetamos a todos nuestros integrantes, cuidamos a nuestros clientes y a nuestro negocio con procesos eficientes y honestos.” La empresa antepone la seguridad de sus colaboradores y promueve tratarse con respeto, justicia, confianza y afecto, valorando la diversidad y la inclusión.",
    fuente: `${MB}, 5.2 y 5.6`,
  },
  {
    id: "empresa-giro",
    categoria: "empresa",
    pregunta: "¿Qué vende la empresa?",
    variantes: ["a que se dedica la sucursal", "giro de la empresa"],
    claves: ["vende", "giro", "dedica", "productos", "venden"],
    respuesta:
      "Comercializamos pisos, azulejos, mármoles y productos para el mejoramiento de espacios (baños, lavabos, tinacos, llaves, mangueras, etc.), atendiendo al público de Perote y sus alrededores.",
    fuente: `${MB}, 4 y 6.1`,
  },

  // ---------------------------------------------------------- SUCURSAL
  {
    id: "sucursal-direccion",
    categoria: "sucursal",
    pregunta: "¿Cuál es la dirección y el teléfono de la sucursal?",
    variantes: ["donde esta la tienda", "domicilio de la sucursal"],
    claves: ["direccion", "domicilio", "ubicacion", "donde", "telefono", "calle"],
    respuesta:
      "El Gigante de los Azulejos y Mármoles, sucursal Perote:\n" +
      "• Alejandro Von Humboldt Sur 603, Colonia Centro, C.P. 91270, Perote, Veracruz.\n" +
      "• Teléfono: 282 488 4555.\n" +
      "• Tiene aproximadamente 2 años en operación.",
    fuente: `${MB}, 6.1`,
  },
  {
    id: "sucursal-estructura",
    categoria: "sucursal",
    pregunta: "¿Cómo está organizada la sucursal? (organigrama)",
    variantes: ["quien depende de quien", "organigrama", "estructura de la sucursal"],
    claves: ["organigrama", "estructura", "areas", "organizada", "depende", "jerarquia"],
    respuesta:
      "• Gerente General: máxima autoridad de la sucursal; de él dependen directamente Ventas, Caja y el Jefe de Almacén.\n" +
      "• Del Jefe de Almacén dependen el Auxiliar de Inventarios, los Almacenistas y el Chofer de Reparto.\n" +
      "• Plantilla: 1 Gerente, 3 Asesores de Ventas, 1 Cajera(o), 1 Jefe de Almacén, 1 Auxiliar de Inventarios, 2 Almacenistas y 1 Chofer de Reparto.",
    fuente: `${MB}, 6.2 · ${MP}, 4 y 6`,
  },
  {
    id: "sucursal-a-quien-acudir",
    categoria: "sucursal",
    pregunta: "¿A quién le pregunto si tengo una duda?",
    variantes: ["con quien hablo", "a quien acudo", "quien me ayuda", "tengo un problema con quien voy"],
    claves: ["acudir", "dudas", "duda", "preguntar", "ayuda", "quien"],
    respuesta:
      "Tus dudas o inquietudes las diriges al Gerente de sucursal: es el responsable de tu inducción y de coordinar a todo el personal. Para nómina, incidencias, vacaciones, permisos y préstamos, el Gerente también es el enlace con Recursos Humanos corporativo. Para temas del día a día de Almacén o Reparto, tu jefe inmediato es el Jefe de Almacén.",
    fuente: `${MB}, 9`,
  },
  {
    id: "sucursal-nomina",
    categoria: "sucursal",
    pregunta: "¿Con quién veo temas de nómina o de Recursos Humanos?",
    variantes: ["mi pago salio mal", "dudas de mi sueldo", "recursos humanos"],
    claves: ["nomina", "sueldo", "pago", "rh", "recursos", "humanos", "quincena"],
    respuesta:
      "Con el Gerente de sucursal: él es el enlace con Recursos Humanos corporativo para nómina, incidencias, vacaciones, permisos y préstamos.",
    fuente: `${MB}, 9`,
  },
  {
    id: "sucursal-induccion",
    categoria: "sucursal",
    pregunta: "¿Cómo es la inducción cuando entro a trabajar?",
    variantes: ["soy nuevo que hago", "primer dia de trabajo", "que me van a ensenar"],
    claves: ["induccion", "nuevo", "primer", "ingreso", "bienvenida", "empiezo"],
    respuesta:
      "La inducción la da el Gerente de sucursal. Normalmente incluye:\n" +
      "• Presentarte con el equipo de trabajo.\n" +
      "• Recorrido por Ventas, Caja, Almacén y Reparto.\n" +
      "• Revisar el Manual de Bienvenida e Inducción.\n" +
      "• Revisar el Manual de Puestos y Funciones de tu puesto.\n" +
      "• Explicarte horario, código de vestimenta y políticas.\n" +
      "• Resolver tus dudas iniciales.\n" +
      "En esta página también tienes “Capacitación Express” con videos y lecciones de tu puesto.",
    link: { to: "/capacitacion", label: "Ir a Capacitación Express" },
    fuente: `${MB}, 8`,
  },

  // ---------------------------------------------------------- POLÍTICAS
  {
    id: "politica-horario",
    categoria: "politicas",
    pregunta: "¿Cuál es el horario de trabajo?",
    variantes: ["a que hora entro", "a que hora salgo", "a que hora abre la tienda", "a que hora cierran"],
    claves: ["horario", "hora", "entrada", "salida", "abre", "cierra", "entro", "salgo"],
    respuesta: "El horario laboral de la sucursal Perote es de 8:00 a.m. a 7:00 p.m.",
    fuente: `${MB}, 7.1`,
  },
  {
    id: "politica-uniforme-oficina",
    categoria: "politicas",
    pregunta: "¿Qué camisa me toca cada día? (Ventas, Caja y Gerencia)",
    variantes: ["que camisa uso", "codigo de vestimenta", "como me visto", "que ropa me pongo"],
    claves: ["camisa", "vestimenta", "uniforme", "ropa", "visto", "vestir", "codigo"],
    respuesta:
      "Código de vestimenta de Ventas, Caja y Gerencia:\n" +
      "• Lunes: camisa gris.\n" +
      "• Martes: camisa vino.\n" +
      "• Miércoles: camisa azul.\n" +
      "• Jueves: camisa azul marino.\n" +
      "• Viernes: camisa azul de rayas (Ventas: mezclilla o vestir autorizado).\n" +
      "• Sábado: playera tipo polo con logo de la empresa; se permiten tenis.\n" +
      "De lunes a viernes: zapato oscuro estilo casual.\n" +
      "Tip: pregúntame “¿qué camisa me toca hoy?” y te digo la del día.",
    fuente: `${MB}, 7.2`,
  },
  {
    id: "politica-uniforme-almacen",
    categoria: "politicas",
    pregunta: "¿Cuál es el uniforme de Almacén?",
    variantes: ["que uso en almacen", "equipo de proteccion"],
    claves: ["uniforme", "almacen", "botas", "faja", "guantes", "gorra", "polo"],
    respuesta:
      "El personal de Almacén usa uniforme proporcionado por la empresa: playeras tipo polo en rojo, gris, azul, azul marino y negro, con botas de trabajo, faja y guantes. La gorra está permitida.",
    fuente: `${MB}, 7.2`,
  },
  {
    id: "politica-imagen",
    categoria: "politicas",
    pregunta: "¿Hay reglas de imagen personal (cabello, maquillaje, piercing)?",
    variantes: ["puedo usar piercing", "puedo pintarme el cabello", "reglas de presentacion"],
    claves: ["cabello", "maquillaje", "piercing", "perforaciones", "tinte", "imagen", "presentacion", "pelo"],
    respuesta:
      "Sí, para Ventas, Caja y Gerencia:\n" +
      "• Colaboradoras: maquillaje no extravagante, cabello sin tinte de tono extravagante y sin perforaciones (piercing).\n" +
      "• Colaboradores: cabello corto y peinado.",
    fuente: `${MB}, 7.2`,
  },

  // ---------------------------------------------------------- VACACIONES / PERMISOS / PRÉSTAMOS
  {
    id: "vacaciones-dias",
    categoria: "vacaciones",
    pregunta: "¿Cuántos días de vacaciones me tocan?",
    variantes: ["dias de vacaciones por antiguedad", "tabla de vacaciones"],
    claves: ["vacaciones", "dias", "antiguedad", "tocan", "corresponden"],
    respuesta:
      "Depende de tus años de servicio:\n" +
      "• 1 año: 12 días · 2 años: 14 · 3 años: 16 · 4 años: 18 · 5 años: 20\n" +
      "• 6 a 10 años: 22 · 11 a 15: 24 · 16 a 20: 26 · 21 a 25: 28\n" +
      "Tip: pregúntame “¿cuántas vacaciones tengo con 3 años?” y te doy el número.",
    fuente: `${MB}, 7.3`,
  },
  {
    id: "vacaciones-cuando",
    categoria: "vacaciones",
    pregunta: "¿Cuándo y cómo se programan las vacaciones?",
    variantes: ["cuando pido vacaciones", "cuando puedo tomar vacaciones"],
    claves: ["programar", "programan", "pedir", "solicitar", "enero", "vacaciones", "cuando"],
    respuesta:
      "• Se programan una vez al año; la fecha máxima para entregarlas es la segunda quincena de enero.\n" +
      "• No se pueden tomar en temporadas de venta especial, Buen Fin ni aperturas de nuevas sucursales.\n" +
      "• No pueden coincidir de vacaciones dos personas de la misma área en la misma semana.\n" +
      "• Se tramitan con el Gerente de sucursal.",
    fuente: `${MB}, 7.3`,
  },
  {
    id: "vacaciones-reglas",
    categoria: "vacaciones",
    pregunta: "¿Las vacaciones se acumulan? ¿Cuántos días seguidos puedo tomar?",
    variantes: ["puedo juntar vacaciones", "maximo de dias seguidos", "se pierden las vacaciones"],
    claves: ["acumulables", "acumular", "juntar", "seguidos", "consecutivos", "maximo", "pierden"],
    respuesta:
      "• Las vacaciones NO son acumulables: se toman entre un aniversario laboral y el siguiente.\n" +
      "• Máximo 6 días consecutivos de vacaciones.",
    fuente: `${MB}, 7.3`,
  },
  {
    id: "permisos",
    categoria: "vacaciones",
    pregunta: "¿Cómo pido un permiso? ¿Es con goce de sueldo?",
    variantes: ["necesito faltar un dia", "permiso con goce", "permiso para faltar"],
    claves: ["permiso", "permisos", "goce", "faltar", "ausentarme", "emergencia", "doctor", "medico", "cita", "enfermo"],
    respuesta:
      "• Los permisos con goce de sueldo solo se dan en casos de fuerza mayor: el motivo se escribe en el formato correspondiente y lo autoriza Recursos Humanos.\n" +
      "• Si tienes de 3 a 12 meses de antigüedad, puedes pedir hasta 3 permisos a cuenta de vacaciones (se descuentan de los días que te correspondan).\n" +
      "• Se tramita con tu Gerente de sucursal.",
    fuente: `${MB}, 7.4`,
  },
  {
    id: "prestamos",
    categoria: "vacaciones",
    pregunta: "¿Puedo pedir un préstamo? ¿Qué requisitos hay?",
    variantes: ["me pueden prestar dinero", "adelanto de sueldo", "requisitos para prestamo"],
    claves: ["prestamo", "prestar", "adelanto", "dinero", "requisitos"],
    respuesta:
      "Sí, si cumples con TODO esto:\n" +
      "• Mínimo 6 meses de antigüedad.\n" +
      "• Opinión favorable de tu jefe inmediato.\n" +
      "• Tener como máximo un reporte de incidencias.\n" +
      "• No tener material a crédito pendiente.\n" +
      "El Gerente puede tramitar hasta $2,000.00; montos mayores los aprueba la Gerencia Regional.",
    fuente: `${MB}, 7.6`,
  },
  {
    id: "prestamos-gerente",
    categoria: "vacaciones",
    pregunta: "Como Gerente, ¿cuánto puedo prestar y de qué soy responsable?",
    claves: ["prestamo", "gerente", "monto", "regional", "descuento"],
    respuesta:
      "• Puedes tramitar préstamos a tu personal por hasta $2,000.00. Para montos mayores notifica y pide aprobación a la Gerencia Regional.\n" +
      "• Eres responsable de verificar que el préstamo se pague completo; si no, se te aplica un descuento nominal por el monto.",
    roles: ["gerencia"],
    fuente: `${MB}, 7.6`,
  },

  // ---------------------------------------------------------- INCIDENCIAS (personal)
  {
    id: "incidencias-baja",
    categoria: "incidencias",
    pregunta: "¿Con cuántas incidencias me dan de baja?",
    variantes: ["cuantas incidencias puedo tener", "cuando me corren", "cuantas actas"],
    claves: ["incidencias", "baja", "corren", "despido", "actas", "vigencia", "dura", "duran", "caducan"],
    respuesta:
      "Se da de baja al colaborador cuando acumula 3 incidencias vigentes. Cada incidencia tiene vigencia de 12 meses (después de un año ya no cuenta).",
    fuente: `${MB}, 7.5`,
  },
  {
    id: "incidencias-motivos",
    categoria: "incidencias",
    pregunta: "¿Por qué motivos me pueden levantar una incidencia?",
    variantes: ["que cuenta como incidencia", "por que me dan un formato de incidencia"],
    claves: ["motivos", "incidencia", "formato", "acta", "sancion", "porque"],
    respuesta:
      "Te pueden dar un formato de incidencia por:\n" +
      "• Incumplimiento de actividades.\n" +
      "• Faltas injustificadas.\n" +
      "• Retardos posteriores al límite permisible.\n" +
      "• Relaciones de índole romántica dentro de las sucursales.\n" +
      "• Fumar, vapear o tomar bebidas alcohólicas dentro de la sucursal en jornada laboral.\n" +
      "• Comportamiento agresivo o indebido.",
    fuente: `${MB}, 7.5`,
  },
  {
    id: "incidencias-retardos-faltas",
    categoria: "incidencias",
    pregunta: "¿Qué pasa si llego tarde o falto?",
    variantes: ["retardos", "falta injustificada", "llegue tarde"],
    claves: ["retardo", "retardos", "tarde", "falta", "faltas", "falto", "injustificada", "tolerancia"],
    respuesta:
      "Las faltas injustificadas y los retardos que pasan el límite permitido generan un formato de incidencia, y 3 incidencias vigentes (12 meses) llevan a la baja. Pregúntale a tu Gerente cuál es la tolerancia de llegada en la sucursal y, si vas a faltar por fuerza mayor, avísale lo antes posible para tramitar un permiso.",
    fuente: `${MB}, 7.4 y 7.5`,
  },
  {
    id: "incidencias-fumar",
    categoria: "incidencias",
    pregunta: "¿Puedo fumar o vapear en la sucursal?",
    variantes: ["se puede fumar", "puedo tomar alcohol"],
    claves: ["fumar", "cigarro", "cigarros", "vapear", "vapeador", "alcohol", "cerveza", "tomar"],
    respuesta:
      "No. Consumir cigarros, vapeadores o bebidas alcohólicas dentro de la sucursal en jornada laboral es motivo de incidencia.",
    fuente: `${MB}, 7.5`,
  },
  {
    id: "incidencias-relaciones",
    categoria: "incidencias",
    pregunta: "¿Se permiten las relaciones de pareja entre compañeros?",
    claves: ["pareja", "novio", "novia", "romantica", "relacion", "noviazgo"],
    respuesta: "Las relaciones de índole romántica dentro de las sucursales son motivo de incidencia.",
    fuente: `${MB}, 7.5`,
  },

  // ---------------------------------------------------------- PUESTOS
  {
    id: "puesto-gerente",
    categoria: "puestos",
    pregunta: "¿Qué hace el Gerente General?",
    variantes: ["funciones del gerente", "responsabilidades de gerencia"],
    claves: ["gerente", "gerencia", "funciones"],
    respuesta:
      "Dirige, coordina y supervisa la sucursal (comercial, administrativo, operativo y personal). Reporta a Recursos Humanos y tiene a cargo a Ventas, Caja, Almacén y Reparto. Principales funciones:\n" +
      "• Estrategias y metas de venta; supervisar al equipo de Ventas y atender negociaciones grandes.\n" +
      "• Supervisar existencias y dar seguimiento a diferencias, mermas e incidencias de Almacén.\n" +
      "• Organizar al personal: actividades, horarios, incidencias y capacitación.\n" +
      "• Supervisar los cortes diarios de Caja.\n" +
      "• Coordinar y priorizar las rutas de reparto.\n" +
      "• Cuidar el piso de venta y las exhibiciones.\n" +
      "• Atender garantías, reclamaciones e inconformidades de clientes.\n" +
      "Perfil: licenciatura y experiencia en gerencia o subgerencia de sucursales.",
    fuente: `${MP}, 6.1`,
  },
  {
    id: "puesto-ventas",
    categoria: "puestos",
    pregunta: "¿Qué hace un Asesor de Ventas?",
    variantes: ["funciones de ventas", "que hace el vendedor", "responsabilidades del asesor"],
    claves: ["asesor", "ventas", "vendedor", "vendedora", "funciones"],
    respuesta:
      "Atiende y asesora a los clientes para contribuir a las metas de venta. Jefe inmediato: Gerencia General. Son 3 asesores. Principales funciones:\n" +
      "• Asesorar al cliente y orientarlo en productos y materiales complementarios.\n" +
      "• Cuantificar el material según las medidas del cliente.\n" +
      "• Hacer cotizaciones y notas de pedido verificando productos, cantidades y claves, y darles seguimiento.\n" +
      "• Coordinarse con Caja para el cobro y con Almacén para disponibilidad (lote, tono, calibre) y surtido.\n" +
      "• Mantener exhibiciones, etiquetas de precios y señalización en buen estado.\n" +
      "• Respetar precios, descuentos y condiciones comerciales autorizadas.\n" +
      "Apoyo: orden y limpieza; cobros básicos en Caja si se necesita (sin arqueo ni corte).",
    fuente: `${MP}, 6.2`,
  },
  {
    id: "puesto-caja",
    categoria: "puestos",
    pregunta: "¿Qué hace la Cajera(o)?",
    variantes: ["funciones de caja", "responsabilidades de caja"],
    claves: ["cajera", "cajero", "caja", "funciones"],
    respuesta:
      "Cobra y registra las operaciones, emite comprobantes y controla los valores. Jefe inmediato: Gerencia General. Principales funciones:\n" +
      "• Procesar pagos y verificar que los importes coincidan con las notas o pedidos.\n" +
      "• Emitir tickets, facturas (CFDI) y comprobantes.\n" +
      "• Hacer arqueo y corte de Caja y resguardar el efectivo y valores.\n" +
      "• Registrar anticipos y cobros, incluidos los que trae el Chofer de Reparto.\n" +
      "• Reportar a Gerencia cualquier diferencia o inconsistencia.\n" +
      "Perfil: bachillerato o carrera técnica en contabilidad; experiencia en caja, TPV, facturación y arqueos.",
    fuente: `${MP}, 6.3`,
  },
  {
    id: "puesto-jefe-almacen",
    categoria: "puestos",
    pregunta: "¿Qué hace el Jefe de Almacén?",
    variantes: ["funciones del jefe de almacen", "responsabilidades del jefe de bodega"],
    claves: ["jefe", "almacen", "bodega", "funciones"],
    respuesta:
      "Coordina y supervisa recepción, almacenamiento, control, surtido y salida de mercancía. Jefe inmediato: Gerencia General. Tiene a cargo al Auxiliar de Inventarios, los Almacenistas y el Chofer de Reparto. Principales funciones:\n" +
      "• Supervisar la recepción y comparar la mercancía contra la documentación.\n" +
      "• Controlar existencias e identificar diferencias; verificar códigos, lotes, tonos y calibres.\n" +
      "• Coordinar surtido de pedidos, carga y descarga, y el acomodo en el almacén.\n" +
      "• Asignar las actividades diarias del personal de Almacén.\n" +
      "• Dar seguimiento a mermas y productos dañados y reportarlos a Gerencia.\n" +
      "• Coordinar con Reparto la preparación y carga de pedidos; reportar fallas de equipos.",
    fuente: `${MP}, 6.4.1`,
  },
  {
    id: "puesto-auxiliar-inventarios",
    categoria: "puestos",
    pregunta: "¿Qué hace el Auxiliar de Inventarios?",
    variantes: ["funciones del auxiliar de inventarios"],
    claves: ["auxiliar", "inventarios", "inventario", "funciones"],
    respuesta:
      "Apoya al Jefe de Almacén en el control de existencias. Jefe inmediato: Jefe de Almacén. Principales funciones:\n" +
      "• Participar en conteos físicos y verificaciones de inventario.\n" +
      "• Identificar, organizar y localizar productos; verificar códigos, cantidades, lotes, tonos y calibres.\n" +
      "• Registrar y consultar información en el sistema.\n" +
      "• Ayudar a encontrar diferencias entre lo físico y el sistema, y reportar faltantes, daños o inconsistencias.\n" +
      "• Mantener ordenada la documentación de inventario.",
    fuente: `${MP}, 6.4.2`,
  },
  {
    id: "puesto-almacenista",
    categoria: "puestos",
    pregunta: "¿Qué hace un Almacenista?",
    variantes: ["funciones del almacenista"],
    claves: ["almacenista", "almacenistas", "funciones", "bodeguero"],
    respuesta:
      "Recibe, acomoda, surte, prepara y carga mercancía. Jefe inmediato: Jefe de Almacén. Son 2 almacenistas. Principales funciones:\n" +
      "• Recibir y descargar mercancía y llevarla a su ubicación.\n" +
      "• Localizar, separar y preparar pedidos verificando producto, cantidad y clave (y lote, tono y calibre cuando haga falta).\n" +
      "• Cargar las unidades de reparto y apoyar a cargar vehículos de clientes.\n" +
      "• Acomodar y estibar bien para evitar daños; mantener el orden.\n" +
      "• Reportar daños, roturas, faltantes o diferencias y participar en conteos físicos.\n" +
      "• Nunca entregar mercancía sin su documentación.",
    fuente: `${MP}, 6.4.3`,
  },
  {
    id: "puesto-chofer",
    categoria: "puestos",
    pregunta: "¿Qué hace el Chofer de Reparto?",
    variantes: ["funciones del chofer", "responsabilidades de reparto"],
    claves: ["chofer", "reparto", "repartidor", "funciones", "conductor"],
    respuesta:
      "Transporta y entrega la mercancía completa y en buen estado. Jefe inmediato: Jefe de Almacén. Principales funciones:\n" +
      "• Revisar la unidad y la ruta asignada antes de salir.\n" +
      "• Participar en la carga y verificar que la mercancía coincida con la documentación (y lote, tono y calibre con Almacén).\n" +
      "• Entregar, descargar y obtener firma o comprobante de recepción.\n" +
      "• Recibir cobros contra entrega y entregarlos completos a Caja con su documentación.\n" +
      "• Avisar al Jefe de Almacén el avance de la ruta y reportar incidencias.\n" +
      "• Subir evidencia fotográfica de cada entrega.\n" +
      "Requisito: licencia de conducir vigente.",
    fuente: `${MP}, 6.5`,
  },
  {
    id: "puesto-jefes",
    categoria: "puestos",
    pregunta: "¿Quién es el jefe inmediato de cada puesto?",
    variantes: ["quien es mi jefe", "a quien le reporto", "quien es mi jefe inmediato", "quien manda"],
    claves: ["jefe", "inmediato", "reporto", "mando"],
    respuesta:
      "• Gerente General → reporta a Recursos Humanos.\n" +
      "• Asesores de Ventas y Cajera(o) → Gerencia General.\n" +
      "• Jefe de Almacén → Gerencia General.\n" +
      "• Auxiliar de Inventarios, Almacenistas y Chofer de Reparto → Jefe de Almacén.",
    fuente: `${MP}, 6`,
  },
  {
    id: "puesto-perfiles",
    categoria: "puestos",
    pregunta: "¿Qué estudios o requisitos pide cada puesto?",
    variantes: ["perfil de puesto", "que escolaridad piden"],
    claves: ["perfil", "escolaridad", "estudios", "requisitos", "experiencia"],
    respuesta:
      "• Gerente General: licenciatura; experiencia en gerencia/subgerencia de sucursales.\n" +
      "• Asesor de Ventas: bachillerato; experiencia en ventas de mostrador.\n" +
      "• Cajera(o): bachillerato o carrera técnica en contabilidad; experiencia en caja, TPV, CFDI y arqueos.\n" +
      "• Jefe de Almacén: bachillerato; experiencia como encargado de bodega, inventarios, mermas y montacargas.\n" +
      "• Auxiliar de Inventarios y Almacenista: secundaria o bachillerato.\n" +
      "• Chofer de Reparto: secundaria o bachillerato, experiencia en repartos locales y licencia vigente.",
    fuente: `${MP}, 6`,
  },

  // ---------------------------------------------------------- OPERACIÓN ("¿quién hace...?" / "¿qué hago si...?")
  {
    id: "op-lote-tono-calibre",
    categoria: "operacion",
    pregunta: "¿Quién revisa lote, tono y calibre de un pedido?",
    variantes: ["el cliente quiere el mismo tono", "verificar tono"],
    claves: ["lote", "tono", "calibre", "uniformidad"],
    respuesta:
      "Ventas lo consulta con Almacén. El Jefe de Almacén, el Auxiliar de Inventarios y los Almacenistas lo verifican al preparar el pedido para que salga uniforme, y el Chofer lo confirma con Almacén antes de salir. Si el cliente necesita completar un piso ya instalado, pide que se revise el mismo lote y tono.",
    fuente: `${MP}, 6.2–6.5`,
  },
  {
    id: "op-mercancia-danada",
    categoria: "operacion",
    pregunta: "¿Qué hago si encuentro mercancía dañada o rota?",
    variantes: ["se rompio una caja", "material roto", "merma"],
    claves: ["danada", "danado", "rota", "roto", "rompio", "merma", "quebrado", "defectuoso"],
    respuesta:
      "Repórtalo al Jefe de Almacén en ese momento; él da seguimiento y lo informa a Gerencia. En la página, Almacén o Gerencia lo registran en Inventario → “Dar de baja”, con el motivo y una foto como evidencia.",
    link: { to: "/inventario?tab=merma", label: "Ir a Merma" },
    fuente: `${MP}, 6.4`,
  },
  {
    id: "op-faltante",
    categoria: "operacion",
    pregunta: "¿Qué hago si falta material o no cuadra lo que dice el sistema?",
    variantes: ["el sistema dice que hay y no hay", "no encuentro el material", "diferencia de inventario"],
    claves: ["falta", "faltante", "diferencia", "descuadre", "cuadra", "sistema", "encuentro"],
    respuesta:
      "Repórtalo al Jefe de Almacén (el Auxiliar de Inventarios le ayuda a encontrar la diferencia). Para corregirlo en la página, Almacén hace un “Conteo físico” del producto: el sistema se ajusta solo y le avisa a Gerencia. Mientras tanto, no le prometas ese material al cliente.",
    link: { to: "/inventario?tab=conteos", label: "Ir a Conteos físicos" },
    fuente: `${MP}, 6.4`,
  },
  {
    id: "op-sin-documento",
    categoria: "operacion",
    pregunta: "¿Puedo entregar mercancía sin nota o documento?",
    claves: ["entregar", "documento", "documentacion", "nota", "remision", "sin"],
    respuesta:
      "No. Una de las responsabilidades de Almacén es evitar entregar mercancía sin su documentación. Verifica siempre producto, cantidad y clave contra la nota. Caja y Almacén se coordinan para revisar la documentación antes de la salida.",
    fuente: `${MP}, 6.3 y 6.4.3`,
  },
  {
    id: "op-cobro-reparto",
    categoria: "operacion",
    pregunta: "¿A quién le entrega el chofer el dinero que cobró?",
    variantes: ["cobro contra entrega", "que hago con el dinero del reparto"],
    claves: ["dinero", "cobro", "contra", "entrega", "chofer", "efectivo", "cobre"],
    respuesta:
      "A Caja. El chofer resguarda temporalmente lo cobrado y lo entrega completo en Caja junto con la documentación (acuses, remisiones, comprobantes). Caja lo registra y confirma el cierre del reparto en “Evidencias y Cobros”.",
    link: { to: "/evidencias-cobros", label: "Ir a Evidencias y Cobros" },
    fuente: `${MP}, 6.3 y 6.5`,
  },
  {
    id: "op-garantias",
    categoria: "operacion",
    pregunta: "Un cliente viene a reclamar o pide una garantía, ¿qué hago?",
    variantes: ["cliente molesto", "queja de cliente", "devolucion"],
    claves: ["garantia", "reclamacion", "reclamo", "queja", "molesto", "inconformidad", "devolucion"],
    respuesta:
      "Atiéndelo con respeto y canalízalo con el Gerente de sucursal: las garantías, reclamaciones e inconformidades que requieren resolución las atiende Gerencia. Si hay un problema con mercancía, avisa también a Almacén.",
    fuente: `${MP}, 6.1`,
  },
  {
    id: "op-diferencia-caja",
    categoria: "operacion",
    pregunta: "¿Qué hago si hay una diferencia en el corte de caja?",
    claves: ["corte", "arqueo", "diferencia", "caja", "sobra", "falta", "cuadra"],
    respuesta:
      "Caja debe reportar a Gerencia General cualquier diferencia o inconsistencia en cobro, registro o corte. Gerencia revisa los cortes diarios y da seguimiento a lo que no cuadre.",
    roles: ["caja", "gerencia"],
    fuente: `${MP}, 6.1 y 6.3`,
  },
  {
    id: "op-ventas-cobrar",
    categoria: "operacion",
    pregunta: "¿Ventas puede cobrar en Caja?",
    claves: ["ventas", "cobrar", "caja", "apoyo", "cubrir"],
    respuesta:
      "Solo como apoyo temporal y para cobros básicos cuando la operación lo requiera. Ventas NO hace arqueo, corte ni resguardo de valores: eso es exclusivo de Caja.",
    fuente: `${MP}, 6.2`,
  },
  {
    id: "op-montacargas",
    categoria: "operacion",
    pregunta: "¿Quién puede usar el montacargas?",
    variantes: ["quien maneja el montacargas"],
    claves: ["montacargas", "maquinaria", "usar", "manejar", "maneja"],
    respuesta:
      "El Jefe de Almacén lo maneja como parte de su puesto. Los Almacenistas solo cuando corresponda y estén autorizados para usarlo.",
    fuente: `${MP}, 6.4.1 y 6.4.3`,
  },
  {
    id: "op-rutas",
    categoria: "operacion",
    pregunta: "¿Quién programa las rutas de reparto?",
    claves: ["rutas", "ruta", "programa", "asigna", "reparto"],
    respuesta:
      "Gerencia coordina y prioriza las rutas; el Jefe de Almacén asigna la ruta y las entregas al Chofer y le da seguimiento durante el recorrido. El Chofer revisa su ruta antes de salir e informa el avance.",
    link: { to: "/repartos", label: "Ver Repartos" },
    fuente: `${MP}, 6.1, 6.4.1 y 6.5`,
  },
  {
    id: "op-exhibiciones",
    categoria: "operacion",
    pregunta: "¿Quién se encarga de las exhibiciones y etiquetas de precio?",
    claves: ["exhibicion", "exhibiciones", "muestras", "etiquetas", "precios", "exhibidores"],
    respuesta:
      "Ventas mantiene actualizadas las exhibiciones, etiquetas de precios y señalización, y apoya al cambiar muestras. Gerencia supervisa el piso de venta. Almacenistas apoyan a mover exhibidores y paneles. En la página: las etiquetas se hacen en “Generador de Etiquetas” y el material que sale a exhibición se registra en Inventario → “Exhibición”.",
    link: { to: "/etiquetas", label: "Ir a Etiquetas" },
    fuente: `${MP}, 6.1, 6.2 y 6.4.3`,
  },
  {
    id: "op-unidad-falla",
    categoria: "operacion",
    pregunta: "¿Qué hago si la camioneta de reparto tiene una falla?",
    claves: ["camioneta", "unidad", "falla", "mantenimiento", "descompuso", "llanta"],
    respuesta:
      "El Chofer revisa la unidad antes de cada ruta y reporta fallas o necesidades de mantenimiento al Jefe de Almacén (quien las sube a Gerencia). Si pasa durante una entrega, márcalo como “Incidencia” en el reparto para que todos se enteren.",
    fuente: `${MP}, 6.5`,
  },
];
