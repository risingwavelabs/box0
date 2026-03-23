import { i as getStoredWorkspace, n as clearStoredAuth, o as setStoredWorkspace, t as apiGet } from "./box0-api-CyLNu8Hv.js";
import * as React from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0.tsx?tsr-split=component
function Box0Layout() {
	const navigate = useNavigate();
	const [workspaces, setWorkspaces] = React.useState([]);
	const [workspace, setWorkspace] = React.useState(() => {
		return getStoredWorkspace() || "";
	});
	React.useEffect(() => {
		apiGet("/workspaces").then((data) => {
			const list = data.workspaces || [];
			setWorkspaces(list);
			const saved = getStoredWorkspace();
			if (saved && list.some((w) => w.name === saved)) setWorkspace(saved);
			else if (list[0]) {
				setWorkspace(list[0].name);
				setStoredWorkspace(list[0].name);
			}
		}).catch(() => {
			clearStoredAuth();
			navigate({ to: "/login" });
		});
	}, [navigate]);
	const onWorkspaceChange = (name) => {
		setWorkspace(name);
		setStoredWorkspace(name);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "app-layout",
		children: [/* @__PURE__ */ jsxs("nav", {
			className: "sidebar",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "sidebar-logo",
					children: ["Box", /* @__PURE__ */ jsx("span", { children: "0" })]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "sidebar-nav",
					children: /* @__PURE__ */ jsxs(Link, {
						to: "/tasks",
						activeOptions: { exact: false },
						activeProps: { className: "active" },
						className: "",
						children: [/* @__PURE__ */ jsx("span", {
							className: "nav-icon",
							children: "T"
						}), " Tasks"]
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sidebar-nav",
					style: {
						borderTop: "1px solid rgba(255,255,255,0.08)",
						paddingTop: 8
					},
					children: [
						/* @__PURE__ */ jsxs(Link, {
							to: "/agents",
							activeProps: { className: "active" },
							style: {
								fontSize: 13,
								opacity: .7
							},
							children: [/* @__PURE__ */ jsx("span", {
								className: "nav-icon",
								children: "A"
							}), " Agents"]
						}),
						/* @__PURE__ */ jsxs(Link, {
							to: "/machines",
							activeProps: { className: "active" },
							style: {
								fontSize: 13,
								opacity: .7
							},
							children: [/* @__PURE__ */ jsx("span", {
								className: "nav-icon",
								children: "M"
							}), " Machines"]
						}),
						/* @__PURE__ */ jsxs(Link, {
							to: "/users",
							activeProps: { className: "active" },
							style: {
								fontSize: 13,
								opacity: .7
							},
							children: [/* @__PURE__ */ jsx("span", {
								className: "nav-icon",
								children: "U"
							}), " Users"]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sidebar-group",
					children: [/* @__PURE__ */ jsx("label", { children: "Workspace" }), /* @__PURE__ */ jsxs("div", {
						style: {
							display: "flex",
							gap: 6,
							alignItems: "center"
						},
						children: [/* @__PURE__ */ jsx("select", {
							value: workspace,
							onChange: (e) => onWorkspaceChange(e.target.value),
							style: { flex: 1 },
							children: workspaces.map((w) => /* @__PURE__ */ jsx("option", {
								value: w.name,
								children: w.name
							}, w.name))
						}), /* @__PURE__ */ jsx(Link, {
							to: "/workspaces",
							title: "Manage workspaces",
							style: {
								color: "var(--text-sidebar)",
								opacity: .5,
								fontSize: 16,
								textDecoration: "none",
								padding: 2
							},
							children: "⚙"
						})]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "sidebar-footer",
					children: [/* @__PURE__ */ jsx("div", { className: "user-name" }), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => {
							clearStoredAuth();
							navigate({ to: "/login" });
						},
						children: "Sign out"
					})]
				})
			]
		}), /* @__PURE__ */ jsx("main", {
			className: "main-content",
			children: /* @__PURE__ */ jsx(Outlet, {})
		})]
	});
}
//#endregion
export { Box0Layout as component };
