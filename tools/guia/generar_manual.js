// Genera el Manual de usuario para capturadores (app 0.6.0): paso a paso, con capturas de
// pantalla y ejemplos con cifras. Uso: node generar_manual.js <salida.docx> (imágenes en ./img).
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, ShadingType, PageBreak, Footer,
  PageNumber, TableOfContents, VerticalAlign,
} = require("docx");

const DIR = __dirname;
const IMG = path.join(DIR, "img");
const SALIDA = process.argv[2] ?? path.join(DIR, "Manual_capturadores.docx");
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
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
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

const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const sinBordes = { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde };
// Varias imágenes de celular lado a lado, cada una con su pie.
function figurasCelular(lista, anchoPx = 190) {
  const ancho = Math.floor(ANCHO_TEXTO / lista.length);
  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: lista.map(() => ancho),
    rows: [new TableRow({ cantSplit: true, children: lista.map(([archivo, pie]) => new TableCell({
      width: { size: ancho, type: WidthType.DXA }, borders: sinBordes, verticalAlign: VerticalAlign.TOP,
      children: figura(archivo, pie, anchoPx),
    })) })],
  });
}
// Ejemplo resaltado en gris, con título.
function ejemplo(titulo, textos) {
  return new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [ANCHO_TEXTO],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: ANCHO_TEXTO, type: WidthType.DXA },
      shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" },
      borders: { top: sinBorde, bottom: sinBorde, right: sinBorde, left: { style: BorderStyle.SINGLE, size: 24, color: "6D6D6D" } },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: titulo, bold: true, color: OSCURO })] }),
        ...textos.map((t, i) => new Paragraph({ spacing: { after: i === textos.length - 1 ? 0 : 80, line: 276 },
          children: [].concat(t).map((x) => (typeof x === "string" ? new TextRun(x) : x)) }))],
    })] })],
  });
}
const h3 = (t) => new Paragraph({ spacing: { before: 200, after: 100 }, keepNext: true, children: [new TextRun({ text: t, bold: true, size: 23, color: OSCURO })] });

// ---------------------------------------------------------------- contenido
const CAPITULOS = [
  "1. Antes de empezar",
  "2. Dónde usar la app: PC, Chrome o celular",
  "3. Entrar y moverse por la app",
  "4. Capturar las lecturas de horómetro de cada turno",
  "5. Registrar un mantenimiento ejecutado",
  "6. Registrar un cambio o reinicio de horómetro",
  "7. Consultar el estado de la flota",
  "8. Exportar a Excel e imprimir",
  "9. Tu cuenta y las actualizaciones",
  "10. Problemas frecuentes y cómo resolverlos",
  "11. Lista de control diaria del capturador",
];

const portada = [
  new Paragraph({ spacing: { before: 1600, after: 300 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(LOGO),
    transformation: { width: 110, height: 110 }, altText: { title: "Logo", description: "Logo de Control de Preventivos - Dimelco", name: "logo" } })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Control de Preventivos - Dimelco", bold: true, size: 48, color: OSCURO })] }),
  new Paragraph({ spacing: { after: 400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "F5B301", space: 8 } },
    children: [new TextRun({ text: "Manual de usuario para capturadores", size: 34, color: AMBAR })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Versión del manual: 4.0", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Versión de la app: 0.6.0 (escritorio y web)", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Fecha: 07/11/2026", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Página web: https://samuel270302.github.io/Control-de-preventivos-Dimelco/", size: 22, color: GRIS })] }),
  new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text:
    "Las capturas de pantalla y los ejemplos usan datos de prueba de la unidad HEMCO al 22/10/2026, con la cuenta de capturador Planeador Martha 850. Las cifras de tu pantalla serán las de tu flota del día.",
    size: 20, color: GRIS, italics: true })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Contenido", bold: true, size: 32, color: OSCURO })] }),
  ...CAPITULOS.map((t) => new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: t, size: 24 })] })),
];

