import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth";
import { useComponentes, useEquipos, usePlanes, useRegistrosPm } from "../lib/queries";
import { fFecha, fNum, hoyISO } from "../lib/fmt";

interface Renglon {
  componenteId: string;
  gama: string;
  lectura: string;
}

const RENGLON_VACIO: Renglon = { componenteId: "", gama: "", lectura: "" };

export default function RegistroPmPage() {
  const { session, esAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: equipos } = useEquipos();
  const { data: componentes } = useComponentes();
  const { data: planes } = usePlanes();
  const { data: registros } = useRegistrosPm(200);

  const [fecha, setFecha] = useState(hoyISO());
  const [equipoId, setEquipoId] = useState("");
  const [responsable, setResponsable] = useState("");
  // Un PM que interviene dos componentes (p. ej. motor y perforadora)
  // se registra en renglones separados, cada uno con su lectura.
  const [renglones, setRenglones] = useState<Renglon[]>([{ ...RENGLON_VACIO }]);
  const [mensaje, setMensaje] = useState("");

  const compDelEquipo = useMemo(
    () => (componentes ?? []).filter((c) => c.equipo_id === equipoId && c.activo),
    [componentes, equipoId]
  );

  const nombreEq = useMemo(
    () => new Map((equipos ?? []).map((e) => [e.id, e.cod_interno])),
    [equipos]
  );
  const compPorId = useMemo(
    () => new Map((componentes ?? []).map((c) => [c.id, c])),
    [componentes]
  );

  function gamasDe(componenteId: string): number[] {
    const c = compPorId.get(componenteId);
    const plan = planes?.find((p) => p.clave === c?.plan_clave);
    const gamas = new Set<number>(plan?.ciclo_gamas ?? []);
    if (c?.aplica_rutina40) gamas.add(40);
    return [...gamas].sort((a, b) => a - b);
  }

  const grabar = useMutation({
    mutationFn: async () => {
      const filas = renglones.filter((r) => r.componenteId);
      if (!fecha || filas.length === 0)
        throw new Error("Seleccione fecha, equipo y al menos un componente");
      for (const r of filas) {
        const { error } = await supabase().from("registros_pm").insert({
          componente_id: r.componenteId,
          fecha,
          gama: r.gama === "" ? null : Number(r.gama),
          lectura: r.lectura === "" ? null : Number(r.lectura),
          responsable: responsable.trim() || null,
          creado_por: session?.user.id,
        });
        if (error) throw error;
      }
      return filas.length;
    },
    onSuccess: (n) => {
      setMensaje(`${n} registro(s) de PM grabado(s)`);
      setRenglones([{ ...RENGLON_VACIO }]);
      setResponsable("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => setMensaje(e.message),
  });

  const anular = useMutation({
    mutationFn: async (id: string) => {
      const motivo = prompt("Motivo de la anulación:");
      if (!motivo) throw new Error("Anulación cancelada");
      const { error } = await supabase()
        .from("registros_pm")
        .update({ anulado: true, motivo_anulacion: motivo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => setMensaje(e.message),
  });

  return (
    <>
      <h1>Registro de mantenimientos ejecutados</h1>
      <p className="subtitulo">
        La lectura es la del contador del componente intervenido al momento del PM. La gama 40 es
        rutina: no mueve la meta del PM mayor.
      </p>
      <div className="panel-formulario">
        <div className="fila-campos" style={{ marginBottom: 12 }}>
          <label className="campo" style={{ maxWidth: 170 }}>
            <span>Fecha de ejecución</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo" style={{ maxWidth: 220 }}>
            <span>Equipo</span>
            <select
              value={equipoId}
              onChange={(e) => {
                setEquipoId(e.target.value);
                setRenglones([{ ...RENGLON_VACIO }]);
              }}
            >
              <option value="">— seleccione —</option>
              {(equipos ?? [])
                .filter((e) => e.activo)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.cod_interno}
                  </option>
                ))}
            </select>
          </label>
          <label className="campo">
            <span>Responsable (técnico o empresa)</span>
            <input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </label>
        </div>
        {renglones.map((r, i) => (
          <div className="fila-campos" key={i} style={{ marginBottom: 8 }}>
            <label className="campo" style={{ maxWidth: 280 }}>
              <span>Componente intervenido</span>
              <select
                value={r.componenteId}
                onChange={(e) => {
                  const n = [...renglones];
                  n[i] = { ...r, componenteId: e.target.value, gama: "" };
                  setRenglones(n);
                }}
              >
                <option value="">— seleccione —</option>
                {compDelEquipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.tipo_horometro})
                  </option>
                ))}
              </select>
            </label>
            <label className="campo" style={{ maxWidth: 140 }}>
              <span>Gama (h)</span>
              <select
                value={r.gama}
                onChange={(e) => {
                  const n = [...renglones];
                  n[i] = { ...r, gama: e.target.value };
                  setRenglones(n);
                }}
              >
                <option value="">— sin gama —</option>
                {gamasDe(r.componenteId).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo" style={{ maxWidth: 160 }}>
              <span>Lectura del contador</span>
              <input
                value={r.lectura}
                onChange={(e) => {
                  const n = [...renglones];
                  n[i] = { ...r, lectura: e.target.value };
                  setRenglones(n);
                }}
              />
            </label>
            {renglones.length > 1 && (
              <button
                className="boton-plano"
                style={{ alignSelf: "flex-end" }}
                onClick={() => setRenglones(renglones.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        <div className="barra-acciones" style={{ marginTop: 10, marginBottom: 0 }}>
          <button
            className="boton-secundario"
            onClick={() => setRenglones([...renglones, { ...RENGLON_VACIO }])}
          >
            + Otro componente del mismo PM
          </button>
          <div className="espacio" />
          {mensaje && <span className="nota">{mensaje}</span>}
          <button onClick={() => grabar.mutate()} disabled={grabar.isPending}>
            {grabar.isPending ? "Grabando…" : "Grabar PM"}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15 }}>Últimos PM registrados</h2>
      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Equipo</th>
              <th>Componente</th>
              <th className="num">Gama</th>
              <th className="num">Lectura</th>
              <th>Responsable</th>
              {esAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(registros ?? []).map((r) => {
              const c = compPorId.get(r.componente_id);
              return (
                <tr key={r.id}>
                  <td>{fFecha(r.fecha)}</td>
                  <td>{c ? nombreEq.get(c.equipo_id) : ""}</td>
                  <td>{c?.nombre}</td>
                  <td className="num">{r.gama ?? "Sin gama"}</td>
                  <td className="num">{fNum(r.lectura)}</td>
                  <td>{r.responsable}</td>
                  {esAdmin && (
                    <td>
                      <button className="boton-plano" onClick={() => anular.mutate(r.id)}>
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
    </>
  );
}
