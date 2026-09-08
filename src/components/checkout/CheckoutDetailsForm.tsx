import type { FormEvent } from "react";

import { CUSTOMER_FIELD_RULES, type CustomerDetails } from "../../../shared/orders";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FieldSpec {
  readonly id: keyof CustomerDetails;
  readonly label: string;
  readonly autoComplete: string;
  readonly inputMode?: "email" | "tel" | "text";
  readonly wide?: boolean;
}

const FIELD_SPECS: readonly FieldSpec[] = [
  { id: "fullName", label: "Full name", autoComplete: "name" },
  { id: "email", label: "Email address", autoComplete: "email", inputMode: "email" },
  { id: "phone", label: "Phone number", autoComplete: "tel", inputMode: "tel" },
  { id: "addressLine1", label: "Address", autoComplete: "address-line1", wide: true },
  { id: "city", label: "Town or city", autoComplete: "address-level2" },
  { id: "postcode", label: "Postcode", autoComplete: "postal-code" },
  { id: "country", label: "Country", autoComplete: "country-name" },
];

const MAX_LENGTH_BY_FIELD: Record<keyof CustomerDetails, number> = Object.fromEntries(
  CUSTOMER_FIELD_RULES.map((rule) => [rule.key, rule.maxLength]),
) as Record<keyof CustomerDetails, number>;

interface CheckoutDetailsFormProps {
  readonly customer: CustomerDetails;
  readonly isSubmitting: boolean;
  onChange(this: void, customer: CustomerDetails): void;
  onSubmit(this: void): void;
}

export function CheckoutDetailsForm({
  customer,
  isSubmitting,
  onChange,
  onSubmit,
}: CheckoutDetailsFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  function handleFieldChange(field: keyof CustomerDetails, value: string): void {
    onChange({ ...customer, [field]: value });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader className="space-y-3 p-6 sm:p-8">
          <CardTitle
            level={2}
            className="font-display text-2xl leading-tight tracking-tight sm:text-3xl"
          >
            Delivery and billing details
          </CardTitle>
          <p
            id="customer-fields-description"
            className="text-base leading-7 text-muted-foreground"
          >
            These details are used for delivery and are sent to JazzCash as your
            billing reference. Card details are entered on JazzCash's own secure
            checkout page — this site never sees or stores them.
          </p>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELD_SPECS.map((field) => (
              <div key={field.id} className={field.wide ? "sm:col-span-2" : undefined}>
                <label htmlFor={`checkout-${field.id}`} className="mb-2 block text-sm font-semibold">
                  {field.label}
                </label>
                <input
                  id={`checkout-${field.id}`}
                  name={field.id}
                  value={customer[field.id]}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  required
                  maxLength={MAX_LENGTH_BY_FIELD[field.id]}
                  aria-describedby="customer-fields-description"
                  onChange={(event) => {
                    handleFieldChange(field.id, event.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch px-6 pb-6 sm:px-8 sm:pb-8">
          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={isSubmitting}>
            {isSubmitting ? "Continuing…" : "Continue to JazzCash"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
