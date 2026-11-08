import { Routes } from '@angular/router';
import { ROLES_OPERATIVOS } from './core/auth';
import { soloInvitados, soloRoles } from './core/guardias';
import { proveerRepositorios } from './core/repositorios';

/** Layout del sistema administrativo: barra superior + menú lateral. */
const shell = () => import('./layout/shell/shell');
/** Layout de la app del conductor/monitora: móvil, sin menú lateral. */
const shellConductor = () => import('./layout/shell-conductor/shell-conductor');
const administrador = [soloRoles('ADMINISTRADOR')];

/**
 * Login y sistemas por TIPO DE USUARIO. Se cargan de forma diferida junto con los
 * repositorios: la ruta padre los provee UNA vez para todos, así comparten instancias
 * (los módulos se enlazan entre sí) sin inflar el bundle inicial. El login va aquí
 * porque, en modo local, resuelve el rol consultando los empleados.
 *
 * - ADMINISTRADOR → `/inicio` y los módulos administrativos.
 * - CONDUCTOR / MONITORA → `/ruta-del-dia`.
 * - ACUDIENTE → `/portal` (layout `shell-portal`).
 * - SUPER_ADMIN → `/plataforma` (layout `shell-plataforma`): empresas de transporte.
 * Los guards (`core/guardias.ts`) llevan a cada quien a su sistema si entra a una URL de otro rol.
 */
export default [
  {
    path: '',
    providers: proveerRepositorios(),
    children: [
      { path: 'login', canActivate: [soloInvitados], loadComponent: () => import('./autenticacion/login/login-page') },
      // Registro público de una empresa (crea su administrador y la prueba gratuita; necesita el API).
      { path: 'registro', canActivate: [soloInvitados], loadComponent: () => import('./autenticacion/registro/registro-page') },
      { path: 'inicio', canActivate: administrador, loadComponent: shell, loadChildren: () => import('./inicio/inicio.routes') },
      { path: 'personas', canActivate: administrador, loadComponent: shell, loadChildren: () => import('./personas/personas.routes') },
      { path: 'finanzas', canActivate: administrador, loadComponent: shell, loadChildren: () => import('./finanzas/finanzas.routes') },
      { path: 'operacion', canActivate: administrador, loadComponent: shell, loadChildren: () => import('./operacion/operacion.routes') },
      { path: 'sistema', canActivate: administrador, loadComponent: shell, loadChildren: () => import('./sistema/sistema.routes') },
      {
        path: 'ruta-del-dia',
        canActivate: [soloRoles(...ROLES_OPERATIVOS)],
        loadComponent: shellConductor,
        loadChildren: () => import('./ruta-del-dia/ruta-del-dia.routes'),
      },
      { path: 'portal', canActivate: [soloRoles('ACUDIENTE')], loadChildren: () => import('./portal/portal.routes') },
      {
        path: 'plataforma',
        canActivate: [soloRoles('SUPER_ADMIN')],
        loadComponent: () => import('./layout/shell-plataforma/shell-plataforma'),
        loadChildren: () => import('./plataforma/plataforma.routes'),
      },
    ],
  },
] satisfies Routes;
