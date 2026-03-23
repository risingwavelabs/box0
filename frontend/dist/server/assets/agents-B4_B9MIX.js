import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/agents.tsx?tsr-split=component
function AgentsPage() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "page-header",
		children: /* @__PURE__ */ jsx("h2", { children: "Agents" })
	}), /* @__PURE__ */ jsx("div", {
		className: "empty-state",
		children: /* @__PURE__ */ jsx("p", { children: "Agent list and actions will use GET workspace-scoped /agents." })
	})] });
}
//#endregion
export { AgentsPage as component };
