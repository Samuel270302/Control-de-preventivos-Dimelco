import ExcelJS from "exceljs";
import type { ControlFila, LecturaCalc, RegistroPm } from "./types";
import { fFecha } from "./fmt";

interface AppEscritorio {
  guardarArchivo?: (datos: Uint8Array, nombre: string) => Promise<string | null>;
}

async function descargar(buf: ArrayBuffer, nombre: string) {
  const escritorio = (window as unknown as { appInfo?: AppEscritorio }).appInfo;
  if (escritorio?.guardarArchivo) {
    await escritorio.guardarArchivo(new Uint8Array(buf), nombre);
    return;
  }
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const COLOR_ESTADO: Record<string, string> = {
  "🔴 Vencido": "FFFFC7CE",
  "📅 Programar": "FFBDD7EE",
  "🔧 Verificar repuestos": "FFFFE699",
  "🟢 Normal": "FFC6EFCE",
};

export interface ColumnaExcel {
  etiqueta: string;
  valor: (f: ControlFila) => string | number | null;
  ancho: number;
  esEstado?: boolean;
}

// Las columnas llegan ya filtradas y ordenadas como las definió el administrador.
export async function exportarControl(
  filas: ControlFila[],
  titulo: string,
  nombreArchivo: string,
  columnas: ColumnaExcel[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titulo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  ws.columns = columnas.map((c) => ({ header: c.etiqueta, width: c.ancho }));
  ws.getRow(1).font = { bold: true };
  const colEstado = columnas.findIndex((c) => c.esEstado) + 1;
  for (const f of filas) {
    const fila = ws.addRow(columnas.map((c) => c.valor(f)));
    const color = COLOR_ESTADO[f.estado];
    if (colEstado > 0 && color) {
      fila.getCell(colEstado).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      fila.getCell(colEstado).font = { color: { argb: "FF1F1F1F" } };
    }
  }
  await descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}

export async function exportarLecturas(
  filas: (LecturaCalc & { equipo: string; tipo: string })[],
  nombreArchivo: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lecturas");
  ws.columns = [
    { header: "Fecha", width: 12 },
    { header: "Equipo", width: 16 },
    { header: "Turno", width: 8 },
    { header: "Tipo de Horómetro", width: 16 },
    { header: "Lectura", width: 11 },
    { header: "Acumulado", width: 11 },
    { header: "Horas del Intervalo", width: 11 },
    { header: "Control", width: 26 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const f of filas)
    ws.addRow([
      fFecha(f.fecha),
      f.equipo,
      f.turno,
      f.tipo,
      f.lectura,
      f.lectura_acum,
      f.horas_intervalo,
      f.control,
    ]);
  await descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}

export async function exportarRegistrosPm(
  filas: (RegistroPm & { equipo: string; tipo: string; clase: string })[],
  nombreArchivo: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Registro PM");
  ws.columns = [
    { header: "Fecha", width: 12 },
    { header: "Equipo", width: 16 },
    { header: "Tipo de Horómetro", width: 16 },
    { header: "Gama", width: 8 },
    { header: "Lectura", width: 11 },
    { header: "Clase", width: 12 },
    { header: "Responsable", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const f of filas)
    ws.addRow([fFecha(f.fecha), f.equipo, f.tipo, f.gama, f.lectura, f.clase, f.responsable]);
  await descargar(await wb.xlsx.writeBuffer(), nombreArchivo);
}
