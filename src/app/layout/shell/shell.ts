import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraSuperior } from '../barra-superior/barra-superior';
import { MenuLateral } from '../menu-lateral/menu-lateral';
import { ContenedorNotificaciones } from 'src/app/shared/notificaciones/contenedor-notificaciones';
import { AvisoPlan } from 'src/app/sistema/membresias/aviso-plan/aviso-plan';
import { DecisionPlan } from 'src/app/sistema/membresias/decision-plan/decision-plan';

/** Layout principal: barra superior + menú lateral (drawer) + contenido. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shell',
  imports: [RouterOutlet, BarraSuperior, MenuLateral, ContenedorNotificaciones, AvisoPlan, DecisionPlan],
  templateUrl: './shell.html',
})
export default class Shell {}
