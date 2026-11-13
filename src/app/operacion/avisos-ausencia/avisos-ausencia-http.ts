import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AvisoAusencia } from 'src/app/ruta-del-dia/avisos-ausencia';
import { AvisosAusenciaRepositorio, FiltrosAvisoAusencia } from './avisos-ausencia-repositorio';

/** `GET {apiUrl}/avisos-ausencia?fecha=&rutaId=` → `AvisoAusencia[]` de la empresa (`recorridos.leer`; fecha vacía = hoy). */
@Injectable()
export class AvisosAusenciaHttp extends AvisosAusenciaRepositorio {
  private readonly http = inject(HttpClient);

  listar(f: FiltrosAvisoAusencia): Observable<AvisoAusencia[]> {
    let params = new HttpParams();
    if (f.fecha) params = params.set('fecha', f.fecha);
    if (f.rutaId) params = params.set('rutaId', f.rutaId);
    return this.http.get<AvisoAusencia[]>(`${environment.apiUrl}/avisos-ausencia`, { params });
  }
}
