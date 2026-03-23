import { t as Route } from "./agents._name-HkUs4eUB.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/agents.$name.tsx?tsr-split=component
function AgentDetailPage() {
	const { name } = Route.useParams();
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("div", {
			style: { marginBottom: 16 },
			children: /* @__PURE__ */ jsx(Link, {
				to: "/agents",
				style: {
					color: "var(--text-secondary)",
					textDecoration: "none",
					fontSize: 13
				},
				children: "← Agents"
			})
		}),
		/* @__PURE__ */ jsx("div", {
			className: "page-header",
			children: /* @__PURE__ */ jsx("h2", { children: decodeURIComponent(name) })
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "card",
			children: [/* @__PURE__ */ jsx("div", {
				className: "card-header",
				children: "Conversations"
			}), /* @__PURE__ */ jsx("div", {
				className: "card-body",
				children: /* @__PURE__ */ jsx("p", {
					style: {
						color: "var(--text-secondary)",
						fontSize: 13
					},
					children: "Thread list and inbox UI to be ported from the reference dashboard."
				})
			})]
		})
	] });
}
//#endregion
export { AgentDetailPage as component };
