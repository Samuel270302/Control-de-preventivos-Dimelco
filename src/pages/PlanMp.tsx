import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useParametros, usePlanes } from "../lib/queries";
import type { PlanMp } from "../lib/types";

export default function PlanMpPage() {
  const qc = useQueryClient();
  const { data: planes } = usePlanes();
  const { data: parametros } = useParametros();
  const [editando, setEditando] = useState<PlanMp | null>(null);
  const [mensaje, setMensaje] = useState("");

  const guardar = useMutation({
    mutationFn: async (p: PlanMp) => {
      const { error } = await supabase()
        .from("planes_mp")
        .update({
          intervalo_h: p.intervalo_h,
          ciclo_gamas: p.ciclo_gamas,
          dias_programar: p.dias_programar,
          dias_verificar: p.dias_verificar,
          base_sin_pm: p.base_sin_pm,
          kits_sap: p.kits_sap,
          observaciones: p.observaciones,
        })
        .eq("clave", p.clave);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditando(null);
      setMensaje("Plan actualizado: el control se recalcula al instante");
      qc.invalidateQueries();
    },
    onError: (e: Error) => setMensaje(e.message),
  });

  const guardarParam = useMutation({
    mutationFn: async ({ clave, valor }: { clave: string; valor: number }) => {
      const { error } = await supabase().from("parametros").update({ valor }).eq("clave", clave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <>
      <h1>Plan de mantenimiento preventivo</h1>
      <p className="subtitulo">
        El ciclo de gamas se lee de izquierda a derecha y vuelve a empezar al final. La clave del
        plan no se cambia: los componentes la referencian.
      </p>
      {mensaje && <p className="nota">{mensaje}</p>}
      <div className="tabla-marco" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Clave</th>
              <th>Sistema</th>
              <th>Componente / modelo</th>
              <th className="num">Intervalo (h)</th>
              <th>Ciclo de gamas</th>
              <th className="num">Programar ≤ (días)</th>
              <th className="num">Verificar repuestos ≤ (días)</th>
              <th className="num">Base sin PM (h)</th>
              <th>Kits SAP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(planes ?? []).map((p) => (
              <tr key={p.clave}>
                <td>{p.clave}</td>
                <td>{p.sistema}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 220 }}>{p.componente_desc}</td>
                <td className="num">{p.intervalo_h}</td>
                <td>{p.ciclo_gamas.join(" - ")}</td>
                <td className="num">{p.dias_programar}</td>
                <td className="num">{p.dias_verificar}</td>
                <td className="num">{p.base_sin_pm ?? ""}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 220 }}>{p.kits_sap}</td>
                <td>
                  <button className="boton-plano" onClick={() => setEditando({ ...p })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 15 }}>Parámetros generales</h2>
      <div className="tabla-marco" style={{ maxWidth: 720 }}>
        <table>
          <tbody>
            {(parametros ?? [])
              .filter((p) => p.clave !== "fecha_referencia")
              .map((p) => (
                <tr key={p.clave}>
                  <td style={{ whiteSpace: "normal" }}>{p.descripcion ?? p.clave}</td>
                  <td className="num" style={{ width: 120 }}>
                    <input
                      style={{ width: 90, textAlign: "right" }}
                      defaultValue={p.valor ?? ""}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v) && v !== Number(p.valor))
                          guardarParam.mutate({ clave: p.clave, valor: v });
                      }}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditorPlan
          plan={editando}
          onCambio={setEditando}
          onGuardar={() => guardar.mutate(editando)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function EditorPlan({
  plan,
  onCambio,
  onGuardar,
  onCerrar,
}: {
  plan: PlanMp;
  onCambio: (p: PlanMp) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const [gamasTexto, setGamasTexto] = useState(plan.ciclo_gamas.join(", "));
  // Abierto como modal: con el atributo open el diálogo queda en el flujo de la
  // página, debajo de las tablas y fuera de la vista.
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
    >
      <h1 style={{ fontSize: 16 }}>Editar plan {plan.clave}</h1>
      <label className="campo">
        <span>Intervalo (h)</span>
        <input
          value={plan.intervalo_h}
          onChange={(e) => onCambio({ ...plan, intervalo_h: Number(e.target.value) || 0 })}
        />
      </label>
      <label className="campo">
        <span>Ciclo de gamas (separadas por coma, en orden)</span>
        <input
          value={gamasTexto}
          onChange={(e) => {
            setGamasTexto(e.target.value);
            const gamas = e.target.value
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => !isNaN(n) && n > 0);
            onCambio({ ...plan, ciclo_gamas: gamas });
          }}
        />
      </label>
      <div className="fila-campos">
        <label className="campo">
          <span>Programar ≤ (días)</span>
          <input
            value={plan.dias_programar}
            onChange={(e) => onCambio({ ...plan, dias_programar: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="campo">
          <span>Verificar repuestos ≤ (días)</span>
          <input
            value={plan.dias_verificar}
            onChange={(e) => onCambio({ ...plan, dias_verificar: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="campo">
          <span>Base sin PM (h)</span>
          <input
            value={plan.base_sin_pm ?? ""}
            onChange={(e) =>
              onCambio({ ...plan, base_sin_pm: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </label>
      </div>
      <label className="campo">
        <span>Kits SAP de overhaul</span>
        <input
          value={plan.kits_sap ?? ""}
          onChange={(e) => onCambio({ ...plan, kits_sap: e.target.value })}
        />
      </label>
      <label className="campo">
        <span>Observaciones</span>
        <textarea
          rows={2}
          value={plan.observaciones ?? ""}
          onChange={(e) => onCambio({ ...plan, observaciones: e.target.value })}
        />
      </label>
      <div className="barra-acciones" style={{ marginBottom: 0 }}>
        <div className="espacio" />
        <button className="boton-plano" onClick={onCerrar}>
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={plan.ciclo_gamas.length === 0}>
          Guardar
        </button>
      </div>
    </dialog>
  );
}
