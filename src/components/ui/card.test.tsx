import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardTitle } from "@/components/ui/card";

describe("CardTitle", () => {
  it("uses a nested heading by default", () => {
    render(<CardTitle>Summary</CardTitle>);

    expect(
      screen.getByRole("heading", { level: 3, name: "Summary" }),
    ).toBeInTheDocument();
  });

  it("supports a deliberate page-section heading level", () => {
    render(<CardTitle level={2}>Page summary</CardTitle>);

    expect(
      screen.getByRole("heading", { level: 2, name: "Page summary" }),
    ).toBeInTheDocument();
  });
});
