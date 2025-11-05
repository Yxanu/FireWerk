export const log = (lvl, msg) => console[lvl](`[${lvl.toUpperCase()}] ${msg}`);
export const info = (m) => log('log', m);
export const warn = (m) => log('warn', m);
export const error = (m) => log('error', m);
