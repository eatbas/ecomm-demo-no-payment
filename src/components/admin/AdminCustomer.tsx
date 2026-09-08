import type { AdminOrderView } from "@/components/admin/admin-order-view";
import { cn } from "@/lib/utils";

interface AdminCustomerProps {
  readonly className?: string;
  readonly customer: AdminOrderView["customer"];
}

export function AdminCustomer({ className, customer }: AdminCustomerProps) {
  return (
    <address className={cn("break-words not-italic leading-6", className)}>
      <span className="block font-semibold text-foreground">
        {customer.fullName}
      </span>
      <span className="block text-muted-foreground">{customer.email}</span>
      <span className="block text-muted-foreground">{customer.phone}</span>
      <span className="block text-muted-foreground">{customer.address}</span>
    </address>
  );
}
