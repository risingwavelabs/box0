import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/machines.tsx?tsr-split=component
function MachinesPage() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "page-header",
		children: /* @__PURE__ */ jsx("h2", { children: "Machines" })
	}), /* @__PURE__ */ jsx("div", {
		className: "empty-state",
		children: /* @__PURE__ */ jsx("p", { children: "Machine table will use GET /machines." })
	})] });
}
//#endregion
export { MachinesPage as component };
