import { useMemo, useState } from "react";
import type { ControlFila } from "../lib/types";
import { fFecha, fNum } from "../lib/fmt";
import EstadoBadge from "./EstadoBadge";
import { exportarControl } from "../lib/exportar";

const GRUPOS: [string, string[], string][] = [
  ["vencido", ["🔴 Vencido"], "Vencidos"],
  ["programar", ["📅 Programar"], "Programar"],
  ["repuestos", ["🔧 Verificar repuestos"], "Verificar repuestos"],
  ["normal", ["🟢 Normal"], "Normal"],
  ["sindatos", ["⚪ Sin PM registrado", "⚪ Sin lecturas", "⚪ Sin tendencia"], "Sin datos"],
];

export default function ControlTabla({
  filas,
  titulo,
  conSecciones,
  archivo,
}: {
  filas: ControlFila[];
  titulo: string;
  conSecciones: boolean;
  archivo: string;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");

  const visibles = useMemo(() => {
    let v = filas;
    if (filtro) {
      const grupo = GRUPOS.find(([k]) => k === filtro);
      if (grupo) v = v.filter((f) => grupo[1].includes(f.estado));
    }
    if (buscar.trim()) {
      const b = buscar.trim().toLowerCase();
      v = v.filter(
        (f) =>
          f.cod_interno.toLowerCase().includes(b) ||
          f.nombre.toLowerCase().includes(b) ||
          f.modelo.toLowerCase().includes(b)
      );
    }
    return v;
  }, [filas, filtro, buscar]);

  const secciones = useMemo(() => {
    if (!conSecciones) return [["", visibles]] as [string, ControlFila[]][];
    const m = new Map<string, ControlFila[]>();
    for (const f of visibles) {
      const s =
        f.seccion === 1
          ? "1. Sistema diésel"
          : f.seccion === 2
            ? "2. Compresor (horómetro motor eléctrico)"
            : "3. Perforadoras / empernadoras · MP mayor";
      if (!m.has(s)) m.set(s, []);
      m.get(s)!.push(f);
    }
    return [...m.entries()].sort();
  }, [visibles, conSecciones]);

  return (
    <>
      <div className="resumen">
        {GRUPOS.map(([clase, estados, texto]) => {
          const n = filas.filter((f) => estados.includes(f.estado)).length;
          return (
            <div
              key={clase}
              className={`chip ${clase} ${filtro === clase ? "activo" : ""}`}
              onClick={() => setFiltro(filtro === clase ? null : clase)}
            >
              <span className="n">{n}</span>
              <span className="t">{texto}</span>
            </div>
          );
        })}
      </div>
      <div className="barra-acciones">
        <input
          style={{ width: 260 }}
          placeholder="Buscar equipo, componente o modelo…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="espacio" />
        <button
          className="boton-secundario"
          onClick={() => exportarControl(visibles, titulo, archivo)}
        >
          Exportar a Excel
        </button>
      </div>
      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>SAP</th>
              <th>Componente</th>
              <th>Último PM</th>
              <th className="num">Gama</th>
              <th className="num">Horóm. PM</th>
              <th className="num">Próx. gama</th>
              <th className="num">Meta acum.</th>
              <th className="num">Meta contador</th>
              <th className="num">Lect. acum.</th>
              <th className="num">Lect. contador</th>
              <th>Fecha lect.</th>
              <th className="num">Hrs falt.</th>
              <th className="num">Tend.</th>
              <th className="num">Días rest.</th>
              <th>Fecha est.</th>
              <th>Estado</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            {secciones.map(([seccion, lista]) => (
              <SeccionFilas key={seccion || "unica"} seccion={seccion} lista={lista} />
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={18} style={{ textAlign: "center", color: "var(--texto-suave)" }}>
                  Sin filas para el filtro actual
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SeccionFilas({ seccion, lista }: { seccion: string; lista: ControlFila[] }) {
  return (
    <>
      {seccion && (
        <tr className="fila-seccion">
          <td colSpan={18}>{seccion}</td>
        </tr>
      )}
      {lista.map((f) => (
        <tr key={f.componente_id}>
          <td>{f.cod_interno}</td>
          <td>{f.cod_sap ?? "Sin SAP"}</td>
          <td>{f.nombre}</td>
          <td>{fFecha(f.fecha_ultimo_pm)}</td>
          <td className="num">{f.gama_ultimo_pm ?? (f.fecha_ultimo_pm ? "Sin gama" : "")}</td>
          <td className="num">{fNum(f.horometro_ultimo_pm)}</td>
          <td className="num">
            {typeof f.proxima_gama === "number" ? fNum(f.proxima_gama) : (f.proxima_gama ?? "")}
          </td>
          <td className="num">{fNum(f.meta_acum)}</td>
          <td className="num">{fNum(f.meta_contador)}</td>
          <td className="num">{fNum(f.ultima_lectura_acum)}</td>
          <td className="num">{fNum(f.ultima_lectura_contador)}</td>
          <td>
            {fFecha(f.fecha_ultima_lectura)}
            {f.antiguedad_dias != null && f.antiguedad_dias > 2 ? ` (${f.antiguedad_dias} d)` : ""}
          </td>
          <td className="num">{fNum(f.hrs_faltantes)}</td>
          <td className="num">{fNum(f.tendencia, 2)}</td>
          <td className="num">{f.dias_restantes ?? ""}</td>
          <td>{fFecha(f.fecha_estimada)}</td>
          <td>
            <EstadoBadge estado={f.estado} />
          </td>
          <td>
            <span className="aviso-obs">{f.observacion}</span>
          </td>
        </tr>
      ))}
    </>
  );
}
