// Genera la Guía de usuario para capturadores (app 0.4.0) con capturas de pantalla.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, ShadingType, PageBreak, Footer,
  PageNumber, TableOfContents, VerticalAlign,
} = require("docx");

const DIR = __dirname;
const IMG = path.join(DIR, "img");
const SALIDA = process.argv[2] ?? path.join(DIR, "Guia_capturadores.docx");
const LOGO = "/home/user/preventivos-hemco/docs/logo/icono_A_horometro_256.png";

const OSCURO = "1C1C1C";
const AMBAR = "B07800";
const GRIS = "6D6D6D";
const ANCHO_TEXTO = 9360; // 6.5" en DXA (carta con márgenes de 1")
const ANCHO_PX = 624; // 6.5" a 96 ppp

let nFigura = 0;
let nLista = 0;

const p = (texto, opts = {}) =>
  new Paragraph({ spacing: { after: 120, line: 276 }, ...opts, children: [].concat(texto).map((t) => (typeof t === "string" ? new TextRun(t) : t)) });
const n = (t) => new TextRun({ text: t, bold: true });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });

function pasos(lista) {
  nLista += 1;
  return lista.map((t) =>
    new Paragraph({
      numbering: { reference: "pasos", level: 0, instance: nLista },
      spacing: { after: 80, line: 276 },
      children: [].concat(t).map((x) => (typeof x === "string" ? new TextRun(x) : x)),
    })
  );
}
const vinetas = (lista) =>
  lista.map((t) =>
    new Paragraph({
      numbering: { reference: "vinetas", level: 0 },
      spacing: { after: 80, line: 276 },
      children: [].concat(t).map((x) => (typeof x === "string" ? new TextRun(x) : x)),
    })
  );

