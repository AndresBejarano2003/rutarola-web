import { AbstractType, Provider, Type } from "@angular/core";
import { environment } from "@environments/environment";
import { AutenticacionHttp } from "../autenticacion/autenticacion-http";
import { AutenticacionLocal } from "../autenticacion/autenticacion-local";
import { AutenticacionRepositorio } from "../autenticacion/autenticacion-repositorio";
import { PortalHttp } from "../portal/portal-http";
import { PortalLocal } from "../portal/portal-local";
import { PortalRepositorio } from "../portal/portal-repositorio";
import { EmpresasHttp } from "../plataforma/empresas/empresas-http";
import { EmpresasLocal } from "../plataforma/empresas/empresas-local";
import { EmpresasRepositorio } from "../plataforma/empresas/empresas-repositorio";
import { TicketsHttp } from "../sistema/soporte/tickets/tickets-http";
import { TicketsLocal } from "../sistema/soporte/tickets/tickets-local";
import { TicketsRepositorio } from "../sistema/soporte/tickets/tickets-repositorio";
import { SuscripcionHttp } from "../sistema/membresias/suscripcion-http";
import { SuscripcionLocal } from "../sistema/membresias/suscripcion-local";
import { SuscripcionRepositorio } from "../sistema/membresias/suscripcion-repositorio";
import { GpsHttp } from "../ruta-del-dia/gps/gps-http";
import { GpsLocal } from "../ruta-del-dia/gps/gps-local";
import { GpsRepositorio } from "../ruta-del-dia/gps/gps-repositorio";
import { RecorridosHttp } from "../ruta-del-dia/recorridos-http";
import { RecorridosLocal } from "../ruta-del-dia/recorridos-local";
import { RecorridosRepositorio } from "../ruta-del-dia/recorridos-repositorio";
import { TableroHttp } from "../inicio/dashboard/tablero-http";
import { TableroLocal } from "../inicio/dashboard/tablero-local";
import { TableroRepositorio } from "../inicio/dashboard/tablero-repositorio";
import { ConfiguracionHttp } from "../inicio/configuracion/configuracion-http";
import { ConfiguracionLocal } from "../inicio/configuracion/configuracion-local";
import { ConfiguracionRepositorio } from "../inicio/configuracion/configuracion-repositorio";
import { CentroNotificaciones } from "../inicio/notificaciones/centro-notificaciones";
import { NotificacionesHttp } from "../inicio/notificaciones/notificaciones-http";
import { NotificacionesLocal } from "../inicio/notificaciones/notificaciones-local";
import { NotificacionesRepositorio } from "../inicio/notificaciones/notificaciones-repositorio";
import { CotizacionesHttp } from "../finanzas/cotizaciones/cotizaciones-http";
import { CotizacionesLocal } from "../finanzas/cotizaciones/cotizaciones-local";
import { CotizacionesRepositorio } from "../finanzas/cotizaciones/cotizaciones-repositorio";
import { FacturasHttp } from "../finanzas/facturas/facturas-http";
import { FacturasLocal } from "../finanzas/facturas/facturas-local";
import { FacturasRepositorio } from "../finanzas/facturas/facturas-repositorio";
import { ProgramacionesHttp } from "../finanzas/programacion/programaciones-http";
import { ProgramacionesLocal } from "../finanzas/programacion/programaciones-local";
import { ProgramacionesRepositorio } from "../finanzas/programacion/programaciones-repositorio";
import { MensajesWhatsappHttp } from "../finanzas/mensajes-whatsapp/mensajes-whatsapp-http";
import { MensajesWhatsappLocal } from "../finanzas/mensajes-whatsapp/mensajes-whatsapp-local";
import { MensajesWhatsappRepositorio } from "../finanzas/mensajes-whatsapp/mensajes-whatsapp-repositorio";
import { RecibosHttp } from "../finanzas/recibos/recibos-http";
import { RecibosLocal } from "../finanzas/recibos/recibos-local";
import { RecibosRepositorio } from "../finanzas/recibos/recibos-repositorio";
import { ReportesHttp } from "../finanzas/reportes/reportes-http";
import { ReportesLocal } from "../finanzas/reportes/reportes-local";
import { ReportesRepositorio } from "../finanzas/reportes/reportes-repositorio";
import { AsignacionesHttp } from "../operacion/asignaciones/asignaciones-http";
import { AsignacionesLocal } from "../operacion/asignaciones/asignaciones-local";
import { AsignacionesRepositorio } from "../operacion/asignaciones/asignaciones-repositorio";
import { ColegiosLocal } from "../operacion/colegios/colegios-local";
import { ColegiosHttp } from "../operacion/colegios/colegios-http";
import { ColegiosRepositorio } from "../operacion/colegios/colegios-repositorio";
import { ConductoresLocal } from "../operacion/conductores/conductores-local";
import { ConductoresHttp } from "../operacion/conductores/conductores-http";
import { ConductoresRepositorio } from "../operacion/conductores/conductores-repositorio";
import { HistorialRecorridosHttp } from "../operacion/recorridos/historial-recorridos-http";
import { HistorialRecorridosLocal } from "../operacion/recorridos/historial-recorridos-local";
import { HistorialRecorridosRepositorio } from "../operacion/recorridos/historial-recorridos-repositorio";
import { RutasHttp } from "../operacion/rutas/rutas-http";
import { RutasLocal } from "../operacion/rutas/rutas-local";
import { RutasRepositorio } from "../operacion/rutas/rutas-repositorio";
import { VehiculosLocal } from "../operacion/vehiculos/vehiculos-local";
import { VehiculosHttp } from "../operacion/vehiculos/vehiculos-http";
import { VehiculosRepositorio } from "../operacion/vehiculos/vehiculos-repositorio";
import { AcudientesLocal } from "../personas/acudientes/acudientes-local";
import { AcudientesHttp } from "../personas/acudientes/acudientes-http";
import { AcudientesRepositorio } from "../personas/acudientes/acudientes-repositorio";
import { EmpleadosLocal } from "../personas/empleados/empleados-local";
import { EmpleadosHttp } from "../personas/empleados/empleados-http";
import { EmpleadosRepositorio } from "../personas/empleados/empleados-repositorio";
import { EstudiantesLocal } from "../personas/estudiantes/estudiantes-local";
import { EstudiantesHttp } from "../personas/estudiantes/estudiantes-http";
import { EstudiantesRepositorio } from "../personas/estudiantes/estudiantes-repositorio";

