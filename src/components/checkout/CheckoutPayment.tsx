import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CheckoutPaymentProps {
  readonly errorMessage: string | null;
  readonly isSubmitting: boolean;
  onSubmit(this: void): void;
}

export function CheckoutPayment({
  errorMessage,
  isSubmitting,
  onSubmit,
}: CheckoutPaymentProps) {
  return (
    <Card>
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <CardTitle
          level={2}
          className="font-display text-2xl leading-tight tracking-tight sm:text-3xl"
        >
          Payment
        </CardTitle>
        <p className="text-base leading-7 text-muted-foreground">
          You will be redirected to JazzCash to complete your card payment securely.
        </p>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">
        <p className="text-sm leading-6 text-muted-foreground">
          Payments are handled via JazzCash hosted checkout. No card numbers or
          sensitive financial details are collected or stored on this server.
        </p>
        {errorMessage !== null ? (
          <Alert role="alert" className="mt-5 border-destructive/40 bg-destructive/10">
            <span aria-hidden="true">!</span>
            <AlertTitle>Order could not be completed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch px-6 pb-6 sm:px-8 sm:pb-8">
        <Button
          type="button"
          size="lg"
          className="h-14 w-full text-base"
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? "Redirecting to payment…" : "Pay by card"}
        </Button>
      </CardFooter>
    </Card>
  );
}
