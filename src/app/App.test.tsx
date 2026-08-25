import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/app/App";

describe("App", () => {
  it("renders the accessible application shell and catalogue route", () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

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
});