const cap1a3 = [
  // 1
  h1(CAPITULOS[0]),
  h2("1.1 Qué es la app"),
  p("Control de Preventivos - Dimelco reemplaza el libro de Excel de registro de horómetros. Todos los usuarios trabajan sobre la misma base de datos en línea: lo que grabas aparece en las pantallas de los demás en segundos, sin refrescar."),
  p("Con las lecturas de horómetro y los mantenimientos que se registran, la app calcula para cada componente cuándo toca el próximo PM, cuántas horas faltan y en qué fecha se estima que llegará, y avisa qué equipos están vencidos, cuáles hay que programar y para cuáles hay que verificar repuestos."),
  h2("1.2 Qué hace un capturador"),
  tabla(["Tarea", "Cuándo", "Pantalla", "Capítulo"], [
    ["Capturar las lecturas de horómetro", "Al cierre de cada turno (Dia y Noche)", "Lecturas", "4"],
    ["Registrar los mantenimientos ejecutados", "El mismo día del PM, con la orden de trabajo a la mano", "Registro PM", "5"],
    ["Registrar un cambio o reinicio de horómetro", "Cuando un contador se reemplaza o vuelve a cero, antes de capturar su primera lectura", "Cambios horómetro", "6"],
    ["Consultar el estado de la flota y exportarlo", "Cuando lo necesites", "Control PM, Rutina 40 h, Gráficas, Programa, Indicadores, Historial", "7 y 8"],
  ], [2700, 2700, 2460, 1500]),
  espacio(),
  p("Antes de guardar, la app revisa cada dato contra lo que ya está grabado. Si algo no cuadra, avisa o no deja grabar y explica el motivo con las cifras."),
  h2("1.3 La regla de oro"),
  recuadro([
    [n("En lecturas y en registros de PM siempre se escribe lo que marca el contador en ese momento, nunca horas acumuladas.")],
    "El acumulado lo calcula la app sumando al contador el offset de los cambios de horómetro registrados (capítulo 6). Si escribes un acumulado donde va un contador, la app lo rechaza como horas imposibles o como una baja sin cambio registrado.",
  ]),
  espacio(),
  ejemplo("Ejemplo", [
    "El horómetro de percusión del Boomer #1 se reinició el 24/03/2026 con un offset de 1,585 h. Hoy su contador marca 135.3 h y el acumulado real es 1,720.3 h (135.3 + 1,585).",
    ["En la pantalla Lecturas se escribe ", n("135.3"), ", que es lo que marca el contador. Si escribes 1720.3, la app lo rechaza como horas imposibles."],
  ]),
  h2("1.4 Palabras que usa la app"),
  tabla(["Palabra", "Qué significa"], [
    ["Horómetro o contador", "El reloj de horas de un componente: motor diésel, motor eléctrico (compresor), percusión o empernado. Un equipo puede tener varios."],
    ["Componente", "Cada parte del equipo que lleva su propio horómetro y su propio plan de PM, por ejemplo el Motor Diésel del Boltec #1."],
    ["Turno", "Dia o Noche. Cada día tiene dos turnos y cada lectura es la del cierre de un turno."],
    ["Acumulado", "Horas reales de vida del componente: contador más offset."],
    ["Offset", "Horas que se suman al contador para obtener el acumulado. Cambia cuando el contador se reemplaza o vuelve a cero."],
    ["Gama", "El tipo de PM según las horas, por ejemplo 250, 500, 750, 1000 o 2000 h en motor diésel."],
    ["Ciclo de gamas", "El orden en que se repiten las gamas. Motor diésel: 250, 500, 750, 1000, 250, 500, 750, 2000 y vuelve a empezar."],
    ["Meta", "Horómetro acumulado en el que toca el próximo PM: horómetro del último PM más el intervalo del plan."],
    ["Hrs faltantes", "Meta menos última lectura acumulada. Si es negativa, el PM está atrasado esas horas."],
    ["Tendencia", "Horas por día de uso de los últimos 30 días, sin contar huecos largos sin lecturas."],
    ["PM mayor", "El mantenimiento por horas del plan (gamas 250, 500, 600, 1200 y otras)."],
    ["Rutina 40 h", "Rutina de percusión cada 40 h de los brazos de perforadoras y empernadoras. Se registra con gama 40."],
  ], [2300, 7060]),

  // 2
  h1(CAPITULOS[1]),
  p("La app tiene tres formas de uso con el mismo usuario y la misma contraseña. Los datos son los mismos en las tres: lo que grabas en una aparece en las otras."),
  tabla(["Forma", "Dónde", "Para qué conviene"], [
    ["App de escritorio", "PC con Windows, desde el acceso directo Control de Preventivos - Dimelco", "Uso diario en la oficina. Guarda el Excel y el PDF donde eliges."],
    ["Página web en Chrome", "Cualquier PC, en https://samuel270302.github.io/Control-de-preventivos-Dimelco/", "PC sin la app instalada. Se ve igual que la app de escritorio."],
    ["Página web en el celular", "Chrome en Android o Safari en iPhone, en la misma dirección", "Capturar lecturas y PM en campo y consultar el Control PM."],
  ], [2200, 3900, 3260]),
  h2("2.1 Instalar la app de escritorio (una sola vez)"),
  ...pasos([
    "Abre https://github.com/Samuel270302/Control-de-preventivos-Dimelco/releases/latest",
    ["Descarga el archivo ", n("Control-de-Preventivos-Dimelco-Setup-0.6.0.exe"), " (el número cambia con cada versión)."],
    ["Ejecútalo. Si Windows muestra el aviso de SmartScreen, haz clic en ", n("Más información"), " y luego en ", n("Ejecutar de todas formas"), "."],
    "Sigue el instalador. Al terminar queda el acceso directo en el escritorio y en el menú Inicio.",
    "La primera vez, si la app pide los datos de conexión a la base, pídeselos al administrador. Se escriben una sola vez por PC.",
  ]),
  p("Después de instalada, la app se actualiza sola (sección 9.2)."),
  h2("2.2 Usar la página web en Chrome"),
  ...pasos([
    "Abre Chrome y entra a https://samuel270302.github.io/Control-de-preventivos-Dimelco/",
    "Escribe tu correo y tu contraseña y haz clic en Entrar. No hay que configurar la conexión.",
    "Guarda la dirección en los marcadores (estrella a la derecha de la barra de direcciones).",
  ]),
  p("La página web siempre carga la última versión. No muestra la franja de actualización."),
  h2("2.3 Usar la app en el celular"),
  ...pasos([
    "Abre la misma dirección en Chrome (Android) o Safari (iPhone).",
    "Entra con tu correo y contraseña.",
    ["Para dejar un ícono en la pantalla principal: en Chrome, menú ⋮ y ", n("Agregar a pantalla principal"), "; en Safari, botón Compartir y ", n("Agregar a inicio"), "."],
  ]),
  p("En el celular la pantalla cambia de forma: arriba queda una franja con el nombre de la pantalla y el punto de conexión, y abajo una barra con Control PM, Lecturas, PM y Más. En Más están el resto de las pantallas, la unidad, Cambiar contraseña y Cerrar sesión."),
  figurasCelular([["m_entrada.png", "Entrada en el celular."], ["m_control.png", "Control PM en el celular."], ["m_menu.png", "Menú Más abierto."]]),
  espacio(),
  p("Las tablas anchas, como la del Control PM, se desplazan de lado con el dedo dentro de su recuadro. La columna Equipo queda fija."),

  // 3
  h1(CAPITULOS[2]),
  h2("3.1 Entrar"),
  ...pasos([
    "Abre la app de escritorio o la página web.",
    ["En ", n("Correo"), " escribe tu usuario completo, por ejemplo planeador.martha@grupodimelco.com. En ", n("Contraseña"), " escribe tu clave. La contraseña inicial te la entrega el administrador."],
    ["Haz clic en ", n("Entrar"), ". La primera pantalla es el Control PM."],
  ]),
  ...figura("01_entrada_c.png", "Pantalla de entrada.", 300),
  tabla(["Lo que ves", "Qué significa y qué hacer"], [
    ["Correo o contraseña incorrectos", "Revisa que el correo esté completo, con @grupodimelco.com, y que la tecla Bloq Mayús esté apagada."],
    ["Acceso pendiente de activación", "Tu cuenta existe pero el administrador no la ha activado o no te asignó unidad. Avísale."],
    ["Botón Cambiar conexión a la base (solo escritorio)", "No se usa en el día a día. Tócalo solo si el administrador lo indica."],
  ], [3200, 6160]),
  h2("3.2 El menú"),
  new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [2600, 6760],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders: sinBordes, children: figura("21_menu_c.png", "Menú del capturador.", 150) }),
      new TableCell({ width: { size: 6760, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: sinBordes, margins: { left: 200 },
        children: [
          p("El menú de la izquierda tiene estas partes, de arriba abajo:"),
          ...vinetas([
            "El logo y el nombre de la app.",
            "Tu unidad minera (sección 3.3).",
            "Las pantallas para consultar: Control PM, Rutina 40 h, Gráficas, Programa 4 semanas, Indicadores e Historial.",
            "Las pantallas para capturar: Lecturas, Registro PM y Cambios horómetro.",
            "Al pie: tu nombre y tu rol, Cambiar contraseña, Cerrar sesión, el punto de conexión y la versión instalada.",
          ]),
          p("Equipos, Plan MP y Usuarios son pantallas del administrador y no aparecen en tu menú."),
        ] }),
    ] })],
  }),
  h2("3.3 Tu unidad o tus unidades"),
  p("Cada capturador ve y captura solo los equipos de las unidades que le asignó el administrador: HEMCO, Veta Nueva, Mina La India o Explotec. Los equipos de las demás unidades no aparecen en ninguna pantalla, y la base rechaza cualquier dato de un equipo que no es tuyo."),
  h3("Si tienes una sola unidad"),
  p("Debajo del logo aparece su nombre, por ejemplo Unidad HEMCO, y todas las pantallas muestran solo esa unidad. No hay nada que elegir."),
  h3("Si tienes varias unidades"),
  p("Debajo del logo aparece el selector Unidad con la opción Mis unidades y una opción por cada unidad tuya."),
  new Table({
    width: { size: ANCHO_TEXTO, type: WidthType.DXA },
    columnWidths: [2600, 6760],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders: sinBordes, children: figura("22_varias_menu_c.png", "Selector de unidad.", 170) }),
      new TableCell({ width: { size: 6760, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: sinBordes, margins: { left: 200 },
        children: [
          ...vinetas([
            "Mis unidades muestra juntas todas tus unidades.",
            "Al elegir una unidad, todas las pantallas (Control PM, Lecturas, Registro PM, Programa, Indicadores e Historial) muestran solo esa unidad.",
            "La app recuerda la elección la próxima vez que entras en ese PC o navegador.",
            "Los títulos y los nombres de los archivos exportados llevan el nombre de la unidad elegida.",
          ]),
        ] }),
    ] })],
  }),
  ejemplo("Ejemplo", [
    "Un capturador tiene HEMCO y Explotec. Con Mis unidades, el Control PM muestra los 16 equipos de HEMCO y los 12 de Explotec (28 en total).",
    "Para la pasada de lecturas de HEMCO elige HEMCO en el selector: la pantalla Lecturas muestra solo los 35 horómetros de HEMCO y así no se mezclan con los de Explotec.",
  ]),
  espacio(),
  ...figura("23_varias_control.png", "Capturador con HEMCO y Explotec, viendo Mis unidades."),
  p("Si necesitas ver otra unidad o dejar de ver una, pídeselo al administrador: él marca tus unidades en su pantalla de Usuarios."),
  h2("3.4 Estado de la conexión"),
  p("El punto al pie del menú (en el celular, arriba a la derecha) indica si la app está conectada a la base."),
  tabla(["Estado", "Qué significa", "Qué hacer"], [
    ["En línea (verde)", "Conectada. Lo que grabas llega a la base y ves lo que graban los demás.", "Trabajar normal."],
    ["Reconectando… (amarillo)", "Se cortó el canal de avisos en tiempo real y la app lo está recuperando.", "Espera unos segundos antes de grabar."],
    ["Sin conexión", "El PC o el celular no tiene red.", "No grabes hasta que vuelva. Lo ya grabado no se pierde; lo escrito y no grabado sí."],
  ], [2300, 4200, 2860]),
];

