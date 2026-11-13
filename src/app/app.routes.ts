import { Routes } from '@angular/router';

export const routes: Routes = [
  // Páginas públicas (sin layout)
  // Antes era un formulario sin datos reales: los datos de la cuenta están en Inicio › Perfil.
  { path: 'editar-usuario', redirectTo: 'inicio/perfil' },
  { path: 'offline-membership', loadComponent: () => import('./sistema/membresias/planes-publicos/planes-publicos-page') },

  // La raíz va al login (o, con sesión, al inicio de su rol: `soloInvitados`). Debe ir ANTES de la ruta '' con
  // loadChildren: si no, esa ruta acepta la URL vacía sin ningún hijo y la pantalla queda en blanco.
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // Login + sistemas por tipo de usuario (con layout, repositorios y guards): ver modulos.routes.ts
  { path: '', loadChildren: () => import('./modulos.routes') },

  { path: '**', redirectTo: 'login' },
];
