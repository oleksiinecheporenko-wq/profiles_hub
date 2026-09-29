"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, X } from "lucide-react";
import { createProfileAction } from "@/app/(app)/profiles/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { PROFILE_STATUSES, PROFILE_STATUS_LABELS, type ProfileStatus } from "@/lib/domain/enums";
import { initials } from "@/lib/format";
import { IMAGE_ACCEPT, precheckImage } from "@/lib/upload";
import { fieldErrorsFromZod } from "@/lib/actions/result";
import { createProfileSchema } from "@/lib/validation/profile";

type FormState = {
  fullName: string;
  status: ProfileStatus;
  title: string;
  profileUrl: string;
};

const EMPTY: FormState = { fullName: "", status: "active", title: "", profileUrl: "" };

export function AddProfileButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        Додати профіль
      </Button>
      <AddProfileDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AddProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const reset = () => {
    setForm(EMPTY);
    setPhoto(null);
    setPreview(null);
    setErrors({});
  };

  const close = () => {
    if (pending) return;
    reset();
    onClose();
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => (void _removed, rest));
  };

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    const problem = precheckImage(file);
    if (problem) {
      setErrors((e) => ({ ...e, photo: problem }));
      return;
    }
    setErrors(({ photo: _removed, ...rest }) => (void _removed, rest));
    setPhoto(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createProfileSchema.safeParse({ ...form, photoPath: null });
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }

    const data = new FormData();
    data.set("fullName", form.fullName);
    data.set("status", form.status);
    data.set("title", form.title);
    data.set("profileUrl", form.profileUrl);
    if (photo) data.set("photo", photo);

    startTransition(async () => {
      const result = await createProfileAction(data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("Профіль створено.");
      reset();
      onClose();
      router.push(`/profiles/${result.data.id}`);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Додати профіль"
      meta="new profile"
      width={540}
      dismissible={!pending}
      footer={
        <>
          <Button onClick={close} disabled={pending}>
            Скасувати
          </Button>
          <Button type="submit" form="add-profile-form" variant="primary" loading={pending}>
            Створити
          </Button>
        </>
      }
    >
      <form id="add-profile-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="ПІБ" required error={errors.fullName}>
          {(p) => (
            <Input
              {...p}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              data-autofocus
              autoComplete="off"
              maxLength={200}
            />
          )}
        </Field>

        <Field label="Статус" error={errors.status}>
          {(p) => (
            <Select {...p} value={form.status} onChange={(e) => set("status", e.target.value as ProfileStatus)}>
              {PROFILE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROFILE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Тайтл" error={errors.title} hint="Стане Title першої, актуальної версії профілю.">
          {(p) => (
            <Input {...p} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={300} />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-fg-2">Фото</span>
          <div className="flex items-center gap-3">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-surface-2 text-xl text-fg-2">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <span aria-hidden>{form.fullName.trim() ? initials(form.fullName) : <ImagePlus className="size-5" />}</span>
              )}
            </span>
            <div className="flex flex-col items-start gap-1">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => fileInput.current?.click()}>
                  {photo ? "Замінити" : "Обрати файл"}
                </Button>
                {photo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<X className="size-3.5" aria-hidden />}
                    onClick={() => {
                      setPhoto(null);
                      setPreview(null);
                    }}
                  >
                    Прибрати
                  </Button>
                )}
              </div>
              <span className="text-xs text-fg-muted">{photo ? photo.name : "JPG, PNG або WebP, до 5 МБ"}</span>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="Фото профілю"
              onChange={(e) => {
                choosePhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {errors.photo && <p className="text-[13px] text-negative">{errors.photo}</p>}
        </div>

        <Field label="Посилання на профіль" error={errors.profileUrl}>
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://www.upwork.com/freelancers/…"
              value={form.profileUrl}
              onChange={(e) => set("profileUrl", e.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
