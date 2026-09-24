import * as React from 'react';
import { AppCtx } from '../components/ctx';

/** Разделы следующих этапов. */
export const Soon: React.FC = () => {
  const { t } = React.useContext(AppCtx);
  return <div className="wp empty-state"><p>{t('soon')}</p></div>;
};
