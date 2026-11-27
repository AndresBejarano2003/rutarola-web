// Crea la empresa de prueba para el revisor de Google Play, con datos ficticios de Bogotá:
// administrador, conductor y acudiente con contraseñas aleatorias, un colegio, un vehículo, dos estudiantes,
// una ruta con su asignación de hoy a un año, y una factura con un pago (para ver el portal con datos).
// Usa la API pública como lo haría la app (registro de empresa), nada se escribe directo en la base.
//
// Uso:  node documentacion-fuente/herramientas/play-cuenta-revision.mjs [https://api.rutarola.com/api/v1]
// Al final pide (opcional) el usuario SuperAdmin para dejar la empresa en plan Profesional ACTIVO por un año
// (si no, queda en la prueba de 15 días y luego pasa a Gratis, sin GPS ni mapa del acudiente).
// Las contraseñas solo se muestran en la terminal: no se guardan en ningún archivo.
import { randomBytes, randomInt } from 'node:crypto';
import { createInterface } from 'node:readline';

const API = (process.argv[2] ?? 'https://api.rutarola.com/api/v1').replace(/\/$/, '');

function contrasena() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(12), (b) => letras[b % letras.length]).join('');
}

async function llamar(metodo, ruta, cuerpo, token) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    const detalle = datos?.errores ? JSON.stringify(datos.errores) : (datos?.mensaje ?? texto);
    throw new Error(`${metodo} ${ruta} → ${r.status}: ${detalle}`);
  }
  return datos;
}

function preguntar(texto, oculto = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (oculto) {
    // Muestra la pregunta y no repite lo que se escribe (la contraseña no queda en pantalla).
    process.stdout.write(texto);
    rl._writeToOutput = () => {};
  }
  return new Promise((resolver) =>
    rl.question(oculto ? '' : texto, (respuesta) => {
      rl.close();
      if (oculto) process.stdout.write('\n');
      resolver(respuesta.trim());
    }),
  );
}

const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
const fecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const masDias = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n);
const periodo = (meses) => fecha(new Date(hoy.getFullYear(), hoy.getMonth() + meses, 1)).slice(0, 7);
const enUnAnio = fecha(masDias(365));
const sufijo = String(randomInt(1000, 9999));

const usuarios = {
  admin: { usuario: `revision.admin${sufijo}`, contrasena: contrasena() },
  conductor: { usuario: `revision.conductor${sufijo}`, contrasena: contrasena() },
  acudiente: { usuario: `revision.acudiente${sufijo}`, contrasena: contrasena() },
};

console.log(`API: ${API}\n`);

// 1. Empresa + administrador (registro público, empieza en la prueba de Profesional).
const registro = await llamar('POST', '/auth/registro', {
  empresa: { nombre: `Transporte Escolar Revisión ${sufijo}`, nit: `9${randomInt(10000000, 99999999)}-${randomInt(0, 10)}`, ciudad: 'Bogotá', telefono: '6015550100' },
  administrador: { nombre: 'Revisor Google Play', usuario: usuarios.admin.usuario, email: `revision${sufijo}@rutarola.com`, contrasena: usuarios.admin.contrasena },
  aceptaTerminos: true,
  comienzo: 'PRUEBA',
});
const token = registro.tokens.accessToken;
const idEmpresa = registro.sesion.empresa?.id;
console.log('✓ Empresa y administrador');

// 2. Colegio con un curso de jornada Mañana.
const colegio = await llamar('POST', '/colegios', {
  nit: `8${randomInt(10000000, 99999999)}-${randomInt(0, 10)}`,
  razonSocial: 'Colegio Los Cerezos (demostración)',
  direccion: 'Carrera 7 # 120-20, Bogotá',
  telefono: '6015550101',
  cursos: [
    { grado: '3°', jornada: 'Mañana', horaEntrada: '07:00', horaSalida: '13:00', estado: 'ACTIVO' },
    { grado: '5°', jornada: 'Mañana', horaEntrada: '07:00', horaSalida: '13:00', estado: 'ACTIVO' },
  ],
  estado: 'ACTIVO',
}, token);
console.log('✓ Colegio');

// 3. Vehículo con documentos vigentes.
const vehiculo = await llamar('POST', '/vehiculos', {
  placa: `RVW${sufijo.slice(0, 3)}`, numeroInterno: '01', tipo: 'BUSETA', marca: 'Chevrolet', linea: 'NPR', modelo: 2022, color: 'Amarillo',
  capacidad: 19, vencimientoSoat: enUnAnio, vencimientoTecnomecanica: enUnAnio, vencimientoTarjetaOperacion: enUnAnio,
  vencimientoPolizas: enUnAnio, estado: 'ACTIVO', observaciones: 'Vehículo de demostración para la revisión de Google Play.',
}, token);
console.log('✓ Vehículo');

