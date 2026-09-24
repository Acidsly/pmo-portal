import * as React from 'react';

/** Блок главной (функция wp прототипа): заголовок, «Показати все», содержимое. */
export const Wp: React.FC<{ title: string; more?: () => void; moreLabel?: string; children?: React.ReactNode }> = ({ title, more, moreLabel, children }) =>
  <section className="wp"><div className="wp-h"><h2>{title}</h2><span>{more ? <button className="more" onClick={more}>{moreLabel}</button> : null}</span></div>{children}</section>;
