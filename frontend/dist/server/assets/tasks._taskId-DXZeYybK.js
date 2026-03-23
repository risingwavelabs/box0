import { t as Route } from "./tasks._taskId-6j_NPjMe.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/tasks.$taskId.tsx?tsr-split=component
function TaskDetailPage() {
	const { taskId } = Route.useParams();
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("div", {
			style: { marginBottom: 16 },
			children: /* @__PURE__ */ jsx(Link, {
				to: "/tasks",
				style: {
					color: "var(--text-secondary)",
					textDecoration: "none",
					fontSize: 13
				},
				children: "← Tasks"
			})
		}),
		/* @__PURE__ */ jsx("div", {
			className: "page-header",
			children: /* @__PURE__ */ jsx("h2", { children: "Task" })
		}),
		/* @__PURE__ */ jsx("div", {
			className: "card",
			children: /* @__PURE__ */ jsx("div", {
				className: "card-body",
				children: /* @__PURE__ */ jsxs("dl", {
					className: "detail-grid",
					children: [/* @__PURE__ */ jsx("dt", { children: "ID" }), /* @__PURE__ */ jsx("dd", {
						style: {
							fontFamily: "var(--mono)",
							fontSize: 12
						},
						children: taskId
					})]
				})
			})
		})
	] });
}
//#endregion
export { TaskDetailPage as component };
