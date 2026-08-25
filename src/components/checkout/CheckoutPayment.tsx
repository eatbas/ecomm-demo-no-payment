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
          Completing this demo order does not collect or confirm payment.
        </p>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">
        <p className="text-sm leading-6 text-muted-foreground">
          No card, wallet, or billing details are accepted. The saved order stays
          unpaid on the public admin page.
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
          {isSubmitting ? "Completing order…" : "Complete order"}
        </Button>
      </CardFooter>
    </Card>
  );
}
