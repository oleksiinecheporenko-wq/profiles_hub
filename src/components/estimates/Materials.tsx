"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Download, ExternalLink, File as FileIcon, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
import {
  prepareUploadAction,
  registerFileAction,
  removeFileAction,
  updateInfoAction,
  uploadThroughServerAction,
} from "@/app/(app)/estimates/actions";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { EstimateFile, EstimateLink } from "@/lib/domain/estimate";
import { formatFileSize } from "@/lib/format";

const MAX_FILE = 50 * 1024 * 1024;

type FileWithUrl = EstimateFile & { url: string | null };
type Upload = { key: string; name: string; progress: number };

type Props = {
  estimateId: string;
  editable: boolean;
  initialFiles: FileWithUrl[];
  initialLinks: EstimateLink[];
};

/** PUT straight to storage through a signed URL, with progress. */
function putToStorage(url: string, file: File, onProgress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Сховище відповіло ${xhr.status}.`)));
    xhr.onerror = () => reject(new Error("Не вдалося завантажити файл: немає з’єднання."));
    xhr.send(file);
  });
}

const kindOf = (f: EstimateFile) =>
  f.mimeType?.startsWith("image/") ? "image" : f.mimeType?.startsWith("video/") ? "video" : "file";

/** Photos, videos, other files and links of the job post. */
export function Materials({ estimateId, editable, initialFiles, initialLinks }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [links, setLinks] = useState(initialLinks);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [savingLinks, setSavingLinks] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function uploadOne(file: File) {
    if (file.size > MAX_FILE) {
      toast.error(`«${file.name}» більший за 50 МБ.`);
      return;
    }
    const key = crypto.randomUUID();
    const progress = (share: number) =>
      setUploads((list) => list.map((u) => (u.key === key ? { ...u, progress: share } : u)));
    setUploads((list) => [...list, { key, name: file.name, progress: 0 }]);
    try {
      const target = await prepareUploadAction(estimateId, { name: file.name, size: file.size });
      if (!target.ok) throw new Error(target.error);
      const { path, signedUrl } = target.data;
      if (signedUrl) {
        await putToStorage(signedUrl, file, progress);
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("path", path);
        const sent = await uploadThroughServerAction(form);
        if (!sent.ok) throw new Error(sent.error);
      }
      const registered = await registerFileAction(estimateId, {
        path,
        name: file.name,
        mimeType: file.type || null,
        size: file.size,
      });
      if (!registered.ok) throw new Error(registered.error);
      setFiles((list) => [...list, { ...registered.data.file, url: registered.data.url }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося завантажити файл.");
    } finally {
      setUploads((list) => list.filter((u) => u.key !== key));
    }
  }

  function uploadAll(list: FileList | null) {
    if (!list) return;
    // A few at a time is plenty; storage handles them in parallel.
    for (const file of Array.from(list)) void uploadOne(file);
  }

  async function removeFile(file: FileWithUrl) {
    const result = await removeFileAction(estimateId, file.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFiles((list) => list.filter((f) => f.id !== file.id));
  }

  async function saveLinks(next: EstimateLink[]) {
    setSavingLinks(true);
    const result = await updateInfoAction(estimateId, { links: next });
    setSavingLinks(false);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setLinks(next);
    return true;
  }

  async function addLink() {
    let url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const ok = await saveLinks([...links, { id: crypto.randomUUID(), url, label: linkLabel.trim() || null }]);
    if (ok) {
      setLinkUrl("");
      setLinkLabel("");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            uploadAll(e.dataTransfer.files);
          }}
          className={clsx(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-7 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-line-strong",
          )}
        >
          <Upload className="size-5 text-fg-muted" aria-hidden />
          <p className="text-sm text-fg-2">Перетягніть фото, відео або файли сюди</p>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            Обрати файли
          </Button>
          <p className="text-[12px] text-fg-muted">До 50 МБ на файл</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              uploadAll(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {(files.length > 0 || uploads.length > 0) && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {files.map((file) => {
            const kind = kindOf(file);
            return (
              <li key={file.id} className="group overflow-hidden rounded-lg border border-line bg-surface-1">
                <div className="flex aspect-video items-center justify-center bg-surface-2">
                  {kind === "image" && file.url ? (
                    <a href={file.url} target="_blank" rel="noreferrer" className="size-full">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                      <img src={file.url} alt={file.name} className="size-full object-cover" />
                    </a>
                  ) : kind === "video" && file.url ? (
                    <video src={file.url} controls preload="metadata" className="size-full bg-black object-contain" />
                  ) : (
                    <FileIcon className="size-8 text-fg-muted" aria-hidden />
                  )}
                </div>
                <div className="flex items-center gap-1 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]" title={file.name}>
                      {file.name}
                    </p>
                    <p className="font-mono text-[12px] text-fg-muted">{formatFileSize(file.size)}</p>
                  </div>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      download={file.name}
                      aria-label={`Завантажити ${file.name}`}
                      title="Завантажити"
                      className="flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg"
                    >
                      <Download className="size-3.5" aria-hidden />
                    </a>
                  )}
                  {editable && (
                    <IconButton label={`Видалити ${file.name}`} size="sm" onClick={() => removeFile(file)}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}
          {uploads.map((u) => (
            <li key={u.key} className="flex flex-col justify-end rounded-lg border border-line bg-surface-1 p-3">
              <div className="flex items-center gap-2 text-[13px]">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-fg-muted" aria-hidden />
                <span className="truncate">{u.name}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-fg-2">
          <Link2 className="size-3.5" aria-hidden />
          Посилання
        </h3>
        {links.length === 0 && !editable && <p className="text-sm text-fg-muted">Посилань немає.</p>}
        {links.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-line rounded-lg border border-line">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-3 px-3 py-2">
                <ExternalLink className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-fg hover:text-accent"
                >
                  {link.label ? (
                    <>
                      {link.label} <span className="text-fg-muted">· {link.url}</span>
                    </>
                  ) : (
                    link.url
                  )}
                </a>
                {editable && (
                  <IconButton
                    label="Видалити посилання"
                    size="sm"
                    disabled={savingLinks}
                    onClick={() => saveLinks(links.filter((l) => l.id !== link.id))}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addLink();
            }}
          >
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
              aria-label="Посилання"
              className="flex-[2]"
            />
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Підпис (необов’язково)"
              aria-label="Підпис посилання"
              maxLength={200}
              className="flex-1"
            />
            <Button type="submit" icon={<Plus className="size-4" aria-hidden />} loading={savingLinks} disabled={!linkUrl.trim()}>
              Додати
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
