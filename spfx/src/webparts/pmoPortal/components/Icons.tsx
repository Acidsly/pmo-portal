import * as React from 'react';

// Иконки — дословно из прототипа (SHIELD_D, SWORD_D, PRIO_I, icoCompass, icoFlag, iconPlus, кнопки темы)
export const SHIELD_D = 'M12 2 4 5v6.2c0 4.9 3.4 9.3 8 10.8 4.6-1.5 8-5.9 8-10.8V5z';
export const SWORD_D = 'M12 4.6l.9 1.3v7.2h2.3v1.4h-2.3v2h.5v1.2h-2.8v-1.2h.5v-2H8.8v-1.4h2.3V5.9z';

export const Strat: React.FC<{ on: boolean }> = ({ on }) => on ? (
  <svg className="stratico" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d={SHIELD_D} fill="currentColor" /><path d={SWORD_D} fill="#fff" /></svg>) : null;

export const Prio: React.FC<{ v: string }> = ({ v }) =>
  v.charAt(0) === '1' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--r)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8l4-4 4 4M4 12.5l4-4 4 4" /></svg>
  : v.charAt(0) === '2' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--y)" strokeWidth="2" strokeLinecap="round"><path d="M3.5 6h9M3.5 10h9" /></svg>
  : v.charAt(0) === '3' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--theme)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg> : null;

export const Compass: React.FC = () => <svg className="hico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" fillOpacity=".25" /></svg>;
export const Flag: React.FC = () => <svg className="hico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>;
export const Plus: React.FC = () => <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2.5v11M2.5 8h11" /></svg>;
export const Sun: React.FC = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg>;
export const Moon: React.FC = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" /></svg>;
export const Gear: React.FC = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const Funnel: React.FC = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" /></svg>;
export const ListIco: React.FC = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 3.5h9M5 8h9M5 12.5h9M2 3.5h.5M2 8h.5M2 12.5h.5" /></svg>;
export const TilesIco: React.FC = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" /><rect x="9" y="9" width="5.5" height="5.5" rx="1.5" /></svg>;
