import { useControl40, useControlPm } from "../lib/queries";
import { hoyISO, fFecha } from "../lib/fmt";
import { reporteSemanal } from "../lib/reporte";
import ControlTabla from "../components/ControlTabla";

export default function ControlPm() {
  const { data, isLoading, error } = useControlPm();
  const { data: r40 } = useControl40();
  if (isLoading) return <p>Cargando control…</p>;
  if (error) return <p className="error-texto">Error al cargar: {String(error)}</p>;
  const filas = (data ?? []).slice().sort((a, b) =>
    (a.seccion ?? 0) - (b.seccion ?? 0) || a.cod_interno.localeCompare(b.cod_interno, "es", { numeric: true })
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h1>Control y proyección de mantenimientos preventivos</h1>
          <p className="subtitulo">PM mayor por horómetro · al {fFecha(hoyISO())}</p>
        </div>
        <button className="boton-secundario" onClick={() => reporteSemanal(filas, r40 ?? [])}>
          Reporte semanal (PDF)
        </button>
      </div>
      <ControlTabla
        filas={filas}
        titulo="Control PM"
        conSecciones
        archivo={`Control PM ${hoyISO()}.xlsx`}
      />
    </>
  );
}
