/**
 * MISURE TEMPORANEE: ogni chiamata al database scrive nei registri quanto ha impiegato
 * («[perf] db 42ms GET players»). Servono a capire dove si perde tempo; da togliere dopo l'ottimizzazione.
 */
export const timedFetch: typeof fetch = async (input, init) => {
  const t0 = performance.now();
  const res = await fetch(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url).pathname.replace(/^\/(rest|auth|storage)\/v1\//, "$1:");
  console.log(`[perf] db ${Math.round(performance.now() - t0)}ms ${init?.method ?? "GET"} ${path}`);
  return res;
};
