import * as React from 'react';
import * as ReactDom from 'react-dom';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPPermission } from '@microsoft/sp-page-context';
import { App } from './components/App';
import { SpRepo } from './data/SpRepo';

/** Портфель проєктів: приложение по прототипу prototype/pmo-prototype.html. */
export default class PmoPortalWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const pc = this.context.pageContext;
    // всем, кроме администраторов сайта (право «Керування веб-сайтом»), прячем штатные полосы SharePoint:
    // шапку сайта, панель команд («Редагувати») и левую панель; полоса Microsoft 365 сверху остаётся
    if (!pc.web.permissions.hasPermission(SPPermission.manageWeb) && !document.getElementById('pmo-hide-sp')) {
      const st = document.createElement('style'); st.id = 'pmo-hide-sp';
      st.textContent = '#spSiteHeader,#spCommandBar,#sp-appBar{display:none!important}';
      document.head.appendChild(st);
    }
    const repo = new SpRepo(this.context.spHttpClient, pc.web.absoluteUrl, pc.web.serverRelativeUrl);
    ReactDom.render(React.createElement(App, { repo, culture: pc.cultureInfo.currentUICultureName,
      userName: pc.user.displayName, userEmail: pc.user.email, webUrl: pc.web.absoluteUrl }), this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }
}
