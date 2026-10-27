import { useState } from "react";
import { useControl40, useControlPm } from "../lib/queries";
import { hoyISO, fFecha } from "../lib/fmt";
import { reporteSemanal } from "../lib/reporte";
import ControlTabla from "../components/ControlTabla";

const SISTEMAS: { seccion: number; pestania: string; titulo: string }[] = [
  { seccion: 1, pestania: "Motor diésel", titulo: "Control de preventivos · Motor diésel" },
  { seccion: 2, pestania: "Compresor", titulo: "Control de preventivos · Compresor (horómetro motor eléctrico)" },
  { seccion: 3, pestania: "Perforadoras y empernadoras", titulo: "Control de preventivos · Perforadoras y empernadoras, MP mayor" },
];

export default function ControlPm() {
  const { data, isLoading, error } = useControlPm();
  const { data: r40 } = useControl40();
  const [seccion, setSeccion] = useState(1);
  if (isLoading) return <p>Cargando control…</p>;
  if (error) return <p className="error-texto">Error al cargar: {String(error)}</p>;
  const todas = (data ?? []).slice().sort((a, b) =>
    a.cod_interno.localeCompare(b.cod_interno, "es", { numeric: true }) ||
    a.tipo_horometro.localeCompare(b.tipo_horometro)
  );
  const sistema = SISTEMAS.find((s) => s.seccion === seccion)!;
  const filas = todas.filter((f) => (f.seccion ?? 0) === seccion);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h1>Control y proyección de mantenimientos preventivos</h1>
          <p className="subtitulo">PM mayor por horómetro · al {fFecha(hoyISO())}</p>
        </div>
        <button className="boton-secundario" onClick={() => reporteSemanal(todas, r40 ?? [])}>
          Reporte semanal (PDF)
        </button>
      </div>
      <div className="pestanias">
        {SISTEMAS.map((s) => (
          <button
            key={s.seccion}
            className={`pestania ${s.seccion === seccion ? "activa" : ""}`}
            onClick={() => setSeccion(s.seccion)}
          >
            {s.pestania}
          </button>
        ))}
      </div>
      <ControlTabla
        filas={filas}
        titulo={sistema.titulo}
        archivo={`Control PM ${sistema.pestania} ${hoyISO()}.xlsx`}
      />
    </>
  );
}
