/** @jest-environment jsdom */
import { setFavicon, faviconHref, FAVICON_SVG } from '../src/webparts/pmoPortal/logic/favicon';

test('#34: значок вкладки — «PPM», значки SharePoint заменены одним своим', () => {
  document.head.innerHTML = '<link rel="shortcut icon" href="/_layouts/15/images/favicon.ico"><link rel="icon" href="x.png">';
  setFavicon(document);
  const icons = document.querySelectorAll('link[rel~="icon"]');
  expect(icons.length).toBe(1);
  expect((icons[0] as HTMLLinkElement).href).toBe(faviconHref());
  expect(decodeURIComponent(faviconHref())).toContain('>PPM</text>');
});
test('прототип показывает тот же значок', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
  const m = /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/.exec(src);
  expect(m).not.toBeNull();
  expect(decodeURIComponent(m![1])).toBe(FAVICON_SVG);
});
