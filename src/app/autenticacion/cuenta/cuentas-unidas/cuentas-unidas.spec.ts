import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/core/auth';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { estabilizar, pantalla, repositoriosDePrueba, simularDialogos } from 'src/app/shared/pruebas/pruebas';
import { AutenticacionRepositorio, CuentaUnida } from '../../autenticacion-repositorio';
import { CuentasUnidas } from './cuentas-unidas';
import { CuentasUnidasEstado } from './cuentas-unidas-estado';

const propia: CuentaUnida = {
  idUsuario: 'u-a', usuario: 'ycharry', nombre: 'Yolanda Charry', idEmpresa: 'e-a', empresa: 'Transportes Andes', actual: true,
  disponible: true, motivo: '', estudiantes: ['Sara Gómez'],
};
const otra: CuentaUnida = {
  idUsuario: 'u-b', usuario: 'ycharry.b', nombre: 'Yolanda Charry', idEmpresa: 'e-b', empresa: 'Rutas del Norte', actual: false,
  disponible: true, motivo: '', estudiantes: ['Tomás Gómez'],
};

/** Simula el API: solo une con la contraseña correcta. */
class AutenticacionFalsa {
  cuentas: CuentaUnida[] = [propia];
  cuentasUnidas = (): Observable<CuentaUnida[]> => of(this.cuentas);
  unirCuenta = (usuario: string, contrasena: string): Observable<CuentaUnida[]> => {
    if (usuario !== 'ycharry.b' || contrasena !== 'Clave-123') {
      return throwError(() => new ErrorCrud('Usuario o contraseña de la otra cuenta incorrectos.', 'VALIDACION'));
    }
    this.cuentas = [propia, otra];
    return of(this.cuentas);
  };
  separarCuenta = (id: string): Observable<CuentaUnida[]> => {
    this.cuentas = this.cuentas.filter((c) => c.idUsuario !== id).length === 1 ? [propia] : this.cuentas;
    return of(this.cuentas);
  };
}

function escribir(el: HTMLElement, control: string, valor: string): void {
  const campo = el.querySelector(`input[formcontrolname="${control}"]`) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('Mi cuenta › Mis empresas de transporte', () => {
  beforeEach(() => {
    simularDialogos();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...repositoriosDePrueba(), CuentasUnidasEstado, { provide: AutenticacionRepositorio, useClass: AutenticacionFalsa }],
    });
    TestBed.inject(AuthService).abrirSesion({
      usuario: 'ycharry', nombre: 'Yolanda Charry', correo: '', rol: 'ACUDIENTE', empleadoId: null, acudienteId: 'acu-1', imagen: '', inicio: new Date().toISOString(),
    });
  });

  it('une la cuenta de otra empresa con su usuario y contraseña y luego la separa', async () => {
    const fixture = TestBed.createComponent(CuentasUnidas);
    await estabilizar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const p = pantalla(el);
    expect(el.textContent).toContain('Transportes Andes');
    expect(el.textContent).not.toContain('Entrar');

    p.boton('Unir otra cuenta').click();
    await estabilizar(fixture);
    p.boton('Unir cuenta').click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('Este campo es obligatorio');

    escribir(el, 'usuario', 'ycharry.b');
    escribir(el, 'contrasena', 'equivocada');
    p.boton('Unir cuenta').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).not.toContain('Rutas del Norte');

    escribir(el, 'contrasena', 'Clave-123');
    p.boton('Unir cuenta').click();
    await estabilizar(fixture, 4);
    expect(el.textContent).toContain('Rutas del Norte');
    expect(el.textContent).toContain('Tomás Gómez');
    expect(p.boton('Entrar')).toBeTruthy();

    (el.querySelector('[aria-label="Separar la cuenta de Rutas del Norte"]') as HTMLButtonElement).click();
    await estabilizar(fixture);
    expect(el.textContent).toContain('dejará de estar unida');
    (el.querySelector('app-dialogo-confirmacion .btn-error') as HTMLButtonElement).click();
    await estabilizar(fixture, 4);
    expect(el.textContent).not.toContain('Rutas del Norte');
  });
});
