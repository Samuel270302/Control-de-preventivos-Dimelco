import { useMemo, useState } from "react";
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

interface Captura {
  valor: string; // lectura del contador (o final de turno en modo manual)
  inicio?: string; // solo modo manual
}

export default function Lecturas() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const { data: equipos } = useEquipos();
  const { data: componentes } = useComponentes();
  const { data: recientes } = useLecturasRecientes(1500);
  const { data: parametros } = useParametros();

  const [fecha, setFecha] = useState(hoyISO());
  const [turno, setTurno] = useState<Turno>("Dia");
  const [capturas, setCapturas] = useState<Record<string, Captura>>({});
  const [mensaje, setMensaje] = useState("");

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

  function validar(c: Componente, texto: Captura) {
    const lect = lecturaFinal(c, texto);
    if (lect === null) return null;
    return validarLectura(fecha, turno, lect, porComponente.get(c.id) ?? [], p);
  }

  // En modo manual (Scooptram #4) se digitan inicio y final del turno;
  // la lectura acumulada se reconstruye: última lectura + (final − inicio).
  function lecturaFinal(c: Componente, cap: Captura): number | null {
    const v = parseFloat(cap.valor);
    if (isNaN(v)) return null;
    if (!c.lectura_manual) return v;
    const ini = parseFloat(cap.inicio ?? "");
    if (isNaN(ini) || v < ini) return null;
    const prev = ultima(c);
    return (prev?.lectura ?? ini) + (v - ini);
  }

  const grabar = useMutation({
    mutationFn: async () => {
      const inserciones: {
        comp: Componente;
        lectura: number;
        cap: Captura;
      }[] = [];
      for (const { comp } of filas) {
        const cap = capturas[comp.id];
        if (!cap || cap.valor.trim() === "") continue;
        const lect = lecturaFinal(comp, cap);
        if (lect === null) throw new Error(`Lectura inválida en ${comp.nombre}`);
        const res = validar(comp, cap);
        if (res?.nivel === "error") throw new Error(`${comp.nombre}: ${res.control}`);
        inserciones.push({ comp, lectura: lect, cap });
      }
      if (inserciones.length === 0) throw new Error("No hay lecturas para grabar");
      for (const ins of inserciones) {
        const { data, error } = await supabase()
          .from("lecturas")
          .insert({
            componente_id: ins.comp.id,
            fecha,
            turno,
            lectura: ins.lectura,
            origen: ins.comp.lectura_manual ? "manual" : "app",
            creado_por: session?.user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (ins.comp.lectura_manual) {
          const { error: e2 } = await supabase().from("registros_manuales").insert({
            componente_id: ins.comp.id,
            fecha,
            turno,
            lectura_inicio: parseFloat(ins.cap.inicio!),
            lectura_final: parseFloat(ins.cap.valor),
            lectura_id: data.id,
            creado_por: session?.user.id,
          });
          if (e2) throw e2;
        }
      }
      return inserciones.length;
    },
    onSuccess: (n) => {
      setCapturas({});
      setMensaje(`${n} lectura(s) grabada(s)`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => setMensaje(e.message),
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
          {mensaje && (
            <div className="nota" style={{ alignSelf: "flex-end", paddingBottom: 10 }}>
              {mensaje}
            </div>
          )}
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
              const cap = capturas[comp.id] ?? { valor: "" };
              const res = cap.valor.trim() !== "" ? validar(comp, cap) : null;
              return (
                <tr key={comp.id}>
                  <td>{equipo}</td>
                  <td>
                    {comp.tipo_horometro}
                    {comp.lectura_manual && (
                      <span className="nota"> · manual (inicio / final)</span>
                    )}
                  </td>
                  <td className="num">{u ? fNum(u.lectura) : "—sin lecturas—"}</td>
                  <td>{u ? `${fFecha(u.fecha)} ${u.turno}` : ""}</td>
                  <td className="num">
                    {comp.lectura_manual ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input
                          style={{ width: 70 }}
                          placeholder="inicio"
                          value={cap.inicio ?? ""}
                          onChange={(e) =>
                            setCapturas({ ...capturas, [comp.id]: { ...cap, inicio: e.target.value } })
                          }
                        />
                        <input
                          style={{ width: 70 }}
                          placeholder="final"
                          value={cap.valor}
                          onChange={(e) =>
                            setCapturas({ ...capturas, [comp.id]: { ...cap, valor: e.target.value } })
                          }
                        />
                      </div>
                    ) : (
                      <input
                        style={{ width: 110, textAlign: "right" }}
                        value={cap.valor}
                        onChange={(e) =>
                          setCapturas({ ...capturas, [comp.id]: { valor: e.target.value } })
                        }
                      />
                    )}
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
