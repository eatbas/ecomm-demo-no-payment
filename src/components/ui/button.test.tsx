import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("uses a pointer cursor", () => {
    render(<Button type="button">Add to cart</Button>);

    expect(screen.getByRole("button", { name: "Add to cart" })).toHaveClass(
      "cursor-pointer",
    );
  });
});
