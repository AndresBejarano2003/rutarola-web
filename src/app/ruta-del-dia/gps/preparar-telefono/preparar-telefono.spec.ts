import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { AjustesTelefono, EstadoTelefono, ajusteDeMarca } from '../ajustes-telefono';
import { PrepararTelefono } from './preparar-telefono';

describe('Prepara tu teléfono', () => {
  it('da el ajuste propio de cada marca y nada para las que no lo necesitan', () => {
    expect(ajusteDeMarca('ZTE')?.pasos).toContain('Autoinicio');
    expect(ajusteDeMarca('xiaomi')?.marca).toBe('Xiaomi');
    expect(ajusteDeMarca('samsung')?.marca).toBe('Samsung');
    expect(ajusteDeMarca('google')).toBeNull();
  });

  it('muestra los pasos pendientes con su botón, ✓ en los hechos, y la marca como vista al cerrarla', async () => {
    simularDialogos();
    const estado = signal<EstadoTelefono | null>({ notificaciones: true, sinOptimizacionBateria: false, fabricante: 'zte' });
    const abrirBateria = vi.fn(() => Promise.resolve());
    const marcarGuiaVista = vi.fn();
    TestBed.configureTestingModule({
      imports: [PrepararTelefono],
      providers: [
        {
          provide: AjustesTelefono,
          useValue: {
            nativo: true,
            estado,
            actualizar: () => Promise.resolve(estado()),
            solicitarNotificaciones: () => Promise.resolve(true),
            abrirOptimizacionBateria: abrirBateria,
            abrirAjustesApp: () => Promise.resolve(),
            marcarGuiaVista,
          },
        },
      ],
    });
    const f = TestBed.createComponent(PrepararTelefono);
    await f.whenStable();
    expect(marcarGuiaVista).not.toHaveBeenCalled(); // creada cerrada: aún no se ha visto

    f.componentRef.setInput('abierto', true);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const botones = [...el.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');
    expect(botones.some((t) => t.includes('Permitir notificaciones'))).toBe(false); // ya permitidas
    expect(el.textContent).toContain('Ajuste de tu ZTE');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Abrir ajustes de batería'))!.click();
    expect(abrirBateria).toHaveBeenCalled();
    expect(el.textContent).toContain('Continuar así');

    f.componentRef.setInput('abierto', false);
    await f.whenStable();
    expect(marcarGuiaVista).toHaveBeenCalled();
  });
});
