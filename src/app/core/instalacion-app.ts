import { Injectable, computed, signal } from '@angular/core';

/** Evento del navegador (Chrome, Edge, Android) que permite mostrar la instalación cuando el usuario quiera. */
interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Cómo se instala en este navegador. NATIVO = botón "Instalar"; los demás se explican con pasos. */
export type FormaInstalacion = 'NATIVO' | 'IOS' | 'SAFARI_MAC' | 'OTRO';

const oferta = signal<EventoInstalacion | null>(null);
const instaladaAhora = signal(false);

/** Se llama en `main.ts` antes de arrancar Angular: el evento puede llegar antes de que exista cualquier servicio. */
export function capturarInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    oferta.set(e as EventoInstalacion);
  });
  window.addEventListener('appinstalled', () => {
    oferta.set(null);
    instaladaAhora.set(true);
  });
}

/** Detecta el navegador para dar las instrucciones correctas (pura, para pruebas). */
export function formaInstalacion(agente: string, tactil: number, hayOferta: boolean): FormaInstalacion {
  if (hayOferta) return 'NATIVO';
  const ios = /iPhone|iPad|iPod/.test(agente) || (/Macintosh/.test(agente) && tactil > 1);
  if (ios) return 'IOS';
  if (/Macintosh/.test(agente) && /Safari/.test(agente) && !/Chrome|Chromium|Edg|Firefox/.test(agente)) return 'SAFARI_MAC';
  return 'OTRO';
}

/**
 * RutaRola como aplicación web instalable (PWA): ícono en el escritorio o la pantalla de inicio y ventana propia.
 * `puedeOfrecer` es falso dentro de la app de Android y cuando ya se abrió instalada.
 */
@Injectable({ providedIn: 'root' })
export class InstalacionApp {
  private readonly nativa = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  private readonly abiertaInstalada =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

  readonly instalada = computed(() => this.abiertaInstalada || instaladaAhora());
  readonly forma = computed(() => formaInstalacion(navigator.userAgent, navigator.maxTouchPoints ?? 0, !!oferta()));
  /** Hay algo que ofrecer: el botón del navegador o, en iPhone/iPad y Safari de Mac, los pasos. */
  readonly puedeOfrecer = computed(() => !this.nativa && !this.instalada() && this.forma() !== 'OTRO');

  /** Abre el diálogo de instalación del navegador. Devuelve true si el usuario aceptó. */
  async instalar(): Promise<boolean> {
    const evento = oferta();
    if (!evento) return false;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    oferta.set(null);
    return outcome === 'accepted';
  }
}
