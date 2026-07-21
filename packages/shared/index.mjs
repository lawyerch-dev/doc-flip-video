// @doc-flip/shared — 共享路径、配置、工具函数
export * from "./paths.mjs";
export { getSettings, updateSettings, saveSettings, nextIssueNumber, today } from "./settings.mjs";
export { json, errorResponse, readBody, readBuffer, parseJson } from "./http.mjs";
