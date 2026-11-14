export const environment = {
  production: true,
  nombreEmpresa: "RutaRola",
  /**
   * URL del API desplegado (`render.yaml` del repo rutarola-api → servicio `rutarola-api`). Se llama
   * directo y no por un proxy de Netlify porque el hub SignalR necesita WebSocket; el API permite este
   * origen en `Cors__Origenes`. Si Render asigna otro nombre al servicio, cambiarlo aquí.
   */
  apiUrl: "https://api.rutarola.com/api/v1",
  usarApi: true,
};
