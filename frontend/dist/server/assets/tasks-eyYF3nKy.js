import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/tasks.tsx?tsr-split=component
function TasksPage() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "page-header",
		children: /* @__PURE__ */ jsx("h2", { children: "Tasks" })
	}), /* @__PURE__ */ jsx("div", {
		className: "card",
		children: /* @__PURE__ */ jsx("div", {
			className: "card-body",
			children: /* @__PURE__ */ jsxs("p", {
				style: {
					color: "var(--text-secondary)",
					fontSize: 14
				},
				children: [
					"Task board and chat will connect to the Box0 API here (same behavior as the static dashboard in",
					" ",
					/* @__PURE__ */ jsx("code", {
						style: {
							fontFamily: "var(--mono)",
							fontSize: 12
						},
						children: "box0-core/web/index.html"
					}),
					")."
				]
			})
		})
	})] });
}
//#endregion
export { TasksPage as component };
