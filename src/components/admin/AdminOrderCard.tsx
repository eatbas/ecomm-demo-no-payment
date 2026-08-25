import type { CompletedOrder } from "../../../shared/orders";

import { AdminDemoAccount } from "@/components/admin/AdminDemoAccount";
import { AdminOrderStatus } from "@/components/admin/AdminOrderStatus";
import { createAdminOrderView } from "@/components/admin/admin-order-view";

interface AdminOrderCardProps {
  readonly order: CompletedOrder;
}

export function AdminOrderCard({ order }: AdminOrderCardProps) {
  const view = createAdminOrderView(order);
  const headingId = `admin-order-${order.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-md"
    >
      <div className="border-b border-border bg-primary px-4 py-4 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/75">
          Order reference
        </p>
        <h2 id={headingId} className="mt-1 break-all text-xl font-bold">
          {view.reference}
        </h2>
        <time className="mt-2 block text-sm" dateTime={view.createdAt}>
          Completed {view.completedAt}
        </time>
      </div>

      <div className="min-w-0 space-y-6 p-4">
        <AdminOrderStatus />

        <section aria-labelledby={`${headingId}-account`}>
          <h3 id={`${headingId}-account`} className="text-sm font-bold text-primary">
            Synthetic demo account
          </h3>
          <AdminDemoAccount className="mt-2 text-sm" customer={view.customer} />
        </section>

        <section aria-labelledby={`${headingId}-items`}>
          <h3 id={`${headingId}-items`} className="text-sm font-bold text-primary">
            Items ({view.itemCount})
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {view.items.map((item) => (
              <li
                key={item.productId}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.quantityLabel}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {item.lineTotal}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <dl className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <dt className="font-semibold">Server total</dt>
          <dd className="text-lg font-bold tabular-nums">
            {view.total}
          </dd>
        </dl>
      </div>
    </article>
  );
}
