import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/workspaces.tsx?tsr-split=component
function WorkspacesPage() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "page-header",
		children: /* @__PURE__ */ jsx("h2", { children: "Workspaces" })
	}), /* @__PURE__ */ jsx("div", {
		className: "empty-state",
		children: /* @__PURE__ */ jsx("p", { children: "Create workspace and members flows will use /workspaces APIs." })
	})] });
}
//#endregion
export { WorkspacesPage as component };
