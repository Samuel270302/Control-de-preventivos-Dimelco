import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import {
  IconoCalendario,
  IconoCamion,
  IconoHistorial,
  IconoLlave,
  IconoPlanilla,
  IconoReinicio,
  IconoTablero,
  IconoTemporizador,
  IconoUsuarios,
} from "./Iconos";
import logoClaro from "../assets/logo-dimelco-claro.png";

const enlaces = [
  { a: "/control", texto: "Control PM", icono: <IconoTablero />, captura: false },
  { a: "/rutina40", texto: "Rutina 40 h", icono: <IconoTemporizador />, captura: false },
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
  return (
    <div className="app">
      <aside className="menu">
        <div className="logo">
          <img className="logo-marca" src={logoClaro} alt="Dimelco" />
          <span className="logo-titulo">Preventivos</span>
          <span className="logo-sub">HEMCO · mantenimiento</span>
        </div>
        <nav>
          {enlaces.filter((e) => puedeCapturar || !e.captura).map((e) => (
            <NavLink key={e.a} to={e.a} className={({ isActive }) => (isActive ? "activo" : "")}>
              {e.icono}
              {e.texto}
            </NavLink>
          ))}
          {esAdmin && (
            <>
              <div className="menu-seccion">Administración</div>
              {enlacesAdmin.map((e) => (
                <NavLink key={e.a} to={e.a} className={({ isActive }) => (isActive ? "activo" : "")}>
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
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
