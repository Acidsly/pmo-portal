import * as React from 'react';
import * as ReactDom from 'react-dom';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { App } from './components/App';
import { SpRepo } from './data/SpRepo';

/** Портфель проєктів: приложение по прототипу prototype/pmo-prototype.html. */
export default class PmoPortalWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const pc = this.context.pageContext;
    const repo = new SpRepo(this.context.spHttpClient, pc.web.absoluteUrl, pc.web.serverRelativeUrl);
    ReactDom.render(React.createElement(App, { repo, culture: pc.cultureInfo.currentUICultureName,
      userName: pc.user.displayName, userEmail: pc.user.email, webUrl: pc.web.absoluteUrl }), this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }
}
