# BioCiencia — Gestor de referencias

Gestor de referencias bibliográficas **gratuito y 100 % local** para Windows, con una interfaz al estilo de EndNote 21/25 (cinta de herramientas con grupos, menús clásicos, tabla de referencias, panel de resumen edición/PDF y barra de estado), construido con **Electron**.

> **Sin nube, sin cuentas, sin suscripciones.** Tu biblioteca y tus PDF viven en tu equipo: `%APPDATA%\BioCiencia` (`library.json` + carpeta `pdfs/`).

---

## ✨ Características

### Entrada de datos
- **Importación automática**: haz doble clic en un archivo `.ris` / `.bib` descargado (EndNote, Zotero, Mendeley, Google Scholar, Web of Science…) y BioCiencia lo importa. También puedes **arrastrar y soltar** el archivo sobre la ventana.
- **Añadir por DOI**: pega un DOI y se descargan título, autores, revista, año, volumen, páginas y resumen (OpenAlex / Crossref).
- **Búsqueda en línea** integrada: OpenAlex, Crossref y PubMed — importa los resultados con un clic.
- **Adjuntar PDF**: el PDF se guarda como archivo real en tu carpeta de datos; BioCiencia puede detectar el **DOI dentro del PDF** y completar los metadatos, o buscar una copia en **acceso abierto** (individual o para toda la vista, con descarga masiva).

### Organización
- Colecciones, **sets de colecciones** (grupos de grupos), grupos inteligentes y etiquetas.
- Marcar leído / no leído, clasificación con estrellas (1–5), columnas visibles configurables.
- Navegación por papeles: ↑/↓ mueve la selección, pestañas de biblioteca, papelera con restaurar.

### Calidad de datos
- Buscar y **consolidar duplicados** (por DOI o título).
- **Actualizar metadatos desde DOI** (Find Reference Updates).
- **Detección de retractaciones y correcciones** vía Crossref, con aviso ⚠ persistente en la ficha y la tabla.
- Buscar y reemplazar (9 campos), **cambiar campos** (antepos / añadir / vaciar sobre selección o vista).
- Listas de términos: autocompletado de autores, revistas y etiquetas + gestor de listas.

### Escritura y salida
- **14 estilos de citación**: APA, MLA, Chicago, Chicago autor-fecha, IEEE, Elsevier (numerado), Vancouver, AMA, CSE, ISO 690, Harvard, ABNT NBR 6023, ACS y Nature.
- Copiar cita, generar bibliografía (de la vista o completa, a portapapeles o archivo).
- **Cite While You Write con Word**: copia la cita temporal `{Autor, Año #N}`, pégala en tu documento y luego **formatea el documento** con bibliografía final automática.
- Exportar RIS / BibTeX / respaldo JSON; **restaurar respaldo**.
- Enviar la referencia por correo (cita formateada + enlace DOI) e imprimir la vista (Ctrl+P).

### Más
- 12 tipos de referencia (artículo, libro, capítulo, conferencia, tesis, informe, página web, prensa, datos, software…).
- **Matcher de manuscrito**: sugiere revistas afines a partir de tu título y resumen.
- Búsqueda avanzada, visor de PDF en ventana propia, tema claro/oscuro y atajos de teclado.

## 🗂 Estructura del proyecto
- `main.js` — proceso principal de Electron (ventana, IPC, asociación de archivos, instancia única).
- `preload.js` — puente seguro contextBridge.
- `app.js` — toda la lógica de la interfaz (menús, citas, importación/exportación, búsqueda en línea…).
- `citewell.html` — interfaz y estilos al estilo EndNote.
- `package.json` — configuración de build (NSIS + asociaciones de archivos).

---

## 🚀 Instalación (usuario final)

Descarga el instalador más reciente en **Releases** y ejecútalo (`BioCiencia Setup 1.0.0.exe`):

1. Si Windows SmartScreen avisa (la app no está firmada): **Más información → Ejecutar de todas formas**.
2. La instalación es automática (one-click): crea accesos directos y registra `.ris`/`.bib` para abrir con BioCiencia.
3. Tus datos se crearán al primer uso en `%APPDATA%\BioCiencia` — nunca salen de tu equipo.

## 🛠 Compilar desde el código (desarrolladores)

```bash
git clone https://github.com/<tu-usuario>/biociencia.git
cd biociencia
npm install
npm start                        # ejecutar en modo desarrollo
npm run dist                     # generar el instalador NSIS en dist/
```

Requisitos: Node.js 18+ y Windows (para el instalador NSIS).

## 🤝 Contribuir

¡Toda colaboración es bienvenida! Áreas especialmente útiles:

- Más estilos de citación o mejoras a los existentes (`citar()` en `app.js`).
- Importadores adicionales (EndNote XML, Medline, Web of Science CSV…).
- Integración real con Microsoft Word (plantilla OOXML).
- Accesibilidad, traducciones y pruebas.

Flujo estándar: bifurcar (fork) → crear rama → cambios → pull request.

## 📄 Licencia

**MIT** — puedes usar, copiar, modificar y redistribuir BioCiencia libremente, incluso en proyectos comerciales, manteniendo el aviso de licencia. BioCiencia es un proyecto independiente; no está afiliado a Clarivate ni reproduce material registrado de EndNote.
