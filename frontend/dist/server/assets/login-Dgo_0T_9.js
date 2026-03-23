import { a as setStoredApiKey, r as getStoredApiKey, s as validateApiKey, t as apiGet } from "./box0-api-CyLNu8Hv.js";
import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/login.tsx?tsr-split=component
function LoginPage() {
	const navigate = useNavigate();
	const [key, setKey] = React.useState("");
	const [error, setError] = React.useState(null);
	React.useEffect(() => {
		if (!getStoredApiKey()) return;
		apiGet("/workspaces").then(() => {
			navigate({ to: "/tasks" });
		}).catch(() => {});
	}, [navigate]);
	React.useEffect(() => {
		const urlKey = new URLSearchParams(window.location.search).get("key");
		if (!urlKey) return;
		window.history.replaceState({}, "", window.location.pathname);
		validateApiKey(urlKey).then((ok) => {
			if (ok) {
				setStoredApiKey(urlKey);
				navigate({ to: "/tasks" });
			}
		});
	}, [navigate]);
	const onSubmit = async () => {
		const trimmed = key.trim();
		if (!trimmed) return;
		setError(null);
		if (!await validateApiKey(trimmed)) {
			setError("Invalid API key");
			return;
		}
		setStoredApiKey(trimmed);
		navigate({ to: "/tasks" });
	};
	return /* @__PURE__ */ jsx("div", {
		className: "login-page",
		children: /* @__PURE__ */ jsxs("div", {
			className: "login-box",
			children: [
				/* @__PURE__ */ jsx("h1", { children: "Box0" }),
				/* @__PURE__ */ jsx("p", { children: "Enter your API key to access the dashboard." }),
				error ? /* @__PURE__ */ jsx("div", {
					className: "login-error",
					style: { display: "block" },
					children: error
				}) : /* @__PURE__ */ jsx("div", { className: "login-error" }),
				/* @__PURE__ */ jsx("input", {
					type: "password",
					value: key,
					onChange: (e) => setKey(e.target.value),
					onKeyDown: (e) => e.key === "Enter" && void onSubmit(),
					placeholder: "API key",
					autoComplete: "off"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					className: "btn btn-primary",
					style: { width: "100%" },
					onClick: () => void onSubmit(),
					children: "Sign in"
				})
			]
		})
	});
}
//#endregion
export { LoginPage as component };
