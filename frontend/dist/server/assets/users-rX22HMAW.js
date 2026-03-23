import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/_box0/users.tsx?tsr-split=component
function UsersPage() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "page-header",
		children: /* @__PURE__ */ jsx("h2", { children: "Users" })
	}), /* @__PURE__ */ jsx("div", {
		className: "empty-state",
		children: /* @__PURE__ */ jsx("p", { children: "Admin user list will use GET /users." })
	})] });
}
//#endregion
export { UsersPage as component };
