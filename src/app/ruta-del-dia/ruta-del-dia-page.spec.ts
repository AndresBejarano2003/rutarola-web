import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { fechaIso } from 'src/app/shared/fechas/fechas';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import RecorridoPage from './recorrido/recorrido-page';
import { RecorridosRepositorio } from './recorridos-repositorio';
import RutaDelDiaPage from './ruta-del-dia-page';

@Component({ template: '' })
class Vacia {}

describe('Ruta del día (conductor)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    simularDialogos();
    vi.useFakeTimers({ now: new Date('2026-11-05T06:30:00'), toFake: ['Date'] });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'ruta-del-dia', component: RutaDelDiaPage },
          { path: 'ruta-del-dia/recorrido/:id', component: RecorridoPage },
          { path: '**', component: Vacia },
        ]),
        ...repositoriosDePrueba(),
      ],
    });
    TestBed.inject(AuthService).abrirSesion({
      usuario: '7698123', nombre: 'José Luis Cárdenas Rojas', correo: '', rol: 'CONDUCTOR', empleadoId: 'emp-1', imagen: '', inicio: '',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('lista las rutas de hoy e inicia la recogida', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-del-dia', RutaDelDiaPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).toContain('Buenos días, José');
    expect(el.textContent).toContain('R-01 · Norte');
    expect(el.textContent).toContain('Monitora:');
    const iniciar = pantalla(el).boton('Iniciar recogida');
    expect(iniciar.className).toContain('btn-primary');

    iniciar.click();
    await estabilizar(harness.fixture, 4);
    expect(TestBed.inject(Router).url).toMatch(/^\/ruta-del-dia\/recorrido\//);
  });

  it('guía el recorrido paso a paso hasta finalizarlo', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/ruta-del-dia/recorrido/${r.id}`, RecorridoPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    const ui = pantalla(el);
    const paso = () => el.querySelector('[aria-live="polite"]')?.textContent ?? '';

    expect(paso()).toContain('Próxima recogida');
    expect(paso()).toContain(r.paradas[0].estudiante);
    ui.boton('Recogido').click();
    await estabilizar(harness.fixture, 3);
    expect(paso()).toContain(r.paradas[1].estudiante);
    ui.boton('No asiste hoy').click();
    await estabilizar(harness.fixture, 3);
    expect(paso()).toContain('Llegada al colegio');
    expect(el.textContent).toContain('No asiste hoy al colegio');
    ui.boton('en el colegio').click();
    await estabilizar(harness.fixture, 3);
    expect(paso()).toContain('Todos los estudiantes están resueltos');
    ui.boton('Finalizar recorrido').click();
    await estabilizar(harness.fixture, 3);
    expect(el.querySelector('[aria-live="polite"]')).toBeNull();
    expect(el.textContent).toContain('Finalizado');
    expect(el.textContent).toContain('100 %');
  });

  it('la monitora cambia el orden y el conductor lo ve con un aviso', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const auth = TestBed.inject(AuthService);
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    const [primero, segundo] = r.paradas;

    // Conductor con el recorrido abierto: no puede ordenar.
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/ruta-del-dia/recorrido/${r.id}`, RecorridoPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector(`[aria-label="Arrastrar a ${primero.estudiante}"]`)).toBeNull();

    // La monitora (en su celular) baja al primero; el conductor recibe el cambio.
    const sesionConductor = auth.sesion();
    auth.abrirSesion({ usuario: 'ycharry', nombre: 'Yolanda Charry', correo: '', rol: 'MONITORA', empleadoId: 'emp-6', imagen: '', inicio: '' });
    await firstValueFrom(repo.reordenar(r.id, [segundo.estudianteId, primero.estudianteId]));
    if (sesionConductor) auth.abrirSesion(sesionConductor);
    window.dispatchEvent(new StorageEvent('storage', { key: 'rutarola.recorridos' }));
    await estabilizar(harness.fixture, 4);

    const aviso = el.querySelector('[role="alert"]')?.textContent ?? '';
    expect(aviso).toContain('Yolanda Charry cambió el orden');
    expect(aviso).toContain(`Ahora sigue: ${segundo.estudiante}`);
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(segundo.estudiante);
    pantalla(el).boton('Entendido').click();
    await estabilizar(harness.fixture, 2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('la monitora ve la manija de arrastre y puede subir o bajar estudiantes', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    const [primero, segundo] = r.paradas;
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'ycharry', nombre: 'Yolanda Charry', correo: '', rol: 'MONITORA', empleadoId: 'emp-6', imagen: '', inicio: '',
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/ruta-del-dia/recorrido/${r.id}`, RecorridoPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector(`[aria-label="Arrastrar a ${primero.estudiante}"]`)).not.toBeNull();
    expect(el.textContent).toContain('Mantén presionado a un estudiante');

    (el.querySelector(`[aria-label="Bajar a ${primero.estudiante}"]`) as HTMLButtonElement).click();
    await estabilizar(harness.fixture, 4);
    const orden = Array.from(el.querySelectorAll('[data-por-visitar]')).map((x) => x.getAttribute('data-por-visitar'));
    expect(orden).toEqual([segundo.estudianteId, primero.estudianteId]);
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(segundo.estudiante);
    expect(el.textContent).toContain('Orden ajustado por Yolanda Charry');
  });

  it('la monitora arrastra un estudiante hasta el final aunque la fila cambie de lugar durante el gesto', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    const [primero, ...resto] = r.paradas;
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'ycharry', nombre: 'Yolanda Charry', correo: '', rol: 'MONITORA', empleadoId: 'emp-6', imagen: '', inicio: '',
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/ruta-del-dia/recorrido/${r.id}`, RecorridoPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;

    const manija = el.querySelector(`[aria-label="Arrastrar a ${primero.estudiante}"]`) as HTMLElement;
    manija.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientY: 0, isPrimary: true }));
    await estabilizar(harness.fixture);
    // jsdom no tiene diseño: con el dedo abajo, todas las demás filas quedan "por encima".
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientY: 100, isPrimary: true }));
    await estabilizar(harness.fixture);
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientY: 120, isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true }));
    await estabilizar(harness.fixture, 4);

    const orden = Array.from(el.querySelectorAll('[data-por-visitar]')).map((x) => x.getAttribute('data-por-visitar'));
    expect(orden).toEqual([...resto.map((p) => p.estudianteId), primero.estudianteId]);
    const guardado = await firstValueFrom(repo.obtener(r.id));
    expect(guardado.paradas.at(-1)?.estudianteId).toBe(primero.estudianteId);
  });

  it('la lista se actualiza cuando el compañero inicia y al tocar Iniciar se une a su recorrido', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const auth = TestBed.inject(AuthService);
    auth.abrirSesion({ usuario: 'ycharry', nombre: 'Yuli Andrea Charry Ortiz', correo: '', rol: 'MONITORA', empleadoId: 'emp-6', imagen: '', inicio: '' });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-del-dia', RutaDelDiaPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    const iniciar = pantalla(el).boton('Iniciar recogida');

    // El conductor inicia en su celular; la monitora tiene la lista desactualizada abierta.
    const monitora = auth.sesion();
    auth.abrirSesion({ usuario: 'jcardenas', nombre: 'José', correo: '', rol: 'CONDUCTOR', empleadoId: 'emp-1', imagen: '', inicio: '' });
    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    const r = await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    if (monitora) auth.abrirSesion(monitora);

    // Tocar "Iniciar" en la lista vieja la lleva al MISMO recorrido, sin error.
    iniciar.click();
    await estabilizar(harness.fixture, 4);
    expect(TestBed.inject(Router).url).toBe(`/ruta-del-dia/recorrido/${r.id}`);
    expect(document.body.textContent).not.toContain('ya fue registrada');
  });

  it('la lista muestra "Continuar" en cuanto el compañero inicia', async () => {
    const repo = TestBed.inject(RecorridosRepositorio);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-del-dia', RutaDelDiaPage);
    await estabilizar(harness.fixture, 4);
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Continuar');

    const [ruta] = await firstValueFrom(repo.rutasDelDia(fechaIso()));
    await firstValueFrom(repo.iniciar(ruta.asignacionId, 'RECOGIDA'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'rutarola.recorridos' }));
    await estabilizar(harness.fixture, 4);
    expect(el.textContent).toContain('Continuar');
  });
});
