import { useState } from "react";
import { useControl40, useControlPm } from "../lib/queries";
import { hoyISO, fFecha } from "../lib/fmt";
import { reporteSemanal } from "../lib/reporte";
import { PestaniasSistema, SISTEMAS } from "../lib/sistemas";
import ControlTabla from "../components/ControlTabla";

export default function ControlPm() {
  const { data, isLoading, error } = useControlPm();
  const { data: r40 } = useControl40();
  const [seccion, setSeccion] = useState(1);
  const [avisoReporte, setAvisoReporte] = useState("");
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
          {avisoReporte && <p className="nota">{avisoReporte}</p>}
        </div>
        <button
          className="boton-secundario"
          onClick={async () => {
            try {
              const ruta = await reporteSemanal(todas, r40 ?? []);
              setAvisoReporte(ruta ? `Reporte guardado en ${ruta}` : "");
            } catch (e) {
              setAvisoReporte(`No se pudo generar el reporte: ${String(e)}`);
            }
          }}
        >
          Reporte semanal (PDF)
        </button>
      </div>
      <PestaniasSistema seccion={seccion} onCambio={setSeccion} />
      <ControlTabla
        filas={filas}
        titulo={`Control de preventivos · ${sistema.titulo}`}
        archivo={`Control PM ${sistema.pestania} ${hoyISO()}.xlsx`}
      />
    </>
  );
}
