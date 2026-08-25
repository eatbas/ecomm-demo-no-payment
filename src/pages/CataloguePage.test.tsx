import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import { CataloguePage } from "@/pages/CataloguePage";

describe("CataloguePage", () => {
  it("renders the complete three-product catalogue as a semantic list", () => {
    render(
      <AppProviders>
        <CataloguePage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { name: "Useful goods, chosen to last." }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getAllByRole("button", { name: /^Add .+ to cart$/ }),
    ).toHaveLength(3);
  });
});
