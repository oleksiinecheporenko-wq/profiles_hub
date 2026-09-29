"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { deleteProfileAction } from "@/app/(app)/profiles/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";

/** `⋯` menu of the profile header with permanent deletion behind a typed confirmation. */
export function ProfileMoreMenu({ profile }: { profile: { id: string; fullName: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim() === profile.fullName.trim();

  const close = () => {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const confirm = () => {
    if (!matches) return;
    start(async () => {
      const result = await deleteProfileAction(profile.id, typed);
      if (!result.ok) {
        setError(result.fieldErrors?.confirm ?? null);
        toast.error(result.error);
        return;
      }
      toast.success(`Профіль «${result.data.fullName}» видалено.`);
      setOpen(false);
      router.push("/profiles");
      router.refresh();
    });
  };

  return (
    <>
      <Menu
        label="Інші дії з профілем"
        triggerLabel="Інші дії з профілем"
        triggerClassName="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-line text-fg-2 transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-fg"
        triggerContent={<MoreHorizontal className="size-4" aria-hidden />}
        items={[
          {
            key: "delete",
            label: "Видалити профіль",
            danger: true,
            icon: <Trash2 className="size-4" aria-hidden />,
            onSelect: () => setOpen(true),
          },
        ]}
      />
      <Dialog
        open={open}
        onClose={close}
        title="Видалити профіль назавжди?"
        icon={Trash2}
        width={500}
        dismissible={!pending}
        footer={
          <>
            <Button onClick={close} disabled={pending}>
              Скасувати
            </Button>
            <Button variant="danger" onClick={confirm} loading={pending} disabled={!matches}>
              Видалити назавжди
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-fg-2">
          <p>
            Профіль <span className="font-semibold text-fg">«{profile.fullName}»</span> буде видалено разом з усіма
            версіями, щоденними змінами, мовами, контрактами й коментарями. Фото та зображення портфоліо теж буде
            видалено.
          </p>
          <p className="rounded-md border border-negative/30 bg-negative-soft px-3 py-2 text-negative">
            Дію не можна скасувати. У «Дії» лишиться лише запис про видалення.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            <Field label="Щоб підтвердити, введіть ПІБ профілю" error={error}>
              {(p) => (
                <Input
                  {...p}
                  data-autofocus
                  autoComplete="off"
                  placeholder={profile.fullName}
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    if (error) setError(null);
                  }}
                />
              )}
            </Field>
          </form>
        </div>
      </Dialog>
    </>
  );
}
