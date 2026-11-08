import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { Empresa } from 'src/app/inicio/configuracion/configuracion';
import { ErrorCrud, Pagina, Paginacion } from 'src/app/shared/crud/crud';
import { FuenteLocal, LATENCIA_LOCAL, responderLocal } from 'src/app/shared/crud/repositorio-local';
import { normalizar } from 'src/app/shared/formularios/formularios';
import { AdministradorEmpresa, FiltrosEmpresa, SolicitudAdministrador, SolicitudEmpresa } from './empresa';
import { EmpresasRepositorio } from './empresas-repositorio';

const CLAVE = 'rutarola.empresas';
/** `{empresaId: AdministradorEmpresa[]}`; las contraseñas no se guardan en modo local. */
const CLAVE_ADMINISTRADORES = 'rutarola.empresas.administradores';
const SEMILLA: Empresa[] = [
  {
    id: 'empresa-local',
    nombre: 'RutaRola Demo',
    nit: '900000001-1',
    direccion: '',
    ciudad: 'Bogotá',
    telefono: '',
    email: 'admin@rutarola.com',
    logoUrl: '',
    estado: 'ACTIVO',
    fechaCreacion: '2026-01-01T00:00:00Z',
  },
];

/** TEMPORAL (pruebas y modo local; el super administrador solo existe con el API). NIT único. */
@Injectable()
export class EmpresasLocal extends EmpresasRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly latenciaMs = inject(LATENCIA_LOCAL);

  listar(f: FiltrosEmpresa, { pagina, tamano }: Paginacion): Observable<Pagina<Empresa>> {
    return defer(() =>
      responderLocal(() => {
        const texto = normalizar(f.texto);
        const todas = this.leer()
          .filter((e) => (!texto || normalizar(e.nombre).includes(texto) || e.nit.includes(texto)) && (!f.estado || e.estado === f.estado))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        return { items: todas.slice((pagina - 1) * tamano, pagina * tamano), total: todas.length, pagina, tamano };
      }, this.latenciaMs),
    );
  }

  crear(s: SolicitudEmpresa): Observable<Empresa> {
    return responderLocal(() => {
      const todas = this.leer();
      this.validar(s, null, todas);
      const { administrador: _, ...datos } = s;
      const nueva: Empresa = { ...datos, id: crypto.randomUUID(), fechaCreacion: new Date().toISOString() };
      const admin = s.administrador
        ? { ...this.datosAdministrador({ ...s.administrador, telefono: '', estado: 'ACTIVO' }, null), id: crypto.randomUUID(), ultimoLogin: null, fechaCreacion: nueva.fechaCreacion }
        : null;
      this.escribir([...todas, nueva]);
      if (admin) this.escribirAdministradores({ ...this.leerAdministradores(), [nueva.id]: [admin] });
      return nueva;
    }, this.latenciaMs);
  }

  actualizar(id: string, s: SolicitudEmpresa): Observable<Empresa> {
    return responderLocal(() => {
      const todas = this.leer();
      const actual = todas.find((e) => e.id === id);
      if (!actual) throw new ErrorCrud('La empresa no existe.', 'NO_ENCONTRADO');
      this.validar(s, id, todas);
      const { administrador: _, ...datos } = s;
      const editada = { ...actual, ...datos };
      this.escribir(todas.map((e) => (e.id === id ? editada : e)));
      return editada;
    }, this.latenciaMs);
  }

  administradores(empresaId: string): Observable<AdministradorEmpresa[]> {
    return defer(() =>
      responderLocal(() => {
        this.empresa(empresaId);
        return [...(this.leerAdministradores()[empresaId] ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
      }, this.latenciaMs),
    );
  }

  crearAdministrador(empresaId: string, s: SolicitudAdministrador): Observable<AdministradorEmpresa> {
    return responderLocal(() => {
      if (!s.contrasena) throw new ErrorCrud('Ingresa la contraseña.', 'VALIDACION');
      this.empresa(empresaId);
      const nuevo: AdministradorEmpresa = { ...this.datosAdministrador(s, null), id: crypto.randomUUID(), ultimoLogin: null, fechaCreacion: new Date().toISOString() };
      const todos = this.leerAdministradores();
      this.escribirAdministradores({ ...todos, [empresaId]: [...(todos[empresaId] ?? []), nuevo] });
      return nuevo;
    }, this.latenciaMs);
  }

  actualizarAdministrador(empresaId: string, id: string, s: SolicitudAdministrador): Observable<AdministradorEmpresa> {
    return responderLocal(() => {
      const todos = this.leerAdministradores();
      const actual = this.administrador(todos, empresaId, id);
      const editado = { ...actual, ...this.datosAdministrador(s, id) };
      this.escribirAdministradores({ ...todos, [empresaId]: (todos[empresaId] ?? []).map((a) => (a.id === id ? editado : a)) });
      return editado;
    }, this.latenciaMs);
  }

  cambiarContrasenaAdministrador(empresaId: string, id: string, nueva: string): Observable<void> {
    return responderLocal(() => {
      this.administrador(this.leerAdministradores(), empresaId, id);
      if (nueva.length < 6) throw new ErrorCrud('La contraseña debe tener al menos 6 caracteres.', 'VALIDACION');
    }, this.latenciaMs);
  }

  private datosAdministrador(s: SolicitudAdministrador, id: string | null): Omit<AdministradorEmpresa, 'id' | 'ultimoLogin' | 'fechaCreacion'> {
    const usuario = s.usuario.trim().toLowerCase();
    if (Object.values(this.leerAdministradores()).flat().some((a) => a.id !== id && a.usuario === usuario)) {
      throw new ErrorCrud(`El usuario "${usuario}" ya está en uso. Elige otro.`, 'DUPLICADO');
    }
    return { nombre: s.nombre.trim(), usuario, email: s.email.trim().toLowerCase(), telefono: s.telefono.trim(), estado: s.estado };
  }

  private empresa(id: string): Empresa {
    const empresa = this.leer().find((e) => e.id === id);
    if (!empresa) throw new ErrorCrud('La empresa no existe.', 'NO_ENCONTRADO');
    return empresa;
  }

  private administrador(todos: Record<string, AdministradorEmpresa[]>, empresaId: string, id: string): AdministradorEmpresa {
    const admin = (todos[empresaId] ?? []).find((a) => a.id === id);
    if (!admin) throw new ErrorCrud('El administrador no existe.', 'NO_ENCONTRADO');
    return admin;
  }

  private leerAdministradores(): Record<string, AdministradorEmpresa[]> {
    try {
      return (JSON.parse(localStorage.getItem(CLAVE_ADMINISTRADORES) ?? 'null') as Record<string, AdministradorEmpresa[]> | null) ?? {};
    } catch {
      return {};
    }
  }

  private escribirAdministradores(valor: Record<string, AdministradorEmpresa[]>): void {
    try {
      localStorage.setItem(CLAVE_ADMINISTRADORES, JSON.stringify(valor));
    } catch {
      throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
    }
  }

  private validar(s: SolicitudEmpresa, id: string | null, todas: Empresa[]): void {
    if (todas.some((e) => e.id !== id && e.nit === s.nit.trim())) {
      throw new ErrorCrud(`Ya existe una empresa con el NIT ${s.nit}.`, 'DUPLICADO');
    }
  }

  private leer(): Empresa[] {
    try {
      return (JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Empresa[] | null) ?? SEMILLA;
    } catch {
      return SEMILLA;
    }
  }

  private escribir(empresas: Empresa[]): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(empresas));
    } catch {
      throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
    }
  }
}
