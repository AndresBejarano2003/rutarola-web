# Manuales en PDF (Centro de Ayuda)

Fuente de los PDF que abre **Sistema › Centro de Ayuda › Documentación** (`public/documentacion/*.pdf`, listados en
`src/app/sistema/soporte/contenido-ayuda.ts`). Cada manual es un HTML en `manuales/` con estilos comunes
(`manuales/estilos.css`) y capturas reales de RutaRola en **modo local** (datos ficticios) en `capturas/`.

Regenerarlos después de cambiar pantallas o reglas:

```bash
npx ng serve --configuration local --port 4300          # terminal 1
node documentacion-fuente/herramientas/capturar.mjs     # terminal 2: todas las capturas (o un filtro: `... capturar.mjs finanzas`)
node documentacion-fuente/herramientas/generar-pdf.mjs  # HTML → public/documentacion/*.pdf (o un filtro)
```

Usa Google Chrome instalado (variable `CHROME` para otra ruta) por su protocolo de depuración, sin dependencias.
Al cambiar un módulo, actualiza también su manual (igual que las preguntas frecuentes de `contenido-ayuda.ts`).
