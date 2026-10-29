import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { useEstadoConexion } from "../lib/conexion";
import { lecturasPendientes, marcarPendientes } from "../lib/pendientes";
import DialogoConfirmar from "./DialogoConfirmar";
import {
  IconoCalendario,
  IconoCamion,
  IconoGrafica,
  IconoHistorial,
  IconoLlave,
  IconoPlanilla,
  IconoReinicio,
  IconoTablero,
  IconoTemporizador,
  IconoUsuarios,
} from "./Iconos";
import logoApp from "../assets/logo-app.svg";

const enlaces = [
  { a: "/control", texto: "Control PM", icono: <IconoTablero />, captura: false },
  { a: "/rutina40", texto: "Rutina 40 h", icono: <IconoTemporizador />, captura: false },
  { a: "/graficas", texto: "Gráficas", icono: <IconoGrafica />, captura: false },
  { a: "/lecturas", texto: "Lecturas", icono: <IconoPlanilla />, captura: true },
  { a: "/registro-pm", texto: "Registro PM", icono: <IconoLlave />, captura: true },
  { a: "/cambios", texto: "Cambios horómetro", icono: <IconoReinicio />, captura: true },
  { a: "/historial", texto: "Historial", icono: <IconoHistorial />, captura: false },
];

const NOMBRE_ROL = { admin: "Administrador", capturador: "Capturador", invitado: "Invitado (solo consulta)" };

const enlacesAdmin = [
  { a: "/equipos", texto: "Equipos", icono: <IconoCamion /> },
  { a: "/plan", texto: "Plan MP", icono: <IconoCalendario /> },
  { a: "/usuarios", texto: "Usuarios", icono: <IconoUsuarios /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { perfil, esAdmin, puedeCapturar } = useAuth();
  const conexion = useEstadoConexion();
  const navegar = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);

  function alNavegar(e: React.MouseEvent, a: string) {
    if (lecturasPendientes() > 0) {
      e.preventDefault();
      setDestino(a);
    }
  }
  return (
    <div className="app">
      <aside className="menu">
        <div className="logo">
          <img className="logo-app" src={logoApp} alt="" />
          <div>
            <span className="logo-titulo">Preventivos</span>
            <span className="logo-sub">HEMCO · mantenimiento</span>
          </div>
        </div>
        <nav>
          {enlaces.filter((e) => puedeCapturar || !e.captura).map((e) => (
            <NavLink key={e.a} to={e.a} onClick={(ev) => alNavegar(ev, e.a)} className={({ isActive }) => (isActive ? "activo" : "")}>
              {e.icono}
              {e.texto}
            </NavLink>
          ))}
          {esAdmin && (
            <>
              <div className="menu-seccion">Administración</div>
              {enlacesAdmin.map((e) => (
                <NavLink key={e.a} to={e.a} onClick={(ev) => alNavegar(ev, e.a)} className={({ isActive }) => (isActive ? "activo" : "")}>
                  {e.icono}
                  {e.texto}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="menu-pie">
          <div className="usuario">
            <div>{perfil?.nombre ?? "…"}</div>
            <div className="usuario-rol">{perfil ? NOMBRE_ROL[perfil.rol] : ""}</div>
          </div>
          <button className="boton-plano" onClick={() => supabase().auth.signOut()}>
            Cerrar sesión
          </button>
          <div className="pie-estado">
            <span className={`punto-conexion ${conexion}`} />
            {conexion === "en_linea" ? "En línea" : conexion === "reconectando" ? "Reconectando…" : "Sin conexión"}
            <span className="pie-version">v{__APP_VERSION__}</span>
          </div>
        </div>
      </aside>
      <main className="contenido">{children}</main>
      {destino && (
        <DialogoConfirmar
          titulo="Hay lecturas sin grabar"
          texto={`Escribiste ${lecturasPendientes()} lectura(s) que todavía no se grabaron. Si sales de la pantalla se pierden.`}
          confirmar="Salir sin grabar"
          onRespuesta={(si) => {
            const a = destino;
            setDestino(null);
            if (si) {
              marcarPendientes(0);
              navegar(a);
            }
          }}
        />
      )}
    </div>
  );
}
