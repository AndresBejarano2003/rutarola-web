import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ConfiguracionRepositorio } from 'src/app/inicio/configuracion/configuracion-repositorio';
import { COLOR_DOCUMENTOS_POR_DEFECTO, FORMATO_VACIO, FormatoDocumentos } from 'src/app/shared/documentos-pdf/documentos-pdf';
import { reducirLogo } from 'src/app/shared/documentos-pdf/logo';
import { Modal } from 'src/app/shared/modal/modal';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { descargarPng, descargarSvg, imprimirHojaTarjetas, imprimirPiezas } from './exportar-pieza';
import {
  ADHESIVO_POR_DEFECTO,
  AMARILLO_MARCA,
  CaraTarjeta,
  DisenoAdhesivo,
  DisenoTarjeta,
  FORMATOS_ADHESIVO,
  MEDIDAS_TARJETA,
  PLANTILLAS_TARJETA,
  URL_DESCARGA,
  medidasAdhesivo,
  svgAdhesivo,
  svgTarjeta,
} from './piezas';

const CLAVE_ADHESIVO = 'rutarola.publicidad.adhesivo';
const CLAVE_TARJETA = 'rutarola.publicidad.tarjeta';

function leerGuardado<T>(clave: string): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? '{}') as Partial<T>;
  } catch {
    return {};
  }
}

function guardar(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento el diseño funciona igual; solo no se recuerda en este equipo.
  }
}

function tarjetaPorDefecto(f: FormatoDocumentos): DisenoTarjeta {
  return {
    plantilla: 'CLASICA',
    colorPrincipal: f.colorPrincipal || COLOR_DOCUMENTOS_POR_DEFECTO,
    colorAcento: AMARILLO_MARCA,
    logo: f.logo,
    nombreEmpresa: f.nombreComercial,
    eslogan: f.eslogan,
    nombreContacto: '',
    cargo: '',
    telefono: f.telefono,
    correo: f.correo,
    direccion: [f.direccion, f.ciudad].filter(Boolean).join(', '),
    sitioWeb: f.sitioWeb,
    mostrarApp: true,
    mostrarQr: true,
  };
}

function adhesivoPorDefecto(f: FormatoDocumentos): DisenoAdhesivo {
  return { ...ADHESIVO_POR_DEFECTO, logo: f.logo, nombreEmpresa: f.nombreComercial, telefono: f.telefono };
}

/**
 * Publicidad de la empresa: adhesivo para los vehículos (QR a la descarga de la app + Google Play) y tarjetas de
 * presentación (frente con el contacto, reverso que invita a los acudientes a ver sus datos en la app). Los datos
 * iniciales salen de Configuración › Documentos PDF (logo, nombre, contacto y color); los cambios se recuerdan en
 * este equipo. Se descargan en PNG (300 ppp, tamaño real), SVG (vector) o PDF (diálogo de impresión).
 */
@Component({
  selector: 'app-publicidad-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Modal],
  templateUrl: './publicidad-page.html',
})
export default class PublicidadPage implements OnInit {
  private readonly configuracion = inject(ConfiguracionRepositorio);
  private readonly avisos = inject(NotificacionesService);

  protected readonly formatos = FORMATOS_ADHESIVO;
  protected readonly plantillas = PLANTILLAS_TARJETA;
  protected readonly urlDescarga = URL_DESCARGA;

  protected readonly cargando = signal(true);
  private readonly formato = signal<FormatoDocumentos>(FORMATO_VACIO);
  protected readonly adhesivo = signal<DisenoAdhesivo>(adhesivoPorDefecto(FORMATO_VACIO));
  protected readonly tarjeta = signal<DisenoTarjeta>(tarjetaPorDefecto(FORMATO_VACIO));

  protected readonly adhesivoAbierto = signal(false);
  protected readonly tarjetaAbierta = signal(false);
  protected readonly cara = signal<CaraTarjeta>('FRENTE');
  protected readonly exportando = signal(false);

  protected readonly svgAdhesivo = computed(() => svgAdhesivo(this.adhesivo()));
  protected readonly svgFrente = computed(() => svgTarjeta(this.tarjeta(), 'FRENTE'));
  protected readonly svgReverso = computed(() => svgTarjeta(this.tarjeta(), 'REVERSO'));
  protected readonly vistaAdhesivo = computed(() => this.comoImagen(this.svgAdhesivo()));
  protected readonly vistaFrente = computed(() => this.comoImagen(this.svgFrente()));
  protected readonly vistaReverso = computed(() => this.comoImagen(this.svgReverso()));
  /** Proporción del adhesivo para la vista previa (`aspect-ratio`). */
  protected readonly proporcionAdhesivo = computed(() => {
    const { ancho, alto } = medidasAdhesivo(this.adhesivo().formato);
    return `${ancho} / ${alto}`;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.formato.set(await firstValueFrom(this.configuracion.formatoDocumentos()));
    } catch {
      // Sin la configuración se arranca con los textos por defecto (se pueden escribir).
    } finally {
      const f = this.formato();
      this.adhesivo.set({ ...adhesivoPorDefecto(f), ...leerGuardado<DisenoAdhesivo>(CLAVE_ADHESIVO) });
      this.tarjeta.set({ ...tarjetaPorDefecto(f), ...leerGuardado<DisenoTarjeta>(CLAVE_TARJETA) });
      this.cargando.set(false);
    }
  }

