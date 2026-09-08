import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CheckoutPaymentProps {
  readonly errorMessage: string | null;
}

export function CheckoutPayment({ errorMessage }: CheckoutPaymentProps) {
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
          Pay by card via JazzCash's hosted checkout.
        </p>
      </CardHeader>
      <CardContent className="px-6 sm:px-8">
        <p className="text-sm leading-6 text-muted-foreground">
          After you continue, you will be redirected to JazzCash to enter your
          card details on their secure page. This site never sees or stores your
          card number.
        </p>
        {errorMessage !== null ? (
          <Alert role="alert" className="mt-5 border-destructive/40 bg-destructive/10">
            <span aria-hidden="true">!</span>
            <AlertTitle>Order could not be started</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
