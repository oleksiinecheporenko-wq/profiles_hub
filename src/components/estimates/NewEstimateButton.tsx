"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus } from "lucide-react";
import { createEstimateAction } from "@/app/(app)/estimates/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

/** `Новий запит`: client name and project name, then straight to the new card. */
export function NewEstimateButton() {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const close = () => {
    setOpen(false);
    setClientName("");
    setProjectName("");
    setErrors({});
  };

  const submit = () =>
    startTransition(async () => {
      const result = await createEstimateAction({ clientName, projectName });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      router.push(`/estimates/${result.data.id}`);
    });

  return (
    <>
      <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Новий запит
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Новий запит"
        icon={FilePlus2}
        width={480}
        dismissible={!pending}
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              Скасувати
            </Button>
            <Button variant="primary" type="submit" form="new-estimate" loading={pending}>
              Створити
            </Button>
          </>
        }
      >
        <form
          id="new-estimate"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Клієнт" required error={errors.clientName}>
            {(props) => (
              <Input
                {...props}
                data-autofocus
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ім’я клієнта або компанії"
                maxLength={200}
              />
            )}
          </Field>
          <Field label="Проєкт" error={errors.projectName}>
            {(props) => (
              <Input
                {...props}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Назва проєкту"
                maxLength={300}
              />
            )}
          </Field>
        </form>
      </Dialog>
    </>
  );
}
