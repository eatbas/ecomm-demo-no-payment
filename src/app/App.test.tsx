import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the accessible application shell and catalogue route", () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(document.title).toBe("Common Goods");
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Useful goods, chosen to last." }),
    ).toBeInTheDocument();
  });

  it("renders the not-found route for an unknown address", () => {
    window.history.replaceState({}, "", "/missing-page");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "This page could not be found." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to the shop" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("registers the admin route, gated behind sign-in, without adding it to customer navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, { status: 401 }),
      ),
    );
    window.history.replaceState({}, "", "/admin");

    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Admin sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).not.toHaveTextContent("Admin");
    expect(document.title).toBe("Admin | Common Goods");

    await user.click(screen.getByRole("link", { name: "Shop" }));
    expect(document.title).toBe("Common Goods");
  });
});