  private comoImagen(svg: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  protected cambiarAdhesivo<K extends keyof DisenoAdhesivo>(campo: K, valor: DisenoAdhesivo[K]): void {
    this.adhesivo.update((d) => ({ ...d, [campo]: valor }));
    guardar(CLAVE_ADHESIVO, this.adhesivo());
  }

  protected cambiarTarjeta<K extends keyof DisenoTarjeta>(campo: K, valor: DisenoTarjeta[K]): void {
    this.tarjeta.update((d) => ({ ...d, [campo]: valor }));
    guardar(CLAVE_TARJETA, this.tarjeta());
  }

  protected restablecerAdhesivo(): void {
    this.adhesivo.set(adhesivoPorDefecto(this.formato()));
    guardar(CLAVE_ADHESIVO, {});
  }

  protected restablecerTarjeta(): void {
    this.tarjeta.set(tarjetaPorDefecto(this.formato()));
    guardar(CLAVE_TARJETA, {});
  }

  protected async elegirLogo(evento: Event, destino: 'ADHESIVO' | 'TARJETA'): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    try {
      const logo = await reducirLogo(archivo);
      if (destino === 'ADHESIVO') this.cambiarAdhesivo('logo', logo);
      else this.cambiarTarjeta('logo', logo);
    } catch (e) {
      this.avisos.error(e instanceof Error ? e.message : 'No se pudo leer la imagen.');
    }
  }

  protected usarLogoEmpresa(destino: 'ADHESIVO' | 'TARJETA'): void {
    if (destino === 'ADHESIVO') this.cambiarAdhesivo('logo', this.formato().logo);
    else this.cambiarTarjeta('logo', this.formato().logo);
  }

  protected tieneLogoEmpresa(): boolean {
    return !!this.formato().logo;
  }

  // --- Exportar ----------------------------------------------------------------------------------------------------

  private nombreArchivo(base: string): string {
    const empresa = (this.formato().nombreComercial || 'empresa')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return `${base}-${empresa}`;
  }

  private async exportar(trabajo: () => Promise<void> | void, mensaje: string): Promise<void> {
    this.exportando.set(true);
    try {
      await trabajo();
      this.avisos.exito(mensaje);
    } catch (e) {
      this.avisos.error(e instanceof Error ? e.message : 'No se pudo generar el archivo.');
    } finally {
      this.exportando.set(false);
    }
  }

  protected descargarAdhesivoPng(): Promise<void> {
    const formato = FORMATOS_ADHESIVO.find((f) => f.id === this.adhesivo().formato) ?? FORMATOS_ADHESIVO[0];
    // 150 ppp basta para un adhesivo que se ve de lejos y mantiene el archivo liviano.
    return this.exportar(() => descargarPng(this.svgAdhesivo(), formato.anchoCm, `${this.nombreArchivo('adhesivo')}.png`, 150), 'Imagen descargada.');
  }

  protected descargarAdhesivoSvg(): Promise<void> {
    return this.exportar(() => descargarSvg(this.svgAdhesivo(), `${this.nombreArchivo('adhesivo')}.svg`), 'Archivo vectorial descargado.');
  }

  protected imprimirAdhesivo(): Promise<void> {
    const formato = FORMATOS_ADHESIVO.find((f) => f.id === this.adhesivo().formato) ?? FORMATOS_ADHESIVO[0];
    return this.exportar(
      () => imprimirPiezas([this.svgAdhesivo()], formato.anchoCm, formato.altoCm, 'Adhesivo RutaRola'),
      'Elige "Guardar como PDF" en el diálogo de impresión.',
    );
  }

  protected descargarTarjetaPng(): Promise<void> {
    const anchoCm = MEDIDAS_TARJETA.ancho / 100;
    return this.exportar(async () => {
      await descargarPng(this.svgFrente(), anchoCm, `${this.nombreArchivo('tarjeta-frente')}.png`);
      await descargarPng(this.svgReverso(), anchoCm, `${this.nombreArchivo('tarjeta-reverso')}.png`);
    }, 'Frente y reverso descargados.');
  }

  protected imprimirTarjeta(): Promise<void> {
    return this.exportar(
      () => imprimirPiezas([this.svgFrente(), this.svgReverso()], 9, 5, 'Tarjeta de presentación'),
      'Elige "Guardar como PDF" en el diálogo de impresión.',
    );
  }

  protected imprimirHoja(): Promise<void> {
    return this.exportar(
      () => imprimirHojaTarjetas(this.cara() === 'FRENTE' ? this.svgFrente() : this.svgReverso(), 'Tarjetas de presentación'),
      'Imprime la hoja del frente y luego la del reverso en la otra cara.',
    );
  }
}
