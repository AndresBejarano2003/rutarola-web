# RutaRola — Frontend

Sistema de gestión de transporte escolar (estudiantes, acudientes, empleados, finanzas, rutas y vehículos).
Construido con **Angular 21** (standalone, zoneless, signals), **Tailwind CSS 4** y **DaisyUI 5**.

## Comandos

```bash
npm install            # instalar dependencias
npm start              # servidor de desarrollo → http://localhost:4200 (con el API: cd ../api && docker compose up)
npm run start:local    # igual, pero todo en modo local (localStorage), sin API
npm test               # pruebas unitarias (Vitest)
npm run build          # build de producción → dist/RutaRolaApp
```

Antes de entregar cualquier cambio: `npm test` y `npm run build` deben pasar sin errores ni advertencias.

---

# Reglas de negocio del sistema

Estas reglas son **obligatorias** para todas las pantallas. Cualquier regla nueva que aplique a todo el
sistema se agrega aquí y en `CLAUDE.md`.

## 1. Estructura del proyecto

Se sigue la guía de estilo oficial de Angular: **organización por funcionalidad** y nombres sin sufijo
`.component` (`estudiantes-page.ts` → `export default class EstudiantesPage`). Nombres de archivos,
rutas, variables y textos en **español**.

```
src/app/
  core/           auth.ts (sesión y roles), guardias.ts (guards por rol), whatsapp y repositorios.ts (fuente de datos de cada módulo)
  modulos.routes.ts  login + sistemas por tipo de usuario (con layout y guards), diferidos junto con los repositorios
  layout/         shell (administrativo), shell-conductor (ruta del día), shell-portal (acudiente), barra-superior, campana-notificaciones, menu-lateral
  ruta-del-dia/   app del conductor/monitora: rutas de hoy y recorrido paso a paso
  portal/         portal del acudiente: sus estudiantes, facturas, pagos y cotizaciones (solo lectura)
  shared/         piezas reutilizables (crud, modal, paginación, notificaciones, formularios, catálogos, fechas, exportar, pruebas)
  autenticacion/  login (+ AutenticacionRepositorio local/HTTP), registro, recuperar
  inicio/         dashboard, perfil, configuración, notificaciones
  personas/  finanzas/  operacion/  sistema/     una carpeta por pantalla + <modulo>.routes.ts
```

**Agregar una pantalla:**
1. Crear `<modulo>/<nombre>/<nombre>-page.ts` y `.html`.
2. Registrar la ruta en `<modulo>/<modulo>.routes.ts` con su `data.breadcrumb`.
3. Agregar la opción en `layout/menu-lateral/opciones-menu.ts`.
4. Mientras no tenga contenido, la ruta apunta a `shared/en-construccion`.

## 2. Estructura de toda pantalla CRUD

Toda pantalla de registros (estudiantes, acudientes, empleados, colegios, vehículos, rutas, asignaciones,
cotizaciones, facturas, recibos, programación…)
tiene **filtros, listado paginado y una ventana modal para registrar, modificar y consultar**, más
confirmación para eliminar. La implementación de referencia es **`personas/estudiantes/`**.

| Archivo | Responsabilidad |
|---|---|
| `<entidad>.ts` | Modelo (extiende `Entidad`), interfaz de filtros y filtros vacíos |
| `<plural>-repositorio.ts` | Contrato abstracto de acceso a datos (token de inyección) |
| `<plural>-local.ts` | Almacenamiento **temporal** en el navegador (`localStorage`) con datos de ejemplo y validaciones de negocio |
| `<plural>-http.ts` | Conexión al API REST, lista para usar |
| `<plural>-store.ts` | Estado de la pantalla con signals: listado, filtros, paginación, cargando, guardando, errores (`extends CrudStore`; listados de solo lectura: `extends ListadoStore`) |
| `<plural>-filtros/` | Filtros con búsqueda en vivo y botón **Limpiar** |
| `<plural>-tabla/` | Listado con acciones **Consultar / Editar / Eliminar** |
| `<entidad>-formulario/` | **Solo los campos** del formulario, con modos **crear / editar / consultar** (solo lectura) y validaciones |
| `<plural>-page.ts` | Orquesta todo; `extends PaginaCrud` (modal, modos, guardar y verificación antes de eliminar ya resueltos) y usa `app-encabezado-listado`, `app-modal`, `app-acciones-formulario`, `app-dialogo-confirmacion` y `app-paginacion` |

La página solo declara su `store`, sus `titulos` (crear/editar/consultar) y `describir(registro)` para el
diálogo de eliminar; lo demás lo hereda de `shared/crud/pagina-crud.ts`.

Comportamiento obligatorio:
- Clic en una fila = **consultar**. Desde la consulta se puede pasar a **editar**.
- **Eliminar** siempre pide confirmación.
- Al guardar, eliminar o fallar se muestra una **notificación** (toast).
- Mientras se guarda, los botones se deshabilitan y muestran un spinner.
- Los campos obligatorios se marcan con `*` y cada error se explica debajo del campo.
- Listado vacío: mensaje claro (y botón de crear si no hay filtros activos).

### Datos temporales y conexión al API

Mientras no exista el backend, los registros se guardan en `localStorage` (clave `rutarola.<recurso>`) y la
pantalla muestra el indicador **"Modo local"**. Para conectar el API se cambia **una línea** en
`core/repositorios.ts`:

```ts
{ provide: EstudiantesRepositorio, useClass: EstudiantesLocal }   // hoy
{ provide: EstudiantesRepositorio, useClass: EstudiantesHttp }    // con API
```

`RepositorioLocal` simula el servidor y tiene ganchos para que cada módulo declare las mismas reglas que
deberá aplicar el API:

- `validar(datos, idActual, registros)`: reglas síncronas (duplicados, rangos de fechas…).
- `validarRelaciones(datos, idActual)`: reglas que consultan **otros módulos** (p. ej. una asignación
  revisa capacidad del vehículo, licencia del conductor y documentos vencidos).
- `preparar(datos, registros)`: datos que genera el servidor (consecutivos `FAC-0001`, `REC-0001`, `COT-0001`).
- `motivoNoEliminar(id)`: integridad referencial (ver abajo).
- La latencia simulada sale del token `LATENCIA_LOCAL` (300 ms; 0 en pruebas).

Cada `*Http` documenta en su comentario los endpoints y respuestas (409/422) que espera.

Contrato REST que espera `RepositorioHttp` (`environment.apiUrl`):

| Operación | Petición | Respuesta |
|---|---|---|
| Listar | `GET /{recurso}?pagina=1&tamano=10&<filtros>` | `{ items, total, pagina, tamano }` |
| Consultar | `GET /{recurso}/{id}` | registro |
| Crear | `POST /{recurso}` | registro creado |
| Modificar | `PUT /{recurso}/{id}` | registro actualizado |
| Eliminar | `DELETE /{recurso}/{id}` | vacío |

| Opciones para listas | `GET /{recurso}/opciones?<filtros>` | `[{ id, nombre }]` (p. ej. `/estudiantes/opciones?acudienteId=acu-1`) |

Endpoints adicionales (solo lectura o calculados en el servidor):

| Pantalla | Petición | Respuesta |
|---|---|---|
| Conductores | `GET /conductores?<filtros>` | conductores (empleados) con licencia y asignación activa |
| Historial de envíos | `GET /programaciones/{id}/envios` | envíos del proceso automático |
| Conteo de envíos | `GET /programaciones/envios/conteo?ids=` | `{ [id]: cantidad }` |
| Reporte de ingresos | `GET /reportes/ingresos?desde=&hasta=&medioPago=` | totales, por mes, por medio y recibos |
| Facturas pendientes | `GET /reportes/facturas-pendientes?texto=&acudienteId=&situacion=` | cuotas sin recibo |
| Morosos | `GET /reportes/morosos?texto=&diasMinimos=` | acudientes con cuotas vencidas |
| Mensajes de WhatsApp | `GET /mensajes-whatsapp?texto=&acudienteId=&estado=&desde=&hasta=` | registro paginado |
| Configuración | `GET/PUT /empresas/actual`, `GET /configuracion`, `PUT /configuracion/{clave} {valor}` | empresa y parámetros |
| GPS | `POST /recorridos/{id}/gps`, `GET …/gps/ultima`, `GET …/gps`, `GET /recorridos/en-curso` | ver `gps/gps-http.ts` |
| Plataforma | `GET/POST/PUT /empresas` (SUPER_ADMIN) | empresas |


Errores: el API puede responder `{ "mensaje": "..." }` y se mostrará tal cual; si no, se usa un mensaje
según el código (409 = duplicado o registro en uso, 404 = no existe, 0 = sin conexión…).

### Backend (API)

