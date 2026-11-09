import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { CatalogosService, OpcionCatalogo } from 'src/app/shared/catalogos/catalogos';
import { mensajeError } from 'src/app/shared/formularios/formularios';
import { SelectorBusqueda } from 'src/app/shared/selector-busqueda/selector-busqueda';
import { CampoFoto } from 'src/app/shared/foto/campo-foto';

/**
 * Secciones "Identificación" y "Datos personales" (documento y nombres).
 * Se usa DENTRO de un `<form [formGroup]>` que tenga los controles de
 * `controlesPersona()`; los `formControlName` se enlazan a ese formulario.
 */
@Component({
  selector: 'app-campos-persona',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectorBusqueda, CampoFoto],
  // Permite usar formControlName contra el formulario del componente padre.
  viewProviders: [{ provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) }],
  host: { class: 'contents' },
  templateUrl: './campos-persona.html',
})
export class CamposPersona implements OnInit {
  /** Tipos de documento permitidos (p. ej. empleados solo mayores de edad). */
  readonly tiposDocumento = input<OpcionCatalogo[]>(inject(CatalogosService).tiposDocumento);

  private readonly contenedor = inject(ControlContainer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // El formulario se marca como "tocado" desde fuera (botón Guardar del pie):
    // refrescar para mostrar los errores.
    this.contenedor.control?.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
  }

  /** Iniciales en vivo para la vista previa de la foto. */
  protected iniciales(): string {
    const v = this.contenedor.control?.value as { primerNombre?: string; primerApellido?: string } | undefined;
    return `${v?.primerNombre?.trim().charAt(0) ?? ''}${v?.primerApellido?.trim().charAt(0) ?? ''}`.toUpperCase();
  }

  protected error(campo: string): string | null {
    const control = this.contenedor.control?.get(campo);
    return control ? mensajeError(control) : null;
  }
}
