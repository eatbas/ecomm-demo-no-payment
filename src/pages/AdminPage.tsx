import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import type { Order } from "../../shared/orders";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminOrderCard } from "@/components/admin/AdminOrderCard";
import { AdminOrderTable } from "@/components/admin/AdminOrderTable";
import { Button } from "@/components/ui/button";
import {
  AdminApiError,
  adminLogin,
  adminLogout,
  checkAdminSession,
} from "@/features/admin/admin.api";
import { listCompletedOrders } from "@/features/orders/order.api";

type AuthState =
  | { readonly status: "checking" }
  | { readonly status: "signed-out"; readonly errorMessage: string | null }
  | { readonly status: "signed-in" };

type AdminOrdersState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly orders: readonly Order[] }
  | { readonly status: "error"; readonly message: string };

export function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [ordersState, setOrdersState] = useState<AdminOrdersState>({
    status: "loading",
  });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void checkAdminSession(controller.signal)
      .then((authenticated) => {
        if (!controller.signal.aborted) {
          setAuthState(
            authenticated
              ? { status: "signed-in" }
              : { status: "signed-out", errorMessage: null },
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAuthState({ status: "signed-out", errorMessage: null });
        }
      });
    return () => {
      controller.abort();
    };
  }, []);

  const requestOrders = useCallback(() => {
    activeRequest.current?.abort();

    const controller = new AbortController();
    activeRequest.current = controller;

    void listCompletedOrders(controller.signal)
      .then(({ orders }) => {
        if (!controller.signal.aborted) {
          setOrdersState({ status: "loaded", orders });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Completed orders could not be loaded. Try again.";
        setOrdersState({ status: "error", message });
      })
      .finally(() => {
        if (activeRequest.current === controller) {
          activeRequest.current = null;
        }
      });
  }, []);

  const retry = useCallback(() => {
    setOrdersState({ status: "loading" });
    requestOrders();
  }, [requestOrders]);

  useEffect(() => {
    if (authState.status !== "signed-in") {
      return;
    }
    requestOrders();

    return () => {
      activeRequest.current?.abort();
    };
  }, [authState.status, requestOrders]);

  function handleLogin(password: string): void {
    setIsSigningIn(true);
    void adminLogin(password)
      .then(() => {
        setAuthState({ status: "signed-in" });
      })
      .catch((error: unknown) => {
        setAuthState({
          status: "signed-out",
          errorMessage:
            error instanceof AdminApiError
              ? error.message
              : "Sign in failed. Try again.",
        });
      })
      .finally(() => {
        setIsSigningIn(false);
      });
  }

  function handleLogout(): void {
    void adminLogout().finally(() => {
      setOrdersState({ status: "loading" });
      setAuthState({ status: "signed-out", errorMessage: null });
    });
  }

  if (authState.status === "checking") {
    return (
      <div
        aria-live="polite"
        className="mx-auto w-full max-w-md px-4 py-16 text-center"
        role="status"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-4 block size-8 animate-spin rounded-full border-4 border-secondary border-t-primary motion-reduce:animate-none"
        />
        <p className="font-semibold">Checking admin session…</p>
      </div>
    );
  }

  if (authState.status === "signed-out") {
    return (
      <AdminLoginForm
        errorMessage={authState.errorMessage}
        isSubmitting={isSigningIn}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <section aria-labelledby="admin-title" className="min-w-0 pb-12 sm:pb-16">
      <div className="bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground/75">
              Admin
            </p>
            <h1 id="admin-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Orders
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-primary-foreground/80 sm:text-base">
              Paid orders and their JazzCash payment status.
            </p>
          </div>
          <Button variant="outline" type="button" onClick={handleLogout}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {ordersState.status === "loading" ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm"
            role="status"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-4 block size-8 animate-spin rounded-full border-4 border-secondary border-t-primary motion-reduce:animate-none"
            />
            <p className="font-semibold">Loading completed orders…</p>
          </div>
        ) : null}

        {ordersState.status === "error" ? (
          <div
            className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm sm:p-8"
            role="alert"
          >
            <h2 className="text-xl font-bold text-destructive">
              Completed orders could not be loaded
            </h2>
            <p className="mt-2 max-w-2xl leading-6 text-muted-foreground">
              {ordersState.message}
            </p>
            <Button className="mt-5" onClick={retry} type="button">
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          </div>
        ) : null}

        {ordersState.status === "loaded" && ordersState.orders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-xl font-bold text-primary">No completed orders</h2>
            <p className="mx-auto mt-2 max-w-xl leading-6 text-muted-foreground">
              Paid orders will appear here once a JazzCash payment is confirmed.
            </p>
          </div>
        ) : null}

        {ordersState.status === "loaded" && ordersState.orders.length > 0 ? (
          <>
            <p className="mb-4 text-sm font-semibold text-muted-foreground" role="status">
              {ordersState.orders.length}{" "}
              {ordersState.orders.length === 1 ? "completed order" : "completed orders"}
            </p>
            <AdminOrderTable orders={ordersState.orders} />
            <ul className="min-w-0 space-y-4 md:hidden" aria-label="Completed demo orders">
              {ordersState.orders.map((order) => (
                <li key={order.id} className="min-w-0">
                  <AdminOrderCard order={order} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
