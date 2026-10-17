// preload.js — safe bridge between the BioCiencia UI and the local file system
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("citewell", {
  // opening a citation file by double-click (.ris / .bib)
  onArchivoAbierto: (cb) => ipcRenderer.on("arch:abierto", (_e, datos) => cb(datos)),
  // library persistence (library.json in the app's user-data folder)
  loadLibrary: () => ipcRenderer.invoke("lib:load"),
  saveLibrary: (data) => ipcRenderer.invoke("lib:save", data),

  // PDF attachments stored as real files (pdfs/<id>.pdf)
  savePdf: (id, arrayBuffer) => ipcRenderer.invoke("pdf:save", id, new Uint8Array(arrayBuffer)),
  readPdf: (id) => ipcRenderer.invoke("pdf:read", id),
  deletePdf: (id) => ipcRenderer.invoke("pdf:del", id),
  openPdf: (id) => ipcRenderer.invoke("pdf:open", id),
  pdfWindow: (id) => ipcRenderer.invoke("pdf:window", id),
  importPdf: (id) => ipcRenderer.invoke("pdf:import", id),

  // file dialogs for export / import (UTF-8 text)
  saveFileAs: (opts) => ipcRenderer.invoke("file:saveAs", opts),
  writeFile: (ruta, contenido) => ipcRenderer.invoke("file:write", ruta, contenido),
  openFile: (opts) => ipcRenderer.invoke("file:open", opts),

  // info
  dataDir: () => ipcRenderer.invoke("app:dataDir")
});
