import { Injectable, signal } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { esAppNativa } from './fuente-ubicacion';

/** Estado del teléfono para compartir la ubicación en segundo plano (solo en la app instalada). */
export interface EstadoTelefono {
  notificaciones: boolean;
  /** RutaRola está fuera del ahorro de batería de Android ("No optimizar" / "Sin restricciones"). */
  sinOptimizacionBateria: boolean;
  /** `Build.MANUFACTURER` en minúsculas (zte, xiaomi, samsung…). */
  fabricante: string;
}

/** Plugin propio de la app Android (`android/.../AjustesTelefono.java`). */
interface PluginAjustesTelefono {
  estado(): Promise<EstadoTelefono & { version: number }>;
  solicitarNotificaciones(): Promise<{ concedido: boolean }>;
  abrirOptimizacionBateria(): Promise<void>;
  abrirAjustesApp(): Promise<void>;
}

/** `localStorage`: el conductor ya vio la guía "Prepara tu teléfono" en este teléfono. */
export const CLAVE_GUIA_TELEFONO = 'rutarola.preparar-telefono.visto';

/** Ajuste propio de cada marca que cierra apps en segundo plano (además del ahorro de batería de Android). */
export interface AjusteMarca {
  marca: string;
  pasos: string;
}

/**
 * Instrucciones por marca (los nombres de los menús cambian con la versión del sistema: se dan como referencia).
 * Sin coincidencia → `null` (basta con el ahorro de batería de Android).
 */
export function ajusteDeMarca(fabricante: string): AjusteMarca | null {
  const f = fabricante.toLowerCase();
  if (f.includes('zte') || f.includes('nubia'))
    return {
      marca: 'ZTE',
      pasos:
        'En la información de RutaRola entra a Batería (o en Ajustes › Batería › Gestión inteligente): cambia Autoinicio, Inicio relacionado y Ejecución en segundo plano de "automático" a manual y actívalos los tres.',
    };
  if (['xiaomi', 'redmi', 'poco'].some((m) => f.includes(m)))
    return {
      marca: 'Xiaomi',
      pasos: 'En la información de RutaRola: Ahorro de batería › Sin restricciones, y activa Inicio automático.',
    };
  if (f.includes('samsung'))
    return {
      marca: 'Samsung',
      pasos:
        'En la información de RutaRola: Batería › Sin restricciones. Si aparece en Ajustes › Batería › Límites de uso en segundo plano, quítala de "Apps en suspensión".',
    };
  if (f.includes('huawei') || f.includes('honor'))
    return {
      marca: 'Huawei',
      pasos: 'En Ajustes › Batería › Inicio de aplicaciones busca RutaRola: elige "Gestionar manualmente" y activa las tres opciones.',
    };
  if (['oppo', 'realme', 'oneplus'].some((m) => f.includes(m)))
    return {
      marca: 'OPPO / realme',
      pasos: 'En la información de RutaRola: Uso de batería › Permitir actividad en segundo plano y Permitir inicio automático.',
    };
  if (f.includes('vivo'))
    return {
      marca: 'vivo',
      pasos: 'En Ajustes › Batería › Consumo de energía en segundo plano, permite a RutaRola consumo alto en segundo plano.',
    };
  return null;
}

/**
 * Lo que la guía "Prepara tu teléfono" consulta y abre. En el navegador no aplica (`nativo` false): la ubicación
 * en segundo plano solo existe en la app instalada.
 */
@Injectable({ providedIn: 'root' })
export class AjustesTelefono {
  readonly nativo = esAppNativa();
  private readonly plugin = this.nativo ? registerPlugin<PluginAjustesTelefono>('AjustesTelefono') : null;
  /** Último estado leído (`null` = aún no se ha leído o no es la app). */
  readonly estado = signal<EstadoTelefono | null>(null);

  async actualizar(): Promise<EstadoTelefono | null> {
    if (!this.plugin) return null;
    try {
      const { notificaciones, sinOptimizacionBateria, fabricante } = await this.plugin.estado();
      const estado = { notificaciones, sinOptimizacionBateria, fabricante };
      this.estado.set(estado);
      return estado;
    } catch {
      return null;
    }
  }

  async solicitarNotificaciones(): Promise<boolean> {
    if (!this.plugin) return true;
    try {
      const { concedido } = await this.plugin.solicitarNotificaciones();
      await this.actualizar();
      return concedido;
    } catch {
      return false;
    }
  }

  abrirOptimizacionBateria(): Promise<void> {
    return this.plugin?.abrirOptimizacionBateria().catch(() => undefined) ?? Promise.resolve();
  }

  abrirAjustesApp(): Promise<void> {
    return this.plugin?.abrirAjustesApp().catch(() => undefined) ?? Promise.resolve();
  }

  guiaVista(): boolean {
    try {
      return localStorage.getItem(CLAVE_GUIA_TELEFONO) === '1';
    } catch {
      return false;
    }
  }

  marcarGuiaVista(): void {
    try {
      localStorage.setItem(CLAVE_GUIA_TELEFONO, '1');
    } catch {
      /* sin almacenamiento: se volverá a mostrar */
    }
  }
}
