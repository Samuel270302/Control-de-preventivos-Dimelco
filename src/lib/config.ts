// Conexión a Supabase por equipo: se captura una vez en la pantalla de
// configuración y queda guardada en este PC (localStorage del app).
export interface ConexionConfig {
  url: string;
  anonKey: string;
}

const CLAVE = "preventivos.conexion";

export function leerConexion(): ConexionConfig | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const cfg = JSON.parse(crudo) as ConexionConfig;
    if (!cfg.url || !cfg.anonKey) return null;
    return cfg;
  } catch {
    return null;
  }
}

export function guardarConexion(cfg: ConexionConfig) {
  localStorage.setItem(CLAVE, JSON.stringify(cfg));
}

export function borrarConexion() {
  localStorage.removeItem(CLAVE);
}