function figura(archivo, pie, anchoPx = 540) {
  const ruta = path.join(IMG, archivo);
  const buf = fs.readFileSync(ruta);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const ancho = Math.min(anchoPx, ANCHO_PX);
  const alto = Math.round((h * ancho) / w);
  nFigura += 1;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      keepNext: true,
      children: [new ImageRun({ type: "png", data: buf, transformation: { width: ancho, height: alto },
        altText: { title: `Figura ${nFigura}`, description: pie, name: archivo } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Figura ${nFigura}. ${pie}`, italics: true, size: 18, color: GRIS })],
    }),
  ];
}

const borde = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D6" };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

function tabla(encabezados, filas, anchos) {
  const celda = (texto, cab, i) =>
    new TableCell({
      borders: bordes,
      width: { size: anchos[i], type: WidthType.DXA },
      shading: cab ? { fill: "252525", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: [new Paragraph({ spacing: { after: 0 },
        children: [new TextRun({ text: texto, bold: cab, color: cab ? "FFFFFF" : undefined, size: 20 })] })],
    });
  return new Table({
    width: { size: anchos.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: encabezados.map((t, i) => celda(t, true, i)) }),
      ...filas.map((f) => new TableRow({ children: f.map((t, i) => celda(t, false, i)) })),
    ],
  });
}

function recuadro(textos) {
  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [ANCHO_TEXTO],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: ANCHO_TEXTO, type: WidthType.DXA },
      shading: { fill: "FFF4CC", type: ShadingType.CLEAR, color: "auto" },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 24, color: "F5B301" } },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: textos.map((t, i) => new Paragraph({ spacing: { after: i === textos.length - 1 ? 0 : 100, line: 276 },
        children: [].concat(t).map((x) => (typeof x === "string" ? new TextRun(x) : x)) })),
    })] })],
  });
}
const espacio = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------------------------------------------------------------- contenido
const portada = [
  new Paragraph({ spacing: { before: 1800, after: 300 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(LOGO),
    transformation: { width: 110, height: 110 }, altText: { title: "Logo", description: "Logo de Preventivos HEMCO", name: "logo" } })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Preventivos HEMCO", bold: true, size: 56, color: OSCURO })] }),
  new Paragraph({ spacing: { after: 400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "F5B301", space: 8 } },
    children: [new TextRun({ text: "Guía de usuario para capturadores", size: 34, color: AMBAR })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Versión de la guía: 2.0", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Versión de la app: 0.4.0", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Fecha: 29/10/2026", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text:
    "Las capturas de pantalla se tomaron con la cuenta de capturador Planeador Martha 850 y datos de prueba al 22/10/2026. Las cifras de tu pantalla serán las de la flota del día.",
    size: 20, color: GRIS, italics: true })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Contenido", bold: true, size: 32, color: OSCURO })] }),
  ...[
    "1. Qué es la app y qué hace un capturador",
    "2. Entrar a la app",
    "3. Capturar lecturas de horómetro (cada turno)",
    "4. Registrar un mantenimiento ejecutado",
    "5. Cambio o reinicio de horómetro",
    "6. Pantallas de consulta",
    "7. Tu cuenta y las actualizaciones",
  ].map((t) => new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: t, size: 24 })] })),
];

const cuerpo = [
  // 1
  h1("1. Qué es la app y qué hace un capturador"),
  p("Preventivos HEMCO reemplaza el libro de Excel de registro de horómetros. La base de datos está en línea: lo que grabas en tu PC lo ven los demás usuarios en segundos, sin refrescar."),
  p("Como capturador tienes tres tareas: capturar las lecturas de horómetro al cierre de cada turno, registrar los mantenimientos ejecutados y registrar los cambios o reinicios de horómetro. Además puedes consultar todas las pantallas de control, el programa de las próximas 4 semanas, los indicadores y el historial, y exportarlos a Excel."),
  p("Antes de guardar, la app revisa cada dato contra lo que ya está grabado. Si algo no cuadra, avisa o no deja grabar, y explica por qué."),
  h2("1.1 La regla de oro"),
  recuadro([
    [n("En lecturas y en registros de PM siempre se escribe lo que marca el contador en ese momento, nunca horas acumuladas.")],
    "El acumulado lo calcula la app con los cambios de horómetro registrados. Si escribes un acumulado donde va un contador, la app lo rechaza como horas imposibles o como una baja sin cambio registrado.",
  ]),

  // 2
  h1("2. Entrar a la app"),
  ...pasos([
    "Abre Preventivos HEMCO desde el acceso directo del escritorio.",
    ["Escribe tu correo de usuario completo (por ejemplo, planeador.martha@grupodimelco.com) y tu contraseña. El administrador te entrega la contraseña inicial."],
    ["Haz clic en ", n("Entrar"), ". La primera pantalla es el Control PM."],
  ]),
  ...figura("01_entrada_c.png", "Pantalla de entrada.", 300),
  p("El botón Cambiar conexión a la base no se usa en el día a día. Solo se toca si el administrador lo indica."),
  p("Si la cuenta todavía no está activa, la app muestra Acceso pendiente de activación. En ese caso pídele al administrador que la active."),
  h2("2.1 El menú"),
  new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [2600, 6760],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        children: figura("21_menu_c.png", "Menú del capturador.", 150) }),
      new TableCell({ width: { size: 6760, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        margins: { left: 200 },
        children: [
          p("El menú de la izquierda tiene dos grupos."),
          p("Para consultar: Control PM, Rutina 40 h, Gráficas, Programa 4 semanas, Indicadores e Historial."),
          p("Para capturar: Lecturas, Registro PM y Cambios horómetro."),
          p("Al pie están tu nombre y tu rol, los botones Cambiar contraseña y Cerrar sesión, el estado de la conexión y la versión instalada (v0.4.0)."),
          p("Las opciones Equipos, Plan MP y Usuarios son del administrador y no aparecen en tu menú."),
        ] }),
    ] })],
  }),
  h2("2.2 Estado de la conexión"),
  p("El punto al pie del menú indica si la app está conectada a la base."),
  tabla(["Estado", "Qué significa"], [
    ["En línea (verde)", "Conectada. Lo que grabas llega a la base y ves lo que graban los demás."],
    ["Reconectando…", "Se cortó el canal de avisos en tiempo real y la app lo está recuperando. Espera unos segundos antes de grabar."],
    ["Sin conexión", "El PC no tiene red. No grabes hasta que vuelva; lo ya grabado no se pierde."],
  ], [2400, 6960]),

  // 3
  h1("3. Capturar lecturas de horómetro (cada turno)"),
  p("La pantalla Lecturas muestra toda la flota, un renglón por horómetro, con la última lectura grabada y su fecha y turno."),
  ...figura("10_lecturas.png", "Pantalla Lecturas antes de escribir."),
  ...pasos([
    ["Entra a ", n("Lecturas"), "."],
    "Arriba elige la fecha y el turno (Dia o Noche) de las lecturas que vas a capturar.",
    ["Escribe en la columna ", n("Nueva lectura"), " lo que marca el contador de cada equipo que trabajó. Deja vacíos los que no tienen lectura."],
    "Con la tecla Enter pasas a la casilla siguiente. Los renglones con valor quedan resaltados en amarillo.",
    ["Mira la columna ", n("Control"), ": la app valida cada lectura contra la base mientras escribes. Mientras consulta aparece Validando…"],
    ["Cuando termines la pasada, haz clic en ", n("Grabar lecturas"), ". Se graban todas juntas y aparece el aviso con la cantidad grabada."],
  ]),
  ...figura("11_lecturas_control.png", "Resultado del control mientras se escribe: dos lecturas OK, una baja de 1 h que solo avisa y una baja de 60 h que no se puede grabar."),
  h2("3.1 Qué significa cada mensaje de Control"),
  p("Los mensajes en verde o naranja permiten grabar. Los mensajes en rojo bloquean la grabación de toda la pasada hasta que corrijas o borres ese valor."),
  tabla(["Mensaje", "Se puede grabar", "Qué hacer"], [
    ["OK", "Sí", "Nada. La lectura es coherente con la anterior."],
    ["Primer registro", "Sí", "Normal cuando ese horómetro nunca se había capturado."],
    ["Lectura menor a la anterior (validar)", "Sí", "Bajó 2 h o menos. Casi siempre es un error de digitación: revisa contra el parte físico antes de grabar."],
    ["Hueco de N día(s) sin lectura", "Sí", "Pasaron más de 7 días desde la última lectura de ese horómetro. Es solo un aviso."],
    ["Duplicado: ya hay lectura de ese turno", "No", "Ese horómetro ya tiene lectura en esa fecha y turno. Revisa la fecha y el turno elegidos arriba."],
    ["Lectura N h menor que la anterior (…). Si se cambió o reinició el horómetro, registre primero el cambio en Cambios horómetro.", "No", "Bajó más de 2 h. Si fue un error, corrige el valor. Si el contador se cambió o volvió a cero, registra primero el cambio (capítulo 5) y vuelve a escribir la lectura."],
    ["Horas imposibles: N h en M turno(s)…", "No", "La lectura suma más de 12 h por turno desde la anterior. Revisa si escribiste un acumulado o un dígito de más."],
    ["Lectura mayor que la lectura posterior del …", "No", "Estás cargando una lectura atrasada y queda por encima de una lectura posterior ya grabada. Revisa el valor o la fecha."],
    ["Horas imposibles hasta la lectura del …", "No", "La lectura atrasada deja más de 12 h por turno hasta la lectura posterior. Revisa el valor o la fecha."],
    ["No se pudo validar: revise la conexión", "Sí, con cuidado", "La app no logró consultar la base. Al grabar, la base vuelve a aplicar el control y rechaza lo que no cumpla."],
  ], [3700, 1300, 4360]),
  espacio(),
  p("Si haces clic en Grabar lecturas con un error en pantalla, la app no graba nada y muestra un aviso rojo con el equipo y el motivo."),
  ...figura("12_lecturas_rechazo.png", "Aviso al intentar grabar con una lectura rechazada."),
  h2("3.2 Salir con lecturas sin grabar"),
  p("Si cambias de pantalla o cierras la app con valores escritos y sin grabar, la app pregunta antes de salir. Seguir capturando te deja en la pantalla con todo lo escrito. Salir sin grabar descarta esos valores."),
  ...figura("13_lecturas_salir_c.png", "Aviso de lecturas sin grabar.", 460),

  // 4
  h1("4. Registrar un mantenimiento ejecutado"),
  ...figura("14_registro_pm.png", "Pantalla Registro PM con un PM listo para grabar."),
  ...pasos([
    ["Entra a ", n("Registro PM"), "."],
    "Elige la fecha de ejecución y el equipo, y escribe el responsable (técnico o empresa).",
    "Elige el componente intervenido y la gama ejecutada.",
    ["Escribe en ", n("Lectura del contador"), " lo que marcaba el contador de ese componente al hacer el PM. Debajo aparece el último contador grabado como referencia."],
    ["Si el mismo PM intervino otro componente (por ejemplo motor y perforadora), haz clic en ", n("+ Otro componente del mismo PM"), " y llena el renglón nuevo con su propia lectura."],
    ["Haz clic en ", n("Grabar PM"), "."],
  ]),
  p("La app revisa la lectura del PM contra las lecturas de horómetro grabadas. Si queda por debajo de la última lectura o deja horas imposibles, muestra el motivo en rojo y el botón Grabar PM queda desactivado."),
  ...figura("15_registro_pm_rechazo.png", "PM rechazado: la lectura es menor que la última lectura de horómetro."),
  ...vinetas([
    "La gama 40 es la rutina de percusión de 40 h. Alimenta el control de Rutina 40 h y no mueve la meta del PM mayor.",
    "Si no sabes la gama, elige Sin gama. El Control PM marcará Validar gama hasta que el administrador la corrija.",
    "Si te equivocas en un PM ya grabado, avísale al administrador. Solo él puede anularlo, y siempre con un motivo.",
  ]),

  // 5
  h1("5. Cambio o reinicio de horómetro"),
  p("Cuando un contador vuelve a cero o lo reemplazan, se registra el offset: las horas que se suman al contador nuevo para obtener el acumulado real."),
  recuadro([
    [n("Primero se registra el cambio y después se captura la lectura del contador nuevo.")],
    "Si capturas primero la lectura, la app la rechaza como una baja de horas. Con el cambio registrado, la misma lectura pasa sola.",
  ]),
  espacio(),
  ...figura("16_cambios.png", "Pantalla Cambios horómetro con un cambio listo para registrar."),
  ...pasos([
    ["Entra a ", n("Cambios horómetro"), "."],
    "Elige el componente (equipo y tipo de horómetro).",
    ["En ", n("Vigente desde"), " pon la fecha de la primera lectura del contador nuevo."],
    "Escribe la última lectura del contador viejo y la lectura inicial del contador nuevo (0 si arrancó en cero).",
    ["En ", n("Fuente / verificación"), " anota de dónde sale el dato, por ejemplo la orden de trabajo."],
    ["Revisa el ", n("Offset propuesto"), " (offset previo + última lectura vieja − lectura inicial nueva) y haz clic en ", n("Registrar cambio"), "."],
  ]),
  p("El cambio queda Por validar hasta que el administrador lo revisa. Mientras tanto ya rige para el cálculo y puedes capturar las lecturas del contador nuevo."),

  // 6
  h1("6. Pantallas de consulta"),
  h2("6.1 Control PM"),
  p("Es el tablero principal del PM mayor por horómetro. Tiene una pestaña por sistema (Motor diésel, Compresor, Perforadoras y empernadoras) y una fila por componente."),
  ...figura("02_control_pm.png", "Control PM, pestaña Motor diésel."),
  p("Los cuadros de arriba cuentan los componentes por estado. Al hacer clic en uno, la tabla muestra solo ese estado; otro clic quita el filtro."),
  tabla(["Estado", "Qué significa"], [
    ["Vencido", "El horómetro ya pasó la meta del próximo PM."],
    ["Programar", "Faltan pocos días para la meta según la tendencia de uso (motor diésel y compresor: 10 días o menos)."],
    ["Verificar repuestos", "La meta se acerca (motor diésel y compresor: 28 días o menos). Es momento de revisar repuestos."],
    ["Normal", "La meta está lejos."],
    ["Sin datos", "Falta un PM registrado, lecturas o tendencia para proyectar."],
  ], [2400, 6960]),
  espacio(),
  ...figura("03_control_filtro.png", "Control PM filtrado por Vencidos."),
  ...vinetas([
    "Clic en el encabezado de una columna ordena la tabla; otro clic invierte el orden. Quitar filtros vuelve al orden original.",
    "El buscador filtra por equipo, componente o modelo.",
    "Clic en el nombre de un equipo abre su ficha (sección 6.6).",
    "Exportar a Excel guarda la tabla visible. Reporte semanal (PDF) genera el reporte para imprimir o enviar.",
    "La columna Equipo queda fija al desplazarte a la derecha. Pasa el mouse sobre una observación para leerla completa.",
  ]),
  h2("6.2 Rutina 40 h"),
  p("Muestra la rutina de percusión de 40 h, una fila por brazo de perforadora o empernadora. Cualquier PM del brazo reinicia el conteo. Funciona igual que el Control PM."),
  ...figura("04_rutina40.png", "Rutina de percusión 40 h."),
  h2("6.3 Gráficas"),
  p("Muestra la evolución del horómetro acumulado de cada componente en los últimos 30 días. La línea roja punteada es la meta del próximo PM y el rombo marca un PM ejecutado. Al pasar el mouse sobre la línea ves la lectura de ese turno. El botón Tabla muestra los mismos datos en números."),
  ...figura("05_graficas.png", "Gráficas de evolución de horómetros."),
  h2("6.4 Programa 4 semanas"),
  p("Lista los PM mayores y las rutinas de 40 h que caen en las próximas 4 semanas según su fecha estimada, desde el lunes de la semana actual. Los vencidos van arriba, ordenados del más atrasado al menos atrasado. El selector de sistema filtra la lista y Exportar a Excel la guarda."),
  ...figura("06_programa_lista.png", "Programa 4 semanas en vista Lista."),
  p("La vista Calendario muestra cada PM en su día, de lunes a domingo. Las tarjetas con borde punteado son rutinas de 40 h. El día de hoy tiene marco amarillo. Al pasar el mouse sobre una tarjeta ves el componente y las horas faltantes."),
  ...figura("07_programa_calendario.png", "Programa 4 semanas en vista Calendario."),
  h2("6.5 Indicadores"),
  p("Resume la gestión del preventivo. Los cuatro cuadros de arriba son:"),
  ...vinetas([
    "Cumplimiento del plan de los últimos 3 meses: porcentaje de PM mayores ejecutados antes de pasar su meta de horas.",
    "Atraso de los PM vencidos abiertos: suma de las horas que llevan pasadas de su meta los componentes vencidos.",
    "Utilización media del mes: horas por día promedio de los componentes con lecturas en el mes.",
    "Lecturas al día: porcentaje de componentes con lectura de los últimos 2 días.",
  ]),
  p("Debajo están la gráfica de cumplimiento por mes, el cumplimiento por sistema, los PM ejecutados después de la meta, los PM vencidos abiertos, la utilización por componente y mes, y la lista de componentes con más de 2 días sin lectura. Esa última lista sirve para revisar qué equipos faltan en la pasada de lecturas."),
  ...figura("08_indicadores.png", "Indicadores de gestión."),
  h2("6.6 Ficha de equipo"),
  p("Al hacer clic en el nombre de un equipo en Control PM, Rutina 40 h, Gráficas, Programa o Indicadores, se abre su ficha. Reúne en una sola pantalla el estado de cada componente, la rutina de 40 h, la gráfica de 30 días, los últimos mantenimientos y las últimas lecturas."),
  ...figura("09_ficha_equipo.png", "Ficha del Boomer #1."),
  h2("6.7 Historial"),
  p("Muestra las lecturas y los registros de PM con filtros por equipo y rango de fechas. La columna Capturado por indica quién grabó cada dato; al pasar el mouse ves la fecha y hora de grabación. Lo cargado desde el libro de Excel aparece como Importado del Excel. Exportar a Excel guarda lo que estás viendo."),
  ...figura("17_historial.png", "Historial de lecturas."),
  p("La casilla Ver anulados muestra los registros que el administrador anuló, con quién los anuló, cuándo y el motivo."),
  ...figura("18_historial_anulados.png", "Historial con Ver anulados."),

  // 7
  h1("7. Tu cuenta y las actualizaciones"),
  h2("7.1 Cambiar tu contraseña"),
  ...pasos([
    ["Haz clic en ", n("Cambiar contraseña"), " al pie del menú."],
    "Escribe la contraseña nueva dos veces. Debe tener al menos 8 caracteres.",
    ["Haz clic en ", n("Cambiar"), ". La app confirma con un aviso verde."],
  ]),
  ...figura("19_cambiar_contrasena_c.png", "Cambio de contraseña.", 380),
  p("Si olvidas tu contraseña, pídele al administrador que la restablezca desde su pantalla de Usuarios. No compartas tu cuenta: cada dato queda registrado a nombre de quien lo grabó."),
  h2("7.2 Actualizaciones de la app"),
  p("Desde la versión 0.4.0 la app busca versiones nuevas al abrir y cada 4 horas, y las descarga sola. Cuando una versión está lista, aparece esta franja arriba de la pantalla:"),
  ...figura("20_actualizacion.png", "Aviso de versión nueva descargada."),
  p("Reiniciar y actualizar cierra la app, instala la versión y la vuelve a abrir. Si prefieres terminar lo que estás haciendo, la versión se instala sola la próxima vez que cierres la app. Graba tus lecturas antes de reiniciar."),
  h2("7.3 Lo que no hace tu usuario"),
  p("El maestro de equipos, el plan de mantenimiento, los usuarios, la validación de cambios de horómetro y la anulación de registros son del administrador. Si una pauta cambió, un equipo entró o salió de la flota, o hay que corregir un dato grabado, repórtalo al administrador."),
];

const doc = new Document({
  creator: "Preventivos HEMCO",
  title: "Guía de usuario para capturadores",
  styles: {
    default: { document: { run: { font: "Calibri", size: 22, color: "252525" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri", color: OSCURO },
        paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "F5B301", space: 6 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri", color: AMBAR },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "pasos", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      { reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1300, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: "Preventivos HEMCO · Guía para capturadores · página ", size: 16, color: GRIS }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS }),
    ] })] }) },
    children: [...portada, ...cuerpo],
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(SALIDA, b); console.log("ok", SALIDA, nFigura, "figuras"); });
