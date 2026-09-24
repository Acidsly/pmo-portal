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