const cap4y5 = [
  // 4
  h1(CAPITULOS[3]),
  p("La pantalla Lecturas tiene un renglón por cada horómetro activo de tu unidad, con la última lectura grabada, su fecha y su turno. Se escribe solo la lectura nueva."),
  h2("4.1 Antes de empezar la pasada"),
  ...vinetas([
    "Ten a la mano el parte de turno o la planilla con las lecturas de cada equipo.",
    "Confirma la fecha y el turno que vas a capturar. Una pasada es un solo turno: si tienes lecturas de dos turnos, captúralas en dos pasadas.",
    "Si un contador se cambió o volvió a cero en ese turno, registra primero el cambio (capítulo 6).",
    "Si tienes varias unidades, elige en el selector la unidad de la pasada (sección 3.3).",
  ]),
  h2("4.2 Paso a paso"),
  ...figura("10_lecturas.png", "Pantalla Lecturas antes de escribir."),
  ...pasos([
    ["Entra a ", n("Lecturas"), " en el menú."],
    ["Arriba, en ", n("Fecha"), ", elige el día del turno. En ", n("Turno"), " elige Dia o Noche. La app propone la fecha de hoy y el turno Dia: cámbialo si capturas el turno Noche o un día anterior."],
    ["Busca el renglón del equipo y del horómetro, y escribe en la casilla ", n("Nueva lectura"), " lo que marca el contador. Usa punto para los decimales: 3488.7."],
    "Pasa a la casilla siguiente con la tecla Enter. Los renglones con valor se pintan de amarillo.",
    ["Mira la columna ", n("Control"), " de cada renglón con valor: la app consulta la base mientras escribes y muestra el resultado (sección 4.4). Mientras consulta aparece Validando…"],
    "Deja vacíos los horómetros que no tienen lectura en ese turno. No escribas la misma lectura anterior si el equipo no trabajó y no la viste en el contador.",
    ["Cuando termines, revisa que no haya mensajes en rojo y haz clic en ", n("Grabar lecturas"), ". Todas las lecturas escritas se graban juntas y aparece un aviso verde, por ejemplo 4 lectura(s) grabada(s)."],
  ]),
  h2("4.3 Ejemplo completo de una pasada"),
  p("Turno Dia del 22/10/2026. El parte trae estas lecturas y la app responde así:"),
  tabla(["Equipo y horómetro", "Última lectura", "Se escribe", "Control", "Por qué"], [
    ["Boltec #1 Diesel", "3,479.3 (18/10 Noche)", "3488.7", "OK", "Subió 9.4 h en 7 turnos. Es coherente."],
    ["Boltec #1 Motor Eléctrico", "4,817.1 (18/10 Noche)", "4823.3", "OK", "Subió 6.2 h."],
    ["Boltec #1 Percusión #1", "1,452.5 (18/10 Noche)", "1451.5", "Lectura menor a la anterior (validar)", "Bajó 1 h. Se puede grabar, pero hay que revisar el parte: casi siempre es un dígito mal leído."],
    ["Boltec #2 Diesel", "1,770.2 (20/10 Noche)", "1710.2", "Lectura 60 h menor que la anterior (1770.2 h el 20/10/2026 Noche)…", "Bajó 60 h. No se puede grabar. Probablemente era 1780.2: se corrige el valor."],
  ], [2000, 1800, 1100, 2260, 2200]),
  espacio(),
  ...figura("11_lecturas_control.png", "El ejemplo en pantalla: dos OK, una baja de 1 h que solo avisa y una baja de 60 h que bloquea."),
  p("En este ejemplo Grabar lecturas no graba nada mientras el Boltec #2 tenga 1710.2. Al corregirlo a 1780.2 el control pasa a OK y la pasada se graba completa."),
  h2("4.4 Qué significa cada mensaje de Control"),
  p("Verde o naranja: se puede grabar. Rojo: bloquea la grabación de toda la pasada hasta que corrijas o borres ese valor. Los límites que usa la app son 12 h por turno como máximo, 2 h de baja tolerada y 7 días para el aviso de hueco."),
  tabla(["Mensaje", "Ejemplo", "¿Graba?", "Qué hacer"], [
    ["OK", "Última 3,479.3; escribes 3488.7.", "Sí", "Nada."],
    ["Primer registro", "Horómetro nuevo sin lecturas.", "Sí", "Normal en un equipo o componente recién dado de alta."],
    ["Lectura menor a la anterior (validar)", "Última 1,452.5; escribes 1451.5 (baja 1 h).", "Sí", "Revisa el parte. Si el contador realmente marca eso, graba."],
    ["Hueco de N día(s) sin lectura", "Última lectura el 01/10 Dia; capturas el 22/10 Dia: Hueco de 21 día(s) sin lectura.", "Sí", "Es solo un aviso. Si tienes las lecturas de esos días, cárgalas también (sección 4.6)."],
    ["Duplicado: ya hay lectura de ese turno", "El Boltec #1 Diesel ya tiene lectura el 22/10 Dia y escribes otra para el mismo turno.", "No", "Revisa la fecha y el turno de arriba. Si la grabada está mal, pide al administrador que la anule."],
    ["Lectura N h menor que la anterior (…)", "Última 1,770.2; escribes 1710.2: Lectura 60 h menor que la anterior (1770.2 h el 20/10/2026 Noche).", "No", "Si fue un error, corrige el valor. Si el contador se cambió o volvió a cero, registra el cambio (capítulo 6) y vuelve a escribir la lectura."],
    ["Horas imposibles: N h en M turno(s)…", "Última 3,479.3 el 18/10 Noche; el 22/10 Dia escribes 34887 (un dígito de más): Horas imposibles: 31407.7 h en 7 turno(s) desde la lectura del 18/10/2026 Noche; el máximo es 84 h.", "No", "Revisa si escribiste un dígito de más o un acumulado en lugar del contador."],
    ["Lectura mayor que la lectura posterior del …", "Cargas el 20/10 Dia con 1775 y ya existe 1,770.2 el 20/10 Noche: Lectura mayor que la lectura posterior del 20/10/2026 Noche (1770.2 h).", "No", "La lectura atrasada no puede ser mayor que una posterior. Revisa el valor o la fecha."],
    ["Horas imposibles hasta la lectura del …", "La lectura atrasada deja más de 12 h por turno hasta la lectura posterior.", "No", "Revisa el valor o la fecha."],
    ["No se pudo validar: revise la conexión", "Se cortó la red mientras escribías.", "Sí, con cuidado", "Al grabar, la base vuelve a revisar todo y rechaza lo que no cumpla."],
  ], [2300, 3300, 900, 2860]),
  espacio(),
  h2("4.5 Si la app no deja grabar"),
  p("Si haces clic en Grabar lecturas con un mensaje rojo en pantalla, la app no graba ninguna lectura de la pasada y muestra un aviso rojo con el equipo y el motivo. Corrige o borra ese valor y vuelve a hacer clic en Grabar lecturas."),
  ...figura("12_lecturas_rechazo.png", "Aviso al intentar grabar con una lectura rechazada."),
  h2("4.6 Cargar lecturas de un turno pasado"),
  p("Se puede capturar un turno atrasado eligiendo arriba su fecha y su turno. La app compara la lectura con la anterior y también con la lectura posterior ya grabada."),
  ejemplo("Ejemplo", [
    "Hoy es 22/10 y faltó capturar el turno Noche del 19/10. Elige Fecha 19/10/2026 y Turno Noche, escribe las lecturas de ese turno y graba.",
    "Cada lectura tiene que quedar entre la anterior (por ejemplo, la del 19/10 Dia) y la posterior (la del 20/10 Dia). Si queda por encima de la posterior, aparece Lectura mayor que la lectura posterior.",
  ]),
  espacio(),
  p("La columna Última lectura siempre muestra la lectura más reciente grabada, no la del turno que estás cargando."),
  h2("4.7 Salir con lecturas sin grabar"),
  p("Si cambias de pantalla o cierras la app con valores escritos y sin grabar, la app pregunta antes. Seguir capturando te deja en la pantalla con todo lo escrito. Salir sin grabar descarta esos valores."),
  ...figura("13_lecturas_salir_c.png", "Aviso de lecturas sin grabar.", 460),
  h2("4.8 Capturar lecturas desde el celular"),
  ...pasos([
    ["Toca ", n("Lecturas"), " en la barra de abajo."],
    "Arriba elige la fecha y el turno. Esa franja, con el botón Grabar lecturas, queda fija aunque bajes por la lista.",
    "Cada horómetro es una tarjeta: arriba el equipo y el tipo de horómetro, debajo la última lectura y su fecha, y la casilla para la lectura nueva. Al tocar la casilla se abre el teclado numérico.",
    "El resultado del control aparece debajo de la casilla.",
    ["Al terminar, toca ", n("Grabar lecturas"), "."],
  ]),
  figurasCelular([["m_lecturas.png", "Lecturas en el celular, con una lectura OK."], ["m_registro_pm.png", "Registro PM en el celular."]], 220),

  // 5
  h1(CAPITULOS[4]),
  p("Cada PM ejecutado se registra con la lectura del contador del componente intervenido en ese momento. Con ese dato la app fija la meta del próximo PM."),
  h2("5.1 Qué necesitas"),
  ...vinetas([
    "La fecha de ejecución.",
    "El equipo y el componente intervenido (por ejemplo, Motor Diésel o Perforadora B1).",
    "La gama ejecutada (250, 500, 750, 1000, 2000, 600, 1200, 40).",
    "La lectura del contador del componente al hacer el PM, tomada del horómetro o de la orden de trabajo.",
    "El responsable: técnico o empresa que ejecutó el PM.",
  ]),
  h2("5.2 Paso a paso"),
  ...figura("14_registro_pm.png", "Registro PM con un PM listo para grabar."),
  ...pasos([
    ["Entra a ", n("Registro PM"), "."],
    ["En ", n("Fecha de ejecución"), " elige el día del PM."],
    ["En ", n("Equipo"), " elige el equipo y en ", n("Responsable"), " escribe quién lo ejecutó."],
    ["En ", n("Componente intervenido"), " elige el componente y en ", n("Gama (h)"), " la gama ejecutada."],
    ["En ", n("Lectura del contador"), " escribe lo que marcaba el contador de ese componente. Debajo aparece el último contador grabado como referencia."],
    ["Si el mismo PM intervino otro componente del equipo, haz clic en ", n("+ Otro componente del mismo PM"), " y llena el renglón nuevo con su propio componente, gama y lectura."],
    ["Revisa que no haya mensajes en rojo y haz clic en ", n("Grabar PM"), ". El PM aparece arriba en Últimos PM registrados."],
  ]),
  h2("5.3 Ejemplo"),
  ejemplo("PM de 250 h al motor diésel del Boomer #1", [
    "Fecha de ejecución 22/10/2026, equipo Boomer #1, responsable Mecánico Juan Pérez, componente Motor Diésel (Diesel), gama 250.",
    "La última lectura grabada del motor es 3,310.4 h el 20/10/2026 Noche. El contador marcaba 3314.4 al hacer el PM: se escribe 3314.4 y se graba.",
    "Con esto la meta del próximo PM queda en 3,314.4 + 250 = 3,564.4 h, y la próxima gama es 500 (sigue el ciclo 250, 500, 750, 1000, 250, 500, 750, 2000).",
  ]),
  espacio(),
  ejemplo("PM con dos componentes", [
    "En un mismo PM del Boomer #1 se hizo la gama 250 al motor diésel (contador 3314.4) y la gama 600 a la Perforadora B1 (contador 118.0; su última lectura grabada es 116.7).",
    "Se llena el primer renglón con el motor, se hace clic en + Otro componente del mismo PM y se llena el segundo con la perforadora. Grabar PM graba los dos.",
  ]),
  h2("5.4 Cuando la app rechaza el PM"),
  p("La app compara la lectura del PM con las lecturas de horómetro grabadas. Si la lectura del PM queda por debajo de la última lectura de ese día o deja horas imposibles, muestra el motivo en rojo y el botón Grabar PM se desactiva."),
  ...figura("15_registro_pm_rechazo.png", "PM rechazado: 3010.4 es menor que la lectura de 3,310.4 h del 20/10/2026."),
  p("En el ejemplo se escribió 3010.4 en lugar de 3314.4. Al corregir el valor, el mensaje desaparece y se puede grabar."),
  h2("5.5 Casos especiales"),
  tabla(["Caso", "Qué hacer"], [
    ["Rutina de percusión de 40 h", "Registra con gama 40 en el componente de perforación o empernado. Alimenta la pantalla Rutina 40 h y no mueve la meta del PM mayor."],
    ["No sabes la gama", "Elige Sin gama. El Control PM mostrará Validar gama en ese componente hasta que el administrador la corrija."],
    ["El PM se hizo y el horómetro se cambió en la misma intervención", "Registra primero el cambio de horómetro (capítulo 6) y después el PM con la lectura del contador nuevo."],
    ["Te equivocaste en un PM ya grabado", "Avisa al administrador con el equipo, la fecha y el error. Solo él puede anularlo, y siempre con un motivo que queda en el Historial."],
  ], [3200, 6160]),
];

