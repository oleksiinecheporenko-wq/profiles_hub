"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { submitAccessPassword, type AccessFormState } from "./actions";

const initialState: AccessFormState = { error: null };

export function AccessForm({ next, misconfigured }: { next: string; misconfigured: boolean }) {
  const [state, formAction, pending] = useActionState(submitAccessPassword, initialState);
  const error = misconfigured
    ? "Доступ не налаштовано: не задано APP_COOKIE_SECRET."
    : state.error;

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Пароль" error={error}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            disabled={misconfigured}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" loading={pending} disabled={misconfigured}>
        Увійти
      </Button>
    </form>
  );
}
