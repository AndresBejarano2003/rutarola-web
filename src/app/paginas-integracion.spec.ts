import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { ConfiguracionRepositorio } from 'src/app/inicio/configuracion/configuracion-repositorio';
import { DIA_LIMITE_PAGO } from 'src/app/inicio/configuracion/configuracion';
import ConfiguracionPage from 'src/app/inicio/configuracion/configuracion-page';
import CuentaPage from 'src/app/autenticacion/cuenta/cuenta-page';
import { AutenticacionRepositorio } from 'src/app/autenticacion/autenticacion-repositorio';
import MensajesWhatsappPage from 'src/app/finanzas/mensajes-whatsapp/mensajes-whatsapp-page';
import MonitoreoPage from 'src/app/operacion/monitoreo/monitoreo-page';
import EmpresasPage from 'src/app/plataforma/empresas/empresas-page';
import { EmpresasRepositorio } from 'src/app/plataforma/empresas/empresas-repositorio';
import { FILTROS_EMPRESA_VACIOS } from 'src/app/plataforma/empresas/empresa';
import SoportePlataformaPage from 'src/app/plataforma/soporte/soporte-plataforma-page';
import { TicketsRepositorio } from 'src/app/sistema/soporte/tickets/tickets-repositorio';
import { NotificacionesService } from 'src/app/shared/notificaciones/notificaciones';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';

const escribirEn = (el: HTMLElement, selector: string, valor: string) => {
  const campo = el.querySelector(selector) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
};

