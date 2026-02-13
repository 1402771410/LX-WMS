const { contextBridge, ipcRenderer } = require("electron");

const api = {
  getInitState: () => ipcRenderer.invoke("app:get-init-state"),
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  openExternal: (payload) => ipcRenderer.invoke("app:open-external", payload),
  registerAdmin: (payload) => ipcRenderer.invoke("auth:register-admin", payload),
  sendAdminEmailCode: (payload) =>
    ipcRenderer.invoke("auth:send-admin-email-code", payload),
  getAdminEmailStatus: (payload) =>
    ipcRenderer.invoke("admin:get-email-status", payload),
  sendAdminBindEmailCode: (payload) =>
    ipcRenderer.invoke("admin:send-bind-email-code", payload),
  bindAdminEmail: (payload) => ipcRenderer.invoke("admin:bind-email", payload),
  login: (payload) => ipcRenderer.invoke("auth:login", payload),
  confirmRecoveryKey: (payload) =>
    ipcRenderer.invoke("auth:confirm-recovery-key", payload),
  validateRecoveryKey: (payload) =>
    ipcRenderer.invoke("auth:validate-recovery-key", payload),
  resetPasswordByKey: (payload) =>
    ipcRenderer.invoke("auth:reset-password-by-key", payload),
  sendResetEmailCode: (payload) =>
    ipcRenderer.invoke("auth:send-reset-email-code", payload),
  resetPasswordByEmail: (payload) =>
    ipcRenderer.invoke("auth:reset-password-by-email", payload),
  changePassword: (payload) => ipcRenderer.invoke("auth:change-password", payload),
  revealRecoveryKey: (payload) =>
    ipcRenderer.invoke("auth:reveal-recovery-key", payload),
  listUsers: () => ipcRenderer.invoke("user:list"),
  createUser: (payload) => ipcRenderer.invoke("user:create", payload),
  updateUserRole: (payload) => ipcRenderer.invoke("user:update-role", payload),
  updateUserStatus: (payload) => ipcRenderer.invoke("user:update-status", payload),
  resetUserPassword: (payload) => ipcRenderer.invoke("user:reset-password", payload),
  deleteUser: (payload) => ipcRenderer.invoke("user:delete", payload),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  createBackup: (payload) => ipcRenderer.invoke("backup:create", payload),
  readBackup: (payload) => ipcRenderer.invoke("backup:read", payload),
  deleteBackup: (payload) => ipcRenderer.invoke("backup:delete", payload),
  exportBackup: (payload) => ipcRenderer.invoke("backup:export", payload),
  restoreDatabase: (payload) => ipcRenderer.invoke("backup:restore-database", payload),
  getMailSettings: () => ipcRenderer.invoke("mail:get-settings"),
  getMailStatus: () => ipcRenderer.invoke("mail:get-status"),
  saveMailSettings: (payload) => ipcRenderer.invoke("mail:save-settings", payload),
  testMail: (payload) => ipcRenderer.invoke("mail:test", payload),
};

contextBridge.exposeInMainWorld("api", api);
