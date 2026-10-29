import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";
import {
  useComponentes,
  useEquipos,
  useLecturasRecientes,
  useParametros,
} from "../lib/queries";
import { validarLectura, type ParamsValidacion } from "../lib/validacion";
import { fFecha, fNum, hoyISO } from "../lib/fmt";
import type { Componente, LecturaCalc, Turno } from "../lib/types";
import { useAvisos } from "../components/Avisos";
import { marcarPendientes } from "../lib/pendientes";

export default function Lecturas() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const { data: equipos } = useEquipos();
  const { data: componentes } = useComponentes();
  const { data: recientes } = useLecturasRecientes(1500);
  const { data: parametros } = useParametros();

  const [fecha, setFecha] = useState(hoyISO());
  const [turno, setTurno] = useState<Turno>("Dia");
  const [capturas, setCapturas] = useState<Record<string, string>>({});
  const nPendientes = Object.values(capturas).filter((v) => v.trim() !== "").length;
  useEffect(() => {
    marcarPendientes(nPendientes);
  }, [nPendientes]);
  useEffect(() => () => marcarPendientes(0), []);

  // Enter pasa a la casilla siguiente, como en una planilla.
  function siguienteCasilla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const casillas = Array.from(document.querySelectorAll<HTMLInputElement>("input.casilla-lectura"));
    const i = casillas.indexOf(e.currentTarget);
    casillas[i + 1]?.focus();
    casillas[i + 1]?.select();
  }
  const { avisar } = useAvisos();

  const p: ParamsValidacion = useMemo(() => {
    const v = (c: string, def: number) =>
      Number(parametros?.find((x) => x.clave === c)?.valor ?? def);
    return {
      maxHorasTurno: v("max_horas_turno", 12),
      umbralCambio: v("umbral_cambio_horometro", 2),
      huecoTurnos: v("hueco_turnos", 14),
    };
  }, [parametros]);

  const porComponente = useMemo(() => {
    const m = new Map<string, LecturaCalc[]>();
    for (const l of recientes ?? []) {
      if (!m.has(l.componente_id)) m.set(l.componente_id, []);
      m.get(l.componente_id)!.push(l);
    }
    return m;
  }, [recientes]);

  const filas = useMemo(() => {
    if (!equipos || !componentes) return [];
    const nombreEq = new Map(equipos.map((e) => [e.id, e.cod_interno]));
    return componentes
      .filter((c) => c.activo)
      .map((c) => ({ comp: c, equipo: nombreEq.get(c.equipo_id) ?? "" }))
      .sort(
        (a, b) =>
          a.equipo.localeCompare(b.equipo, "es", { numeric: true }) ||
          a.comp.tipo_horometro.localeCompare(b.comp.tipo_horometro)
      );
  }, [equipos, componentes]);

  function ultima(c: Componente): LecturaCalc | undefined {
    return porComponente.get(c.id)?.[0];
  }

  function validar(c: Componente, texto: string) {
    const lect = parseFloat(texto);
    if (isNaN(lect)) return null;
    return validarLectura(fecha, turno, lect, porComponente.get(c.id) ?? [], p);
  }

  const grabar = useMutation({
    mutationFn: async () => {
      const inserciones: { comp: Componente; lectura: number }[] = [];
      for (const { comp } of filas) {
        const texto = capturas[comp.id];
        if (!texto || texto.trim() === "") continue;
        const lect = parseFloat(texto);
        if (isNaN(lect)) throw new Error(`Lectura inválida en ${comp.nombre}`);
        const res = validar(comp, texto);
        if (res?.nivel === "error") throw new Error(`${comp.nombre}: ${res.control}`);
        inserciones.push({ comp, lectura: lect });
      }
      if (inserciones.length === 0) throw new Error("No hay lecturas para grabar");
      const { error } = await supabase()
        .from("lecturas")
        .insert(
          inserciones.map((ins) => ({
            componente_id: ins.comp.id,
            fecha,
            turno,
            lectura: ins.lectura,
            origen: "app",
            creado_por: session?.user.id,
          }))
        );
      if (error) throw error;
      return inserciones.length;
    },
    onSuccess: (n) => {
      setCapturas({});
      avisar(`${n} lectura(s) grabada(s)`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => avisar(e.message, "error"),
  });

  return (
    <>
      <h1>Captura de lecturas de horómetro</h1>
      <p className="subtitulo">
        Se escribe lo que marca el contador al cierre del turno, nunca horas acumuladas.
      </p>
      <div className="panel-formulario">
        <div className="fila-campos">
          <label className="campo" style={{ maxWidth: 170 }}>
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo" style={{ maxWidth: 130 }}>
            <span>Turno</span>
            <select value={turno} onChange={(e) => setTurno(e.target.value as Turno)}>
              <option>Dia</option>
              <option>Noche</option>
            </select>
          </label>
          <div style={{ alignSelf: "flex-end" }}>
            <button onClick={() => grabar.mutate()} disabled={grabar.isPending}>
              {grabar.isPending ? "Grabando…" : "Grabar lecturas"}
            </button>
          </div>
        </div>
      </div>
      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Horómetro</th>
              <th className="num">Última lectura</th>
              <th>Fecha últ.</th>
              <th className="num" style={{ width: 130 }}>
                Nueva lectura
              </th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ comp, equipo }) => {
              const u = ultima(comp);
              const texto = capturas[comp.id] ?? "";
              const res = texto.trim() !== "" ? validar(comp, texto) : null;
              return (
                <tr key={comp.id} className={texto.trim() !== "" ? "fila-con-valor" : ""}>
                  <td>{equipo}</td>
                  <td>{comp.tipo_horometro}</td>
                  <td className="num">{u ? fNum(u.lectura) : "—sin lecturas—"}</td>
                  <td>{u ? `${fFecha(u.fecha)} ${u.turno}` : ""}</td>
                  <td className="num">
                    <input
                      className="casilla-lectura"
                      style={{ width: 110, textAlign: "right" }}
                      value={texto}
                      onKeyDown={siguienteCasilla}
                      onChange={(e) => setCapturas({ ...capturas, [comp.id]: e.target.value })}
                    />
                  </td>
                  <td>
                    {res && (
                      <span className={`control-${res.nivel === "ok" ? "ok" : res.nivel}`}>
                        {res.control}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
