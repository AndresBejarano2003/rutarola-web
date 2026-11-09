import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MEDIOS_PAGO, MedioPago } from 'src/app/finanzas/recibos/recibo';
import { Trayecto } from 'src/app/ruta-del-dia/recorrido';
import { diasEntre, fechaCorta, fechaIso, nombrePeriodo } from 'src/app/shared/fechas/fechas';
import { EstudiantePortal, situacionRecorrido } from '../portal';
import { PortalEstado } from '../portal-estado';
import { MapaRuta } from '../mapa-ruta/mapa-ruta';
import { Avatar } from 'src/app/shared/foto/avatar';

/** Inicio del portal: cómo va la cuenta, dónde están hoy los estudiantes y los últimos pagos. */
@Component({
  selector: 'app-portal-inicio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, MapaRuta, Avatar],
  templateUrl: './portal-inicio-page.html',
})
export default class PortalInicioPage {
  protected readonly estado = inject(PortalEstado);
  protected readonly datos = this.estado.datos;
  protected readonly nombrePeriodo = nombrePeriodo;
  protected readonly fechaCorta = fechaCorta;
  protected readonly trayectos: Trayecto[] = ['RECOGIDA', 'ENTREGA'];

  private readonly ahora = new Date();
  protected readonly saludo = computed(
    () => `${this.ahora.getHours() < 12 ? 'Buenos días' : this.ahora.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${this.datos()?.acudiente.nombre.split(' ')[0] ?? ''}`,
  );
  protected readonly fechaHoy = this.ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  protected readonly activos = computed(() => (this.datos()?.estudiantes ?? []).filter((e) => e.estado === 'ACTIVO'));
  protected readonly ultimosPagos = computed(() => (this.datos()?.recibos ?? []).filter((r) => r.estado === 'ACTIVO').slice(0, 3));

  protected situacion(e: EstudiantePortal, trayecto: Trayecto) {
    return situacionRecorrido(e.hoy.find((r) => r.trayecto === trayecto), trayecto);
  }

  protected plazo(fechaLimite: string): string {
    const dias = diasEntre(fechaIso(), fechaLimite);
    if (dias < 0) return `Venció hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
    return dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
  }

  protected medio(id: MedioPago): string {
    return MEDIOS_PAGO.find((m) => m.id === id)?.nombre ?? id;
  }
}