const cap6a11 = [
  // 6
  h1(CAPITULOS[5]),
  p("Cuando un contador se reemplaza o vuelve a cero, sus lecturas empiezan de nuevo. Para que el acumulado siga correcto se registra el offset: las horas que se suman al contador nuevo."),
  recuadro([
    [n("Primero se registra el cambio y después se captura la lectura del contador nuevo.")],
    "Si capturas primero la lectura, la app la rechaza como una baja de horas. Con el cambio registrado, la misma lectura pasa sola.",
  ]),
  h2("6.1 Paso a paso"),
  ...figura("16_cambios.png", "Cambios horómetro con un cambio listo para registrar."),
  ...pasos([
    ["Entra a ", n("Cambios horómetro"), "."],
    ["En ", n("Componente"), " elige el equipo y el tipo de horómetro, por ejemplo Boltec #1 · Diesel."],
    ["En ", n("Vigente desde"), " pon la fecha de la primera lectura del contador nuevo."],
    ["En ", n("Última lectura contador viejo"), " escribe lo último que marcó el contador viejo antes del cambio."],
    ["En ", n("Lectura inicial contador nuevo"), " escribe con cuánto arrancó el contador nuevo (0 si arrancó en cero)."],
    ["En ", n("Fuente / verificación"), " anota de dónde salen los datos, por ejemplo Cambio de tablero, OT 4512."],
    ["Revisa el ", n("Offset propuesto"), " que calcula la app y haz clic en ", n("Registrar cambio"), "."],
    "Ahora sí, captura en Lecturas la lectura del contador nuevo.",
  ]),
  h2("6.2 Cómo se calcula el offset"),
  p("Offset nuevo = offset previo + última lectura del contador viejo − lectura inicial del contador nuevo."),
  ejemplo("Ejemplo: cambio de tablero del Boltec #1", [
    "El contador diésel viejo marcó 3,487 h y lo reemplazaron por uno nuevo que arrancó en 0. El componente no tenía cambios anteriores (offset previo 0 h).",
    "Offset propuesto: 0 + 3,487 − 0 = 3,487 h.",
    "En el siguiente turno el contador nuevo marca 9.5. En Lecturas se escribe 9.5 y la app calcula el acumulado: 9.5 + 3,487 = 3,496.5 h. El Control PM sigue la meta sin saltos.",
  ]),
  espacio(),
  ejemplo("Ejemplo con un cambio anterior", [
    "La percusión del Boomer #1 ya tenía un offset de 1,585 h. Si su contador marca 140.0 al reiniciarse y el nuevo arranca en 0, el offset nuevo es 1,585 + 140.0 − 0 = 1,725 h.",
  ]),
  h2("6.3 Después de registrar"),
  ...vinetas([
    "El cambio queda Por validar hasta que el administrador lo revisa. Mientras tanto ya rige para el cálculo y puedes capturar las lecturas del contador nuevo.",
    "La tabla de abajo muestra los cambios registrados de tu unidad, con el método y la fuente de cada uno.",
    "Si te equivocaste en un cambio, avisa al administrador. No registres un segundo cambio para corregir el primero.",
  ]),

  // 7
  h1(CAPITULOS[6]),
  h2("7.1 Control PM"),
  p("Es el tablero principal del PM mayor. Tiene una pestaña por sistema (Motor diésel, Compresor, Perforadoras y empernadoras) y una fila por componente."),
  ...figura("02_control_pm.png", "Control PM, pestaña Motor diésel."),
  h3("Las columnas, con el ejemplo del Boltec #1 Motor Diésel"),
  tabla(["Columna", "Qué significa", "Ejemplo"], [
    ["Equipo", "Código del equipo. Clic para abrir su ficha (sección 7.6).", "Boltec #1"],
    ["Componente", "Parte del equipo con su propio horómetro y plan.", "Motor Diésel"],
    ["Cód. interno", "Código interno del componente, si lo tiene.", "618320"],
    ["Fecha último PM", "Fecha del último PM mayor registrado.", "21/02/2026"],
    ["Gama último PM", "Gama de ese PM.", "250"],
    ["Horómetro último PM", "Acumulado al hacer ese PM.", "2,847.5"],
    ["Próxima gama", "Siguiente gama del ciclo. Validar gama si el último PM no tiene gama.", "500"],
    ["Meta (acum.)", "Horómetro último PM + intervalo del plan.", "2,847.5 + 250 = 3,097.5"],
    ["Meta (contador)", "La misma meta expresada en lo que debe marcar el contador.", "3,097.5"],
    ["Última lectura (acum.) y (contador)", "Última lectura grabada, en acumulado y en contador.", "3,479.3"],
    ["Fecha última lectura", "Fecha de esa lectura.", "18/10/2026"],
    ["Hrs faltantes", "Meta − última lectura. Negativo = atrasado.", "3,097.5 − 3,479.3 = −381.8"],
    ["Tendencia (h/día)", "Horas por día de los últimos 30 días.", "2.62"],
    ["Fecha estimada", "Cuándo llega a la meta. Si ya la pasó, el día en que la alcanzó.", "02/06/2026"],
    ["Días restantes", "Fecha estimada − hoy.", "Negativo: vencido"],
    ["Estado", "Resultado del cálculo (tabla siguiente).", "Vencido"],
    ["Observación", "Nota del administrador. Pasa el mouse para leerla completa.", ""],
  ], [2300, 4600, 2460]),
  espacio(),
  h3("Los estados"),
  tabla(["Estado", "Cuándo aparece", "Qué hacer"], [
    ["Vencido", "La fecha estimada ya pasó: el horómetro superó la meta.", "Programar el PM cuanto antes y avisar a mantenimiento."],
    ["Programar", "Faltan 10 días o menos para la fecha estimada (motor diésel y compresor; percusión: 14 días).", "Coordinar la fecha del PM."],
    ["Verificar repuestos", "Faltan 28 días o menos (motor diésel y compresor; percusión: 90 días).", "Revisar que estén los repuestos y el kit."],
    ["Normal", "La meta está más lejos.", "Nada."],
    ["Sin PM registrado", "El componente no tiene ningún PM grabado.", "Registrar el último PM ejecutado (capítulo 5)."],
    ["Sin tendencia", "No hay horas de uso en los últimos 30 días para proyectar.", "Revisar que se estén capturando sus lecturas."],
    ["Plan no definido", "El componente no tiene plan asignado.", "Avisar al administrador."],
  ], [2000, 4200, 3160]),
  espacio(),
  ejemplo("Ejemplo de Programar: Boomer #3 Motor Diésel", [
    "Meta 2,372.3 h; última lectura 2,313.9 h el 18/10/2026; faltan 58.4 h; tendencia 3.04 h/día.",
    "Días hasta la meta: 58.4 ÷ 3.04 = 19.2 días. Fecha estimada: 18/10/2026 + 19 días = 06/11/2026.",
    "Si hoy es 03/11/2026 faltan 3 días, que es menos de 10: el estado es Programar.",
  ]),
  h3("Usar la tabla"),
  ...vinetas([
    "Los cuadros de arriba cuentan los componentes por estado. Clic en uno filtra la tabla; otro clic quita el filtro.",
    "El buscador filtra por equipo, componente o modelo mientras escribes.",
    "Clic en el encabezado de una columna ordena; otro clic invierte el orden.",
    "La columna Equipo queda fija al desplazarte a la derecha.",
    "Exportar a Excel guarda la tabla visible y Reporte semanal (PDF) genera el reporte (capítulo 8).",
  ]),
  ...figura("03_control_filtro.png", "Control PM filtrado por Vencidos."),
  h2("7.2 Rutina 40 h"),
  p("Una fila por brazo de perforadora o empernadora, con las horas de percusión desde la última rutina o PM del brazo. La meta es cada 40 h y cualquier PM del brazo reinicia el conteo. Se usa igual que el Control PM."),
  ...figura("04_rutina40.png", "Rutina de percusión 40 h."),
  h2("7.3 Gráficas"),
  p("La evolución del acumulado de cada componente en los últimos 30 días. La línea roja punteada es la meta del próximo PM y el rombo marca un PM ejecutado. Al pasar el mouse por la línea ves la lectura de cada turno. El botón Tabla muestra los mismos datos en números."),
  ...figura("05_graficas.png", "Gráficas de evolución de horómetros."),
  h2("7.4 Programa 4 semanas"),
  p("Los PM mayores y las rutinas de 40 h que caen en las próximas 4 semanas según su fecha estimada, desde el lunes de esta semana. Los vencidos van arriba, del más atrasado al menos atrasado."),
  ...figura("06_programa_lista.png", "Programa 4 semanas en vista Lista."),
  p("La vista Calendario pone cada PM en su día. Las tarjetas de borde punteado son rutinas de 40 h y el día de hoy tiene marco amarillo. En el celular, la vista Lista es la más cómoda."),
  ...figura("07_programa_calendario.png", "Programa 4 semanas en vista Calendario."),
  h2("7.5 Indicadores"),
  tabla(["Cuadro", "Qué mide"], [
    ["Cumplimiento del plan", "Porcentaje de PM mayores de los últimos 3 meses ejecutados antes de pasar su meta."],
    ["Atraso de los PM vencidos abiertos", "Suma de las horas que llevan pasadas de su meta los componentes vencidos."],
    ["Utilización media del mes", "Horas por día promedio de los componentes con lecturas en el mes."],
    ["Lecturas al día", "Porcentaje de componentes con lectura en los últimos 2 días."],
  ], [3200, 6160]),
  espacio(),
  p("Al final está la lista de componentes con más de 2 días sin lectura. Úsala para revisar qué equipos faltan en tu pasada."),
  ...figura("08_indicadores.png", "Indicadores de gestión."),
  h2("7.6 Ficha de equipo"),
  p("Clic en el nombre de un equipo en cualquier tabla abre su ficha: estado de cada componente, rutina de 40 h, gráfica de 30 días, últimos PM y últimas lecturas."),
  ...figura("09_ficha_equipo.png", "Ficha del Boomer #1."),
  h2("7.7 Historial"),
  p("Lecturas y registros de PM con filtros por equipo y por rango de fechas. Capturado por dice quién grabó cada dato; al pasar el mouse ves la fecha y hora de grabación. Lo cargado desde el libro de Excel aparece como Importado del Excel."),
  ...figura("17_historial.png", "Historial de lecturas."),
  p("La casilla Ver anulados muestra los registros que el administrador anuló, con quién, cuándo y el motivo."),
  ...figura("18_historial_anulados.png", "Historial con Ver anulados."),

  // 8
  h1(CAPITULOS[7]),
  tabla(["Botón", "App de escritorio", "Página web (Chrome)"], [
    ["Exportar a Excel (Control PM, Rutina 40 h, Programa, Historial)", "Pregunta dónde guardar el archivo .xlsx.", "Descarga el archivo en la carpeta Descargas. El nombre va sin acentos, por ejemplo Control PM HEMCO Motor diesel 2026-11-07.xlsx."],
    ["Reporte semanal (PDF) en Control PM", "Genera el PDF y pregunta dónde guardarlo.", "Abre la ventana de imprimir de Chrome: en Destino elige Guardar como PDF y haz clic en Guardar."],
  ], [2900, 2900, 3560]),
  espacio(),
  p("El Excel exporta lo que se ve en pantalla: si filtraste por Vencidos o por una unidad, el archivo trae solo eso."),

  // 9
  h1(CAPITULOS[8]),
  h2("9.1 Cambiar tu contraseña"),
  ...pasos([
    ["Haz clic en ", n("Cambiar contraseña"), " al pie del menú (en el celular, dentro de Más)."],
    "Escribe la contraseña nueva dos veces. Debe tener al menos 8 caracteres y ser distinta de la actual.",
    ["Haz clic en ", n("Cambiar"), ". La app confirma con un aviso verde."],
  ]),
  ...figura("19_cambiar_contrasena_c.png", "Cambio de contraseña.", 380),
  p("Si olvidas tu contraseña, pide al administrador que la restablezca. No compartas tu cuenta: cada dato queda registrado a nombre de quien lo grabó."),
  h2("9.2 Actualizaciones de la app de escritorio"),
  p("La app busca versiones nuevas al abrir y cada 4 horas, y las descarga sola. Cuando una versión está lista aparece esta franja arriba:"),
  ...figura("20_actualizacion.png", "Aviso de versión nueva descargada."),
  p("Graba tus lecturas y haz clic en Reiniciar y actualizar: la app se cierra, se instala la versión y vuelve a abrir. Si prefieres terminar lo que estás haciendo, la versión se instala sola la próxima vez que cierres la app. La página web no necesita actualizarse."),

  // 10
  h1(CAPITULOS[9]),
  tabla(["Lo que pasa", "Causa probable", "Qué hacer"], [
    ["No encuentro un equipo en Lecturas", "El equipo es de otra unidad, está inactivo o tienes elegida otra unidad en el selector.", "Revisa el selector de unidad. Si el equipo debería estar, avisa al administrador."],
    ["Grabar lecturas no graba nada", "Hay al menos un mensaje rojo en la pasada.", "Busca el renglón en rojo, corrige o borra el valor y graba de nuevo."],
    ["Duplicado: ya hay lectura de ese turno", "Fecha o turno equivocados arriba, o el turno ya se capturó.", "Revisa fecha y turno. Si la lectura grabada está mal, pide la anulación al administrador."],
    ["Un contador volvió a cero y la app no acepta la lectura", "Falta registrar el cambio de horómetro.", "Registra el cambio (capítulo 6) y vuelve a escribir la lectura."],
    ["Horas imposibles", "Dígito de más, un acumulado en vez del contador, o fecha y turno equivocados.", "Compara con el parte físico y con la última lectura."],
    ["El Control PM dice Validar gama", "El último PM se grabó Sin gama.", "Avisa al administrador la gama correcta."],
    ["El Control PM dice Sin tendencia", "No hay lecturas con horas de uso en los últimos 30 días.", "Revisa que las lecturas de ese componente se estén capturando."],
    ["El punto de conexión dice Sin conexión", "Sin red en el PC o el celular.", "Espera a que vuelva la red antes de grabar. Lo escrito y no grabado se pierde si cierras."],
    ["La app pide los datos de conexión (escritorio)", "Primera vez en ese PC o se borraron los datos.", "Pide los datos al administrador, o usa la página web, que no los pide."],
    ["Acceso pendiente de activación", "Cuenta inactiva o sin unidades asignadas.", "Avisa al administrador."],
    ["El Excel descargado no se abre en el celular", "El celular no tiene una app para .xlsx.", "Ábrelo con Google Sheets o Excel para celular, o descárgalo desde el PC."],
  ], [2700, 3200, 3460]),

  // 11
  h1(CAPITULOS[10]),
  p("Al cierre de cada turno:"),
  ...pasos([
    "Revisa que el punto de conexión esté En línea.",
    "Si tienes varias unidades, elige en el selector la unidad de la pasada.",
    "Registra primero los cambios de horómetro del turno, si los hubo.",
    "Abre Lecturas, revisa la fecha y el turno, y escribe las lecturas del parte.",
    "Revisa la columna Control: ningún mensaje rojo y los avisos naranjas comparados con el parte.",
    "Graba y confirma el aviso verde con la cantidad de lecturas grabadas.",
    "Registra los PM ejecutados en el turno, con su lectura de contador y su responsable.",
    "Una vez al día, revisa en Indicadores la lista de componentes con más de 2 días sin lectura y completa los que falten.",
  ]),
  espacio(),
  recuadro([
    [n("Ante cualquier duda con un dato, no lo grabes: consúltalo con el parte físico o con el administrador.")],
    "Corregir un dato grabado requiere que el administrador lo anule, y la anulación queda registrada en el Historial.",
  ]),
];

const doc = new Document({
  creator: "Control de Preventivos - Dimelco",
  title: "Manual de usuario para capturadores",
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
      new TextRun({ text: "Control de Preventivos - Dimelco · Manual para capturadores · página ", size: 16, color: GRIS }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS }),
    ] })] }) },
    children: [...portada, ...cap1a3, ...cap4y5, ...cap6a11],
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(SALIDA, b); console.log("ok", SALIDA, nFigura, "figuras"); });
