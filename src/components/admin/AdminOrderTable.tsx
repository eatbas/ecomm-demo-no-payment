import type { CompletedOrder } from "../../../shared/orders";

import { AdminDemoAccount } from "@/components/admin/AdminDemoAccount";
import { AdminOrderStatus } from "@/components/admin/AdminOrderStatus";
import { createAdminOrderView } from "@/components/admin/admin-order-view";

interface AdminOrderTableProps {
  readonly orders: readonly CompletedOrder[];
}

export function AdminOrderTable({ orders }: AdminOrderTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-md md:block">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Completed demo orders</caption>
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="px-5 py-4 font-semibold" scope="col">
                Order
              </th>
              <th className="px-5 py-4 font-semibold" scope="col">
                Demo account
              </th>
              <th className="px-5 py-4 font-semibold" scope="col">
                Items
              </th>
              <th className="px-5 py-4 font-semibold" scope="col">
                Status
              </th>
              <th className="px-5 py-4 text-right font-semibold" scope="col">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const view = createAdminOrderView(order);
              return (
                <tr key={view.id} className="align-top hover:bg-muted/50">
                  <th className="px-5 py-5 font-normal" scope="row">
                    <span className="block font-bold text-primary">
                      {view.reference}
                    </span>
                    <time
                      className="mt-1 block whitespace-nowrap text-xs text-muted-foreground"
                      dateTime={view.createdAt}
                    >
                      {view.completedAt}
                    </time>
                  </th>
                  <td className="max-w-56 px-5 py-5">
                    <AdminDemoAccount customer={view.customer} />
                  </td>
                  <td className="max-w-72 px-5 py-5">
                    <ul className="space-y-3">
                      {view.items.map((item) => (
                        <li key={item.productId} className="break-words">
                          <span className="block font-semibold">
                            {item.productName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.equationLabel}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs font-semibold text-muted-foreground">
                      {view.itemCountLabel}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <AdminOrderStatus />
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right text-base font-bold tabular-nums">
                    {view.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
