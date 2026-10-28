import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";
import { useComponentes, useEquipos } from "../lib/queries";
import { exportarLecturas, exportarRegistrosPm } from "../lib/exportar";
import { fFecha, fNum, hoyISO } from "../lib/fmt";
import type { LecturaCalc, RegistroPm } from "../lib/types";

export default function Historial() {
  const { esAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: equipos } = useEquipos();
  const { data: componentes } = useComponentes();

  const [pestania, setPestania] = useState<"lecturas" | "pm">("lecturas");
  const [equipoId, setEquipoId] = useState("");
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(hoyISO());

  const compPorId = useMemo(
    () => new Map((componentes ?? []).map((c) => [c.id, c])),
    [componentes]
  );
  const nombreEq = useMemo(
    () => new Map((equipos ?? []).map((e) => [e.id, e.cod_interno])),
    [equipos]
  );
  const compsEquipo = useMemo(
    () =>
      equipoId
        ? (componentes ?? []).filter((c) => c.equipo_id === equipoId).map((c) => c.id)
        : null,
    [componentes, equipoId]
  );

  const lecturas = useQuery({
    queryKey: ["hist-lecturas", equipoId, desde, hasta],
    queryFn: async () => {
      let q = supabase()
        .from("v_lecturas")
        .select("*")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("num_turno", { ascending: false })
        .limit(3000);
      if (compsEquipo) q = q.in("componente_id", compsEquipo);
      const { data, error } = await q;
      if (error) throw error;
      return data as LecturaCalc[];
    },
  });

  const registros = useQuery({
    queryKey: ["hist-pm", equipoId, desde, hasta],
    queryFn: async () => {
      let q = supabase()
        .from("registros_pm")
        .select("*")
        .eq("anulado", false)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .limit(2000);
      if (compsEquipo) q = q.in("componente_id", compsEquipo);
      const { data, error } = await q;
      if (error) throw error;
      return data as RegistroPm[];
    },
  });

  const anularLectura = useMutation({
    mutationFn: async (id: string) => {
      const motivo = prompt("Motivo de la anulación:");
      if (!motivo) throw new Error("cancelado");
      const { error } = await supabase()
        .from("lecturas")
        .update({ anulada: true, motivo_anulacion: motivo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  const anularPm = useMutation({
    mutationFn: async (id: string) => {
      const motivo = prompt("Motivo de la anulación del registro PM:");
      if (!motivo) throw new Error("cancelado");
      const { error } = await supabase()
        .from("registros_pm")
        .update({ anulado: true, motivo_anulacion: motivo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  function decorarLectura(l: LecturaCalc) {
    const c = compPorId.get(l.componente_id);
    return {
      ...l,
      equipo: c ? (nombreEq.get(c.equipo_id) ?? "") : "",
      tipo: c?.tipo_horometro ?? "",
    };
  }

  function decorarPm(r: RegistroPm) {
    const c = compPorId.get(r.componente_id);
    return {
      ...r,
      equipo: c ? (nombreEq.get(c.equipo_id) ?? "") : "",
      tipo: c?.tipo_horometro ?? "",
      clase: r.gama === null ? "Sin gama" : r.gama === 40 ? "Rutina 40 h" : "Mayor",
    };
  }

  return (
    <>
      <h1>Historial</h1>
      <p className="subtitulo">Lecturas de horómetro y mantenimientos ejecutados.</p>
      <div className="barra-acciones">
        <button
          className={pestania === "lecturas" ? "" : "boton-secundario"}
          onClick={() => setPestania("lecturas")}
        >
          Lecturas
        </button>
        <button
          className={pestania === "pm" ? "" : "boton-secundario"}
          onClick={() => setPestania("pm")}
        >
          Registros PM
        </button>
        <select style={{ width: 200 }} value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
          <option value="">Todos los equipos</option>
          {(equipos ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.cod_interno}
            </option>
          ))}
        </select>
        <input type="date" style={{ width: 150 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" style={{ width: 150 }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <div className="espacio" />
        <button
          className="boton-secundario"
          onClick={() =>
            pestania === "lecturas"
              ? exportarLecturas(
                  (lecturas.data ?? []).map(decorarLectura),
                  `Lecturas ${desde} a ${hasta}.xlsx`
                )
              : exportarRegistrosPm(
                  (registros.data ?? []).map(decorarPm),
                  `Registros PM ${desde} a ${hasta}.xlsx`
                )
          }
        >
          Exportar a Excel
        </button>
      </div>

      {pestania === "lecturas" ? (
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Equipo</th>
                <th>Horómetro</th>
                <th className="num">Lectura</th>
                <th className="num">Acumulado</th>
                <th className="num">Horas interv.</th>
                <th>Control</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {(lecturas.data ?? []).map((l) => {
                const d = decorarLectura(l);
                return (
                  <tr key={l.id}>
                    <td>{fFecha(l.fecha)}</td>
                    <td>{l.turno}</td>
                    <td>{d.equipo}</td>
                    <td>{d.tipo}</td>
                    <td className="num">{fNum(l.lectura)}</td>
                    <td className="num">{fNum(l.lectura_acum)}</td>
                    <td className="num">{fNum(l.horas_intervalo)}</td>
                    <td>
                      <span
                        className={
                          l.control === "OK"
                            ? "control-ok"
                            : l.control.startsWith("Horas imposibles")
                              ? "control-error"
                              : "control-aviso"
                        }
                      >
                        {l.control}
                      </span>
                    </td>
                    {esAdmin && (
                      <td>
                        <button className="boton-plano" onClick={() => anularLectura.mutate(l.id)}>
                          Anular
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Equipo</th>
                <th>Horómetro</th>
                <th className="num">Gama</th>
                <th className="num">Lectura</th>
                <th>Clase</th>
                <th>Responsable</th>
                {esAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {(registros.data ?? []).map((r) => {
                const d = decorarPm(r);
                return (
                  <tr key={r.id}>
                    <td>{fFecha(r.fecha)}</td>
                    <td>{d.equipo}</td>
                    <td>{d.tipo}</td>
                    <td className="num">{r.gama ?? "Sin gama"}</td>
                    <td className="num">{fNum(r.lectura)}</td>
                    <td>{d.clase}</td>
                    <td>{r.responsable}</td>
                    {esAdmin && (
                      <td>
                        <button className="boton-plano" onClick={() => anularPm.mutate(r.id)}>
                          Anular
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
