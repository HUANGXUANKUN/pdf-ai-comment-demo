const setMissing = (target: object, key: PropertyKey) => {
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value: undefined,
  });
};

setMissing(Promise, "withResolvers");
setMissing(Promise, "try");
setMissing(AbortSignal, "any");

await import("./client/src/lib/pdfjs-compat");
await import("pdfjs-dist/legacy/build/pdf.mjs");

const required: Array<[string, unknown]> = [
  ["Promise.withResolvers", Promise.withResolvers],
  ["Promise.try", Promise.try],
  ["AbortSignal.any", AbortSignal.any],
];

for (const [name, value] of required) {
  if (typeof value !== "function") {
    throw new Error(`${name} was not installed for an older Safari runtime`);
  }
}

const first = new AbortController();
const second = new AbortController();
const combined = AbortSignal.any([first.signal, second.signal]);
second.abort("compatibility-test");

if (!combined.aborted) {
  throw new Error("AbortSignal.any polyfill did not forward an abort event");
}

console.log("PDF.js older-Safari compatibility test passed.");
