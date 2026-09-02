# Portal Interno — El Gigante de los Azulejos y Mármoles (Sucursal Perote)

Prototipo funcional de sitio web interno.
**Etapa 1 completada:** autenticación real con Supabase, roles funcionales, layout base.
**Etapa 2 completada:** dashboard real de "Inicio", adaptado según el rol, con datos DEMO.

> **Corrección técnica aplicada (Etapa 1):** la migración SQL fue corregida para eliminar un riesgo de recursión infinita en las políticas RLS de `profiles`. La solución final usa una tabla espejo `user_roles` sin RLS — ver detalle en los comentarios de `supabase/migrations/0001_init_profiles.sql`. También se retiró temporalmente el script `npm run lint` de `package.json` porque ESLint aún no estaba configurado en el proyecto.

> Este prototipo es para pruebas piloto con datos DEMO. No sustituye ni modifica el sistema oficial de ventas de la empresa.

---

## 1. Requisitos

- Node.js 18 o superior instalado en tu computadora.
- Una cuenta gratuita en [supabase.com](https://supabase.com).
- (Más adelante) una cuenta en [github.com](https://github.com) y en [netlify.com](https://netlify.com) — no se necesitan todavía en la Etapa 1.

---

## 2. Crear tu proyecto de Supabase (hazlo tú, paso a paso)

1. Entra a **https://supabase.com** y crea una cuenta (puedes usar "Continue with GitHub" o correo).
2. Da clic en **"New project"**.
3. Elige/crea una organización, ponle un nombre al proyecto, por ejemplo `gigante-perote`.
4. Crea una **contraseña de base de datos** (guárdala en un lugar seguro, no la necesitas para este prototipo pero Supabase la pide).
5. Elige la región más cercana (por ejemplo, la de EE.UU. más cercana a México) y da clic en **"Create new project"**. Tarda 1-2 minutos en aprovisionarse.

### 2.1 Ejecutar el script SQL de la Etapa 1

1. Dentro de tu proyecto, en el menú lateral izquierdo entra a **"SQL Editor"**.
2. Da clic en **"New query"**.
3. Abre el archivo `supabase/migrations/0001_init_profiles.sql` de este proyecto, copia **todo** su contenido y pégalo en el editor.
4. Da clic en **"Run"** (o Ctrl+Enter). Debe decir "Success. No rows returned".

Esto crea: el tipo de rol (`gerencia`, `ventas`, `caja`, `almacen`, `reparto`), la tabla `profiles`, un disparador (trigger) que crea automáticamente el perfil cuando se crea un usuario, y las políticas de seguridad (RLS).

### 2.2 Copiar tus claves públicas

1. En el menú lateral entra a **"Project Settings"** (ícono de engrane) → **"Data API"** (o "API" según la versión).
2. Copia el valor de **"Project URL"**.
3. Copia el valor de **"anon public"** (clave pública). **No copies la "service_role"**, esa nunca debe usarse en el frontend.

### 2.3 Crear usuarios DEMO para probar los 5 roles

1. En el menú lateral entra a **"Authentication" → "Users"**.
2. Da clic en **"Add user" → "Create new user"**.
3. Llena:
   - **Email:** por ejemplo `gerencia.demo@gigante.com`
   - **Password:** una contraseña de prueba, por ejemplo `Demo1234!`
   - Activa la opción **"Auto Confirm User"** (para no tener que confirmar por correo).
4. Da clic en **Create user**. Esto dispara el trigger y crea automáticamente su fila en `profiles` con rol `ventas` por defecto (lo corregimos en el siguiente paso).
5. Ve a **"Table Editor" → tabla `profiles"`**. Busca la fila del usuario que acabas de crear.
6. Edita esa fila directamente en la tabla:
   - `full_name`: escribe un nombre DEMO, ej. `Gerente Demo`
   - `role`: selecciona el rol correspondiente, ej. `gerencia`
7. **Repite los pasos 2-6** para crear un usuario de prueba por cada rol, por ejemplo:

   | Email                     | Rol       | full_name       |
   |---------------------------|-----------|------------------|
   | gerencia.demo@gigante.com | gerencia  | Gerente Demo     |
   | ventas.demo@gigante.com   | ventas    | Ventas Demo      |
   | caja.demo@gigante.com     | caja      | Caja Demo        |
   | almacen.demo@gigante.com  | almacen   | Almacén Demo     |
   | reparto.demo@gigante.com  | reparto   | Reparto Demo     |

No compartas estas contraseñas fuera del equipo de prueba; son solo para el piloto interno.

---

## 3. Configurar el proyecto en tu computadora

1. Descomprime/coloca esta carpeta del proyecto donde prefieras.
2. Abre una terminal dentro de la carpeta `gigante-perote`.
3. Instala las dependencias:
   ```
   npm install
   ```
4. Copia el archivo de ejemplo de variables de entorno:
   ```
   cp .env.example .env
   ```
5. Abre el archivo `.env` (recién creado) y reemplaza los valores con los que copiaste en el paso 2.2:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-aqui
   ```
6. Guarda el archivo. **Este archivo `.env` nunca se sube a GitHub** (ya está excluido en `.gitignore`).

---

## 4. Ejecutar el proyecto localmente

```
npm run dev
```

Abre en tu navegador la dirección que aparece en la terminal (normalmente `http://localhost:5173`).

### Cómo probar que la Etapa 1 funciona

1. Deberías ver la pantalla de **Login**, con el diseño de dos paneles (panel azul + tarjeta de login) igual que en la imagen de referencia, y en una sola columna si abres el navegador angosto o desde el celular.
2. Inicia sesión con uno de los usuarios DEMO que creaste (ej. `gerencia.demo@gigante.com` / `Demo1234!`).
3. Deberías entrar a la pantalla **Inicio**, con el sidebar azul a la izquierda (en escritorio) o el menú inferior (en móvil), mostrando únicamente los módulos permitidos para ese rol.
4. La tarjeta de bienvenida debe mostrar tu nombre DEMO y tu rol correctamente.
5. Da clic en tu usuario (arriba a la derecha) → **Cerrar sesión**. Debes regresar a la pantalla de Login.
6. Prueba con los otros 4 usuarios DEMO y verifica que cada uno ve el sidebar/menú correspondiente a su rol (por ejemplo, `reparto.demo` no debe ver "Administración").
7. Prueba reduciendo el ancho de la ventana (o abriendo desde el celular) para confirmar que el layout cambia a la versión móvil con menú inferior.

Si algo no funciona (pantalla en blanco, error de "faltan variables de entorno", etc.), revisa que el archivo `.env` tenga los valores correctos y reinicia `npm run dev`.

---

## 5. Estructura del proyecto

```
gigante-perote/
├── src/
│   ├── components/layout/   → Sidebar, BottomNav, Header, AppLayout
│   ├── context/AuthContext  → sesión, perfil y rol del usuario actual
│   ├── lib/supabaseClient   → conexión a Supabase (usa solo la clave pública)
│   ├── pages/                → pantallas (Login, Inicio; se irán agregando más)
│   ├── routes/ProtectedRoute → protege rutas por sesión y por rol
│   └── types/                → roles, perfil, lista de módulos de navegación
├── supabase/migrations/      → scripts SQL versionados de la base de datos
├── .env.example               → plantilla de variables de entorno (sin secretos)
└── README.md
```

## 6. Qué se hizo en la Etapa 2

El dashboard "Inicio" ahora es real (no solo un mensaje de bienvenida): muestra tarjetas de
estadísticas, accesos rápidos, el resumen de inventario (gráfico de dona) y actividad reciente /
próximos repartos, **adaptado según el rol** que inició sesión (por ejemplo, Reparto no ve tarjetas
de ventas ni el inventario). Todos los números son **datos DEMO** explícitamente marcados como tales
(ver `src/data/demoData.ts`) — se conectarán a datos reales conforme se construyan los módulos de
Inventario, Ventas, Repartos y Retiros. También se agregaron páginas "próximamente" para el resto de
módulos, para que el menú y los accesos rápidos no lleven a páginas rotas mientras tanto.

## 7. Qué se hizo en la Etapa 3 — Inventario

El módulo de Inventario ya es real, con su propia tabla en Supabase (`products` y
`inventory_movements`, ver `supabase/migrations/0002_inventario.sql`). Incluye:

- Tarjetas de resumen (total de productos, existencia física, vendidos pendientes, disponibles)
- Búsqueda por nombre/código/marca y filtros por categoría y marca
- Pestañas "Lista de productos" y "Movimientos"
- Botón **"Registrar entrada"** (solo visible para Gerencia y Almacén), que llama a una función de
  Supabase (`register_inventory_entry`) que registra el movimiento y actualiza el stock de forma
  atómica
- 8 productos **DEMO** de ejemplo (nombres y marcas genéricos, no productos reales de la empresa)

**Decisión tomada sin preguntar (avísame si prefieres otra cosa):** todavía no se construyó la
pantalla de "Detalle del producto" individual (con su historial de movimientos por producto) — se
dejó para cuando se conecte el módulo de Ventas en la Etapa 4, para no construir de más por ahora.
El "Registrar entrada" está limitado a Gerencia y Almacén; Ventas puede ver el inventario pero no
modificarlo, según lo que definiste sobre los roles.

### Para aplicar la Etapa 3 en tu Supabase

1. Ve a **SQL Editor > New query** en tu proyecto de Supabase.
2. Copia y pega todo el contenido de `supabase/migrations/0002_inventario.sql`.
3. Dale **Run**. Si aparece un aviso de RLS (como pasó en la Etapa 1), revisa el aviso — en este
   caso ambas tablas nuevas sí tienen RLS habilitado, así que no debería aparecer, pero si aparece
   algún otro aviso, mándame captura antes de confirmar.

## 8. Qué se hizo en la Etapa 4 — Ventas y Entregas + Retiros en Sucursal

Se agregó el flujo de venta con **3 tipos de entrega**, confirmado contigo:

- **Entrega inmediata**: el cliente paga y se lleva el material en el momento. La existencia física
  se descuenta de inmediato.
- **Retiro en sucursal**: el material se aparta ("vendidos pendientes") y la existencia física se
  descuenta hasta que alguien confirme el retiro en el módulo de **Retiros en Sucursal**.
- **Entrega a domicilio**: por ahora solo queda registrada como pendiente; la confirmación real de
  entrega se conectará en la **Etapa 5 (Repartos)**.

Se agregaron las tablas `sales` y `sale_items`, y dos funciones de Supabase que mueven el inventario
de forma segura y atómica: `register_sale` (crea la venta y sus movimientos) y `confirm_retiro`
(confirma la recolección y descuenta existencia real). Ver `supabase/migrations/0003_ventas.sql`.

También se agregó un **precio DEMO** a cada producto (columna `unit_price`), solo para poder calcular
totales de venta de ejemplo — no es una lista de precios real de la empresa.

**Decisión tomada sin preguntar (avísame si prefieres otra cosa):** el precio de cada producto DEMO
lo definí yo mismo con valores de ejemplo razonables; cuando carguen su catálogo real, esos precios
se reemplazan sin tener que tocar el resto del sistema.

### Para aplicar la Etapa 4 en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0003_ventas.sql`.
3. Dale **Run**.

## 9. Etapa 4b — Fecha estimada de recolección

A petición tuya, se agregó un campo opcional de "fecha estimada de recolección" para las ventas
con entrega tipo "Retiro en sucursal", visible al registrar la venta y en la pantalla de Retiros en
Sucursal. Ver `supabase/migrations/0004_fecha_retiro.sql` (agrégalo después del 0003, en el SQL
Editor, igual que los anteriores).

## 10. Etapa 5 — Repartos

Cuando se registra una venta con "Entrega a domicilio" (Etapa 4), ahora se crea automáticamente su
reparto correspondiente. La pantalla de Repartos incluye:

- Tarjetas de resumen (repartos hoy, completados, en camino, pendientes)
- Mapa con OpenStreetMap/Leaflet — **las ubicaciones son aproximadas (DEMO)**, ya que el prototipo
  no geocodifica direcciones reales todavía; queda documentado en la propia pantalla y en el código
- Lista de repartos con acceso al **detalle de entrega**: cambiar estado (Pendiente → En camino →
  Entregado / Incidencia), asignar chofer/vehículo, registrar kilometraje inicial/actual, y notas
- Al marcar "Entregado", se descuenta la existencia física real del inventario (mismo mecanismo que
  Retiros en Sucursal)

**Decisión tomada sin preguntar (avísame si prefieres otra cosa):** todavía no se construyó la
evidencia fotográfica ni la firma del cliente en canvas — quedan para la **Etapa 5b**, como
acordamos, para no construir todo junto.

### Para aplicar la Etapa 5 en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0005_repartos.sql`.
3. Dale **Run**.

## 12. Etapa — Entregas y retiros parciales

A petición del jefe de almacén, se agregó soporte para:

- Un cliente compra 50 cajas y se lleva 30 en el momento, dejando 20 pendientes.
- Un cliente compra un producto que se lleva de inmediato y otro que se le entrega después a
  domicilio, en la **misma venta** (cada producto puede tener su propio tipo de entrega).
- Un cliente pasa varias veces a recoger partes de su pedido (retiros parciales en sucursal).
- Un pedido grande se reparte en varios viajes ("Registrar viaje adicional" en el detalle de un
  reparto).

Cada renglón de una venta ahora sabe cuánto de esa cantidad ya se entregó. El estado de la venta
puede ser **Pendiente**, **Parcial** o **Entregada** según cuánto falte. Ver
`supabase/migrations/0006a_entregas_parciales_enum.sql` y
`supabase/migrations/0006b_entregas_parciales.sql`.

**Corrección de permisos incluida:** el rol Reparto no podía ver el detalle de las ventas asociadas
a sus repartos (solo veía el reparto, sin datos del cliente/productos) — ya corregido en el mismo
script.

**Simplificación documentada:** el sistema no distingue "cantidad ya asignada a un viaje pendiente"
de "cantidad aún sin asignar a ningún viaje" — si se crean dos viajes al mismo tiempo para el mismo
pedido, es responsabilidad de quien los registra no exceder lo realmente disponible. Para el volumen
de una sucursal esto es razonable; se puede reforzar más adelante si hace falta.

### Para aplicar esto en tu Supabase (2 pasos, en orden)

1. **Primero**, en una consulta nueva y en blanco, ejecuta **todo** el contenido de
   `supabase/migrations/0006a_entregas_parciales_enum.sql`. Espera a que diga "Success".
2. **Después**, en otra consulta nueva, ejecuta todo el contenido de
   `supabase/migrations/0006b_entregas_parciales.sql`.

⚠️ No los juntes en una sola consulta — Postgres no lo permite (el motivo está explicado en los
comentarios del propio archivo).

## 13. Pendiente de definir contigo — Facturas de proveedores y Merma

El jefe de almacén también propuso: registrar facturas semanales de entrada (con foto de la factura,
proveedor, y conteo por marca/línea), y un apartado para dar de baja material dañado (con foto y
motivo). Ambas ideas son buenas y factibles, pero requieren configurar primero **Supabase Storage**
(el servicio para guardar imágenes), que todavía no hemos configurado — es un paso manual tuyo que
se hará guiado, por separado, antes de programar esta parte.

## 13. Facturas de proveedores y Merma — completado

Se agregaron dos pestañas nuevas dentro de Inventario:

- **Facturas**: registra facturas semanales de entrada (número de factura, proveedor, foto de la
  factura, y uno o más productos con su cantidad). Aumenta la existencia física real y queda
  registrado en Movimientos. Muestra un contador de "facturas registradas esta semana".
- **Merma**: da de baja material dañado (producto, cantidad, motivo obligatorio, foto opcional).
  Descuenta la existencia física real; no permite dar de baja más de lo que hay en existencia.

Ambas acciones están restringidas a **Gerencia y Almacén**, con evidencia fotográfica guardada en
Supabase Storage (buckets `facturas` y `merma`, creados como públicos para simplificar el
prototipo — la restricción real está en quién puede *subir* archivos, no en quién puede verlos).

Ver `supabase/migrations/0007a_facturas_merma_enum.sql` y
`supabase/migrations/0007b_facturas_merma.sql`.

### Para aplicar esto en tu Supabase

0. Debes tener ya creados, desde el Dashboard de Supabase (Storage), los buckets **"facturas"** y
   **"merma"**, ambos como **Public**.
1. En una consulta nueva y en blanco, ejecuta **todo** `0007a_facturas_merma_enum.sql`. Espera "Success".
2. En otra consulta nueva, ejecuta **todo** `0007b_facturas_merma.sql`.

## 14. Ajuste — Caja ahora puede consultar Ventas

A petición del equipo (refleja el proceso real: el vendedor genera la orden, el cliente paga en
Caja con el número de orden), el rol **Caja** ahora puede **ver** la pantalla de Ventas y Entregas
para consultar el folio y el total a cobrar. Caja sigue sin poder crear ni editar ventas — eso
sigue siendo exclusivo de Gerencia y Ventas. Ver `supabase/migrations/0008_caja_ve_ventas.sql`.

## 16. Etapa 6 — Evidencias y Cobros

Retoma el proceso real de cobro en reparto que confirmaste: el chofer entrega el material a
domicilio, recibe el dinero del cliente (efectivo, transferencia o tarjeta), captura la **firma del
cliente en canvas** y una o varias **fotos de evidencia**, y marca el reparto como "Entregado". A
partir de esta etapa, **ya no se puede marcar un reparto como entregado sin esa evidencia** — el
sistema lo exige tanto en la pantalla como en el propio servidor (Supabase).

Después, cuando **Caja** recibe físicamente ese dinero de manos del chofer, entra a la nueva
pantalla **"Evidencias y Cobros"** (Gerencia y Caja) y da la **confirmación final** de que el
reparto y su cobro quedaron cerrados. Mientras nadie confirme, el cobro aparece como "pendiente".

Se agregaron a la tabla `deliveries` (repartos): la firma (`signature_path`), las fotos
(`photo_paths`), el monto cobrado, el método de pago, y quién/cuándo confirmó el cobro. Ver
`supabase/migrations/0009_evidencias_cobros.sql`.

**Decisiones tomadas sin preguntar (avísame si prefieres otra cosa):**
- La firma y la evidencia se capturan **por viaje/reparto**, no por venta completa — si un pedido
  grande se reparte en varios viajes, cada viaje tiene su propia firma, fotos y cobro, porque así
  ocurre en la vida real (el chofer no siempre lleva todo en una sola vuelta).
- El monto a cobrar se **sugiere automáticamente** con el total de los productos de ese viaje, pero
  el chofer puede corregirlo a mano (por ejemplo, si hubo un descuento verbal).
- La firma en canvas se hizo con HTML nativo (sin librerías externas) para no agregar dependencias
  al proyecto; funciona con mouse y con el dedo en pantallas táctiles.

### Para aplicar la Etapa 6 en tu Supabase

0. Antes de correr el script, crea en el Dashboard de Supabase (**Storage**) dos buckets nuevos,
   ambos como **Public**: `repartos-firmas` y `repartos-evidencia` (igual que hiciste con
   `facturas` y `merma` en la etapa anterior).
1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0009_evidencias_cobros.sql`.
3. Dale **Run**.

### Cómo probarlo

1. Entra como `reparto.demo` (o `gerencia.demo`) a un reparto pendiente o en camino.
2. Cambia el estado a "Entregado": aparecerá la sección de evidencia obligatoria (firma, fotos,
   monto y método de pago). Intenta guardar sin llenarla — debe mostrar el error correspondiente.
3. Llena la firma (dibuja con el mouse o el dedo), sube al menos una foto, confirma el monto
   sugerido o cámbialo, elige el método de pago, y guarda.
4. Entra como `caja.demo` (o `gerencia.demo`) a **Evidencias y Cobros**: debe aparecer ese reparto
   en la pestaña "Pendientes", con acceso a la firma y las fotos. Da clic en "Confirmar cobro" y
   confírmalo.
5. El reparto debe pasar a la pestaña "Confirmados", y si vuelves a entrar al detalle del reparto,
   debe mostrar la insignia "Cobro confirmado por Caja".

### Si te sale el error "Could not find the function public.confirm_delivery_payment..."

Significa que a Supabase le falta esa función (el script `0009` no llegó a crearla, o su caché de
funciones no se ha refrescado). Corre `supabase/migrations/0010_fix_funciones_evidencias_cobros.sql`
en una consulta nueva — es seguro correrlo las veces que haga falta, no borra ni daña nada, y al
final le pide a Supabase que recargue su caché de inmediato. También limpia un problema relacionado:
como `update_delivery` ganó 4 parámetros nuevos en esta etapa, Postgres pudo haber dejado **dos
versiones** de esa función al mismo tiempo (la vieja de 7 parámetros y la nueva de 11) si el script
`0009` se detuvo a la mitad; este script quita la vieja para que no haya ambigüedad.

**Nota aparte:** si ves repartos con "Sin firma · 0 foto(s) · $0.00" en Evidencias y Cobros, es
normal si esos repartos ya se habían marcado como "Entregado" **antes** de instalar esta etapa —
todavía no existía la exigencia de evidencia cuando se entregaron. Los repartos nuevos que marques
como "Entregado" de aquí en adelante sí la pedirán.

## 17. Etapa 7 — Manuales e Información + Asistente de Consulta

Se construyeron los dos módulos juntos, como se acordó desde el inicio del proyecto:

**Manuales e Información** (los 5 roles pueden consultar): repositorio de documentos —manual de
bienvenida, descripciones de puesto, protocolos, políticas— y de preguntas frecuentes, cada uno
categorizado y con la opción de dirigirlo solo a ciertos roles (por ejemplo, un protocolo que solo
le sirve a Reparto). Si no se elige ningún rol al publicarlo, se muestra para todos. Solo
**Gerencia** puede publicar, y eliminar contenido; el resto de los roles solo consulta lo que le
corresponde. Los documentos (PDF o imagen) se guardan en Supabase Storage, en un bucket público
nuevo llamado `manuales`.

**Asistente de Consulta** (los 5 roles): un buscador por palabras clave sobre los manuales y las
preguntas frecuentes ya publicados, para que un empleado con una duda no tenga que adivinar en qué
pestaña está la respuesta. **Aclaración importante:** esto **no es un asistente con inteligencia
artificial de pago** — conectar un servicio así (OpenAI, Claude API, etc.) tendría un costo por
cada pregunta que se le hiciera, algo que no tiene sentido meterle a un prototipo. En vez de eso, la
búsqueda vive enteramente en el navegador (`src/lib/search.ts`): compara las palabras de la
pregunta contra el título/descripción de los manuales y la pregunta/respuesta de las FAQ, ignora
acentos y palabras vacías ("de", "para", "el"...), y muestra los resultados ordenados por
relevancia. No tiene ningún costo de operación ni depende de ningún servicio externo.

Ver `supabase/migrations/0011_manuales_asistente.sql`.

**Decisión tomada sin preguntar (avísame si prefieres otra cosa):** el filtrado de "para qué rol es
este manual/pregunta" se hace en la pantalla (frontend), no en la base de datos — cualquiera de los
5 roles técnicamente puede leer todo si consultara la base de datos directamente, pero en la
pantalla normal cada quien solo ve lo suyo. Para un prototipo/piloto interno esto es suficiente; si
más adelante se vuelve sensible qué área ve qué protocolo, se puede reforzar con RLS más estricto.

### Para aplicar la Etapa 7 en tu Supabase

0. Antes de correr el script, crea en el Dashboard de Supabase (**Storage**) un bucket nuevo llamado
   `manuales`, como **Public**.
1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0011_manuales_asistente.sql`.
3. Dale **Run**.

### Cómo probarlo

1. Entra como `gerencia.demo` a **Manuales e Información** y publica un manual (por ejemplo, "Manual
   de bienvenida", categoría "Bienvenida", sin marcar ningún rol para que aplique a todos) y una
   pregunta frecuente (por ejemplo: "¿Qué hago si un cliente quiere recoger su pedido en partes?").
2. Entra con cualquier otro usuario DEMO (por ejemplo `almacen.demo`) y confirma que puede ver ambos
   en modo consulta, sin botones de publicar/eliminar.
3. Ve a **Asistente de Consulta** y busca alguna palabra que aparezca en lo que publicaste (por
   ejemplo "partes" o "bienvenida") — debe aparecer como resultado. Busca algo que no exista para
   confirmar que muestra el mensaje de "no encontré nada".

### Si te sale el error 'type "manual_category" already exists' (o cualquier "ya existe")

El editor de SQL de Supabase va guardando cada instrucción por separado, no todo el script como un
solo paquete — así que si el script se interrumpió a la mitad, o le diste "Run" dos veces, algunas
partes ya quedaron creadas. **No pasa nada:** el script de `0011_manuales_asistente.sql` ya está
escrito para ser seguro de correr las veces que haga falta (usa "si no existe, créalo" en cada
paso). Simplemente vuelve a correrlo completo desde el SQL Editor — va a saltarse lo que ya estaba y
completar lo que faltó, sin duplicar nada ni borrar información.

## 18. Etapa 9 — Administración de usuarios y roles

Se agregó, solo para **Gerencia**, una pantalla dentro del sitio para consultar y editar a los
empleados: nombre, correo, rol, y estado (activo/dado de baja) — sin tener que entrar cada vez al
Dashboard de Supabase para eso.

**Lo que NO cambia:** crear una cuenta de acceso nueva (correo + contraseña) sigue siendo un paso
manual tuyo en Supabase (Authentication → Users), igual que en la Etapa 1 — hacerlo desde el sitio
requeriría exponer la clave "service_role" en el navegador, y eso nunca es seguro en un prototipo
que cualquiera puede inspeccionar desde el navegador.

**Cambio importante de comportamiento:** la columna "active" de `profiles` ya existía desde la
Etapa 1, pero hasta ahora no tenía ningún efecto real — un usuario dado de baja ahí seguía pudiendo
entrar al sitio con su contraseña. A partir de esta etapa, **sí bloquea el acceso de verdad**: si
Gerencia desactiva a alguien desde Administración, esa persona ve un aviso de "cuenta dada de baja"
la próxima vez que intente entrar (o si ya tenía la sesión abierta, la próxima vez que la app
revise su perfil).

Por seguridad, **nadie puede cambiarse su propio rol ni desactivar su propia cuenta** desde esta
pantalla (se bloquea en la pantalla), para que Gerencia no se quede accidentalmente sin acceso —
eso lo tendría que hacer otro usuario de Gerencia, o tú directamente desde Supabase.

Ver `supabase/migrations/0012_administracion.sql`. Los permisos (RLS) para que Gerencia vea y
edite todos los perfiles **ya existían desde la Etapa 1** — esta migración solo agrega la columna
de correo (para poder identificar a cada quién sin adivinar por el nombre) y actualiza el disparador
que crea el perfil automáticamente para que también guarde el correo.

### Para aplicar la Etapa 9 en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0012_administracion.sql`.
3. Dale **Run**.

### Cómo probarlo

1. Entra como `gerencia.demo` a **Administración**: debes ver a los 5 usuarios DEMO con su correo.
2. Da clic en "Editar" sobre tu propia fila (Gerente Demo): el rol y el interruptor de "Cuenta
   activa" deben aparecer bloqueados, con el aviso correspondiente.
3. Da clic en "Editar" sobre otro usuario (por ejemplo `reparto.demo`) y desactiva su cuenta.
4. Cierra sesión, intenta entrar con `reparto.demo` — debe mostrar el aviso de cuenta dada de baja
   en vez de dejarlo entrar.
5. Regresa como `gerencia.demo` y reactívalo — `reparto.demo` debe poder volver a entrar.

## 19. Etapa 10 — Publicación (GitHub + Netlify)

Con esto el prototipo deja de vivir solo en tu computadora (`localhost`) y queda accesible desde
cualquier navegador, con una URL real. Se agregó `netlify.toml` (le dice a Netlify cómo construir el
sitio) y se ajustó `.gitignore` para no subir archivos que no aportan al repositorio (`dist/`,
cachés de TypeScript, etc.).

**Aclaración importante:** publicar en Netlify no es un evento único — una vez conectado el repo,
cada vez que corrijas algo y lo subas a GitHub (`git push`), Netlify vuelve a publicar el sitio
solo, en un par de minutos, sin que tengas que repetir ningún paso de configuración. Los cambios en
Supabase (tablas, funciones, RLS) se siguen aplicando directo en su SQL Editor, sin relación con
Netlify — Netlify solo sirve el frontend.

### Paso 1 — Subir el proyecto a GitHub

1. Entra a [github.com](https://github.com) y crea un repositorio nuevo (botón "New"). Ponle un
   nombre (ej. `gigante-perote`), déjalo **vacío** (sin README, sin .gitignore, sin licencia — ya
   los trae el proyecto) y dale "Create repository".
2. En tu computadora, abre una terminal **dentro de la carpeta del proyecto** y corre, en orden:
   ```
   git init
   git add .
   git commit -m "Prototipo Gigante Perote - Etapas 1 a 9"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```
   (Reemplaza `TU-USUARIO/TU-REPO` por los datos reales que te muestra GitHub al crear el repo.)
3. Verifica en la página del repo que sí subieron los archivos, y que **NO** subió tu archivo
   `.env` real (solo debe aparecer `.env.example`) — si por error `.env` aparece en GitHub, cambia
   de inmediato tu `anon key` en Supabase (Settings > API > "Reset" en Project API keys) y sube el
   `.gitignore` corregido.

### Paso 2 — Conectar Netlify

1. Entra a [netlify.com](https://netlify.com), crea una cuenta o inicia sesión (puedes usar tu
   cuenta de GitHub directamente).
2. "Add new site" → "Import an existing project" → elige **GitHub** → autoriza y selecciona el
   repositorio que acabas de subir.
3. Netlify va a detectar `netlify.toml` y llenar solo el "Build command" (`npm run build`) y el
   "Publish directory" (`dist`) — no los cambies.
4. **Antes de darle "Deploy"**, abre la sección "Environment variables" (o entra a "Site
   configuration → Environment variables" si ya se creó el sitio) y agrega estas dos, con los
   valores reales de tu proyecto de Supabase (Settings → API):
   - `VITE_SUPABASE_URL` → tu "Project URL"
   - `VITE_SUPABASE_ANON_KEY` → tu clave pública "anon public" (NO la "service_role")

   Sin esto, el sitio publicado se ve pero no puede conectarse a la base de datos.
5. Dale "Deploy site". En 1-2 minutos te da una URL tipo `https://algo-al-azar.netlify.app`.

### Paso 3 — Probarlo

Entra a la URL que te dio Netlify desde el celular o desde otra computadora, e inicia sesión con
cualquiera de los usuarios DEMO. Si ves la pantalla de login pero al entrar no carga nada, revisa
que las dos variables de entorno del Paso 2 estén bien escritas (sin espacios, sin comillas).

### Después de publicado: cómo corregir algo

1. Corriges el código en tu computadora (o me pides que te ayude a generar el cambio).
2. `git add .` → `git commit -m "descripción del cambio"` → `git push`.
3. Netlify detecta el push y vuelve a publicar solo — no hay que tocar nada en Netlify de nuevo,
   salvo que el cambio necesite una variable de entorno nueva.

## 20. Corrección extra — Notificaciones (campanita funcional)

La campanita del encabezado ya funciona de verdad:

- Cuando un reparto se marca como **"Incidencia"**, se crea automáticamente una notificación
  visible para **todos los roles**, con un link directo a ese reparto para poder atenderlo rápido.
- Cualquier persona puede usar el botón **"Reportar"** (junto a la campanita) para avisar un
  problema a mano (por ejemplo, "se cayó el internet en caja") — también le llega a todos.
- Cada usuario ve su propio contador de "no leídas": si tú ya la abriste, a un compañero le sigue
  apareciendo como nueva hasta que él también la vea. Hay un botón "Marcar todas" para limpiar tu
  contador de una vez.
- Se revisa cada ~25 segundos si hay notificaciones nuevas (sin necesitar recargar la página).

Ver `supabase/migrations/0014_notificaciones.sql`.

### Para aplicar esta corrección en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0014_notificaciones.sql`.
3. Dale **Run**.

### Cómo probarlo

1. Con `reparto.demo`, marca un reparto como "Incidencia" (desde el desplegable "Cambiar estado a")
   y escribe algo en "Notas". Guarda.
2. Entra con cualquier otro usuario DEMO — debe verse un número rojo en la campanita. Ábrela: debe
   aparecer la incidencia, y al darle clic te debe llevar directo a ese reparto.
3. Prueba también el botón "Reportar" con cualquier usuario, escribe un mensaje de prueba, y
   confirma que le llega a los demás.

## 22. Corrección extra — Cobro en caja al momento de la venta

Retoma el proceso real que confirmaste: cuando Ventas registra una venta, a **Caja y Gerencia** les
llega de inmediato una notificación (con la campanita que ya construimos). Al entrar al detalle de
esa venta, Caja puede anotar **cuánto le pagó el cliente en el mostrador** — puede ser el total
completo, o solo una parte.

Ejemplo real: una venta de $12,000 — el cliente deja pagados $9,000 en caja, y quedan $3,000
pendientes; esos $3,000 los cobra después el chofer al entregar a domicilio (eso ya se lleva por
separado en "Evidencias y Cobros", que construimos en la Etapa 6).

La lista de "Ventas y Entregas" ahora muestra, además del total, si esa venta ya quedó **Pagada** o
si **Faltan $X** por cobrar, para que cualquiera lo vea de un vistazo.

Ver `supabase/migrations/0015_cobro_en_caja.sql`.

### Para aplicar esta corrección en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0015_cobro_en_caja.sql`.
3. Dale **Run**.

### Cómo probarlo

1. Con `ventas.demo` (o `gerencia.demo`), registra una venta nueva.
2. Entra con `caja.demo` — debe llegarle una notificación en la campanita avisando de la venta
   nueva, con link directo a "Ventas y Entregas".
3. Abre esa venta desde la lista (dale clic al folio) y da clic en "Registrar cobro en caja". Anota
   un monto MENOR al total (por ejemplo, si el total es $1,000, anota $700) y guarda.
4. Debe verse "Pagado en caja: $700" y "Pendiente de cobro: $300" dentro del detalle, y en la lista
   general debe decir "Faltan $300.00".

## 24. Corrección extra — La campanita solo avisa problemas

A petición tuya: se quitó la notificación automática de "nueva venta" (agregada en la Etapa 22),
porque en un día con muchas ventas iba a inundar la campanita y le quitaría valor a lo que de
verdad importa. La campanita queda reservada solo para:

- Incidencias marcadas en un reparto (automático).
- Reportes manuales con el botón "Reportar" (cualquiera puede usarlo).

Caja sigue viendo el estado de cobro de cada venta (Pagada / Faltan $X) directo en la lista de
"Ventas y Entregas", sin necesidad de una notificación aparte — normalmente el cliente llega al
mostrador con su folio justo después de que Ventas registra la orden.

Ver `supabase/migrations/0016_notificaciones_solo_incidencias.sql` (no requiere cambios de código,
solo esta migración).

### Para aplicar esta corrección en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0016_notificaciones_solo_incidencias.sql`.
3. Dale **Run**.

## 26. Corrección extra — Ver quién hizo cada cosa

A petición tuya: el sistema **ya guardaba** quién registró cada venta, cada movimiento de
inventario, cada factura, cada merma y cada cobro — pero nadie lo podía ver en pantalla, porque
antes de esta corrección cada quien solo podía consultar su propio perfil (o Gerencia, el de
todos). Ahora cualquier usuario con sesión puede ver el nombre de sus compañeros (no su contraseña
ni nada sensible, solo nombre/correo), y se muestra en:

- **Ventas y Entregas**: columna "Vendedor" en la lista, y en el detalle de cada venta quién la
  registró y quién confirmó el cobro en caja.
- **Inventario**: columna "Registrado por" en Movimientos, Facturas de proveedores y Merma.
- **Evidencias y Cobros** y el detalle de cada **reparto**: quién confirmó el cobro, además de
  cuándo.

Ver `supabase/migrations/0017_ver_nombres_companeros.sql`.

### Para aplicar esta corrección en tu Supabase

1. Ve a **SQL Editor > New query**.
2. Copia y pega todo el contenido de `supabase/migrations/0017_ver_nombres_companeros.sql`.
3. Dale **Run**.

## 27. Próximas etapas (no implementadas todavía)

La Calculadora la construirá tu compañero por separado, y el Asistente de Consulta actual se
reemplazará más adelante por el suyo cuando esté listo. Falta la conexión a GitHub y la publicación
en Netlify para dejar el prototipo accesible fuera de tu computadora.
