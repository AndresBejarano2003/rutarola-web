# Ficha de RutaRola en Google Play

Textos y respuestas para copiar en Play Console. Imágenes en esta misma carpeta:
`icono-512.png`, `grafico-funciones-1024x500.png` y `capturas/01…07.png` (1080×1920). Para regenerarlas:
`node documentacion-fuente/herramientas/play-capturas.mjs` (con `npx ng serve --configuration local --port 4300`) y
`node documentacion-fuente/herramientas/play-componer.mjs`.

## Detalles de la app (Presencia en la tienda › Ficha principal de la tienda)

**Nombre de la app** (máx. 30):

```
RutaRola: Transporte Escolar
```

**Descripción breve** (máx. 80):

```
Rutas, cobros y ubicación en vivo para el transporte escolar y las familias.
```

**Descripción completa** (máx. 4000):

```
RutaRola organiza tu empresa de transporte escolar en un solo lugar: estudiantes, rutas, vehículos, cobros y la ruta del día en tiempo real. La usan la empresa, los conductores, las monitoras y las familias, cada uno con lo que necesita.

PARA EL CONDUCTOR Y LA MONITORA
• La ruta del día al abrir la app: colegio, vehículo, estudiantes y compañero de turno.
• Recorrido paso a paso: a quién recoger y en qué orden, con la foto del estudiante, llamada, WhatsApp y cómo llegar.
• Marca cada subida, entrega o ausencia. El conductor y la monitora ven lo mismo al instante.
• Comparte la ubicación del vehículo durante el recorrido, aunque el celular esté bloqueado o se use otra aplicación. Al finalizar el recorrido deja de compartirla.
• Reporta novedades del vehículo con foto o documento.

PARA LAS FAMILIAS
• Mira en el mapa dónde va la ruta mientras el recorrido está en curso.
• Sabe si tu hijo ya subió y cuándo lo entregaron.
• Avisa cuando tu hijo no va a la ruta.
• Consulta el colegio, el horario, la ruta, el vehículo, el conductor y la monitora.
• Revisa tus facturas, pagos y recibos mes a mes.

PARA LA EMPRESA DE TRANSPORTE
• Estudiantes, acudientes, colegios, rutas, vehículos y personal en un solo lugar.
• Facturas mensuales, pagos, abonos, recibos y cotizaciones en PDF con tu logo.
• Monitoreo en vivo de todas las rutas, cronograma e historial de recorridos.
• Alertas de SOAT, técnico-mecánica, licencias y cuotas vencidas.
• Tablero con el recaudo del mes, la cartera y lo que requiere tu atención.
• Gastos y novedades de cada vehículo.
• También funciona en el computador, en app.rutarola.com, con la misma cuenta.

PLANES
Empieza gratis: el plan Gratis no vence (1 vehículo y 20 estudiantes), o prueba 15 días el plan Profesional sin tarjeta de crédito. Conoce los planes en rutarola.com.

PRIVACIDAD
Cada empresa ve solo su información. La ubicación se comparte únicamente durante el recorrido y se borra a los 30 días. RutaRola no tiene publicidad ni vende datos. Política de privacidad: rutarola.com/privacidad

¿Eres conductor, monitora o acudiente? Tu usuario y contraseña te los entrega tu empresa de transporte.
```

> No se mencionan los recordatorios automáticos por WhatsApp y correo: Brevo y el proveedor de WhatsApp están en pausa.
> Agregar la línea "• Recordatorios de pago automáticos por WhatsApp y correo." cuando estén activos.

## Categoría y contacto (Presencia en la tienda › Configuración de la tienda)

| Campo | Valor |
|---|---|
| Tipo de app | Aplicación |
| Categoría | Empresa |
| Etiquetas | Empresa, Productividad (las que Play sugiera de transporte/gestión) |
| Correo | andresf.bejarano@gmail.com |
| Teléfono | opcional (+57 320 287 1272 si quieres mostrarlo) |
| Sitio web | https://rutarola.com |

## Contenido de la app (Política › Contenido de la app)

| Formulario | Respuesta |
|---|---|
| Política de privacidad | `https://rutarola.com/privacidad` |
| Anuncios | No, la app no contiene anuncios |
| Acceso a la app | Toda o parte de la funcionalidad está restringida → dar usuarios de prueba (ver abajo) |
| Clasificación de contenido | Categoría "Todas las demás apps" (utilidad/productividad). Violencia, sexo, lenguaje, drogas, apuestas: **No**. ¿Los usuarios interactúan o intercambian contenido? **No** (no hay chat entre usuarios). ¿Comparte la ubicación física del usuario con otros usuarios? **Sí**. ¿Permite compras digitales? **No** (los planes se pagan por fuera de Google Play) |
| Público objetivo | **18 años o más** únicamente. No está dirigida a niños: los estudiantes no usan la app |
| Apps de noticias / gubernamentales / salud / préstamos | No |
| Funciones financieras | Ninguna |
| ID de publicidad | No usa el ID de publicidad |
| Eliminación de cuentas | `https://rutarola.com/eliminar-cuenta` |

### Seguridad de los datos

