// #34: свой значок вкладки браузера — «PPM» в цветах логотипа приложения (тот же — в прототипе)
export const FAVICON_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0a84ff'/><stop offset='1' stop-color='#5e5ce6'/></linearGradient></defs><rect width='64' height='64' rx='16' fill='url(#g)'/><text x='32' y='41' text-anchor='middle' font-family='Segoe UI,Helvetica,Arial,sans-serif' font-size='24' font-weight='700' fill='#fff' letter-spacing='-1'>PPM</text></svg>";
export const faviconHref = (): string => 'data:image/svg+xml,' + encodeURIComponent(FAVICON_SVG);
/** Ставит значок вкладки: заменяет значки SharePoint (rel icon / shortcut icon) одним своим. */
export function setFavicon(doc: Document): void {
  Array.prototype.slice.call(doc.querySelectorAll('link[rel~="icon"]')).forEach((l: Element) => l.parentNode && l.parentNode.removeChild(l));
  const link = doc.createElement('link'); link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = faviconHref();
  doc.head.appendChild(link);
}
