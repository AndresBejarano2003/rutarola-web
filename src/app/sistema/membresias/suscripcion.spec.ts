import { PLANES, Suscripcion, nivelUso, puedeIniciarPrueba, recordatorioGratis } from './suscripcion';

function gratis(cambios: Partial<Suscripcion> = {}): Suscripcion {
  const plan = PLANES[0];
  return {
    plan: 'GRATIS',
    nombrePlan: plan.nombre,
    estado: 'GRATIS',
    periodo: '',
    fechaInicio: '2026-11-01T00:00:00Z',
    fechaFin: null,
    diasRestantes: null,
    pruebaUsada: false,
    limites: plan.limites,
    uso: { vehiculos: 0, estudiantes: 5 },
    funciones: plan.funciones,
    pagosEnLinea: false,
    nota: '',
    pendienteDecision: false,
    planVencido: '',
    fechaVencimiento: null,
    diasPrueba: 0,
    ...cambios,
  };
}

describe('Recordatorios del plan Gratis', () => {
  it('nivel de uso: cerca desde el 80 % y lleno al 100 %', () => {
    expect(nivelUso(15, 20)).toBe('NORMAL');
    expect(nivelUso(16, 20)).toBe('CERCA');
    expect(nivelUso(1, 1)).toBe('LLENO');
    expect(nivelUso(500, null)).toBe('NORMAL');
  });

  it('el límite alcanzado se avisa antes que el recordatorio general', () => {
    expect(recordatorioGratis(gratis())).toMatchObject({ nivel: 'NORMAL' });
    expect(recordatorioGratis(gratis())!.texto).toContain('prueba el plan Profesional');
    expect(recordatorioGratis(gratis({ pruebaUsada: true }))!.texto).not.toContain('prueba el plan Profesional');
    expect(recordatorioGratis(gratis({ uso: { vehiculos: 0, estudiantes: 17 } }))).toMatchObject({ nivel: 'CERCA' });
    const lleno = recordatorioGratis(gratis({ uso: { vehiculos: 1, estudiantes: 17 } }))!;
    expect(lleno.nivel).toBe('LLENO');
    expect(lleno.texto).toContain('1 de 1 vehículo');
  });

  it('no aplica fuera de Gratis ni con la decisión pendiente; la prueba solo si no la ha usado', () => {
    expect(recordatorioGratis(gratis({ estado: 'PRUEBA' }))).toBeNull();
    expect(recordatorioGratis(gratis({ pendienteDecision: true }))).toBeNull();
    expect(puedeIniciarPrueba(gratis())).toBe(true);
    expect(puedeIniciarPrueba(gratis({ pruebaUsada: true }))).toBe(false);
    expect(puedeIniciarPrueba(gratis({ estado: 'ACTIVA' }))).toBe(false);
  });
});
