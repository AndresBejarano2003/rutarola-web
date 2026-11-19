import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App instalable de RutaRola (Android primero). Empaqueta la misma interfaz de `npm run build`; el login decide a qué
 * parte entra cada rol. `appId` es permanente en Google Play: no cambiarlo después de publicar.
 */
const config: CapacitorConfig = {
  appId: 'co.rutarola.app',
  appName: 'RutaRola',
  webDir: 'dist/RutaRolaApp/browser',
  backgroundColor: '#111827',
  server: {
    // La app se identifica como el sitio web (origen https://app.rutarola.com): el API ya lo permite en CORS, la
    // sesión y los datos guardados quedan bajo ese dominio y los enlaces "en otra pestaña" a app.rutarola.com abren el
    // sitio real en el navegador. La interfaz sigue saliendo de dentro de la app, no de internet.
    hostname: 'app.rutarola.com',
    androidScheme: 'https',
  },
  android: {
    // Sin esto Android detiene la ubicación tras 5 min en segundo plano (plugin background-geolocation, issue #89).
    useLegacyBridge: true,
  },
};

export default config;
