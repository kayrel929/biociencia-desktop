// BioCiencia (antes CiteWell) — shell de escritorio; guarda la biblioteca y los
// PDF adjuntos como archivos reales en ESTA máquina (carpeta user-data).
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");

const DATA_DIR = app.getPath("userData");
const LIB_FILE = path.join(DATA_DIR, "library.json");
const PDF_DIR  = path.join(DATA_DIR, "pdfs");

// Migración de datos desde la versión anterior (productName "CiteWell"):
// si la carpeta de BioCiencia no tiene biblioteca pero CiteWell sí, se copian
// library.json y pdfs/ para no perder nada de lo ya guardado.
function migrarDatosViejos() {
  try {
    if (path.basename(DATA_DIR).toLowerCase() === "biociencia") {
      const viejo = path.join(os.homedir(), "AppData", "Roaming", "CiteWell");
      const viejaLib = path.join(viejo, "library.json");
      if (fs.existsSync(viejaLib) && !fs.existsSync(LIB_FILE)) {
        fs.cpSync(viejaLib, LIB_FILE);
        const viejosPdfs = path.join(viejo, "pdfs");
        if (fs.existsSync(viejosPdfs) && !fs.existsSync(PDF_DIR)) {
          fs.cpSync(viejosPdfs, PDF_DIR, { recursive: true });
        }
      }
    }
  } catch (e) {}
}
migrarDatosViejos();


function ensureDirs() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.mkdirSync(PDF_DIR, { recursive: true }); } catch (e) {}
}
function pdfPath(id) {
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "");
  return path.join(PDF_DIR, safe + ".pdf");
}

ipcMain.handle("lib:load", async () => {
  try { return JSON.parse(fs.readFileSync(LIB_FILE, "utf8")); } catch (e) { return null; }
});
ipcMain.handle("lib:save", async (_e, data) => {
  try { ensureDirs(); fs.writeFileSync(LIB_FILE, JSON.stringify(data, null, 2), "utf8"); return true; } catch (e) { return false; }
});
ipcMain.handle("pdf:save", async (_e, id, buf) => {
  try { ensureDirs(); fs.writeFileSync(pdfPath(id), Buffer.from(buf)); return true; } catch (e) { return false; }
});
ipcMain.handle("pdf:read", async (_e, id) => {
  try { const b = fs.readFileSync(pdfPath(id)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
  catch (e) { return null; }
});
ipcMain.handle("pdf:del", async (_e, id) => {
  try { fs.unlinkSync(pdfPath(id)); } catch (e) {} return true;
});
ipcMain.handle("pdf:open", async (_e, id) => {
  const p = pdfPath(id);
  if (fs.existsSync(p)) { await shell.openPath(p); return true; }
  return false;
});
// visor de PDF en una ventana propia de BioCiencia
ipcMain.handle("pdf:window", (_e, id) => {
  const p = pdfPath(id);
  if (!fs.existsSync(p)) return false;
  const w = new BrowserWindow({
    width: 980, height: 760, autoHideMenuBar: true,
    title: "PDF — BioCiencia", parent: null
  });
  w.loadURL("file:///" + p.replace(/\\/g, "/"));
  return true;
});
ipcMain.handle("app:dataDir", async () => DATA_DIR);

ipcMain.handle("file:saveAs", async (_e, opts) => {
  const res = await dialog.showSaveDialog({ defaultPath: opts.defaultName, filters: opts.filters || [] });
  return res.canceled ? null : res.filePath;
});
ipcMain.handle("file:write", async (_e, ruta, contenido) => {
  try { fs.writeFileSync(ruta, contenido, "utf8"); return true; } catch (e) { return false; }
});
ipcMain.handle("file:open", async (_e, opts) => {
  const res = await dialog.showOpenDialog({ filters: opts.filters || [], properties: ["openFile"] });
  if (res.canceled || !res.filePaths.length) return null;
  const ruta = res.filePaths[0];
  try { return { path: ruta, content: fs.readFileSync(ruta, "utf8") }; } catch (e) { return null; }
});
// dialogo para elegir PDF y guardar copia como pdfs/<id>.pdf
ipcMain.handle("pdf:import", async (_e, id) => {
  const res = await dialog.showOpenDialog({ filters: [{ name: "PDF", extensions: ["pdf"] }], properties: ["openFile"] });
  if (res.canceled || !res.filePaths.length) return false;
  try {
    ensureDirs();
    fs.copyFileSync(res.filePaths[0], pdfPath(id));
    return true;
  } catch (e) { return false; }
});

// ===== Apertura por doble clic (archivos .ris / .bib de EndNote, Zotero, etc.) =====
let mainWin = null;
// Extrae la ruta de un archivo de cita pasada como argumento al ejecutable
function rutaCitaDeArgs(args) {
  return (args || []).map(a => {
    try {
      const u = a.startsWith("bio") && a.includes("://") ? new URL(a).pathname : null;
      return u ? decodeURIComponent(u) : a;
    } catch (e) { return a; }
  }).find(a => /\.(ris|bib|enw|ciw|txt)$/i.test(a) && fs.existsSync(a)) || null;
}
// Manda el contenido del archivo al programa (que lo importa y lo guarda)
function abrirArchivoCita(ruta) {
  if (!ruta || !mainWin || mainWin.isDestroyed()) return;
  try {
    console.log("[cita-archivo] importando:", ruta);
    const contenido = fs.readFileSync(ruta, "utf8");
    mainWin.webContents.send("arch:abierto", { ruta, contenido });
    mainWin.show(); mainWin.focus();
  } catch (e) {}
}
// Una sola instancia: si el programa ya está abierto, el doble clic se le pasa a él
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
app.on("second-instance", (_e, args) => {
  if (mainWin && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore();
    abrirArchivoCita(rutaCitaDeArgs(args));
  } else createWindow();
});
// macOS: apertura por Finder
app.on("open-file", (e, ruta) => { e.preventDefault(); abrirArchivoCita(ruta); });

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    title: "BioCiencia",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu(); // BioCiencia trae su propia interfaz
  win.loadFile(path.join(__dirname, "citewell.html"));
  mainWin = win;
  // si se arrancó con un archivo de cita (doble clic), importarlo al terminar de cargar
  win.webContents.on("did-finish-load", () => { abrirArchivoCita(rutaCitaDeArgs(process.argv)); });
  // open external links (DOI, URLs) in the system browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