El API está en `../api` (ASP.NET Core .NET 10 + PostgreSQL, multiempresa). Su documentación está en `api/README.md`.
Implementa los contratos que documenta cada `<plural>-http.ts`:

- recursos bajo `{apiUrl}` = `https://<host>/api/v1`;
- listados `{ items, total, pagina, tamano }` y `GET /x/opciones`;
- errores ProblemDetails con `mensaje`;
- enums en `UPPER_SNAKE`, fechas `YYYY-MM-DD`, horas `HH:mm` e ids UUID como texto.

Los módulos que ya tienen API se registran con `api(XRepositorio, XLocal, XHttp)` en `core/repositorios.ts`:
usan HTTP cuando `environment.usarApi` es `true` (desarrollo, `npm start`) y local con `npm run start:local`
(`environment.local.ts`), en producción mientras no se despliegue el API y en las pruebas
(`repositoriosDePrueba()` siempre es local). Para pasar otro módulo basta con cambiar su línea a `api(...)`.

- **Con API hoy:** colegios, vehículos, empleados, acudientes, estudiantes, la vista de conductores, rutas, asignaciones, la Ruta del día, el historial de recorridos y el login.
- `RepositorioHttp.motivoNoEliminar` consulta `GET /x/{id}/motivo-no-eliminar` → `{ motivo }` antes de pedir
  confirmación (el `DELETE` igual responde 409 con el mensaje).
- `listar` con `SIN_PAGINAR` trae como máximo 1000 registros por petición.
- Los textos opcionales vacíos viajan como `""` y una fecha opcional vacía también (`vencimientoLicencia` de una monitora).
- El contrato del empleado llega con `url` vacía en los listados; el detalle (`obtener`) trae el archivo.

### Repositorios: un solo registro para toda la app

Los módulos se enlazan entre sí (estudiantes ↔ colegios ↔ rutas ↔ asignaciones ↔ vehículos/empleados;
acudientes ↔ facturas ↔ recibos ↔ programación ↔ reportes). Por eso **todos** los repositorios se
declaran en un único lugar, `core/repositorios.ts` (`proveerRepositorios()`), que se aplica en la ruta
padre de `modulos.routes.ts`. Así todas las pantallas comparten las mismas instancias, y los
repositorios se cargan de forma diferida (no inflan el bundle inicial). Ninguna pantalla ni módulo
declara sus propios repositorios.

Cuando un repositorio local necesita a otro que a su vez lo necesita (p. ej. empleados ↔ asignaciones),
lo obtiene de forma diferida con `Injector.get()` dentro del método, no con `inject()` en el campo.

### Relaciones entre registros

- Una lista que muestra registros de **otra pantalla** (por ejemplo, el acudiente de un estudiante) se
  llena con `repositorio.opciones(filtros?)`, **nunca** con datos fijos en `shared/catalogos`. Los
  catálogos son solo para valores fijos: tipos de documento, grados (Jardín, Transición, 1° … 11°),
  jornadas… Ejemplos: los estudiantes de un acudiente (`opciones({ acudienteId })`), los cursos del
  colegio elegido.
- **Integridad:** no se puede eliminar un registro que otros usan. Por ejemplo, un acudiente con
  estudiantes a cargo o facturas, un colegio con estudiantes o rutas, un vehículo o empleado con
  asignaciones, una factura con recibos o programación.
  - Cada repositorio declara `motivoNoEliminar(id)` (devuelve el motivo o `null`); `eliminar` lanza
    `ErrorCrud(..., 'EN_USO')` y el API debe responder **409** con `mensaje`.
  - La pantalla lo verifica antes. El diálogo explica el motivo con `[permitirConfirmar]="false"`, que
    muestra solo el botón "Entendido".
  - Se sugiere marcar el registro como **Inactivo** en lugar de eliminarlo.
- Todo registro tiene `estado: EstadoRegistro` (`'ACTIVO' | 'INACTIVO'`), mostrado con
  `<app-badge-estado>` (`textoActivo`/`textoInactivo` para "Vigente/Anulada", "Válido/Anulado").
- **Documentos financieros con copia de datos:** factura, recibo y cotización guardan el nombre del
  acudiente, del estudiante y el número de factura con que se expidieron (no cambian si luego se edita
  la persona).

### Reglas de cada módulo

- **Colegios:** NIT único; "Agregar cursos" llena los cursos **desde Jardín hasta el curso elegido** con
  la hora de entrada y salida indicadas (cada curso se puede modificar o quitar después). El grado de un
  estudiante se elige entre los cursos activos de su colegio.
- **Vehículos:** placa e interno únicos; foto opcional (`<app-campo-foto>`, se ve en la tabla); vencimientos de SOAT,
  tecnomecánica, tarjeta de operación y pólizas con alerta a 30 días (`app-badge-vencimiento`). **Historial de
  documentos** (`operacion/vehiculos/documentos-vehiculo/`, en el detalle del vehículo): cada SOAT, revisión, tarjeta
  de operación, póliza u otro documento renovado queda registrado con número, entidad, expedición, vencimiento,
  observaciones y su PDF o imagen (≤ 2 MB). El de vencimiento más reciente de cada tipo es el **vigente** y fija la
  fecha del vehículo (alertas, asignaciones); los anteriores se ven como "Reemplazado". Cambiar una fecha en el
  formulario del vehículo también la agrega al historial. `DocumentosVehiculoRepositorio` (local → HTTP
  `/vehiculos/{id}/documentos`).
- **Rutas:** código único; estudiantes del colegio de la ruta; un estudiante no puede estar en dos rutas
  activas de la misma jornada.
- **Asignaciones (ruta + vehículo + conductor + monitora):** una activa por ruta; conductor de tipo
  conductor con licencia vigente; vehículo activo, con capacidad suficiente y documentos al día; un
  vehículo o persona no cubre dos rutas de la misma jornada. Arriba de la tabla, **Avisos de ausencia**
  (`<app-avisos-del-dia>`, fecha elegible, hoy por defecto): estudiantes que su acudiente avisó que no viajan, su
  ruta, lo que avisó y si la ruta ya lo confirmó.
- **Conductores:** vista de solo lectura de los empleados conductores con su licencia y ruta asignada;
  se editan en Personas › Empleados y se asignan en Operación › Asignaciones.
- **Cotizaciones:** acudiente/estudiantes registrados (selectores) o cliente nuevo (texto);
  total = valor por estudiante × estudiantes.
- **PDF de facturas, recibos y cotizaciones:** "Descargar PDF" en la fila y en el detalle abre "Imprimir / Guardar
  como PDF" del navegador (`shared/documentos-pdf/`: `htmlDocumento` + `imprimirHtml` en un iframe oculto, sin
  dependencias) con el **formato de la empresa** (Configuración › Documentos PDF). `GeneradorPdf` (provisto en
  `proveerRepositorios()`) lee el formato una vez y se refresca al guardarlo. Los textos se escapan y solo se aceptan
  color `#RRGGBB` y logo en data URL de imagen.
- **Facturas (contrataciones):** valor **mensual** por estudiante entre un mes inicial y uno final; el
  estudiante debe ser del acudiente; un estudiante no tiene dos facturas vigentes que se crucen.
- **Recibos:** pagan un mes de una factura vigente; un mes no se paga dos veces.
- **Programación de facturación:** una por factura; día límite (1–31) y días previos (1–10); por cada canal
  activo (WhatsApp / correo) hay mensajes predefinidos y **exactamente uno "En uso"**; los envíos los
  hace el servidor y se ven en el historial.
- **Reportes:** ingresos (recibos válidos por fecha de pago), facturas pendientes (meses sin recibo hasta
  el mes en curso) y morosos (cuotas vencidas según el día límite de la programación, o el día 5).
- **Mensajes de WhatsApp (`finanzas/mensajes-whatsapp`):** registro de solo lectura de los recordatorios que
  envió el servidor (fecha, acudiente, estudiante, teléfono, texto, estado y respuesta del proveedor), con filtros
  por texto, acudiente, estado y fechas. En modo local está vacío: los envía el proceso del servidor.
