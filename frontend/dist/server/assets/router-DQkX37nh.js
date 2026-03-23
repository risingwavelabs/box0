import { r as getStoredApiKey } from "./box0-api-CyLNu8Hv.js";
import { t as Route$9 } from "./tasks._taskId-6j_NPjMe.js";
import { t as Route$10 } from "./machines._machineId-CYBbV_TT.js";
import { t as Route$11 } from "./agents._name-HkUs4eUB.js";
import "react";
import { ErrorComponent, HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRouteWithContext, createRouter, lazyRouteComponent, redirect, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
//#region src/components/DefaultCatchBoundary.tsx
function DefaultCatchBoundary({ error }) {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId
	});
	console.error(error);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6",
		children: [/* @__PURE__ */ jsx(ErrorComponent, { error }), /* @__PURE__ */ jsxs("div", {
			className: "flex gap-2 items-center flex-wrap",
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => {
					router.invalidate();
				},
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				children: "Try Again"
			}), isRoot ? /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				children: "Home"
			}) : /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: `px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`,
				onClick: (e) => {
					e.preventDefault();
					window.history.back();
				},
				children: "Go Back"
			})]
		})]
	});
}
//#endregion
//#region src/components/NotFound.tsx
function NotFound({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-2 p-2",
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-gray-600 dark:text-gray-400",
			children: children || /* @__PURE__ */ jsx("p", { children: "The page you are looking for does not exist." })
		}), /* @__PURE__ */ jsxs("p", {
			className: "flex items-center gap-2 flex-wrap",
			children: [/* @__PURE__ */ jsx("button", {
				onClick: () => window.history.back(),
				className: "bg-emerald-500 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
				children: "Go back"
			}), /* @__PURE__ */ jsx(Link, {
				to: "/",
				className: "bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm",
				children: "Start Over"
			})]
		})]
	});
}
//#endregion
//#region src/styles/app.css?url
var app_default = "/assets/app-CCrFz1M9.css";
//#endregion
//#region src/utils/seo.ts
var seo = ({ title, description, keywords, image }) => {
	return [
		{ title },
		{
			name: "description",
			content: description
		},
		{
			name: "keywords",
			content: keywords
		},
		{
			name: "twitter:title",
			content: title
		},
		{
			name: "twitter:description",
			content: description
		},
		{
			name: "twitter:creator",
			content: "@tannerlinsley"
		},
		{
			name: "twitter:site",
			content: "@tannerlinsley"
		},
		{
			name: "og:type",
			content: "website"
		},
		{
			name: "og:title",
			content: title
		},
		{
			name: "og:description",
			content: description
		},
		...image ? [
			{
				name: "twitter:image",
				content: image
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				name: "og:image",
				content: image
			}
		] : []
	];
};
//#endregion
//#region src/routes/__root.tsx
var Route$8 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			...seo({
				title: "Box0 Dashboard",
				description: "Box0 multi-agent platform dashboard."
			})
		],
		links: [
			{
				rel: "stylesheet",
				href: app_default
			},
			{
				rel: "apple-touch-icon",
				sizes: "180x180",
				href: "/apple-touch-icon.png"
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "32x32",
				href: "/favicon-32x32.png"
			},
			{
				rel: "icon",
				type: "image/png",
				sizes: "16x16",
				href: "/favicon-16x16.png"
			},
			{
				rel: "manifest",
				href: "/site.webmanifest",
				color: "#fffff"
			},
			{
				rel: "icon",
				href: "/favicon.ico"
			}
		]
	}),
	errorComponent: (props) => {
		return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(DefaultCatchBoundary, { ...props }) });
	},
	notFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {}),
	component: RootComponent
});
function RootComponent() {
	return /* @__PURE__ */ jsx(RootDocument, { children: /* @__PURE__ */ jsx(Outlet, {}) });
}
function RootDocument({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [
			children,
			/* @__PURE__ */ jsx("div", {
				className: "toast-container",
				id: "toast-container"
			}),
			/* @__PURE__ */ jsx(TanStackRouterDevtools, { position: "bottom-right" }),
			/* @__PURE__ */ jsx(ReactQueryDevtools, { buttonPosition: "bottom-left" }),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
}
//#endregion
//#region src/routes/login.tsx
var $$splitComponentImporter$7 = () => import("./login-Dgo_0T_9.js");
var Route$7 = createFileRoute("/login")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
//#endregion
//#region src/routes/_box0.tsx
var $$splitComponentImporter$6 = () => import("./_box0-sgFtLq-5.js");
var Route$6 = createFileRoute("/_box0")({
	beforeLoad: () => {
		if (typeof window === "undefined") return;
		if (!getStoredApiKey()) throw redirect({ to: "/login" });
	},
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter$5 = () => import("./routes-BPQkWcsy.js");
var Route$5 = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({
			to: "/tasks",
			replace: true
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
//#endregion
//#region src/routes/_box0/workspaces.tsx
var $$splitComponentImporter$4 = () => import("./workspaces-DmafRZP2.js");
var Route$4 = createFileRoute("/_box0/workspaces")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
//#endregion
//#region src/routes/_box0/users.tsx
var $$splitComponentImporter$3 = () => import("./users-rX22HMAW.js");
var Route$3 = createFileRoute("/_box0/users")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
//#endregion
//#region src/routes/_box0/tasks.tsx
var $$splitComponentImporter$2 = () => import("./tasks-eyYF3nKy.js");
var Route$2 = createFileRoute("/_box0/tasks")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
//#endregion
//#region src/routes/_box0/machines.tsx
var $$splitComponentImporter$1 = () => import("./machines-USb3q2kO.js");
var Route$1 = createFileRoute("/_box0/machines")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
//#endregion
//#region src/routes/_box0/agents.tsx
var $$splitComponentImporter = () => import("./agents-B4_B9MIX.js");
var Route = createFileRoute("/_box0/agents")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
//#endregion
//#region src/routeTree.gen.ts
var LoginRoute = Route$7.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$8
});
var Box0Route = Route$6.update({
	id: "/_box0",
	getParentRoute: () => Route$8
});
var IndexRoute = Route$5.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$8
});
var Box0WorkspacesRoute = Route$4.update({
	id: "/workspaces",
	path: "/workspaces",
	getParentRoute: () => Box0Route
});
var Box0UsersRoute = Route$3.update({
	id: "/users",
	path: "/users",
	getParentRoute: () => Box0Route
});
var Box0TasksRoute = Route$2.update({
	id: "/tasks",
	path: "/tasks",
	getParentRoute: () => Box0Route
});
var Box0MachinesRoute = Route$1.update({
	id: "/machines",
	path: "/machines",
	getParentRoute: () => Box0Route
});
var Box0AgentsRoute = Route.update({
	id: "/agents",
	path: "/agents",
	getParentRoute: () => Box0Route
});
var Box0TasksTaskIdRoute = Route$9.update({
	id: "/$taskId",
	path: "/$taskId",
	getParentRoute: () => Box0TasksRoute
});
var Box0MachinesMachineIdRoute = Route$10.update({
	id: "/$machineId",
	path: "/$machineId",
	getParentRoute: () => Box0MachinesRoute
});
var Box0AgentsRouteChildren = { Box0AgentsNameRoute: Route$11.update({
	id: "/$name",
	path: "/$name",
	getParentRoute: () => Box0AgentsRoute
}) };
var Box0AgentsRouteWithChildren = Box0AgentsRoute._addFileChildren(Box0AgentsRouteChildren);
var Box0MachinesRouteChildren = { Box0MachinesMachineIdRoute };
var Box0MachinesRouteWithChildren = Box0MachinesRoute._addFileChildren(Box0MachinesRouteChildren);
var Box0TasksRouteChildren = { Box0TasksTaskIdRoute };
var Box0RouteChildren = {
	Box0AgentsRoute: Box0AgentsRouteWithChildren,
	Box0MachinesRoute: Box0MachinesRouteWithChildren,
	Box0TasksRoute: Box0TasksRoute._addFileChildren(Box0TasksRouteChildren),
	Box0UsersRoute,
	Box0WorkspacesRoute
};
var rootRouteChildren = {
	IndexRoute,
	Box0Route: Box0Route._addFileChildren(Box0RouteChildren),
	LoginRoute
};
var routeTree = Route$8._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
function getRouter() {
	const queryClient = new QueryClient();
	const router = createRouter({
		routeTree,
		context: { queryClient },
		defaultPreload: "intent",
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => /* @__PURE__ */ jsx(NotFound, {})
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient
	});
	return router;
}
//#endregion
export { getRouter };
