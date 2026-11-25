import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { capturarInstalacion } from './app/core/instalacion-app';

// Aplicación web instalable (PWA): la oferta de instalar del navegador llega muy pronto, se guarda antes de arrancar.
capturarInstalacion();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Service worker solo en producción y en el navegador: la app de Android ya es una app instalada.
const enAppNativa = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
if (!isDevMode() && 'serviceWorker' in navigator && !enAppNativa) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('sw.js').catch(() => undefined));
}
