import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

import { CheckoutConfirmationPage } from "@/pages/CheckoutConfirmationPage";
import { createJsonResponse } from "@/test/orders";

function renderConfirmationPage(initialEntry = "/checkout/confirmation") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/checkout/confirmation" element={<CheckoutConfirmationPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const validOrderId = "ord_11111111-1111-4111-8111-111111111111";
const validOrderRef = "CG-12345678";

describe("CheckoutConfirmationPage", () => {
  it("displays fallback message when no order reference is provided in search params", () => {
    renderConfirmationPage("/checkout/confirmation");

    expect(screen.getByRole("heading", { name: "No order specified" })).toBeInTheDocument();
    expect(screen.getByText("No order reference was provided in the URL.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to shop" })).toHaveAttribute("href", "/");
  });

  it("loads and displays paid order status when payment succeeded", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        id: validOrderId,
        reference: validOrderRef,
        paymentStatus: "paid",
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderConfirmationPage(`/checkout/confirmation?order=${validOrderId}`);

    expect(await screen.findByRole("heading", { name: "Payment confirmed" })).toBeInTheDocument();
    expect(screen.getByText(validOrderRef)).toBeInTheDocument();
    expect(screen.getByText("Your card payment was processed securely via JazzCash.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "View completed orders" })).toHaveAttribute("href", "/admin");
  });

  it("displays payment failed message and retry button when status is failed", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        id: validOrderId,
        reference: "CG-DEADBEEF",
        paymentStatus: "failed",
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderConfirmationPage(`/checkout/confirmation?order=${validOrderId}`);

    expect(await screen.findByRole("heading", { name: "Payment unsuccessful" })).toBeInTheDocument();
    expect(screen.getByText("CG-DEADBEEF")).toBeInTheDocument();
    expect(
      screen.getByText("The transaction was declined or cancelled. You may retry payment."),
    ).toBeInTheDocument();

    const retryLink = screen.getByRole("link", { name: "Retry card payment" });
    expect(retryLink).toHaveAttribute("href", `/api/orders/${validOrderId}/payment/redirect`);
  });

  it("displays awaiting payment and polls when status is awaiting_payment", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          id: validOrderId,
          reference: "CG-A1B2C3D4",
          paymentStatus: "awaiting_payment",
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: validOrderId,
          reference: "CG-A1B2C3D4",
          paymentStatus: "paid",
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    renderConfirmationPage(`/checkout/confirmation?order=${validOrderId}`);

    expect(await screen.findByRole("heading", { name: "Processing payment" })).toBeInTheDocument();
    expect(screen.getByText("Awaiting confirmation from JazzCash")).toBeInTheDocument();
    expect(screen.getByText("CG-A1B2C3D4")).toBeInTheDocument();
  });

  it("displays error message when status check fails", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    renderConfirmationPage(`/checkout/confirmation?order=${validOrderId}`);

    expect(
      await screen.findByText("The order service could not be reached. Try again."),
    ).toBeInTheDocument();
  });
});
