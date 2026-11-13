import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';
import { ErrorCrud } from 'src/app/shared/crud/crud';
import { FuenteLocal } from 'src/app/shared/crud/repositorio-local';
import { TIPOS_DOCUMENTO_VEHICULO, TipoDocumentoVehiculo, Vehiculo } from '../vehiculo';
import { VehiculosRepositorio } from '../vehiculos-repositorio';
import { DocumentoVehiculo, SolicitudDocumentoVehiculo } from './documento-vehiculo';
import { DocumentosVehiculoRepositorio } from './documentos-vehiculo-repositorio';

const CLAVE = 'rutarola.vehiculos.documentos';

/**
 * TEMPORAL (`localStorage`, archivos como data URL ≤ 2 MB). Igual que el API: si el vehículo tiene un vencimiento
 * más reciente que su historial (se cambió en el formulario), ese vencimiento entra al historial; cada escritura deja
 * el vencimiento del vehículo con el registro más reciente del tipo.
 */
@Injectable()
export class DocumentosVehiculoLocal extends DocumentosVehiculoRepositorio implements FuenteLocal {
  readonly modoLocal = true as const;
  private readonly vehiculos = inject(VehiculosRepositorio);

  listar(vehiculoId: string): Observable<DocumentoVehiculo[]> {
    return defer(() =>
      from(
        (async () => {
          const vehiculo = await firstValueFrom(this.vehiculos.obtener(vehiculoId));
          this.registrarDesdeVehiculo(vehiculo);
          return this.delVehiculo(vehiculoId).map((d) => ({ ...d, archivo: d.archivo ? { ...d.archivo, url: '' } : null }));
        })(),
      ),
    );
  }

  obtener(vehiculoId: string, id: string): Observable<DocumentoVehiculo> {
    return defer(() => {
      const d = this.delVehiculo(vehiculoId).find((x) => x.id === id);
      if (!d) throw new ErrorCrud('El documento no existe.', 'NO_ENCONTRADO');
      return [d];
    });
  }

