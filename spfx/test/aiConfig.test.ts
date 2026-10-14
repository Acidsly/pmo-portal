import { aiRedirectUri } from '../src/webparts/pmoPortal/ai/aiConfig';

// Адрес возврата входа MSAL — всегда страница портала, как бы ни открыли сайт (в регистрации SPA — только она)
describe('адрес возврата входа', () => {
  const o = 'https://smarthrua.sharepoint.com', p = o + '/sites/pmo-test/SitePages/Portal.aspx';
  test.each([
    ['/sites/pmo-test', p],
    ['/sites/pmo-test/', p],
    ['/sites/pmo-test/SitePages/Portal.aspx', p],
    ['/sites/pmo-test/SitePages/portal.aspx', p],
    ['/sites/pmo-test/SitePages/Home.aspx', p],
    ['/sites/ppm', o + '/sites/ppm/SitePages/Portal.aspx']
  ])('%s', (path, want) => expect(aiRedirectUri(o, path)).toBe(want));
});