// 4. Conductor con licencia vigente y acceso a la app.
const conductor = await llamar('POST', '/empleados', {
  tipoDocumento: 'CC', numeroDocumento: `10${randomInt(10000000, 99999999)}`, primerNombre: 'Carlos', segundoNombre: '',
  primerApellido: 'Prueba', segundoApellido: 'Revisión', tipoEmpleado: 'CONDUCTOR', telefono: '3005550102', correo: '',
  direccion: 'Calle 127 # 15-30, Bogotá', fechaIngreso: fecha(hoy), sueldo: 1500000, tipoContrato: 'TERMINO_INDEFINIDO',
  contrato: null, numeroLicencia: `${randomInt(10000000, 99999999)}`, categoriaLicencia: 'C2', vencimientoLicencia: enUnAnio,
  usuario: usuarios.conductor.usuario, contrasena: usuarios.conductor.contrasena, estado: 'ACTIVO',
}, token);
console.log('✓ Conductor');

// 5. Acudiente con acceso al portal y dos estudiantes.
const acudiente = await llamar('POST', '/acudientes', {
  tipoDocumento: 'CC', numeroDocumento: `52${randomInt(1000000, 9999999)}`, primerNombre: 'Laura', segundoNombre: '',
  primerApellido: 'Prueba', segundoApellido: 'Revisión', telefono: '3005550103', telefonoAlterno: '', correo: '',
  direccion: 'Calle 134 # 9-51, Bogotá', usuario: usuarios.acudiente.usuario, contrasena: usuarios.acudiente.contrasena, estado: 'ACTIVO',
}, token);
const estudiante = (nombre, grado, nacimiento, direccion) =>
  llamar('POST', '/estudiantes', {
    tipoDocumento: 'TI', numeroDocumento: `11${randomInt(10000000, 99999999)}`, primerNombre: nombre, segundoNombre: '',
    primerApellido: 'Prueba', segundoApellido: 'Revisión', fechaNacimiento: nacimiento, direccion,
    acudienteId: acudiente.id, colegioId: colegio.id, grado, jornada: 'Mañana', estado: 'ACTIVO', observaciones: '',
  }, token);
const est1 = await estudiante('Sofía', '3°', `${hoy.getFullYear() - 8}-04-12`, 'Calle 134 # 9-51, Bogotá');
const est2 = await estudiante('Mateo', '5°', `${hoy.getFullYear() - 10}-09-03`, 'Calle 134 # 9-51, Bogotá');
console.log('✓ Acudiente y estudiantes');

// 6. Ruta y asignación (hoy → un año, toda la jornada).
const ruta = await llamar('POST', '/rutas', {
  codigo: '', nombre: 'Ruta Cedritos', colegioId: colegio.id, jornada: 'Mañana', sector: 'Cedritos, Usaquén',
  estudianteIds: [est1.id, est2.id], estado: 'ACTIVO', observaciones: '',
}, token);
await llamar('POST', '/asignaciones', {
  rutaId: ruta.id, vehiculoId: vehiculo.id, conductorId: conductor.id, monitoraId: '', fechaInicio: fecha(hoy), fechaFin: enUnAnio,
  estado: 'ACTIVO', observaciones: '',
}, token);
console.log('✓ Ruta y asignación');

// 7. Factura mensual (mes pasado → +10 meses) y el pago del mes pasado.
const factura = await llamar('POST', '/facturas', {
  fechaEmision: fecha(hoy), acudienteId: acudiente.id, estudianteId: est1.id, valorContratacion: 250000,
  periodoInicio: periodo(-1), periodoFin: periodo(10), concepto: 'Transporte escolar', estado: 'ACTIVO', observaciones: '',
}, token);
await llamar('POST', '/recibos', {
  facturaId: factura.id, periodo: periodo(-1), fechaPago: fecha(hoy), valor: 250000, medioPago: 'TRANSFERENCIA', referencia: '',
  estado: 'ACTIVO', observaciones: '', aplicacion: 'MESES', periodos: [periodo(-1)],
}, token);
console.log('✓ Factura y pago');

// 8. (Opcional) Plan Profesional activo por un año, con el SuperAdmin.
console.log('\nPara que no pierda el GPS cuando termine la prueba, la dejo en plan Profesional por un año.');
const superUsuario = await preguntar('Usuario SuperAdmin (Enter para omitir): ');
if (superUsuario) {
  const superContrasena = await preguntar('Contraseña SuperAdmin (no se muestra): ', true);
  const sesion = await llamar('POST', '/auth/login', { usuario: superUsuario, contrasena: superContrasena });
  await llamar('PUT', `/empresas/${idEmpresa}/suscripcion`, {
    plan: 'PROFESIONAL', estado: 'ACTIVA', periodo: 'ANUAL', fechaFin: `${enUnAnio}T23:59:59Z`,
    nota: 'Cuenta de revisión de Google Play (sin cobro).',
  }, sesion.tokens.accessToken);
  console.log('✓ Plan Profesional activo hasta', enUnAnio);
} else {
  console.log('· Omitido: la empresa queda en la prueba de Profesional.');
}

console.log(`
══════════ Datos para Play Console (Datos de inicio de sesión) ══════════
Administrador  usuario: ${usuarios.admin.usuario}   contraseña: ${usuarios.admin.contrasena}
Conductor      usuario: ${usuarios.conductor.usuario}   contraseña: ${usuarios.conductor.contrasena}
Acudiente      usuario: ${usuarios.acudiente.usuario}   contraseña: ${usuarios.acudiente.contrasena}
═════════════════════════════════════════════════════════════════════════
Cópialos ahora: no se guardan en ningún lado.`);
