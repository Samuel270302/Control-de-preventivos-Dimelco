import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnaControl, ControlFila } from "../lib/types";
import { fFecha, fNum, gamaTexto } from "../lib/fmt";
import EstadoBadge from "./EstadoBadge";
import { exportarControl } from "../lib/exportar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";
import { useColumnas } from "../lib/queries";

const GRUPOS: [string, string[], string][] = [
  ["vencido", ["🔴 Vencido"], "Vencidos"],
  ["programar", ["📅 Programar"], "Programar"],
  ["repuestos", ["🔧 Verificar repuestos"], "Verificar repuestos"],
  ["normal", ["🟢 Normal"], "Normal"],
  ["sindatos", ["⚪ Sin PM registrado", "⚪ Sin lecturas", "⚪ Sin tendencia"], "Sin datos"],
];

type Render = (f: ControlFila) => React.ReactNode;

const CELDAS: Record<string, { num: boolean; render: Render }> = {
  cod_sap: { num: false, render: (f) => f.cod_sap ?? "Sin SAP" },
  modelo: { num: false, render: (f) => f.modelo },
  fecha_ultimo_pm: { num: false, render: (f) => fFecha(f.fecha_ultimo_pm) },
  gama_ultimo_pm: {
    num: true,
    render: (f) => f.gama_ultimo_pm ?? (f.fecha_ultimo_pm ? "Sin gama" : ""),
  },
  horometro_ultimo_pm: { num: true, render: (f) => fNum(f.horometro_ultimo_pm) },
  proxima_gama: { num: true, render: (f) => gamaTexto(f.proxima_gama) },
  meta_acum: { num: true, render: (f) => fNum(f.meta_acum) },
  meta_contador: { num: true, render: (f) => fNum(f.meta_contador) },
  ultima_lectura_acum: { num: true, render: (f) => fNum(f.ultima_lectura_acum) },
  ultima_lectura_contador: { num: true, render: (f) => fNum(f.ultima_lectura_contador) },
  fecha_ultima_lectura: {
    num: false,
    render: (f) =>
      `${fFecha(f.fecha_ultima_lectura)}${
        f.antiguedad_dias != null && f.antiguedad_dias > 2 ? ` (${f.antiguedad_dias} d)` : ""
      }`,
  },
  hrs_faltantes: { num: true, render: (f) => fNum(f.hrs_faltantes) },
  tendencia: { num: true, render: (f) => fNum(f.tendencia, 2) },
  dias_restantes: { num: true, render: (f) => f.dias_restantes ?? "" },
  fecha_estimada: { num: false, render: (f) => fFecha(f.fecha_estimada) },
  estado: { num: false, render: (f) => <EstadoBadge estado={f.estado} /> },
  observacion: {
    num: false,
    render: (f) => <span className="aviso-obs">{f.observacion}</span>,
  },
};

export default function ControlTabla({
  filas,
  titulo,
  archivo,
}: {
  filas: ControlFila[];
  titulo: string;
  archivo: string;
}) {
  const { esAdmin } = useAuth();
  const { data: columnas } = useColumnas();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);

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

  const colsActivas = useMemo(
    () =>
      (columnas ?? [])
        .filter((c) => c.visible && CELDAS[c.columna])
        .sort((a, b) => a.orden - b.orden),
    [columnas]
  );

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
        {esAdmin && (
          <button className="boton-plano" onClick={() => dialogo.current?.showModal()}>
            Columnas
          </button>
        )}
        <button
          className="boton-secundario"
          onClick={() => exportarControl(visibles, titulo, archivo)}
        >
          Exportar a Excel
        </button>
      </div>
      <div className="titulo-tabla">{titulo}</div>
      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Componente</th>
              {colsActivas.map((c) => (
                <th key={c.columna} className={CELDAS[c.columna].num ? "num" : ""}>
                  {c.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.componente_id}>
                <td>{f.cod_interno}</td>
                <td>{f.nombre}</td>
                {colsActivas.map((c) => (
                  <td key={c.columna} className={CELDAS[c.columna].num ? "num" : ""}>
                    {CELDAS[c.columna].render(f)}
                  </td>
                ))}
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td
                  colSpan={colsActivas.length + 2}
                  style={{ textAlign: "center", color: "var(--texto-suave)" }}
                >
                  Sin filas para el filtro actual
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {esAdmin && <ColumnasDialog dialogoRef={dialogo} columnas={columnas ?? []} />}
    </>
  );
}

function ColumnasDialog({
  dialogoRef,
  columnas,
}: {
  dialogoRef: React.RefObject<HTMLDialogElement>;
  columnas: ColumnaControl[];
}) {
  const qc = useQueryClient();
  const alternar = useMutation({
    mutationFn: async ({ columna, visible }: { columna: string; visible: boolean }) => {
      const { error } = await supabase()
        .from("columnas_control")
        .update({ visible })
        .eq("columna", columna);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["columnas_control"] }),
  });
  return (
    <dialog ref={dialogoRef}>
      <h1 style={{ fontSize: 16 }}>Columnas visibles</h1>
      <p className="nota">
        Aplica a todos los usuarios, en Control PM y Rutina 40 h. Equipo y Componente siempre se
        muestran.
      </p>
      <div className="lista-columnas">
        {columnas
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((c) => (
            <label key={c.columna}>
              <input
                type="checkbox"
                checked={c.visible}
                onChange={(e) => alternar.mutate({ columna: c.columna, visible: e.target.checked })}
              />
              {c.etiqueta}
            </label>
          ))}
      </div>
      <div className="barra-acciones" style={{ marginBottom: 0 }}>
        <div className="espacio" />
        <button onClick={() => dialogoRef.current?.close()}>Cerrar</button>
      </div>
    </dialog>
  );
}
