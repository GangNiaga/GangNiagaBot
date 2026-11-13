import {
  afterAll,
  afterEach,
  beforeAll,
  expect,
  spyOn,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Route as RootRoute } from "@/routes/__root";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost/" }));
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});

test("an unmatched route renders a 404 view without redirecting", async () => {
  const root = createRootRoute({
    notFoundComponent: RootRoute.options.notFoundComponent,
  });
  const home = createRoute({
    component: () => <p>Home</p>,
    getParentRoute: () => root,
    path: "/",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/missing"] }),
    routeTree: root.addChildren([home]),
  });

  const view = render(<RouterProvider router={router as never} />);

  expect(await view.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  expect(router.state.location.pathname).toBe("/missing");
});

test("a route error renders an alert with retry and back controls", async () => {
  const consoleError = spyOn(console, "error").mockImplementation(() => {});
  const root = createRootRoute({
    errorComponent: RootRoute.options.errorComponent,
  });
  const broken = createRoute({
    component: () => {
      throw new Error("The route could not be loaded.");
    },
    getParentRoute: () => root,
    path: "/",
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: root.addChildren([broken]),
  });

  try {
    const view = render(<RouterProvider router={router as never} />);

    const alert = await view.findByRole("alert");
    expect(alert.textContent).toContain("The route could not be loaded.");
    await waitFor(() => expect(document.activeElement?.id).toBe("root-error-title"));
    expect(view.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Go back" })).toBeTruthy();
  } finally {
    consoleError.mockRestore();
  }
});
