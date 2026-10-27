// Validación de lecturas en vivo: la misma lógica de la columna Control
// del libro (y de la vista v_lecturas), para avisar antes de grabar.
import type { LecturaCalc, Turno } from "./types";

export interface ParamsValidacion {
  maxHorasTurno: number; // 12
  umbralCambio: number; // 2
  huecoTurnos: number; // 14
}

export function nTurno(fecha: string, turno: Turno): number {
  const base = new Date("2000-01-01T00:00:00Z").getTime();
  const f = new Date(fecha + "T00:00:00Z").getTime();
  const dias = Math.round((f - base) / 86400000);
  return dias * 2 + (turno === "Noche" ? 1 : 0);
}

export interface ResultadoValidacion {
  control: string;
  nivel: "ok" | "aviso" | "error";
}

export function validarLectura(
  fecha: string,
  turno: Turno,
  lectura: number,
  previas: LecturaCalc[], // lecturas del mismo componente
  p: ParamsValidacion
): ResultadoValidacion {
  const nt = nTurno(fecha, turno);
  if (previas.some((l) => l.num_turno === nt))
    return { control: "Duplicado: ya hay lectura de ese turno", nivel: "error" };
  const anteriores = previas.filter((l) => l.num_turno < nt);
  if (anteriores.length === 0) return { control: "Primer registro", nivel: "aviso" };
  const prev = anteriores.reduce((a, b) => (a.num_turno > b.num_turno ? a : b));
  const turnos = nt - prev.num_turno;
  const horas =
    lectura >= prev.lectura
      ? lectura - prev.lectura
      : prev.lectura - lectura <= p.umbralCambio
        ? 0
        : lectura;
  if (horas > turnos * p.maxHorasTurno)
    return {
      control: `Horas imposibles: ${horas.toFixed(1)} h en ${turnos} turno(s)`,
      nivel: "error",
    };
  if (lectura < prev.lectura && prev.lectura - lectura <= p.umbralCambio)
    return { control: "Lectura menor a la anterior (validar)", nivel: "aviso" };
  if (lectura < prev.lectura)
    return {
      control: "Cambio de horómetro (validar): registre el offset en Cambios de horómetro",
      nivel: "aviso",
    };
  if (turnos > p.huecoTurnos)
    return { control: `Hueco de ${Math.round(turnos / 2)} día(s) sin lectura`, nivel: "aviso" };
  return { control: "OK", nivel: "ok" };
}