describe('Pantallas de GPS, comunicación, configuración y plataforma', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    simularDialogos();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...repositoriosDePrueba()] });
  });

  it('Monitoreo en vivo sin recorridos en curso', async () => {
    const fixture = TestBed.createComponent(MonitoreoPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Monitoreo en vivo');
    expect(el.textContent).toContain('No hay recorridos en curso');
    fixture.destroy();
  });

  it('Mensajes de WhatsApp explica que en modo local no se envían', async () => {
    const fixture = TestBed.createComponent(MensajesWhatsappPage);
    await estabilizar(fixture, 4);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('En modo local no se envían mensajes');
  });

  it('Configuración guarda los datos de la empresa y un parámetro, y valida el rango', async () => {
    const fixture = TestBed.createComponent(ConfiguracionPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    expect((el.querySelector('input[formcontrolname="nombre"]') as HTMLInputElement).value).toBe('RutaRola Demo');

    escribirEn(el, `input[data-clave="${DIA_LIMITE_PAGO}"]`, '40');
    pantalla(el).boton('Guardar cambios').click();
    await estabilizar(fixture, 3);
    expect(el.textContent).toContain('El valor máximo es 31');

    escribirEn(el, `input[data-clave="${DIA_LIMITE_PAGO}"]`, '10');
    escribirEn(el, 'input[formcontrolname="ciudad"]', 'Neiva');
    pantalla(el).boton('Guardar cambios').click();
    await estabilizar(fixture, 4);
    const repo = TestBed.inject(ConfiguracionRepositorio);
    expect((await firstValueFrom(repo.empresa())).ciudad).toBe('Neiva');
    expect((await firstValueFrom(repo.parametros())).find((p) => p.clave === DIA_LIMITE_PAGO)?.valor).toBe('10');
  });

  it('Mi cuenta cambia la contraseña local de un empleado', async () => {
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'jcardenas', nombre: 'José Luis Cárdenas Rojas', correo: '', rol: 'CONDUCTOR', empleadoId: 'emp-1', imagen: '', inicio: new Date().toISOString(),
    });
    // Siembra los empleados (y sus credenciales locales).
    await firstValueFrom(TestBed.inject(AutenticacionRepositorio).iniciarSesion({ usuario: 'jcardenas', contrasena: 'rutarola' }));

    const fixture = TestBed.createComponent(CuentaPage);
    await estabilizar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('jcardenas');
    escribirEn(el, 'input[formcontrolname="actual"]', 'equivocada');
    escribirEn(el, 'input[formcontrolname="contrasena"]', 'nueva-123');
    escribirEn(el, 'input[formcontrolname="confirmarContrasena"]', 'otra');
    pantalla(el).boton('Cambiar contraseña').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Las contraseñas no coinciden');

    escribirEn(el, 'input[formcontrolname="actual"]', 'rutarola');
    escribirEn(el, 'input[formcontrolname="confirmarContrasena"]', 'nueva-123');
    pantalla(el).boton('Cambiar contraseña').click();
    await estabilizar(fixture, 3);
    const auth = TestBed.inject(AutenticacionRepositorio);
    await expect(firstValueFrom(auth.iniciarSesion({ usuario: 'jcardenas', contrasena: 'rutarola' }))).rejects.toThrow();
    expect((await firstValueFrom(auth.iniciarSesion({ usuario: 'jcardenas', contrasena: 'nueva-123' }))).rol).toBe('CONDUCTOR');
  });

  it('Plataforma › Empresas registra una empresa con NIT único', async () => {
    const fixture = TestBed.createComponent(EmpresasPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    const ui = pantalla(el);
    expect(el.textContent).toContain('RutaRola Demo');

    ui.boton('Nueva empresa').click();
    await estabilizar(fixture);
    ui.escribir('nombre', 'Transportes del Huila');
    ui.escribir('nit', '900000001-1');
    (el.querySelector('input[formcontrolname="conAdministrador"]') as HTMLInputElement).click();
    await estabilizar(fixture);
    ui.boton('Registrar empresa').click();
    await estabilizar(fixture, 3);
    expect(TestBed.inject(NotificacionesService).lista().at(-1)?.mensaje).toContain('Ya existe una empresa con el NIT');

    ui.escribir('nit', '901234567-8');
    ui.boton('Registrar empresa').click();
    await estabilizar(fixture, 4);
    const { items } = await firstValueFrom(TestBed.inject(EmpresasRepositorio).listar(FILTROS_EMPRESA_VACIOS, { pagina: 1, tamano: 10 }));
    expect(items.map((e) => e.nombre)).toEqual(['RutaRola Demo', 'Transportes del Huila']);
    expect(ui.filas('table').length).toBe(2);
  });

  it('Plataforma › Empresas muestra los administradores y les restablece la contraseña', async () => {
    const repo = TestBed.inject(EmpresasRepositorio);
    const empresa = await firstValueFrom(
      repo.crear({ nombre: 'Rutas del Sur', nit: '901111111-1', direccion: '', ciudad: '', telefono: '', email: '', logoUrl: '', estado: 'ACTIVO',
        administrador: { nombre: 'Laura Gómez', usuario: 'lgomez', email: '', contrasena: 'Clave-123' } }),
    );
    const fixture = TestBed.createComponent(EmpresasPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    const ui = pantalla(el);
    ([...el.querySelectorAll('tbody tr')].find((f) => f.textContent?.includes('Rutas del Sur')) as HTMLElement).click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('Laura Gómez');
    expect(el.textContent).toContain('Aún no ha ingresado');

    ui.boton('Cambiar contraseña').click();
    await estabilizar(fixture);
    ui.boton('Guardar contraseña').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Este campo es obligatorio');
    ui.boton('Generar una').click();
    await estabilizar(fixture);
    const campo = el.querySelector('app-administradores-empresa input[formcontrolname="contrasena"]') as HTMLInputElement;
    expect(campo.value).toHaveLength(12);
    expect(campo.type).toBe('text');
    ui.boton('Guardar contraseña').click();
    await estabilizar(fixture, 4);
    expect(TestBed.inject(NotificacionesService).lista().at(-1)?.mensaje).toContain('Contraseña de Laura Gómez actualizada');
    expect((await firstValueFrom(repo.administradores(empresa.id))).map((a) => a.usuario)).toEqual(['lgomez']);
  });

  it('Plataforma › Soporte avanza un ticket por sus etapas y pide comentario al devolverlo', async () => {
    const repo = TestBed.inject(TicketsRepositorio);
    const ticket = await firstValueFrom(
      repo.crear({ tipo: 'ERROR', modulo: 'Finanzas', prioridad: 'ALTA', asunto: 'Factura en blanco', descripcion: 'La factura no muestra los valores del mes.', adjuntos: [] }),
    );
    const fixture = TestBed.createComponent(SoportePlataformaPage);
    await estabilizar(fixture, 4);
    const el = fixture.nativeElement as HTMLElement;
    const ui = pantalla(el);
    expect(el.textContent).toContain('Factura en blanco');
    expect(el.textContent).toContain('Sin asignar');

    ([...el.querySelectorAll('tbody tr')].find((f) => f.textContent?.includes('Factura en blanco')) as HTMLElement).click();
    await estabilizar(fixture, 4);
    expect(el.textContent).not.toContain('Marcar resuelto');
    ui.boton('Tomar y revisar').click();
    await estabilizar(fixture, 4);
    expect((await firstValueFrom(repo.detallePlataforma(ticket.id))).estado).toBe('EN_REVISION');

    // Rechazar exige explicar el motivo.
    (el.querySelector('input[type="radio"][value="RECHAZADO"]') as HTMLInputElement).click();
    await estabilizar(fixture);
    ui.boton('Rechazar').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Este campo es obligatorio');

    // Nota interna: no la ve la empresa.
    ui.boton('Responder').click();
    await estabilizar(fixture);
    (el.querySelector('#form-respuesta-ticket textarea') as HTMLTextAreaElement).value = 'Revisar el cálculo del mes';
    el.querySelector('#form-respuesta-ticket textarea')!.dispatchEvent(new Event('input'));
    (el.querySelector('#form-respuesta-ticket input[type="checkbox"]') as HTMLInputElement).click();
    ui.boton('Enviar').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('Nota interna (la empresa no la ve)');
    expect((await firstValueFrom(repo.obtener(ticket.id))).eventos.some((e) => e.interno)).toBe(false);
  });
});
