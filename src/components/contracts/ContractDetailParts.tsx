"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, FileText, FileType, Lock, LockOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  addContractCommentAction,
  deleteContractAction,
  setContractStatusAction,
} from "@/app/(app)/contracts/actions";
import { Button, buttonClassName } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { controlClassName } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import type { ContractStatus } from "@/lib/domain/enums";
import type { ContractComment } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";

type ContractStatusRef = { id: string; title: string; status: ContractStatus };

/** Header actions, in the order from Part A: edit, close/reopen, download, ⋯ delete. */
export function ContractActions({ contract }: { contract: ContractStatusRef }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"status" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const closing = contract.status === "active";

  const changeStatus = () =>
    start(async () => {
      const result = await setContractStatusAction(contract.id, closing ? "closed" : "active");
      if (!result.ok) return toast.error(result.error);
      toast.success(closing ? "Контракт закрито." : "Контракт відкрито знову.");
      setConfirm(null);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const result = await deleteContractAction(contract.id);
      if (!result.ok) return toast.error(result.error);
      setConfirm(null);
      toast.success(`Контракт «${contract.title}» видалено.`);
      router.push("/contracts");
      router.refresh();
    });

  const exportHref = (format: "docx" | "pdf") => `/api/contracts/${contract.id}/export?format=${format}`;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href={`/contracts/${contract.id}?mode=edit`} className={buttonClassName("secondary", "md")}>
        <Pencil className="size-4" aria-hidden />
        Редагувати
      </Link>
      <Button
        onClick={() => setConfirm("status")}
        icon={closing ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
      >
        {closing ? "Закрити контракт" : "Відкрити знову"}
      </Button>
      <Menu
        label="Завантажити"
        triggerClassName={buttonClassName("secondary", "md")}
        triggerContent={
          <>
            <Download className="size-4" aria-hidden />
            Завантажити
          </>
        }
        items={[
          {
            key: "docx",
            label: "Word (.docx)",
            icon: <FileText className="size-4 text-fg-muted" aria-hidden />,
            onSelect: () => (window.location.href = exportHref("docx")),
          },
          {
            key: "pdf",
            label: "PDF",
            icon: <FileType className="size-4 text-fg-muted" aria-hidden />,
            onSelect: () => (window.location.href = exportHref("pdf")),
          },
        ]}
      />
      <Menu
        label="Інші дії"
        triggerLabel="Інші дії"
        triggerClassName="inline-flex size-9 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface-2 text-fg-2 transition-colors hover:bg-surface-hover hover:text-fg"
        triggerContent={<MoreHorizontal className="size-4" aria-hidden />}
        items={[
          {
            key: "delete",
            label: "Видалити",
            danger: true,
            icon: <Trash2 className="size-4" aria-hidden />,
            onSelect: () => setConfirm("delete"),
          },
        ]}
      />

      <ConfirmDialog
        open={confirm === "status"}
        title={closing ? "Закрити контракт?" : "Відкрити контракт знову?"}
        message={
          closing ? (
            <>Контракт «{contract.title}» буде позначено як закритий із сьогоднішньою датою.</>
          ) : (
            <>Контракт «{contract.title}» знову стане активним, дату закриття буде прибрано.</>
          )
        }
        confirmLabel={closing ? "Закрити контракт" : "Відкрити знову"}
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={changeStatus}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Видалити контракт?"
        message={<>Контракт «{contract.title}» зникне зі списків. Запис про видалення лишиться в Діях.</>}
        confirmLabel="Видалити"
        tone="danger"
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />
    </div>
  );
}

/** Dialog collapsed to about 8 lines with `Показати повністю`. */
export function CollapsibleDialog({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.split("\n").length > 8 || text.length > 900;
  return (
    <div>
      <p className={clsx("text-sm leading-relaxed break-words whitespace-pre-wrap text-fg", !open && long && "line-clamp-8")}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 cursor-pointer text-[13px] text-fg-2 underline-offset-4 hover:text-fg hover:underline"
        >
          {open ? "Згорнути" : "Показати повністю"}
        </button>
      )}
    </div>
  );
}

/** Comments oldest first; adding one does not require edit mode. */
export function Comments({ contractId, comments }: { contractId: string; comments: ContractComment[] }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => {
    if (!body.trim()) {
      setError("Коментар порожній.");
      return;
    }
    start(async () => {
      const result = await addContractCommentAction(contractId, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setError(null);
      toast.success("Коментар додано.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-fg-muted">Коментарів ще немає.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-line bg-surface-1 px-3 py-2">
              <time dateTime={c.createdAt} className="font-mono text-xs text-fg-muted">
                {formatDate(c.createdAt)} {formatTime(c.createdAt)}
              </time>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap text-fg">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label htmlFor="new-comment" className="sr-only">
            Новий коментар
          </label>
          <textarea
            id="new-comment"
            rows={2}
            value={body}
            maxLength={5000}
            placeholder="Новий коментар"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                add();
              }
            }}
            className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
          />
          {error && <p className="mt-1 text-[13px] text-negative">{error}</p>}
        </div>
        <Button variant="primary" onClick={add} loading={pending}>
          Додати
        </Button>
      </div>
    </div>
  );
}
