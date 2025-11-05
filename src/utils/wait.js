export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (base, j) => base + Math.floor(Math.random() * j);
