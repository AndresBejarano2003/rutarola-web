import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { environment } from '@environments/environment';

export interface Credenciales {
  usuario: string;
  contrasena: string;
  /** `true`: la sesión sobrevive al cerrar el navegador (localStorage); si no, solo la pestaña (sessionStorage). */
  recordar?: boolean;
}

/**
 * Tipos de usuario. Cada uno entra a SU sistema:
 * - `ADMINISTRADOR` → sistema administrativo (`/inicio`, todos los módulos).
 * - `CONDUCTOR` / `MONITORA` → app de la ruta del día (`/ruta-del-dia`).
 * - `ACUDIENTE` → portal del acudiente (`/portal`): sus estudiantes, facturas, pagos y cotizaciones.
 * - `SUPER_ADMIN` → plataforma (`/plataforma`): empresas de transporte (solo con API).
 */
export type RolUsuario = 'ADMINISTRADOR' | 'CONDUCTOR' | 'MONITORA' | 'ACUDIENTE' | 'SUPER_ADMIN';

export const ROLES_USUARIO: { id: RolUsuario; nombre: string; inicio: string }[] = [
  { id: 'ADMINISTRADOR', nombre: 'Administrador', inicio: '/inicio' },
  { id: 'CONDUCTOR', nombre: 'Conductor', inicio: '/ruta-del-dia' },
  { id: 'MONITORA', nombre: 'Monitora', inicio: '/ruta-del-dia' },
  { id: 'ACUDIENTE', nombre: 'Acudiente', inicio: '/portal' },
  { id: 'SUPER_ADMIN', nombre: 'Plataforma RutaRola', inicio: '/plataforma' },
];

/** Roles que usan la app de la ruta del día. */
export const ROLES_OPERATIVOS: RolUsuario[] = ['CONDUCTOR', 'MONITORA'];

/**
 * Tokens del API (`POST /auth/login` y `/auth/refresh`). El access token (JWT, 15 min) va en
 * `Authorization: Bearer`; el refresh token es de un solo uso y se cambia en cada renovación
 * (`core/interceptor-autenticacion.ts`). En modo local no hay tokens.
 */
export interface TokensSesion {
  accessToken: string;
  /** ISO */
  accessTokenExpira: string;
  refreshToken: string;
  /** ISO */
  refreshTokenExpira: string;
}

/** Usuario autenticado (lo que devuelve `POST /auth/login` en `sesion`, más sus `tokens`). */
export interface Sesion {
  /** Usuario con el que ingresó (correo o número de documento). */
  usuario: string;
  nombre: string;
  correo: string;
  rol: RolUsuario;
  /** Empleado vinculado (conductor/monitora); `null` para los demás roles. */
  empleadoId: string | null;
  /** Acudiente vinculado (rol ACUDIENTE). */
  acudienteId?: string | null;
  /** Foto de perfil; vacía = iniciales. */
  imagen: string;
  /** ISO de inicio de sesión. */
  inicio: string;
  /** Empresa de transporte del usuario (solo con API). */
  empresa?: { id: string; nombre: string } | null;
  /** Permisos `modulo.accion` del rol (solo con API). */
  permisos?: string[];
  /** Solo con API; ausente en modo local. */
  tokens?: TokensSesion;
}

/** Perfil inicial del administrador de demostración del modo local (lo puede cambiar en Mi cuenta). */
export const USUARIO_DEMO = {
  nombre: 'Andrés Bejarano',
  correo: 'andres@rutarola.com',
  imagen: '',
};

/** Clave donde se guarda la sesión (localStorage si "Recordarme", si no sessionStorage). */
export const CLAVE_SESION = 'rutarola.sesion';

export function nombreRol(rol: RolUsuario): string {
  return ROLES_USUARIO.find((r) => r.id === rol)?.nombre ?? rol;
}

/** Ruta de entrada de cada tipo de usuario. */
export function rutaInicio(rol: RolUsuario): string {
  return ROLES_USUARIO.find((r) => r.id === rol)?.inicio ?? '/login';
}