/**
 * ÚNICO lugar donde se elige la fuente de datos de cada módulo.
 *
 * Se registran una sola vez en la ruta padre de los módulos internos
 * (`modulos.routes.ts`) porque los módulos se enlazan entre sí
 * (estudiantes ↔ colegios ↔ rutas ↔ asignaciones; facturas ↔ recibos ↔
 * programación ↔ reportes) y todos deben compartir la misma instancia.
 *
 * Los módulos que ya tienen API usan `api(XRepositorio, XLocal, XHttp)`: HTTP cuando `environment.usarApi`
 * (desarrollo), local en `npm run start:local`, en producción (hasta desplegar el API) y en las
 * pruebas (`repositoriosDePrueba()`). Para conectar otro módulo, cambiar su
 * `{ provide: XRepositorio, useClass: XLocal }` por `api(XRepositorio, XLocal, XHttp)`. El login va con Personas: los usuarios se crean en sus formularios.
 */
export function proveerRepositorios({
  usarApi = environment.usarApi,
}: { usarApi?: boolean } = {}): Provider[] {
  const api = <T>(
    token: AbstractType<T>,
    local: Type<T>,
    http: Type<T>,
  ): Provider => ({
    provide: token,
    useClass: usarApi ? http : local,
  });
  return [
    // Personas
    api(EstudiantesRepositorio, EstudiantesLocal, EstudiantesHttp),
    api(AcudientesRepositorio, AcudientesLocal, AcudientesHttp),
    api(EmpleadosRepositorio, EmpleadosLocal, EmpleadosHttp),
    // Operación
    api(ColegiosRepositorio, ColegiosLocal, ColegiosHttp),
    api(VehiculosRepositorio, VehiculosLocal, VehiculosHttp),
    api(RutasRepositorio, RutasLocal, RutasHttp),
    api(AsignacionesRepositorio, AsignacionesLocal, AsignacionesHttp),
    api(ConductoresRepositorio, ConductoresLocal, ConductoresHttp),
    api(
      HistorialRecorridosRepositorio,
      HistorialRecorridosLocal,
      HistorialRecorridosHttp,
    ),
    // Finanzas
    api(CotizacionesRepositorio, CotizacionesLocal, CotizacionesHttp),
    api(FacturasRepositorio, FacturasLocal, FacturasHttp),
    api(RecibosRepositorio, RecibosLocal, RecibosHttp),
    api(ProgramacionesRepositorio, ProgramacionesLocal, ProgramacionesHttp),
    api(ReportesRepositorio, ReportesLocal, ReportesHttp),
    api(MensajesWhatsappRepositorio, MensajesWhatsappLocal, MensajesWhatsappHttp),
    // Inicio (resumen de todos los módulos) y configuración de la empresa
    api(TableroRepositorio, TableroLocal, TableroHttp),
    api(ConfiguracionRepositorio, ConfiguracionLocal, ConfiguracionHttp),
    // Notificaciones (leen datos de todos los módulos). `CentroNotificaciones` es el estado
    // compartido de la campana y la página; va aquí porque necesita estos repositorios.
    api(NotificacionesRepositorio, NotificacionesLocal, NotificacionesHttp),
    CentroNotificaciones,
    // Acceso (el login local resuelve el rol con los empleados) y ruta del día de conductores/monitoras
    api(AutenticacionRepositorio, AutenticacionLocal, AutenticacionHttp),
    api(RecorridosRepositorio, RecorridosLocal, RecorridosHttp),
    // Ubicación de los vehículos (Ruta del día la envía; mapas del administrador y del acudiente)
    api(GpsRepositorio, GpsLocal, GpsHttp),
    // Portal del acudiente (lee todos los módulos)
    api(PortalRepositorio, PortalLocal, PortalHttp),
    // Plataforma (SUPER_ADMIN, solo existe con el API)
    api(EmpresasRepositorio, EmpresasLocal, EmpresasHttp),
    // Tickets de soporte (empresa y plataforma)
    api(TicketsRepositorio, TicketsLocal, TicketsHttp),
    // Plan de la empresa y pagos en línea (Wompi)
    api(SuscripcionRepositorio, SuscripcionLocal, SuscripcionHttp),
  ];
}
