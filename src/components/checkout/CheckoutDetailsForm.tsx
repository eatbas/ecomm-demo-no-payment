import type { FormEvent } from "react";

import { DEMO_CUSTOMER } from "../../../shared/orders";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CheckoutDetailsFormProps {
  readonly isDemoAccountFilled: boolean;
  readonly isSubmitting: boolean;
  onFillDemoAccount(this: void): void;
  onSubmit(this: void): void;
}

interface DemoField {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly inputMode?: "email" | "tel" | "text";
}

const demoFields: readonly DemoField[] = [
  {
    id: "checkout-full-name",
    label: "Full name",
    value: DEMO_CUSTOMER.fullName,
  },
  {
    id: "checkout-email",
    label: "Email address",
    value: DEMO_CUSTOMER.email,
    inputMode: "email",
  },
  {
    id: "checkout-phone",
    label: "Phone number",
    value: DEMO_CUSTOMER.phone,
    inputMode: "tel",
  },
  {
    id: "checkout-address",
    label: "Address",
    value: DEMO_CUSTOMER.addressLine1,
  },
  {
    id: "checkout-city",
    label: "Town or city",
    value: DEMO_CUSTOMER.city,
  },
  {
    id: "checkout-postcode",
    label: "Postcode",
    value: DEMO_CUSTOMER.postcode,
  },
  {
    id: "checkout-country",
    label: "Country",
    value: DEMO_CUSTOMER.country,
  },
];

export function CheckoutDetailsForm({
  isDemoAccountFilled,
  isSubmitting,
  onFillDemoAccount,
  onSubmit,
}: CheckoutDetailsFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader className="space-y-3 p-6 sm:p-8">
          <CardTitle
            level={2}
            className="font-display text-2xl leading-tight tracking-tight sm:text-3xl"
          >
            Demo delivery details
          </CardTitle>
          <p
            id="demo-fields-description"
            className="text-base leading-7 text-muted-foreground"
          >
            Only the fixed synthetic account below can be used in this public demo.
          </p>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {demoFields.map((field) => (
              <div
                key={field.id}
                className={field.id === "checkout-address" ? "sm:col-span-2" : undefined}
              >
                <label htmlFor={field.id} className="mb-2 block text-sm font-semibold">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  value={isDemoAccountFilled ? field.value : ""}
                  inputMode={field.inputMode}
                  readOnly
                  aria-describedby="demo-fields-description"
                  className="h-11 w-full rounded-xl border border-border bg-muted/45 px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background read-only:cursor-default"
                />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch px-6 pb-6 sm:px-8 sm:pb-8">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            onClick={onFillDemoAccount}
          >
            Fill with demo account
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
