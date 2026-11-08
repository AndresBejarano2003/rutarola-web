import { Routes } from '@angular/router';

export const routes: Routes = [
  // Páginas públicas (sin layout)
  // Antes era un formulario sin datos reales: los datos de la cuenta están en Inicio › Perfil.
  { path: 'editar-usuario', redirectTo: 'inicio/perfil' },
  { path: 'offline-membership', loadComponent: () => import('./sistema/membresias/planes-publicos/planes-publicos-page') },

  // Login + sistemas por tipo de usuario (con layout, repositorios y guards): ver modulos.routes.ts
  { path: '', loadChildren: () => import('./modulos.routes') },

  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
