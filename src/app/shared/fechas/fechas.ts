/** Utilidades de fechas en formato ISO local (`YYYY-MM-DD`) y periodos mensuales (`YYYY-MM`). */

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Fecha local `YYYY-MM-DD` (sin el desfase de `toISOString`, que usa UTC). */
export function fechaIso(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

/** Periodo `YYYY-MM` de una fecha. */
export function periodoDe(fecha = new Date()): string {
  return fechaIso(fecha).slice(0, 7);
}

/** Suma meses a un periodo `YYYY-MM`. */
export function sumarMeses(periodo: string, meses: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + meses, 1);
  return periodoDe(fecha);
}

/** Periodos de `desde` a `hasta`, ambos incluidos. */
export function periodosEntre(desde: string, hasta: string): string[] {
  const resultado: string[] = [];
  for (let p = desde; p && hasta && p <= hasta; p = sumarMeses(p, 1)) {
    resultado.push(p);
  }
  return resultado;
}

/** `2026-02` → `feb. 2026` (o `febrero de 2026` con `largo`). */
export function nombrePeriodo(periodo: string, largo = false): string {
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return periodo;
  }
  const [anio, mes] = periodo.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-CO', { month: largo ? 'long' : 'short', year: 'numeric' });
}

/** Fecha `YYYY-MM-DD` del día indicado en el periodo; si el mes es más corto, el último día. */
export function diaDelPeriodo(periodo: string, dia: number): string {
  const [anio, mes] = periodo.split('-').map(Number);
  const ultimo = new Date(anio, mes, 0).getDate();
  return `${periodo}-${dosDigitos(Math.min(dia, ultimo))}`;
}

/** Días entre dos fechas `YYYY-MM-DD` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** `2026-02-15` → `15 feb. 2026`. */
export function fechaCorta(fecha: string): string {
  if (!fecha) return '';
  return new Date(`${fecha.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

/** `06:30` → `6:30 a. m.` */
export function horaLegible(hora: string): string {
  if (!/^\d{2}:\d{2}$/.test(hora)) return hora;
  const [h, m] = hora.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** `YYYY-MM-DD` + `dias` (negativo para restar), en fecha local. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return fechaIso(new Date(a, m - 1, d + dias));
}
