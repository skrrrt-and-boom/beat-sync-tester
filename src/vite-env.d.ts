/// <reference types="vite/client" />

// CSS module declarations
declare module '*.css' {
  const content: string;
  export default content;
}

// Essentia.js type declarations
declare module 'essentia.js/dist/essentia-wasm.es.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const EssentiaWASM: any;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Essentia: any;
  export default Essentia;
}