/**
 * Estado de la sesión. La validación de las credenciales la hace
 * `AutenticacionRepositorio` (local o `POST /auth/login`); este servicio solo
 * guarda, expone y cierra la sesión.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly injector = inject(Injector);
  private readonly _sesion = signal<Sesion | null>(leerSesion());
  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);
  readonly rol = computed(() => this._sesion()?.rol ?? null);
  readonly tokens = computed(() => this._sesion()?.tokens ?? null);

  abrirSesion(sesion: Sesion, recordar = false): void {
    borrarSesion();
    guardar(recordar ? localStorage : sessionStorage, sesion);
    this._sesion.set(sesion);
  }

  /** Tokens nuevos tras `/auth/refresh`: se guardan donde ya estaba la sesión ("Recordarme" o solo la pestaña). */
  actualizarTokens(tokens: TokensSesion): void {
    const actual = this._sesion();
    if (!actual) return;
    const sesion = { ...actual, tokens };
    guardar(almacenDeSesion() ?? sessionStorage, sesion);
    this._sesion.set(sesion);
  }

  /** Datos del perfil cambiados en Mi cuenta (nombre, correo, foto): conserva los tokens y el almacén. */
  actualizarSesion(cambios: Partial<Pick<Sesion, 'nombre' | 'correo' | 'imagen'>>): void {
    const actual = this._sesion();
    if (!actual) return;
    const sesion = { ...actual, ...cambios };
    guardar(almacenDeSesion() ?? sessionStorage, sesion);
    this._sesion.set(sesion);
  }

  /**
   * Otra pestaña (con "Recordarme") pudo renovar los tokens: si el almacenamiento tiene otros, se
   * adoptan y devuelve `true` (así no se reusa un refresh token ya rotado).
   */
  adoptarTokensDeOtraPestana(): boolean {
    const guardada = leerSesion();
    const actuales = this.tokens();
    if (guardada?.tokens && actuales && guardada.tokens.refreshToken !== actuales.refreshToken) {
      this._sesion.set({ ...this._sesion()!, tokens: guardada.tokens });
      return true;
    }
    return false;
  }

  /**
   * Cierra SOLO la sesión: los datos locales de los módulos se conservan. Con API también revoca el
   * refresh token en el servidor (sin esperar la respuesta); `revocar: false` cuando ya no es válido.
   */
  cerrarSesion({ revocar = true }: { revocar?: boolean } = {}): void {
    const tokens = this.tokens();
    borrarSesion();
    this._sesion.set(null);
    if (revocar && tokens) {
      this.injector
        .get(HttpClient)
        .post(`${environment.apiUrl}/auth/logout`, { refreshToken: tokens.refreshToken })
        .subscribe({ error: () => undefined });
    }
  }

  tieneRol(...roles: RolUsuario[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }
}

function leerSesion(): Sesion | null {
  for (const almacen of [sessionStorage, localStorage]) {
    try {
      const guardada = almacen.getItem(CLAVE_SESION);
      if (guardada) {
        const sesion = JSON.parse(guardada) as Sesion;
        if (ROLES_USUARIO.some((r) => r.id === sesion.rol)) return sesion;
      }
    } catch {
      // Almacenamiento no disponible o sesión corrupta: se ignora.
    }
  }
  return null;
}

function guardar(almacen: Storage, sesion: Sesion): void {
  try {
    almacen.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento la sesión vive solo en memoria.
  }
}

function almacenDeSesion(): Storage | null {
  for (const almacen of [sessionStorage, localStorage]) {
    try {
      if (almacen.getItem(CLAVE_SESION)) return almacen;
    } catch {
      // No disponible.
    }
  }
  return null;
}

function borrarSesion(): void {
  for (const almacen of [sessionStorage, localStorage]) {
    try {
      almacen.removeItem(CLAVE_SESION);
    } catch {
      // Nada que borrar.
    }
  }
}
