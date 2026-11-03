#!/usr/bin/env python3
"""Exporta tablas y vistas de la base local a JSON para probar la interfaz sin Supabase."""
import datetime as dt
import decimal
import json
import os
import sys

import psycopg2
import psycopg2.extras

DSN_LOCAL = "host=/home/user/.pgrun port=5433 user=dev dbname=hemco"
SALIDA = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures"

CONSULTAS = {
    "v_control_pm": "select * from v_control_pm",
    "v_control_40": "select * from v_control_40",
    "equipos": "select * from equipos order by cod_interno",
    "componentes": "select * from componentes",
    "planes_mp": "select * from planes_mp order by orden",
    "cambios_horometro": "select * from cambios_horometro order by vigente_desde",
    "v_lecturas": "select * from v_lecturas order by num_turno desc limit 1500",
    "registros_pm": "select * from registros_pm where not anulado order by fecha desc limit 300",
    "parametros": "select * from parametros",
    "columnas_control": "select * from columnas_control order by orden",
    "v_registros_pm": "select * from v_registros_pm order by fecha",
    "v_cumplimiento_pm": "select * from v_cumplimiento_pm order by fecha",
    "v_utilizacion_mensual": "select * from v_utilizacion_mensual order by mes",
    "unidades": "select * from unidades order by orden",
    "v_ultima_lectura": "select * from v_ultima_lectura",
}


def plano(v):
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, list):
        return [plano(x) for x in v]
    return v


def main():
    os.makedirs(SALIDA, exist_ok=True)
    con = psycopg2.connect(os.environ.get("DATABASE_URL", DSN_LOCAL))
    cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    for nombre, sql in CONSULTAS.items():
        cur.execute(sql)
        filas = [{k: plano(v) for k, v in r.items()} for r in cur.fetchall()]
        with open(f"{SALIDA}/{nombre}.json", "w") as f:
            json.dump(filas, f, ensure_ascii=False)
        print(nombre, len(filas))
    # Perfil de prueba para la sesión simulada
    with open(f"{SALIDA}/perfiles.json", "w") as f:
        json.dump(
            [{
                "user_id": "00000000-0000-0000-0000-000000000001",
                "nombre": "Samuel Zapata",
                "correo": "demo@hemco.local",
                "rol": "admin",
                "activo": True,
                "unidad_id": None,
            }],
            f, ensure_ascii=False)
    print("perfiles 1")


if __name__ == "__main__":
    main()