- **Configuración (`inicio/configuracion`):** el administrador edita los datos de contacto de su empresa (el NIT
  y el estado los cambia la plataforma) y los parámetros: **día límite de pago** (1–31, por defecto 5; para
  facturas sin programación), **días de alerta de vencimiento** (1–120, por defecto 30) y el interruptor **"Los
  acudientes ven la ubicación en vivo de la ruta"** (`gps.acudientes_ven_ubicacion`, 1 = sí por defecto; un
  parámetro de 0 a 1 se muestra como interruptor Sí/No). Un solo "Guardar cambios"; con el API los aplica el
  servidor en reportes, portal, tablero, notificaciones y conductores. Pestañas (`?seccion=documentos|apariencia`):
  - **Documentos PDF** (`formato-documentos/`): logo (PNG/JPG/WebP/SVG reducido a 600 × 240 px, ≤ 300 KB),
    nombre comercial (obligatorio), eslogan, NIT, dirección, ciudad, teléfono, correo, sitio web, color principal,
    pie de página y una nota por tipo (factura, recibo, cotización), con vista previa en vivo de los tres y "Probar
    PDF". Sin guardar todavía, parte de los datos de contacto de la empresa (`personalizado` false).
    `GET/PUT /configuracion/documentos`.
  - **Apariencia** (`apariencia/`): tema **oscuro (por defecto)** o **claro** para TODOS los usuarios de la empresa;
    se guarda al elegirlo (`PUT /empresas/actual/tema`) y llega a cada usuario en `Sesion.empresa.tema` al iniciar
    sesión. `core/tema.ts` (`TemaApp`, iniciado en `App`) pone `data-theme` (`rutarola` / `rutarola-claro`) y
    recuerda el último en `rutarola.tema` (pantalla de login y modo local).