- ¿Recopila o comparte datos? **Sí recopila. No comparte** (los proveedores que solo prestan el servicio — servidor, mapas — no cuentan como "compartir" para Google).
- ¿Los datos están cifrados en tránsito? **Sí** (HTTPS).
- ¿Los usuarios pueden pedir que se borren sus datos? **Sí** → `https://rutarola.com/eliminar-cuenta`.

| Tipo de dato | Recopilado | Obligatorio | Finalidad |
|---|---|---|---|
| Ubicación › Ubicación precisa | Sí (solo conductor y monitora, durante el recorrido) | Obligatorio para ellos | Funcionalidad de la app |
| Información personal › Nombre | Sí | Obligatorio | Funcionalidad, administración de la cuenta |
| Información personal › Dirección de correo | Sí | Opcional | Funcionalidad, administración de la cuenta, comunicaciones del desarrollador |
| Información personal › ID de usuario | Sí (usuario de acceso) | Obligatorio | Administración de la cuenta |
| Información personal › Dirección | Sí (dirección de recogida del estudiante, del acudiente) | Obligatorio | Funcionalidad |
| Información personal › Número de teléfono | Sí | Obligatorio | Funcionalidad |
| Información personal › Otra información (documento de identidad) | Sí | Obligatorio | Funcionalidad |
| Información financiera › Otra información financiera (facturas y pagos del transporte) | Sí | Obligatorio | Funcionalidad |
| Fotos y videos › Fotos (foto de perfil, soportes) | Sí | Opcional | Funcionalidad |
| Archivos y documentos (documentos del vehículo, adjuntos de soporte) | Sí | Opcional | Funcionalidad |
| Actividad en la app › Otro contenido generado por el usuario (avisos de ausencia, novedades, observaciones) | Sí | Opcional | Funcionalidad |

En todos: **no** es efímero, **no** se usa para publicidad ni analítica.

### Permisos de servicio en primer plano (Android 14+)

La app declara `FOREGROUND_SERVICE_LOCATION`. Play Console pide justificarlo:

- **Tipo**: Ubicación.
- **Descripción** (copiar):
  ```
  Mientras un recorrido escolar está en curso, el teléfono del conductor y de la monitora comparte la ubicación del vehículo con la empresa de transporte y con las familias de los estudiantes de esa ruta, también con la pantalla bloqueada o si usan otra aplicación (por ejemplo, el navegador GPS). El servicio lo inicia el usuario al tocar "Iniciar recogida" o "Iniciar entrega" y se detiene al tocar "Finalizar recorrido". Mientras funciona se ve la notificación "RutaRola está compartiendo la ubicación". Fuera de un recorrido la app no lee la ubicación.
  ```
- **Impacto si se interrumpe**: las familias y la empresa dejarían de ver dónde va el vehículo escolar.
- **Video**: un enlace de YouTube (puede ser "No listado") de 30–60 s grabado en el celular: iniciar sesión como conductor → Iniciar recogida → aceptar permisos → aparece la notificación → bloquear la pantalla → mostrar el mapa del acudiente o del administrador moviéndose → Finalizar recorrido → la notificación desaparece.

La app **no** pide `ACCESS_BACKGROUND_LOCATION` (usa un servicio en primer plano), así que no aplica la declaración de ubicación en segundo plano. Si Play la pide de todas formas, usar la misma descripción y el mismo video.

### Acceso a la app (usuarios para el revisor de Google)

Google necesita entrar. Crear en producción una empresa de prueba con datos ficticios (Plataforma › Empresas) y dar:

| Rol | Usuario | Contraseña | Qué probar |
|---|---|---|---|
| Conductor | (crear) | (crear) | Ruta del día → Iniciar recogida → ubicación |
| Acudiente | (crear) | (crear) | Portal: estudiantes, ver en el mapa, pagos |
| Administrador | (crear) | (crear) | Tablero, Operación › Monitoreo en vivo |

Instrucciones para el revisor (copiar):

```
Inicie sesión con el usuario de Conductor. En "Ruta del día" toque "Iniciar recogida" y acepte los permisos de ubicación y notificaciones: la app comparte la ubicación del vehículo solo mientras el recorrido está en curso. Con el usuario de Acudiente puede ver la ruta en el mapa ("Mis estudiantes" › "Ver en el mapa"). Toque "Finalizar recorrido" (marcando a cada estudiante como entregado o ausente) para detener el servicio de ubicación.
```

## Lanzamiento

- Archivo: `android/app/build/outputs/bundle/release/app-release.aab` (`npm run android` y luego, en `android/`,
  `./gradlew bundleRelease`; firma con `~/RutaRola-firma/keystore.properties`).
- **Firma de apps de Google Play**: aceptar (Google guarda la llave de la app; la nuestra es solo la de **subida**).
- Cada versión nueva sube `versionCode` en `android/app/build.gradle` (1, 2, 3…) y `versionName` ("1.0", "1.0.1"…).
- Notas de la versión 1.0 (copiar):
  ```
  Primera versión de RutaRola: ruta del día para conductor y monitora, ubicación en vivo durante el recorrido, portal de las familias y gestión de la empresa de transporte escolar.
  ```
