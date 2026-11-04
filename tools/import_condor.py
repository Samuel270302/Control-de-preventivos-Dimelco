#!/usr/bin/env python3
"""Genera el SQL que carga en Mina La India las lecturas y los PM diésel del libro
"Registro de tiempos de paro - Condor GOLD Indicadores".

Carga sobre el equipo que ya existe en la app (P03 del libro = "Perf - 03"):
  - plan DIESEL-LI (250-500-750-1000, avisos a 10 y 28 días) asignado al horómetro Diesel;
  - horómetro de percusión "Perforadora" (Percusión #1, sin plan) si no existe;
  - lecturas de la hoja Horometros (Diesel y Percusión), salvo las de EXCLUIR;
  - PM diésel tomados de la hoja Registro de Paros (PM_DIESEL).
Vuelve a cargar desde cero lo importado antes (origen 'import' y responsable RESPONSABLE),
sin tocar lo capturado en la app.

Uso:
    python3 -I tools/import_condor.py <libro.xlsx> > condor.sql
"""
import datetime as dt
import sys

import openpyxl

UNIDAD = "Mina La India"
EQUIPOS = {"P03": "Perf - 03"}
RESPONSABLE = "Registro de paros Condor GOLD"
# Percusión del 27/10 y 28/10 en 526.5 h: menor que la del 25/10 y 26/10 (527.2 h).
EXCLUIR = {("P03", "Percusión", dt.date(2026, 10, 27), "Dia"), ("P03", "Percusión", dt.date(2026, 10, 28), "Dia")}
# PM diésel del Registro de Paros: (fecha, gama, H. Diesel inicial del turno)
PM_DIESEL = {
    "P03": [
        (dt.date(2026, 7, 8), 500, 685.5),
        (dt.date(2026, 7, 23), 750, 822.6),
        (dt.date(2026, 8, 12), 1000, 1025.5),
        (dt.date(2026, 9, 8), 250, 1391.6),
        (dt.date(2026, 9, 29), 500, 1651.0),
    ]
}
TIPOS = {"diesel": "Diesel", "percusión": "Percusión #1", "percusion": "Percusión #1"}


def q(v):
    return "'" + str(v).replace("'", "''") + "'"


def main():
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True, read_only=True)
    lecturas, excluidas, vistas = [], 0, set()
    for f in wb["Horometros"].iter_rows(min_row=2, max_col=5, values_only=True):
        if f[0] is None:
            continue
        cod, turno, tipo = str(f[1]).strip().upper(), str(f[2]).strip().capitalize(), str(f[3]).strip()
        fecha = f[0].date() if isinstance(f[0], dt.datetime) else f[0]
        if cod not in EQUIPOS:
            raise SystemExit(f"Equipo {cod} sin equivalente en la app")
        if (cod, tipo, fecha, turno) in EXCLUIR:
            excluidas += 1
            continue
        clave = (cod, TIPOS[tipo.lower()], fecha, turno)
        if clave in vistas:
            raise SystemExit(f"Lectura duplicada {clave}")
        vistas.add(clave)
        lecturas.append((*clave, float(f[4])))

    eq = lambda cod: (f"(select e.id from equipos e join unidades u on u.id = e.unidad_id "
                      f"where u.nombre = {q(UNIDAD)} and e.cod_interno = {q(EQUIPOS[cod])})")
    comp = lambda cod, tipo: f"(select id from componentes where equipo_id = {eq(cod)} and tipo_horometro = {q(tipo)})"

    out = [f"-- {len(lecturas)} lecturas ({excluidas} excluidas) y "
           f"{sum(len(v) for v in PM_DIESEL.values())} PM diésel de {UNIDAD}\n", "begin;\n"]
    out.append("""insert into planes_mp (clave, sistema, componente_desc, aplica_a, tipo_horometro_desc, intervalo_h,
  ciclo_gamas, dias_programar, dias_verificar, observaciones, orden)
values ('DIESEL-LI', 'Motor Diésel', 'Furukawa L100 (Mina La India)', 'Mina La India', 'Horómetro motor diésel', 250,
  array[250,500,750,1000]::numeric[], 10, 28, 'Ciclo de los PM del Registro de Paros Condor GOLD',
  (select coalesce(max(orden), 0) + 1 from planes_mp))
on conflict (clave) do nothing;
""")
    for cod in EQUIPOS:
        out.append(f"""do $$ begin
  if {eq(cod)} is null then raise exception 'No existe el equipo {EQUIPOS[cod]} en {UNIDAD}'; end if;
end $$;
update componentes set plan_clave = 'DIESEL-LI' where id = {comp(cod, 'Diesel')};
insert into componentes (equipo_id, tipo_horometro, nombre, sistema, seccion, plan_clave)
select {eq(cod)}, 'Percusión #1', 'Perforadora', 'Perforadora', 3, null
where not exists (select 1 from componentes where equipo_id = {eq(cod)} and tipo_horometro = 'Percusión #1');
delete from lecturas where origen = 'import' and componente_id in (select id from componentes where equipo_id = {eq(cod)});
delete from registros_pm where responsable = {q(RESPONSABLE)} and componente_id in (select id from componentes where equipo_id = {eq(cod)});
""")
    out.append("alter table lecturas disable trigger validar_lectura;\n"
               "alter table registros_pm disable trigger validar_registro_pm;\n")
    for cod in EQUIPOS:
        for tipo in ("Diesel", "Percusión #1"):
            filas = [x for x in lecturas if x[0] == cod and x[1] == tipo]
            out.append(f"insert into lecturas (componente_id, fecha, turno, lectura, origen)\n"
                       f"select {comp(cod, tipo)}, v.fecha::date, v.turno, v.lectura, 'import' from (values\n" +
                       ",\n".join(f"  ('{d.isoformat()}', '{t}', {l})" for _, _, d, t, l in filas) +
                       "\n) as v(fecha, turno, lectura);\n")
        for d, gama, lect in PM_DIESEL.get(cod, []):
            out.append(f"insert into registros_pm (componente_id, fecha, gama, lectura, responsable) values "
                       f"({comp(cod, 'Diesel')}, '{d.isoformat()}', {gama}, {lect}, {q(RESPONSABLE)});\n")
    out.append("alter table lecturas enable trigger validar_lectura;\n"
               "alter table registros_pm enable trigger validar_registro_pm;\n"
               "commit;\n")
    print("".join(out))


if __name__ == "__main__":
    main()
