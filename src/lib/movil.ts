import { useSyncExternalStore } from "react";

// Pantalla de celular: menos de 768 px de ancho. El menú pasa a una barra inferior y
// las tablas de captura se ven como tarjetas; el escritorio no cambia.
const CONSULTA = "(max-width: 767px)";

export function useEsMovil(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(CONSULTA);
      m.addEventListener("change", avisar);
      return () => m.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA).matches
  );
}