  crear(vehiculoId: string, s: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo> {
    return this.guardar(vehiculoId, null, s);
  }

  actualizar(vehiculoId: string, id: string, s: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo> {
    return this.guardar(vehiculoId, id, s);
  }

  eliminar(vehiculoId: string, id: string): Observable<void> {
    return defer(() =>
      from(
        (async () => {
          const todos = this.leer();
          const actual = todos.find((d) => d.id === id && d.vehiculoId === vehiculoId);
          if (!actual) throw new ErrorCrud('El documento no existe.', 'NO_ENCONTRADO');
          this.escribir(todos.filter((d) => d.id !== id));
          await this.sincronizar(vehiculoId, [actual.tipo]);
        })(),
      ),
    );
  }

  private guardar(vehiculoId: string, id: string | null, s: SolicitudDocumentoVehiculo): Observable<DocumentoVehiculo> {
    return defer(() =>
      from(
        (async () => {
          await firstValueFrom(this.vehiculos.obtener(vehiculoId));
          this.validar(s);
          const todos = this.leer();
          const actual = id ? todos.find((d) => d.id === id && d.vehiculoId === vehiculoId) : undefined;
          if (id && !actual) throw new ErrorCrud('El documento no existe.', 'NO_ENCONTRADO');
          // Archivo: data URL = nuevo; otra url (o vacía de la lista) = se conserva; null = se quita.
          const archivo = s.archivo === null ? null : s.archivo.url.startsWith('data:') ? s.archivo : (actual?.archivo ?? null);
          const registro: DocumentoVehiculo = {
            id: actual?.id ?? crypto.randomUUID(),
            vehiculoId,
            tipo: s.tipo,
            numero: s.numero.trim(),
            entidad: s.entidad.trim(),
            fechaExpedicion: s.fechaExpedicion,
            fechaVencimiento: s.fechaVencimiento,
            observaciones: s.observaciones.trim(),
            archivo,
            vigente: false,
            fechaCreacion: actual?.fechaCreacion ?? new Date().toISOString(),
          };
          this.escribir(actual ? todos.map((d) => (d.id === registro.id ? registro : d)) : [...todos, registro]);
          await this.sincronizar(vehiculoId, actual && actual.tipo !== s.tipo ? [s.tipo, actual.tipo] : [s.tipo]);
          return this.delVehiculo(vehiculoId).find((d) => d.id === registro.id) ?? registro;
        })(),
      ),
    );
  }

  private validar(s: SolicitudDocumentoVehiculo): void {
    if (!TIPOS_DOCUMENTO_VEHICULO.some((t) => t.id === s.tipo)) throw new ErrorCrud('Elige el tipo de documento.', 'VALIDACION');
    if (!s.fechaVencimiento) throw new ErrorCrud('Ingresa la fecha de vencimiento.', 'VALIDACION');
    if (s.fechaExpedicion && s.fechaVencimiento < s.fechaExpedicion) {
      throw new ErrorCrud('El vencimiento debe ser posterior a la expedición.', 'VALIDACION');
    }
    if (s.archivo && s.archivo.tamano > 2 * 1024 * 1024) throw new ErrorCrud('El archivo supera 2 MB.', 'VALIDACION');
  }

  /** Vencimientos del vehículo más recientes que su historial entran al historial (como el API al guardar el vehículo). */
  private registrarDesdeVehiculo(v: Vehiculo): void {
    const todos = this.leer();
    const nuevos: DocumentoVehiculo[] = [];
    for (const t of TIPOS_DOCUMENTO_VEHICULO) {
      const fecha = t.campo ? v[t.campo] : '';
      if (!fecha) continue;
      const delTipo = todos.filter((d) => d.vehiculoId === v.id && d.tipo === t.id);
      if (delTipo.some((d) => d.fechaVencimiento >= fecha)) continue;
      nuevos.push({
        id: crypto.randomUUID(),
        vehiculoId: v.id,
        tipo: t.id,
        numero: '',
        entidad: '',
        fechaExpedicion: '',
        fechaVencimiento: fecha,
        observaciones: 'Registrado desde la ficha del vehículo.',
        archivo: null,
        vigente: false,
        fechaCreacion: new Date().toISOString(),
      });
    }
    if (nuevos.length) this.escribir([...todos, ...nuevos]);
  }

  /** El vencimiento del vehículo para cada tipo = el registro más reciente (si queda alguno). */
  private async sincronizar(vehiculoId: string, tipos: TipoDocumentoVehiculo[]): Promise<void> {
    const v = await firstValueFrom(this.vehiculos.obtener(vehiculoId));
    const cambios: Partial<Vehiculo> = {};
    for (const tipo of tipos) {
      const campo = TIPOS_DOCUMENTO_VEHICULO.find((t) => t.id === tipo)?.campo;
      const ultimo = this.delVehiculo(vehiculoId).find((d) => d.tipo === tipo);
      if (campo && ultimo && v[campo] !== ultimo.fechaVencimiento) cambios[campo] = ultimo.fechaVencimiento;
    }
    if (!Object.keys(cambios).length) return;
    const { id: _id, fechaCreacion: _c, fechaActualizacion: _a, ...datos } = { ...v, ...cambios };
    await firstValueFrom(this.vehiculos.actualizar(vehiculoId, datos));
  }

  private delVehiculo(vehiculoId: string): DocumentoVehiculo[] {
    const lista = this.leer()
      .filter((d) => d.vehiculoId === vehiculoId)
      .sort((a, b) => b.fechaVencimiento.localeCompare(a.fechaVencimiento) || b.fechaCreacion.localeCompare(a.fechaCreacion));
    const vigentes = new Set<string>();
    const vistos = new Set<TipoDocumentoVehiculo>();
    for (const d of lista) {
      if (d.tipo === 'OTRO' || vistos.has(d.tipo)) continue;
      vistos.add(d.tipo);
      vigentes.add(d.id);
    }
    return lista.map((d) => ({ ...d, vigente: vigentes.has(d.id) }));
  }

  private leer(): DocumentoVehiculo[] {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as DocumentoVehiculo[];
    } catch {
      return [];
    }
  }

  private escribir(lista: DocumentoVehiculo[]): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      throw new ErrorCrud('No hay espacio en el almacenamiento temporal del navegador.', 'SIN_ESPACIO');
    }
  }
}
