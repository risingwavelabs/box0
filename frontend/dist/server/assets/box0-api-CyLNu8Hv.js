//#region src/lib/box0-api.ts
var API_KEY = "b0_api_key";
var WORKSPACE_KEY = "b0_workspace";
function getStoredApiKey() {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem(API_KEY);
}
function setStoredApiKey(key) {
	localStorage.setItem(API_KEY, key);
}
function clearStoredAuth() {
	localStorage.removeItem(API_KEY);
	localStorage.removeItem(WORKSPACE_KEY);
}
function getStoredWorkspace() {
	if (typeof localStorage === "undefined") return null;
	return localStorage.getItem(WORKSPACE_KEY);
}
function setStoredWorkspace(name) {
	localStorage.setItem(WORKSPACE_KEY, name);
}
function apiHeaders() {
	const h = { "Content-Type": "application/json" };
	const key = getStoredApiKey();
	if (key) h["X-API-Key"] = key;
	return h;
}
async function apiGet(path) {
	const res = await fetch(path, { headers: apiHeaders() });
	const data = await res.json();
	if (res.status === 401) {
		clearStoredAuth();
		throw new Error("Unauthorized");
	}
	if (!res.ok) throw new Error(data.error || "Request failed");
	return data;
}
async function validateApiKey(key) {
	return (await fetch("/workspaces", { headers: {
		"Content-Type": "application/json",
		"X-API-Key": key
	} })).ok;
}
//#endregion
export { setStoredApiKey as a, getStoredWorkspace as i, clearStoredAuth as n, setStoredWorkspace as o, getStoredApiKey as r, validateApiKey as s, apiGet as t };
