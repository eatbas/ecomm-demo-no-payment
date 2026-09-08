import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdminLoginFormProps {
  readonly errorMessage: string | null;
  readonly isSubmitting: boolean;
  onSubmit(this: void, password: string): void;
}

export function AdminLoginForm({
  errorMessage,
  isSubmitting,
  onSubmit,
}: AdminLoginFormProps) {
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit(password);
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-3 p-6 sm:p-8">
            <CardTitle level={2} className="font-display text-2xl sm:text-3xl">
              Admin sign in
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Enter the admin password to view completed orders and payment status.
            </p>
          </CardHeader>
          <CardContent className="px-6 sm:px-8">
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {errorMessage !== null ? (
              <Alert role="alert" className="mt-5 border-destructive/40 bg-destructive/10">
                <span aria-hidden="true">!</span>
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="px-6 pb-6 sm:px-8 sm:pb-8">
            <Button type="submit" className="w-full" disabled={isSubmitting || password.length === 0}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
