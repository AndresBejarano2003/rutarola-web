import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Trayecto } from 'src/app/ruta-del-dia/recorrido';
import { horaLegible } from 'src/app/shared/fechas/fechas';
import { EstudiantePortal, situacionRecorrido } from '../portal';
import { PortalEstado } from '../portal-estado';
import { MapaRuta } from '../mapa-ruta/mapa-ruta';
import { AvisarAusencia } from '../avisar-ausencia/avisar-ausencia';
import { Avatar } from 'src/app/shared/foto/avatar';
import { inicialesDe } from 'src/app/shared/foto/foto';

/** Estudiantes a cargo: colegio y horario, ruta, vehículo, personal (con contacto), cómo van hoy y avisos de que no van. */
@Component({
  selector: 'app-portal-estudiantes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MapaRuta, Avatar, AvisarAusencia],
  templateUrl: './portal-estudiantes-page.html',
})
export default class PortalEstudiantesPage {
  protected readonly inicialesDe = inicialesDe;
  protected readonly estado = inject(PortalEstado);
  protected readonly datos = this.estado.datos;
  protected readonly horaLegible = horaLegible;
  protected readonly trayectos: Trayecto[] = ['RECOGIDA', 'ENTREGA'];

  protected situacion(e: EstudiantePortal, trayecto: Trayecto) {
    return situacionRecorrido(e.hoy.find((r) => r.trayecto === trayecto), trayecto);
  }

  protected telefono(numero: string): string {
    return `tel:${numero.replace(/\D/g, '')}`;
  }
}
