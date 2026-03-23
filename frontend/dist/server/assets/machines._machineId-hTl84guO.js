import { t as Route } from "./machines._machineId-CYBbV_TT.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/machines.$machineId.tsx?tsr-split=component
function MachineDetailPage() {
	const { machineId } = Route.useParams();
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("div", {
			style: { marginBottom: 16 },
			children: /* @__PURE__ */ jsx(Link, {
				to: "/machines",
				style: {
					color: "var(--text-secondary)",
					textDecoration: "none",
					fontSize: 13
				},
				children: "← Machines"
			})
		}),
		/* @__PURE__ */ jsx("div", {
			className: "page-header",
			children: /* @__PURE__ */ jsx("h2", { children: decodeURIComponent(machineId) })
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "card",
			children: [/* @__PURE__ */ jsx("div", {
				className: "card-header",
				children: "Agents on this machine"
			}), /* @__PURE__ */ jsx("div", {
				className: "card-body",
				children: /* @__PURE__ */ jsx("p", {
					style: {
						color: "var(--text-secondary)",
						fontSize: 13
					},
					children: "Detail view to match the reference HTML app."
				})
			})]
		})
	] });
}
//#endregion
export { MachineDetailPage as component };