- **Ubicación para acudientes:** si el administrador la desactiva, el acudiente NO ve el mapa ni la posición del
  vehículo (el servidor responde 403 a `gps/ultima` y al `Seguir` del hub, y deja de enviarle posiciones aunque ya
  estuviera conectado), pero sí el estado de su estudiante y la hora en que inició la ruta ("la ruta va en camino
  (inició a las …)"). El administrador y el personal siguen viendo el monitoreo, el historial y los mapas.
- **Centro de Ayuda (`sistema/soporte`):** manuales, tutoriales y preguntas frecuentes se editan solo en
  `contenido-ayuda.ts`; las respuestas deben coincidir con las rutas y reglas vigentes (actualizarlas
  cuando cambie un módulo). La búsqueda filtra los tres a la vez. Una **solicitud de soporte** exige tipo
  (error, consulta, mejora, capacitación), módulo afectado (sale del menú con `modulosDelMenu()`, nunca
  de una lista fija), prioridad (Media por defecto), asunto de 5 a 120 caracteres y descripción de 20 a
  2000; admite hasta 3 adjuntos (PDF o imagen, 1 MB c/u). El consecutivo `SOP-0001` lo asigna el servidor.
  WhatsApp se abre con lo que el usuario ya escribió en el formulario.
- **Tickets de soporte (`sistema/soporte/tickets/`):** cada solicitud es un ticket. Flujo NUEVO → En revisión →
  En proceso → QA → Pruebas → Validación del cliente → Resuelto → Cerrado, más Esperando cliente (al responder la
  empresa vuelve a En revisión), retrocesos, Rechazado y Cancelado. Un ERROR o MEJORA solo se resuelve desde
  Validación del cliente; una CONSULTA o CAPACITACIÓN puede resolverse desde revisión o proceso. Rechazar, pedir
  información, resolver o retroceder exige comentario. SLA desde la creación: crítica 8 h, alta 24 h, media 72 h,
  baja 7 días (la empresa no elige crítica). La empresa ve "Mis solicitudes" (En curso/Todas), responde con
  adjuntos, valida ("Sí funciona" / "No, sigue fallando"), confirma con calificación 1–5, reabre o cancela; un
  Resuelto sin respuesta se cierra solo a los 7 días. La plataforma (`plataforma/soporte`) filtra, avanza estados,
  responde (pública o nota interna, que la empresa nunca ve), asigna responsable y prioridad, y agenda reuniones
  (virtual con enlace; realizada con acta). El servidor envía correo al equipo y al solicitante y una notificación
  de campana por cada respuesta pública.
- **Planes y membresías (`sistema/membresias/`):** Gratis $0 (1 vehículo, 20 estudiantes) · Esencial $89.900
  (5/120, recordatorios automáticos y reportes) · Profesional $189.900 (15/400, GPS en vivo, mapa del acudiente,
  soporte prioritario) · Empresarial desde $389.900 (sin límite + acompañamiento); COP con IVA; anual = 10
  mensualidades. Toda empresa nueva (registro público `/registro` o la plataforma) recibe una **prueba gratuita del
  plan Profesional de 15 días**, parametrizable por el SuperAdmin (Plataforma › Ajustes, `suscripcion.dias_prueba`,
  1–90); **cada prueba conserva los días con que empezó** (`Suscripcion.diasPrueba`): si la plataforma cambia 15 → 20,
  solo las empresas nuevas reciben 20. En el registro también se puede **pagar un plan de una vez** ("Pagar un plan
  ahora", `pagarAhora: true`): la empresa empieza en Gratis con la decisión pendiente y se abre el pago del plan
  elegido (`/registro?plan=&periodo=` desde la página pública de precios).
  - **Al vencer la prueba o un plan pagado** (`pendienteDecision`): apenas entra el administrador ve la pasarela
    (`<app-decision-plan>` en el shell, no se cierra sin decidir; no tapa Planes y membresías ni Soporte): elegir
    plan y periodo → pago, o "No quiero pagar, seguir en Gratis" (con confirmación de lo que se inactiva,
    `POST /suscripcion/continuar-gratis`).
  - **Bajar a un plan con menos límite** (Gratis o uno pagado menor) **inactiva lo que sobra** (no se borra): se
    conservan primero los vehículos con asignación vigente y los estudiantes en rutas activas, luego los más antiguos;
    un vehículo inactivado también inactiva sus asignaciones. Inactivos no salen en listas de activos, rutas ni
    asignaciones; para activar otro hay que inactivar primero uno activo (422 por encima del límite) o mejorar el plan.
  - **Funciones por plan** (`FUNCIONES_PLAN`, `PlanEmpresa` + guardia `conFuncion`): Programación de cobros
    (RECORDATORIOS: se ve, pero guardar exige el plan; aviso `<app-aviso-funcion>`), Reportes financieros (REPORTES)
    y Monitoreo en vivo / mapas (GPS_EN_VIVO) se muestran con candado en el menú y llevan a Planes y membresías
    (`?funcion=`) con el plan desde el que están; el servidor responde 403 con el mismo mensaje. El mapa del
    acudiente también exige GPS en vivo.
  Los límites solo bloquean crear o activar vehículos o estudiantes por encima del plan; sin GPS el teléfono muestra
  "Ubicación en pausa". El pago es
  Wompi Web Checkout y el plan lo activa SOLO la confirmación de Wompi al servidor (evento firmado o consulta), nunca
  el navegador. Pagar durante la prueba suma los días restantes; renovar extiende; cambiar de plan empieza hoy.
  **Hoy Wompi está pausado** (sin llaves en el servidor, `pagosEnLinea` = false): la página ofrece "Solicitar por
  Soporte" y la plataforma activa el plan en Empresas › Plan; el correo también está simulado (avisos solo por
  la campana). `suscripcion.ts` debe coincidir con `CatalogoPlanes.cs`. `/offline-membership` es la página pública de precios y
  `<app-aviso-plan>` avisa en el shell 15 días antes del fin o en Gratis.
- **Códigos promocionales (`plataforma/codigos-promocionales/`, Plataforma › Promociones):** el SuperAdmin crea
  códigos que genera el sistema (aleatorios y únicos, con un prefijo opcional: `REGRESO-7KQ9M2XT` o `7KQ9-M2XT`, sin
  0/O ni 1/I/L) o que escribe él mismo (letras, números y guiones, 4–30, únicos sin importar mayúsculas; botón "Sugerir") con descuento en **porcentaje** (1–100)
  o **valor fijo** (pesos), vigencia desde–hasta (fechas de Colombia, ambas incluidas), a quién aplica (**todas** las
  empresas, **empresas elegidas** o **primera compra** = nunca han pagado un plan), planes (ninguno = todos los de
  pago), periodo (mensual, anual o ambos), usos máximos en total (vacío = sin límite) y usos por empresa (por defecto 1).
  **El descuento es solo del primer mes que se factura**: en el anual se descuenta una mensualidad (el porcentaje
  se calcula sobre el valor mensual y el valor fijo no supera un mes); las renovaciones van a precio normal. Al pagar,
  la empresa escribe el código en "¿Tienes un código promocional?" y ve el descuento o el motivo si no aplica (no
  existe/inactivo, aún no empieza o venció, otro plan o periodo, no es para su empresa, solo primera compra, usos
  agotados). Si el total queda en $0, "Activar plan" lo activa de inmediato. El uso cuenta cuando el pago se aprueba
  o cuando la plataforma activa el plan a mano con el código (Empresas › Plan, queda anotado en la nota). Mientras
  Wompi está pausado, "Solicitar por Soporte" precarga la solicitud con el plan y el código. Un código usado no se
  elimina (se inactiva); su detalle muestra las empresas que lo usaron.
- **Administradores de empresa (plataforma):** en Plataforma › Empresas el SuperAdmin ve los administradores de
  cada empresa, los crea, edita, inactiva y les cambia la contraseña (revoca sus sesiones), y ajusta su plan.
- **Membresías en Plataforma › Empresas:** tarjetas por situación (`GET /empresas/resumen-membresias`) que filtran la
  tabla, filtros de membresía y plan, y la columna **Membresía**: plan, situación (`SITUACIONES_MEMBRESIA`: En prueba,
  Prueba por vencer ≤ 3 días, Al día, Por vencer ≤ 7 días, **Se pasó el pago** = venció sin pagar ni elegir Gratis,
  Gratis), desde cuándo, hasta cuándo y días que quedan, días de la prueba, y el último pago (columna desde 1024 px).
- **Plataforma › Ajustes (`plataforma/ajustes/`):** parámetros globales (`GET/PUT /plataforma/parametros`); hoy los
  días de la prueba gratuita.

### Tipos de usuario y acceso (`core/auth.ts`, `core/guardias.ts`, `autenticacion/`)
Cada tipo de usuario entra a SU sistema; el rol lo decide el servidor al iniciar sesión.

| Rol | Entra a | Ve |
|---|---|---|
| `ADMINISTRADOR` | `/inicio` | Sistema administrativo completo (menú lateral, todos los módulos) |
| `CONDUCTOR` / `MONITORA` | `/ruta-del-dia` | Solo la app de la ruta del día (layout `shell-conductor`, sin menú lateral) |
| `ACUDIENTE` | `/portal` | Solo el portal del acudiente (layout `shell-portal`): sus estudiantes, facturas, pagos y cotizaciones |
| `SUPER_ADMIN` | `/plataforma` | Solo con API: empresas de transporte (layout `shell-plataforma`, `plataforma/empresas`) |

- **Mi cuenta** (`autenticacion/cuenta/cuenta-page`, en `/inicio/perfil`, `/ruta-del-dia/cuenta`, `/portal/cuenta` y
  `/plataforma/cuenta`): **Mis datos** — cada usuario cambia su foto de perfil, su teléfono de contacto y su correo
  (`GET/PUT /auth/perfil`); el administrador y el SuperAdmin también su nombre. Conductores, monitoras y acudientes
  guardan en SU registro de Personas (el teléfono es obligatorio) y su nombre, documento y usuario los corrige el
  administrador. La foto nueva se ve al instante en la barra superior — y cambio de la contraseña propia
  (`AutenticacionRepositorio.cambiarContrasena`, `PUT /auth/contrasena {actual, nueva}`; con el API cierra las
  demás sesiones; en modo local cambia `rutarola.credenciales`, salvo el `admin` de demostración).
  `/editar-usuario` redirige aquí.
- **Plataforma › Empresas** (SUPER_ADMIN): lista con filtros, alta con su primer administrador opcional
  (usuario, correo, contraseña) y edición; no se eliminan, se dejan INACTIVAS (`EmpresasRepositorio`,
  `GET/POST/PUT /empresas`). El SuperAdmin del API es `superadmin` (`SEED_SUPERADMIN_PASSWORD`).

- `AutenticacionRepositorio` (`AutenticacionLocal` → `AutenticacionHttp`, `POST /auth/login` → `Sesion`)
  valida las credenciales; `AuthService` guarda la sesión (`rutarola.sesion`: `localStorage` con
  "Recordarme", si no `sessionStorage`). **Cerrar sesión borra solo la sesión**, nunca los datos.
- **Con API** (`AutenticacionHttp`): `POST {apiUrl}/auth/login` responde `{ sesion, tokens }`. Los tokens
  quedan dentro de la sesión (`Sesion.tokens`) y `interceptorAutenticacion` (`core/interceptor-autenticacion.ts`,
  registrado en `app.config.ts`) los usa así:
  - agrega `Authorization: Bearer <accessToken>` solo a las peticiones a `environment.apiUrl`, salvo
    `/auth/login`, `/auth/refresh` y `/auth/logout`;
  - ante un 401 renueva con `/auth/refresh` UNA sola vez para todas las peticiones que fallaron a la vez
    (`RenovacionSesion`), guarda los tokens nuevos donde estaba la sesión y repite cada petición;
  - si otra pestaña ya renovó, adopta sus tokens en lugar de reusar el refresh token viejo (el servidor
    trata ese reuso como robo y cierra todas las sesiones);
  - si la renovación falla, cierra la sesión y lleva a `/login?volver=<url>`.

  Cerrar sesión también revoca el refresh token (`POST /auth/logout`). En modo local no hay tokens y el
  interceptor no hace nada.
  `AutenticacionHttp` se usa junto con Personas (`api(...)`), porque los usuarios de conductores,
  monitoras y acudientes se crean desde sus formularios. El API crea su usuario con el rol de su tipo,
  cambiar la contraseña cierra sus sesiones y eliminar a la persona libera el usuario. Con los datos demo del
  API ingresan `jcardenas`, `ycharry`, `mperez`… con la clave `SEED_DEMO_PASSWORD`.
- **El login pide "Usuario"** (no correo): cada quien decide si es su correo, documento u otro texto.
- **Credenciales de empleados y acudientes:** los formularios de Personas › Empleados y Personas ›
  Acudientes tienen la sección "Acceso a la app" (`<app-campos-acceso>` y `controlesAcceso`/
  `contrasenasIguales`/`ajustarContrasena` de `personas/compartido/acceso.ts`) con usuario (obligatorio, único, 4–40 caracteres sin espacios, se guarda en minúsculas) y contraseña
  (obligatoria al crear, mínimo 6, con "Confirmar contraseña"; al editar, vacía = conservar la actual).
  La contraseña es de SOLO ESCRITURA: el API nunca la devuelve y debe guardarla con hash.
  **El usuario es único entre empleados, acudientes y el administrador** (409): cada repositorio local lo
  revisa contra el otro módulo en `validarRelaciones` (`validarUsuarioLibre`). Al eliminar el registro se
  libera su usuario.
- Login local: usuario + contraseña de un empleado → CONDUCTOR o MONITORA según su tipo; de un acudiente →
  ACUDIENTE (con `acudienteId` en la sesión); inactivo → no entra; `admin` / `rutarola` → ADMINISTRADOR. Error genérico "Usuario o contraseña incorrectos" (no se
  revela cuál falló). Las contraseñas locales viven aparte de los registros (`rutarola.credenciales`,
  `autenticacion/credenciales-local.ts`, `{usuario: {contrasena, titular: EMPLEADO|ACUDIENTE}}`); los
  empleados y acudientes de ejemplo usan inicial + apellido (`jcardenas`, `ycharry`, `mperez`…) con
  contraseña `rutarola`. La pantalla muestra un acceso de prueba por rol.
- Guards: `soloRoles(...)` en cada módulo (sin sesión → `/login?volver=<url>`; otro rol → la entrada de
  su sistema) y `soloInvitados` en el login. `volver` solo acepta rutas internas (`rutaInternaSegura`).
- El login vive en `modulos.routes.ts` (no en `app.routes.ts`) porque en modo local consulta empleados.
- La barra superior y el saludo del inicio muestran el usuario de la sesión.

### Ruta del día (`ruta-del-dia/`)
App para el celular del conductor y la monitora, dentro del vehículo.
- **Rutas de hoy:** las de sus asignaciones ACTIVAS vigentes en la fecha (`fechaInicio ≤ hoy ≤ fechaFin`)
  con ruta activa; muestra colegio, vehículo, número de estudiantes y el compañero (conductor ↔ monitora)
  con botón de llamar. El empleado sale de la sesión/token, nunca de un parámetro.
- **Avisos de los acudientes:** "Mis rutas" dice cuántos acudientes avisaron que su estudiante no viaja hoy
  (`RutaAsignada.avisosAusencia`). En el recorrido, cada parada trae su `aviso` (misma fecha; trayecto igual o
  ambos): alerta arriba con los nombres por confirmar, y en la tarjeta del siguiente paso y en la fila "El acudiente
  avisó: …" con Llamar, Escribir (WhatsApp "¿confirmas que … no viaja hoy?") y **"Confirmar: no va"**, que lo marca
  AUSENTE con el motivo avisado (`motivoAlConfirmar`: en la entrega, "No viaja"). Marcarlo AUSENTE confirma el
  aviso (queda "Confirmado por …" para el acudiente y el administrador); "Deshacer" lo deja sin confirmar.
  "Subieron todos" no incluye a quien avisó que no viaja.
- **Trayectos:** `RECOGIDA` (casa → colegio, en el orden de la ruta) y `ENTREGA` (colegio → casa, en orden
  inverso). Un recorrido por asignación, fecha y trayecto; uno solo `EN_CURSO` por asignación. Conductor
  y monitora comparten el mismo recorrido: si uno toca "Iniciar" en un trayecto que el otro ya inició,
  **se une a ese recorrido** donde va (no es un error; aviso informativo) y "Mis rutas" se actualiza sola
  cuando el compañero inicia (`observarRutasDelDia`), mostrando "Continuar".
- **Snapshot:** al iniciar se guardan ruta, colegio, vehículo, personal y, por estudiante activo de la
  ruta, nombre, grado, dirección y acudiente con teléfono.
- **Estados por estudiante:** `PENDIENTE → A_BORDO → ENTREGADO` o `PENDIENTE → AUSENTE`, con hora;
  "Deshacer" vuelve al estado anterior. Otras transiciones → 422.
- **Asistencia** (`motivoAusencia`, solo con AUSENTE): en la recogida hay dos botones, "**No asiste hoy**"
  (`NO_ASISTE`: no va al colegio; la ENTREGA de ese día ya lo trae como AUSENTE y se puede deshacer si sí
  llegó) y "**Va por su cuenta**" (`POR_SU_CUENTA`: sí asiste y regresa en la ruta). En la entrega, "No viaja"
  (`POR_SU_CUENTA`); `NO_ASISTE` en la entrega → 422. Textos en `nombreAusencia` (iguales en el API).
- **Siguiente paso** (`siguientePaso`): recogida = recoger al siguiente pendiente y luego "Entregar en el
  colegio" a todos los que van a bordo; entrega = abordaje en el colegio y luego cada casa. Cada parada
  ofrece "Cómo llegar" (Google Maps), llamar y avisar por WhatsApp al acudiente.
- **Fotos de los estudiantes:** si el estudiante tiene foto, la monitora y el conductor la ven en la lista del
  recorrido y en grande en la tarjeta de la próxima parada, para reconocer al niño. Se cargan una sola vez al abrir
  el recorrido (`GET /recorridos/{id}/fotos`), no en cada marca, para ahorrar datos móviles.
- **Orden de visita (monitora):** durante el recorrido, la monitora arrastra a un estudiante que falta
  (manija ⠿ de inmediato, o manteniendo presionada la fila 350 ms; también ↑/↓ con botones o teclado; la página se
  desplaza sola cerca del borde, vibra al levantar y Esc cancela) a otra posición: si el 2 pasa al 6, los del 3 al 6 suben una.
  Solo se reordenan los que faltan por visitar (recogida: PENDIENTES; entrega: PENDIENTES y A BORDO); los
  ya resueltos quedan arriba. Solo la monitora de la asignación (el conductor si la ruta no tiene
  monitora) — `puedeReordenar`; la lista enviada debe ser EXACTAMENTE la de los que faltan
  (`reordenarParadas`, si cambió mientras arrastraba → 409 y se recarga). Se guarda `ordenActualizado`
  (quién y cuándo). `PUT /recorridos/{id}/orden {estudianteIds}`.
- **Sincronización conductor ↔ monitora:** la pantalla del recorrido escucha los cambios del compañero
  (`observar`). Con API, por el hub SignalR (`core/tiempo-real.ts`, `TiempoReal`: una conexión perezosa a
  `/hubs/recorridos`, se reconecta sola y vuelve a `Seguir`; el paquete se carga solo al conectar) y una
  consulta de respaldo cada 60 s; "Mis rutas" se refresca con los avisos que el servidor envía al personal. En
  modo local, el evento `storage` de otra pestaña y una consulta cada 10 s. Si la monitora cambió el orden, el
  conductor ve el aviso "… cambió el orden · Ahora sigue: …" (con vibración y un sonido de dos tonos) y el
  siguiente paso actualizado; quien cambió el orden oye una confirmación corta. Los sonidos (`ruta-del-dia/sonidos.ts`)
  se generan con Web Audio, sin archivos; suenan desde el primer toque en la pantalla y se silencian con el botón
  🔊 de la lista (preferencia de cada teléfono).
- **GPS** (`ruta-del-dia/gps/`): mientras el recorrido está EN CURSO, los teléfonos del conductor **y** de la
  monitora (`reportaUbicacion`) comparten la ubicación, así sigue al día aunque uno cierre la app o se apague; el
  servidor guarda una lectura cada 4 s como mínimo por recorrido (descarta las casi simultáneas). Usa
  `EmisorGps`: `watchPosition` → lecturas con precisión ≤ 100 m y una cada ≥ 5 s → cola en `localStorage`
  (`rutarola.gps.pendientes`, sobrevive a recargas y a la falta de señal, máx. 5000 por recorrido) → lotes de
  ≤ 500 cada 15 s y al volver la red; lo pendiente de recorridos anteriores se reenvía al abrir (el servidor
  acepta hasta 5 min después del fin y descarta repetidas; un 4xx descarta el lote). La pantalla muestra
  "Compartiendo ubicación", "Buscando señal", sin permiso o cuántas lecturas faltan por enviar, y que el
  compañero también comparte. `GpsRepositorio` (`GpsLocal`, `rutarola.gps` → `GpsHttp`): enviar, última, trayecto, en curso
  y observar (hub). Las ubicaciones se conservan **30 días** (`DIAS_RETENCION_GPS`, `Gps:DiasRetencion` en el API).
- **Mapas** (`shared/mapa/mapa.ts`, `<app-mapa>`: Leaflet + OpenStreetMap con atribución, cargado solo al
  mostrarse; marcadores Font Awesome con `divIcon`): Operación › **Monitoreo en vivo** (`operacion/monitoreo`,
  recorridos en curso con su posición en vivo, "sin señal" a los 3 min, lista seleccionable), el **trayecto** en
  el detalle del historial (en vivo si sigue en curso) y "**Ver en el mapa**" del portal. El mapa va aislado (`isolate`
  en el host y en `.leaflet-container`) para que las capas de Leaflet (z-index 400–1000) nunca tapen el menú
  lateral, las barras ni los desplegables; lo que flote sobre un mapa va en un contenedor `relative isolate` con `z-10`.
- **Finalizar** solo con todos ENTREGADOS o AUSENTES: **ningún estudiante puede quedar a bordo**.
  Un recorrido finalizado no se modifica. Si se cierra la app, el recorrido en curso se retoma desde "Mis rutas".
- **Historial** (Operación › Recorridos, solo lectura, administrador): todos los recorridos del más
  reciente al más antiguo, filtros por texto (ruta, colegio, placa, personal, estudiante), rango de fechas,
  ruta, trayecto, estado y novedad (con ausencias / con observaciones); detalle con la hora de cada
  estudiante y exportación CSV de todo lo filtrado. `HistorialRecorridosRepositorio`
  (`HistorialRecorridosLocal` → `HistorialRecorridosHttp`, `GET /recorridos`).
- `RecorridosRepositorio` (`RecorridosLocal`, `rutarola.recorridos` → `RecorridosHttp`, endpoints y
  códigos 409/422 documentados en la clase). Botones grandes, una sola acción principal (`btn-primary`)
  y sin toasts por cada marca (solo errores y el cierre).

### Portal del acudiente (`portal/`)
Para el celular del acudiente; **solo lectura** (no paga, no edita), salvo los **avisos de ausencia**. El acudiente
sale de la sesión/token, nunca de un parámetro: solo ve SUS estudiantes, facturas, recibos y cotizaciones.
- **Avisos de ausencia** (`portal/avisar-ausencia/`, en Estudiantes y en "Hoy en la ruta"): "Avisar que no va" para
  hoy o hasta 30 días adelante: **No va al colegio** (`NO_ASISTE`, recogida y entrega) o **Va al colegio, pero no en la
  ruta** (`POR_SU_CUENTA`: ambos trayectos, solo la recogida o solo la entrega), con nota opcional (≤ 300). Un aviso
  por estudiante y día (409); no se avisa un trayecto que ya terminó (422). Muestra cada aviso "por confirmar" o
  "Confirmado por …" y permite retirarlo mientras la ruta no lo haya confirmado y no sea de un día pasado.
  `PortalRepositorio.crearAviso`/`cancelarAviso` (`POST /portal/avisos`, `DELETE /portal/avisos/{id}`); cada
  estudiante trae sus `avisos`. Modelo y helpers en `ruta-del-dia/avisos-ausencia.ts` (local: `rutarola.avisos-ausencia`).
- `PortalRepositorio` (`PortalLocal` → `PortalHttp`, `GET /portal` → `PortalAcudiente`), estado
  compartido en `PortalEstado` (provisto en `portal.routes.ts`, botón "Actualizar" en el encabezado).
- Secciones (pestañas desde `sm`, barra inferior fija en celular): **Inicio** (saldo vencido, próximo
  pago, pagado en el año, "Hoy en la ruta" y últimos pagos), **Estudiantes** (colegio, horario, dirección
  de recogida, ruta, vehículo, conductor y monitora con llamada, estado de hoy), **Pagos** (facturas
  vigentes con cada mes, anuladas y recibos) y **Cotizaciones**.
- **Estado de cuenta** (`calcularEstadoCuenta`, puro; el API debe aplicar las mismas reglas): cada mes de
  una factura vigente es `PAGADA` (tiene recibo vigente), `VENCIDA` (pasó la fecha límite sin recibo),
  `PENDIENTE` (mes en curso dentro del plazo) o `PROGRAMADA` (mes futuro). La fecha límite es
  `fechaLimiteCuota` (`finanzas/reportes/reportes.ts`): día límite de la programación de la factura o el
  día 5. Las facturas anuladas no generan cuotas y los recibos anulados no cuentan. Próximo pago:
  primero lo vencido, luego lo pendiente y luego lo programado, por fecha.
- **Hoy en la ruta:** estado del recorrido de hoy por trayecto (`situacionRecorrido`): aún no inicia, la
  ruta va en camino, a bordo desde…, entregado…, no asistió. Se actualiza solo (`PortalRepositorio.observarCambios`:
  el servidor avisa al acudiente de cada cambio del recorrido de sus estudiantes; local: evento `storage`).
- **Ver en el mapa** (`portal/mapa-ruta`): solo mientras el recorrido de SU estudiante está EN CURSO; muestra el
  vehículo en vivo y al terminar el recorrido el botón desaparece y el modal se cierra (el API deja de entregar la
  ubicación).

### Inicio (`inicio/dashboard/`)

La pantalla principal resume el estado del negocio con **datos reales** de todos los módulos (nunca cifras
fijas). `TableroRepositorio` entrega un `Tablero` calculado por `calcular-tablero.ts` (reglas puras que el
API debe replicar en `GET /tablero`); se recalcula cuando se guarda o elimina un registro.

- **Encabezado:** saludo, fecha, mes del resumen, "Modo local" y accesos rápidos (Registrar pago, Nueva
  factura, Nuevo estudiante, Nueva cotización) que abren el formulario de creación con `?accion=nuevo`.
- **Indicadores** (cada tarjeta lleva a su pantalla):
  - *Recaudo del mes:* recibos vigentes que pagan el mes en curso frente al valor mensual de las facturas
    vigentes que lo cubren (barra de %), número de pagos y el recaudo del mes anterior como referencia.
  - *Cartera vencida:* valor de las cuotas con la fecha límite vencida, acudientes en mora y lo que aún está
    en plazo este mes.
  - *Estudiantes activos:* colegios, nuevos del mes y cuántos no tienen ruta.
  - *Operación:* rutas activas, vehículos, conductores y % de cupos ocupados.
- **Requiere atención** (reemplaza las alertas fijas): solo lo que tiene cantidad > 0, de lo crítico a lo
  informativo, y cada fila lleva a la pantalla donde se resuelve: acudientes en mora, vehículos con documentos
  vencidos, licencias vencidas, recordatorios fallidos (30 días), estudiantes sin ruta, rutas sin vehículo ni
  conductor, documentos y licencias por vencer (30 días), contratos que terminan este mes o el siguiente,
  facturas vigentes sin programación de cobro y cotizaciones pendientes. Si no hay nada: "Todo en orden".
- **Próximos 30 días** (reemplaza "Actividad reciente"; la actividad ya está en la campana): vencimientos de
  documentos y licencias, fechas límite de pago (agrupadas por día) y fin de contratos.
- **Últimos pagos:** los 5 recibos más recientes.
- **Gráficas:** facturado vs recaudado (6 o 12 meses), estudiantes por colegio (5 principales + Otros) y
  ocupación de cada ruta frente a la capacidad del vehículo asignado (≥ 90 % en amarillo; sin vehículo, aviso).
  Los colores de ApexCharts son los del tema (`COLORES` en `dashboard-page.ts`).

### Centro de notificaciones (`inicio/notificaciones/`)

La campana de la barra superior y la página `/inicio/notificaciones` muestran lo que pasa en el sistema.
No confundir con los toasts (`shared/notificaciones`), que son mensajes pasajeros de una acción.

- **Quién las crea:** el **servidor** (por evento y con un proceso diario). El usuario solo las lee,
  marca como leídas/no leídas, archiva/restaura y elimina. Con API las crea el servidor para los
  administradores de la empresa (al pedir el resumen, si hubo cambios o pasó un minuto, y en el proceso
  periódico); en modo local las genera `NotificacionesLocal` a partir de los datos del navegador.
- **Qué se notifica** (reglas en `generar-notificaciones.ts`, que el API debe replicar):

  | Categoría | Hecho | Prioridad |
  |---|---|---|
  | Pagos y cartera | Pago recibido (recibo vigente) | Éxito |
  | Pagos y cartera | Acudiente en mora (cuotas vencidas) | Crítica |
  | Facturas y contratos | Nueva factura | Informativa |
  | Facturas y contratos | Contrato por terminar (termina este mes o el siguiente) | Advertencia |
  | Facturas y contratos | Contrato terminado con la factura aún vigente | Informativa |
  | Cotizaciones | Nueva cotización / aprobada / rechazada | Informativa / Éxito |
  | Vencimientos | SOAT, técnico-mecánica, tarjeta de operación o pólizas por vencer (30 días) / vencidos | Advertencia / Crítica |
  | Vencimientos | Licencia de conductor activo por vencer / vencida | Advertencia / Crítica |
  | Operación / Personas | Vehículo o empleado registrado | Informativa |
  | Envíos | Recordatorio de cobro enviado / fallido | Informativa / Crítica |

  Los eventos (registros, pagos, envíos) solo se notifican si ocurrieron en los últimos **30 días**.
- **Sin repetidos:** cada notificación tiene una `clave` que identifica el hecho (p. ej.
  `licencia:{id}:{fecha}:VENCIDA`). Un hecho se notifica **una sola vez**, aunque se elimine. Si se vence
  otra cuota o se renueva un documento, la clave cambia y llega una notificación nueva.
- **Campana:** número de no leídas (rojo si hay críticas, máximo "99+"), las 6 más recientes,
  "Marcar todas como leídas" y "Ver todas". Al hacer clic en una, se marca leída y se abre expandida en
  la página (`?abrir=<id>`). En teléfonos el panel ocupa todo el ancho.
- **Página:** bandeja de entrada y archivadas; filtros por texto, categoría, prioridad y lectura; agrupadas
  por fecha (Hoy, Ayer, Últimos 7 días, Anteriores); al expandir se ve el mensaje completo, la fecha, la
  prioridad y el botón para ir a la pantalla relacionada. Selección múltiple para marcar, archivar o
  eliminar. Archivar también la marca como leída.
- **Eliminar:** una notificación se elimina de inmediato; varias seleccionadas o "Vaciar bandeja" piden
  confirmación con `<app-dialogo-confirmacion>`.
- **Actualización:** `CentroNotificaciones` (estado compartido, registrado en `core/repositorios.ts`) se
  refresca al iniciar, cada 60 s y cada vez que se guarda o elimina un registro en cualquier módulo
  (`CrudStore` → `CambiosDatos.notificar()`).
- **API** (`NotificacionesHttp`): `GET /notificaciones`, `GET /notificaciones/resumen`,
  `PATCH /notificaciones/lectura`, `POST /notificaciones/leer-todas`, `PATCH /notificaciones/archivo`,
  `POST /notificaciones/eliminar`, `DELETE /notificaciones?bandeja=`; solo afectan las del usuario autenticado.

### Piezas compartidas de personas (`personas/compartido/`)

Estudiantes, acudientes y empleados comparten los datos de identificación.

- **`DatosPersona`:** tipo y número de documento, primer y segundo nombre, primer y segundo apellido.
- **`controlesPersona(fb)`:** los controles del formulario con sus validaciones:
  - documento alfanumérico de 5 a 15 caracteres;
  - nombres de máximo 50 caracteres.
- **`limpiarPersona(datos)`:** limpia los datos antes de guardar.
- **`<app-campos-persona />`:** las secciones "Identificación" y "Datos personales". Se pone dentro del
  `<form>`, y `[tiposDocumento]` restringe los tipos permitidos (por ejemplo, empleados no usan RC/TI).
- **Funciones auxiliares:**
  - `nombreCompleto`, `iniciales`;
  - `coincideTexto`: filtro por nombre o documento;
  - `compararPorApellido`: orden del listado;
  - `validarDocumentoUnico`: no permite documentos repetidos.
- **`<app-celda-persona [foto]>`:** primera columna de la tabla, con avatar (foto de perfil o iniciales), nombre y detalle.
- **Fotos de perfil (`shared/foto/`):** estudiantes, acudientes y empleados tienen `foto` (en `DatosPersona` y
  `controlesPersona`; `<app-campos-persona>` muestra `<app-campo-foto>` en "Datos personales"). El navegador recorta
  la imagen en un cuadrado y la reduce a 256 px JPG (`reducirFoto`, unos 20–40 KB), así viaja en los listados y en
  la sesión. `<app-avatar>` muestra la foto o, si no hay, las iniciales en todas las pantallas: tablas de Personas y
  conductores, barra superior y encabezados de la Ruta del día, el portal y la plataforma, Mi cuenta, el portal
  (estudiante, conductor y monitora) y el compañero en la Ruta del día.

### Archivos adjuntos

Se usa `<app-archivo-adjunto formControlName="contrato" aceptar=".pdf,image/*" [tamanoMaximoMb]="2" />`
(varios archivos: `<app-archivos-adjuntos [maximo]="3" />`, valor `ArchivoAdjunto[]`).

- Valida el tipo y el tamaño del archivo.
- Permite ver o descargar, reemplazar y quitar el archivo.
- En consulta queda en solo lectura.
- En modo local el archivo se guarda dentro del registro (data URL), por eso el límite es de **2 MB**.
  Si el navegador se queda sin espacio, se muestra el error `SIN_ESPACIO`.
- Con API, el archivo viaja en el JSON (base64), o se sobrescribe `crear`/`actualizar` en el `*Http`
  para enviarlo como `multipart/form-data`.

### Formato colombiano

La app usa `LOCALE_ID = 'es-CO'`. Los valores en dinero se muestran con
`{{ valor | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}` (ejemplo: $ 2.200.000).

### Utilidades compartidas

- `shared/fechas`: `fechaIso`, `periodoDe`, `sumarMeses`, `periodosEntre`, `nombrePeriodo`,
  `diaDelPeriodo`, `diasEntre`, `fechaCorta`, `horaLegible` (meses como `YYYY-MM`).
- `shared/exportar/csv.ts`: `descargarCsv()` (separador `;` y BOM para Excel en español).
- `shared/formularios`: validadores `nit`, `placa`, `posteriorA(inicio, fin)` y `emitirEnVivo(form, salida)`
  para filtros con búsqueda en vivo.
- `shared/paginacion/paginacion-local.ts`: `PaginacionLocal` para paginar en el cliente (reportes) con
  `<app-paginacion>`.

### Pruebas

`shared/pruebas/pruebas.ts` ofrece lo necesario para probar las pantallas:

- `repositoriosDePrueba()`: todos los repositorios de `core/repositorios.ts`, sin latencia;
- `simularDialogos()`: simula los diálogos del navegador (y `ResizeObserver` para las gráficas);
- `estabilizar()`, `pantalla(el)`: escribir en campos, elegir en selectores y pulsar botones.

Toda pantalla nueva incluye su `*-page.spec.ts` con estos casos:

- listar;
- filtrar;
- crear con validación;
- eliminar.

Las reglas de negocio que cruzan módulos se prueban sobre los repositorios
(`operacion/reglas-operacion.spec.ts`, `finanzas/reglas-finanzas.spec.ts`).

## 3. Diseño y colores

El sistema usa el tema oscuro **`rutarola`** (por defecto) y, si la empresa lo elige en Configuración › Apariencia,
el tema claro **`rutarola-claro`**, ambos en `src/styles.css` con los MISMOS tokens (por eso las plantillas nunca usan
colores fijos). Los colores salen del logo: **amarillo del bus** (acción principal) y **rojo de las montañas**
(acento de marca). En el claro, info/success/warning/error son tonos oscuros (#0369a1, #15803d, #b45309, #b91c1c) para
cumplir AA como texto sobre blanco, y `text-primary` se pinta #a16207. Las gráficas toman sus colores del tema activo
(`COLORES_TEMA` en `dashboard-page.ts`).

**Regla:** en las plantillas se usan las clases semánticas del tema, **nunca grises o azules fijos**
(`bg-gray-800`, `text-gray-500`, etc.).

| Clase | Color | Uso |
|---|---|---|
| `bg-base-100` | #111827 | Fondo de página, inputs y selects |
| `bg-base-200` | #1f2937 | Tarjetas, modales, tablas |
| `bg-base-300` | #374151 | Encabezado de tabla, hover de filas, botones neutros |
| `text-base-content` | #f3f4f6 | Texto principal |
| `text-base-content/70` | — | Texto secundario (**mínimo permitido para texto**) |
| `primary` | #facc15 | Acción principal de la vista (una por vista), página actual, editar |
| `secondary` | #2563eb | Acciones secundarias y enlaces |
| `accent` | #dc2626 | Acentos de marca (no para errores) |
| `info` | #38bdf8 | Consultar, títulos de sección en formularios |
| `success` | #4ade80 | Estado activo, confirmaciones |
| `warning` | #fbbf24 | Avisos, "Modo local" |
| `error` | #f87171 | Eliminar, errores de validación |

**Contraste:** todo par texto/fondo debe cumplir **WCAG AA (≥ 4.5:1)**. Ejemplo: texto principal sobre
tarjeta = 13.3:1; texto secundario `/70` = 7.3:1. No se permite `gray-500` sobre tarjetas (3.0:1).

### Componentes estándar

- **Tarjeta:** `card bg-base-200 border border-base-300 shadow-xl`.
- **Input / select:** `input input-bordered bg-base-100 border-neutral` (igual para `select`).
- **Tabla:**
  - contenedor `@container overflow-x-auto rounded-box border border-base-300` (ver "Diseño responsive");
  - encabezado `bg-base-300 text-base-content/80 text-xs uppercase tracking-wide`;
  - filas `border-base-300 hover:bg-base-300/50 cursor-pointer`;
  - estados con `badge badge-soft` (verde = activo, gris = inactivo);
  - acciones con íconos y tooltip: consultar `text-info`, editar `text-primary`, eliminar `text-error`.
- **Listas de selección (filtros y formularios, en todas las pantallas):** nunca un `<select>` simple;
  siempre `<app-selector-busqueda>`, para que el usuario encuentre su registro **escribiendo**, aunque
  haya cientos.
  - Busca sin importar tildes ni mayúsculas.
  - Teclado: ↑/↓ para moverse, Enter selecciona, Esc cierra.
  - La opción elegida se marca con ✓ y aparece "Sin resultados" si nada coincide.
  - Se abre hacia arriba cuando no hay espacio debajo, por ejemplo al final de un modal.
  - **En filtros:** `textoTodos="Todos los …"` agrega la opción "Todos" y el botón ✕.
  - **En formularios:** `[invalido]="!!error('campo')"` lo marca en rojo. Va dentro de un `<div>` con
    su `<span class="label-text">`, **no** dentro de un `<label>`.
  - **Excepción:** 2 a 4 opciones fijas que conviene ver a la vez (p. ej. tipo y prioridad de una
    solicitud de soporte) pueden ir como tarjetas de opción: `<label>` + radio `sr-only` +
    `has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2`.

  ```html
  <!-- Filtro -->
  <app-selector-busqueda formControlName="colegioId" [opciones]="colegios()"
    textoTodos="Todos los colegios" etiqueta="Colegio" />

  <!-- Formulario -->
  <div class="flex flex-col w-full">
    <span class="label-text text-base-content/90 mb-1">Colegio <span class="text-error">*</span></span>
    <app-selector-busqueda formControlName="colegioId" [opciones]="colegios()"
      etiqueta="Colegio" [invalido]="!!error('colegioId')" />
  </div>
  ```
- **Paginación:** siempre `<app-paginacion>`: números de página, la actual en amarillo (`btn-primary`),
  "Mostrando a–b de n" y selector de filas por página (10/25/50).
- **Abrir el formulario desde otra pantalla:** toda página CRUD (`PaginaCrud`) abre el formulario de
  creación si la URL trae `?accion=nuevo` (p. ej. `/finanzas/recibos?accion=nuevo`).
- **Modal:** `<app-modal>`; eliminar con `<app-dialogo-confirmacion>`. Ver la regla de modales abajo.
- **Piezas de pantalla:** `<app-encabezado-listado>` (título, total, "Modo local", botón Nuevo, error con
  Reintentar), `<app-acciones-fila>` (Consultar / Editar / Eliminar), `<app-estado-vacio>`,
  `<label app-campo etiqueta requerido [error]>` (o `<div app-campo>` alrededor de un selector) y
  `<app-titulo-seccion>` para las secciones del formulario; `<app-lista-seleccion>` para elegir varios
  registros (p. ej. estudiantes de una ruta).
- **Botón principal:** `btn btn-primary` (amarillo con texto oscuro).
- **Mensajes:** siempre con toasts (`NotificacionesService`), nunca `alert()`.
- **Accesos rápidos:** la tarjeta completa es el botón (`<button class="card …">` con ícono de color);
  no se ponen botones de colores dentro de cada tarjeta (así se mantiene un solo `btn-primary` por vista).
- **Navegación dentro de la página:** nunca `href="#…"` (con la URL `/#/…` cambiaría de ruta); la sección
  lleva un `id` y `scroll-mt-4` y se llega con `scrollIntoView`.
- **Videos y PDF incrustados:** se abren en `<app-modal>`. Los videos usan `aspect-video` (nunca alto
  fijo) y `youtube-nocookie.com`; los PDF ofrecen además "Abrir en otra pestaña" y "Descargar", porque
  los navegadores de celular no muestran PDF dentro de un iframe.

### Diseño responsive (obligatorio)

El sistema debe verse bien en teléfonos (iPhone/Android, desde 320 px, vertical y horizontal),
tablets, portátiles y pantallas grandes y extra grandes. Se verifica en 320, 375, 768, 1024, 1280,
1920 y 2560 px.

- **Layout (`layout/shell`):** altura `h-dvh` (correcta con las barras del navegador móvil), barra
  superior con botón ☰ por debajo de `lg` y menú lateral fijo desde `lg`. El menú se cierra al elegir
  una opción. El contenido tiene `min-w-0`, padding `px-3 sm:px-4 lg:px-6` y un ancho máximo de
  1920 px centrado. Se respetan las zonas seguras del iPhone (`viewport-fit=cover`, `env(safe-area-inset-*)`).
- **Nunca hay scroll horizontal de la página.** Lo ancho (tablas) se desplaza dentro de su tarjeta.
- **Tablas:**
  - contenedor `@container overflow-x-auto …`;
  - filas de una sola línea (los encabezados sí pueden partirse);
  - la última columna (acciones o valor) queda fija a la derecha;
  - las columnas secundarias se muestran según el **ancho de la tarjeta** (container queries), no
    de la ventana: `hidden @3xl:table-cell` (≥ 768 px), `@5xl:` (≥ 1024 px), `@6xl:` (≥ 1152 px);
  - desde 768 px de tarjeta la tabla debe caber completa sin desplazarse;
  - una celda con listas largas puede usar `whitespace-normal min-w-44`.
- **Filtros:** van dentro de `<app-panel-filtros (limpiar)="…">`. Se pliegan en teléfonos (también en
  horizontal) y siempre están abiertos en pantallas `amplio:` (≥ 768 px de ancho y ≥ 512 px de alto).
- **Grids:** siempre empiezan en una columna en móvil (`grid-cols-1 md:grid-cols-2 …`); los hijos de
  un grid tienen `min-width: 0` (global) para que nada los ensanche.
- **Modales:** en teléfono se abren como hoja inferior (`modal-bottom`) y en pantallas `sm+` centrados;
  título y padding más compactos en móvil.
- **Grupos de botones o encabezados con acciones:** `flex flex-wrap gap-2`, nunca anchos fijos. Los
  menús desplegables usan `max-w-[calc(100vw-1rem)]`.
- Los íconos de Font Awesome no aceptan utilidades de visibilidad (`md:hidden`) porque su CSS les gana:
  se envuelven en un `<span>` con la utilidad.

### Regla de modales: botones siempre visibles

Todo modal o panel con formulario tiene **tres zonas**:

1. **Encabezado fijo:** título, subtítulo y botón cerrar.
2. **Cuerpo con scroll propio:** si el formulario es largo, solo esta zona hace scroll.
3. **Pie fijo:** los botones (Cancelar/Cerrar, Editar, Guardar) siempre están visibles, sin que el usuario
   tenga que bajar hasta el final.

Cómo se implementa:
- `<app-modal>` ya trae las tres zonas. Todo lo que lleve el atributo `pie` se ubica en el pie.
- El componente de formulario contiene **solo los campos**: `<form [id]="idFormulario()">`, sin botones.
- Los botones se ponen con `<app-acciones-formulario pie formulario="form-x">`. Ese componente:
  - muestra Cancelar/Cerrar, Editar (en consulta) y Guardar con spinner;
  - envía el formulario con el atributo HTML `form`.
- Cada zona va en su propio bloque `@if (modalAbierto())` con **un único elemento raíz**. Si no, Angular
  no lo proyecta en el pie.
- Los diálogos de confirmación también llevan sus botones en el pie.

```html
<app-modal [(abierto)]="modalAbierto" [titulo]="titulo()">
  @if (modalAbierto()) {
    <app-x-formulario idFormulario="form-x" [modo]="modo()" (guardar)="guardar($event)" />
  }
  @if (modalAbierto()) {
    <app-acciones-formulario pie formulario="form-x" [modo]="modo()" [guardando]="store.guardando()"
      textoCrear="Registrar x" (cancelar)="modalAbierto.set(false)" (editar)="modo.set('editar')" />
  }
</app-modal>
```

Las pantallas que aún usan grises fijos se migran a estas clases cuando se modifiquen.

## 4. Convenciones de código (Angular 21)

- Componentes standalone con `ChangeDetectionStrategy.OnPush`. La app es **zoneless** (sin zone.js): el
  estado que cambia la vista se guarda en **signals**.
- `inject()` en vez de inyección por constructor; `input()`, `output()`, `model()` y `viewChild()` en vez
  de decoradores.
- Control de flujo `@if` / `@for` / `@let` en plantillas.
- Formularios reactivos tipados (`NonNullableFormBuilder`).
- Miembros usados solo por la plantilla: `protected`; dependencias: `private readonly`.
- Prohibido `any`; observables con `takeUntilDestroyed` o `toSignal`.
- No usar APIs marcadas `@experimental` (hoy: `resource`, `rxResource`, `httpResource`, Signal Forms).
- Selectores con prefijo `app-`.
- No relajar `strict` ni `strictTemplates`.
- No agregar dependencias sin una necesidad concreta.

## 5. Pendientes conocidos

- **Autenticación en modo local:** `AutenticacionLocal` guarda las contraseñas sin hash en el navegador (solo
  demo) y el administrador es fijo (`admin`). Con API (`npm start`) el login ya es `AutenticacionHttp`. Falta el
  módulo de usuarios administrativos.
  Datos locales creados antes de este cambio no tienen usuario: editar el empleado o limpiar los datos.
- **Con API (`npm start`):** todos los módulos con endpoint vienen del servidor: Personas, Operación, Finanzas,
  tablero, notificaciones (`NotificacionesHttp`, las crea el servidor) y el Portal del acudiente (`PortalHttp`,
  `GET /portal`). Solo el Centro de Ayuda sigue en `localStorage`. Para la demo completa sin API:
  `npm run start:local`.
- **Ruta del día:** con API los recorridos viven en el servidor (`RecorridosHttp`, hub SignalR + respaldo cada
  60 s); en modo local en `localStorage` (`RecorridosLocal`). Solo puede haber un recorrido en curso por
  asignación y día: uno que quedó abierto otro día no bloquea el de hoy. Falta un aviso push/WhatsApp al
  acudiente (recogido, entregado, no asistió); hoy lo ve en el portal al instante.
- **GPS:** el navegador solo da la ubicación por HTTPS (o `localhost`) y con la pantalla encendida: si el
  teléfono bloquea la pantalla o cambia de app, se pausan las lecturas (una app nativa o PWA con permiso en
  segundo plano lo resolvería). Las teselas son de OpenStreetMap (uso moderado); para mucho tráfico, un
  proveedor de mapas con clave.
- **Varias instancias del API:** SignalR necesitará un backplane (Redis o Azure SignalR); hoy corre una sola.
- **Envíos automáticos:** el proceso del servidor envía los recordatorios de la programación de cobro y guarda
  su historial y el registro de WhatsApp, pero todavía **no hay proveedor real**: en desarrollo los canales son
  simulados y en producción están deshabilitados hasta conectar WhatsApp Business y un servicio de correo.
  `WhatsappService` (`core/whatsapp.ts`, apunta a `${apiUrl}/whatsapp/enviar.php`) no lo usa ninguna pantalla:
  los mensajes los envía el servidor.
- **Modo local** (`npm run start:local` y pruebas; producción ya usa el API desplegado, `environment.ts` →
  `apiUrl`/`usarApi`): todo funciona con `localStorage`; Configuración guarda los parámetros pero los cálculos del
  navegador usan los valores por defecto (día 5, 30 días); el inicio (`TableroLocal`), las notificaciones
  (`NotificacionesLocal`) y el portal (`PortalLocal`) se calculan en el navegador con las mismas reglas del API.
- **Datos fijos:** el perfil del administrador local (`USUARIO_DEMO`) es de ejemplo. En modo local los tickets y el
  plan viven en el navegador; el pago en línea y el registro público (`/registro`) necesitan el API.
