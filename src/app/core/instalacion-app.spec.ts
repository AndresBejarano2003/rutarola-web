import { formaInstalacion } from './instalacion-app';

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';

describe('Instalar RutaRola (PWA)', () => {
  it('usa el botón del navegador cuando lo ofrece', () => {
    expect(formaInstalacion(CHROME_WIN, 0, true)).toBe('NATIVO');
  });

  it('explica los pasos en iPhone, iPad (se presenta como Mac táctil) y Safari de Mac', () => {
    expect(formaInstalacion(IPHONE, 5, false)).toBe('IOS');
    expect(formaInstalacion(SAFARI_MAC, 5, false)).toBe('IOS');
    expect(formaInstalacion(SAFARI_MAC, 0, false)).toBe('SAFARI_MAC');
  });

  it('no ofrece nada si el navegador no permite instalar', () => {
    expect(formaInstalacion(FIREFOX, 0, false)).toBe('OTRO');
    expect(formaInstalacion(CHROME_MAC, 0, false)).toBe('OTRO');
  });
});
