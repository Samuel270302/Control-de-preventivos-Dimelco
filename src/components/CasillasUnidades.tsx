import { useEffect, useRef } from "react";
import type { Unidad } from "../lib/types";

// Lista desplegable con una casilla por unidad. El resumen muestra las unidades marcadas.
export default function CasillasUnidades({
  unidades,
  valor,
  onCambio,
  deshabilitado,
  textoTodas,
  etiqueta,
  enLinea,
}: {
  unidades: Unidad[];
  valor: string[];
  onCambio: (ids: string[]) => void;
  deshabilitado?: boolean;
  textoTodas?: string;
  etiqueta: string;
  // Dentro de una tabla: la lista se abre en la fila y no flota (el marco la recortaría).
  enLinea?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  // Se cierra al hacer clic fuera.
  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);
  const nombres = unidades.filter((u) => valor.includes(u.id)).map((u) => u.nombre);
  const resumen = deshabilitado && textoTodas ? textoTodas : nombres.length ? nombres.join(", ") : "Seleccione";
  if (deshabilitado)
    return (
      <div className="casillas-unidades deshabilitado" aria-label={etiqueta}>
        <span className="resumen-unidades">{resumen}</span>
      </div>
    );
  return (
    <details className={`casillas-unidades${enLinea ? " en-linea" : ""}`} ref={ref}>
      <summary aria-label={etiqueta} className={nombres.length ? "" : "vacio"}>
        <span className="resumen-unidades">{resumen}</span>
      </summary>
      <div className="lista-unidades" role="group" aria-label={etiqueta}>
        {unidades.map((u) => (
          <label key={u.id} className="campo-check">
            <input
              type="checkbox"
              checked={valor.includes(u.id)}
              onChange={(e) =>
                onCambio(
                  e.target.checked
                    ? unidades.filter((x) => x.id === u.id || valor.includes(x.id)).map((x) => x.id)
                    : valor.filter((x) => x !== u.id)
                )
              }
            />
            {u.nombre}
          </label>
        ))}
      </div>
    </details>
  );
}
