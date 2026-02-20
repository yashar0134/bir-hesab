const { contextBridge, ipcRenderer } = require("electron");

const invokeChannels = new Set([
  "services:list",
  "services:create",
  "services:update",
  "services:delete",
  "projects:list",
  "projects:create",
  "projects:update",
  "projects:delete",
  "partners:list",
  "partners:create",
  "partners:update",
  "partners:delete",
  "partners:terms:list",
  "partners:terms:upsert",
  "partners:terms:delete",
  "partners:payables:list",
  "settlements:list",
  "settlements:create",
  "settlements:update",
  "settlements:delete",
  "expenses:list",
  "expenses:create",
  "expenses:update",
  "expenses:delete",
  "cashbox:list",
  "cashbox:create",
  "cashbox:update",
  "cashbox:delete",
  "reports:business",
  "reports:export:excel",
  "reports:export:pdf",
  "system:backup:settings:get",
  "system:backup:settings:update",
  "system:backup:auto:run",
  "system:backup:create",
  "system:backup:restore",
  "updater:check",
  "updater:download",
  "updater:install"
]);

const eventChannels = new Set([
  "update:available",
  "update:none",
  "update:error",
  "update:download-progress",
  "update:downloaded",
  "update:installing"
]);

contextBridge.exposeInMainWorld("birHesab", {
  invoke(channel, payload = {}) {
    if (!invokeChannels.has(channel)) {
      throw new Error(`Channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, callback) {
    if (!eventChannels.has(channel)) {
      throw new Error(`Event channel not allowed: ${channel}`);
    }
    const wrapped = (_, data) => callback(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});
