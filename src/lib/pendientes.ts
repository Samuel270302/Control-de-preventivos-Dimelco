// Lecturas escritas y no grabadas en la pantalla de captura. El menú lateral lo
// consulta antes de cambiar de pantalla y la ventana antes de cerrarse.
let pendientes = 0;

export function marcarPendientes(n: number) {
  pendientes = n;
  window.onbeforeunload = n > 0 ? () => "Hay lecturas sin grabar" : null;
}

export const lecturasPendientes = () => pendientes;
