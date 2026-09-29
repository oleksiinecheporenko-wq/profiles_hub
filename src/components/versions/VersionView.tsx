import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, History, Pencil } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLLECTION_META, FIELD_LABELS } from "@/lib/domain/collections";
import type {
  Certification,
  CollectionField,
  DailyChange,
  EmploymentItem,
  PortfolioItem,
  ProfileVersion,
  ProjectCatalogItem,
} from "@/lib/domain/types";
import { formatPlainDate, formatPrice, formatRate } from "@/lib/format";
import { ChangeRecord } from "./ChangeRecord";

export function Section({ index, label, children }: { index: number; label: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[168px_minmax(0,1fr)] gap-x-6 border-b border-line py-4 last:border-b-0">
      <h3 className="pt-0.5 font-mono text-[11px] tracking-wide text-fg-muted uppercase">
        {String(index).padStart(2, "0")} / {label}
      </h3>
      <div className="min-w-0 text-sm">{children}</div>
    </section>
  );
}

const Muted = ({ children = "—" }: { children?: ReactNode }) => <span className="text-fg-muted">{children}</span>;

function SafeLink({ href }: { href: string | null }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-fg-muted hover:text-accent"
    >
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{href}</span>
    </a>
  );
}

function ItemCard({ title, meta, description, link, image }: {
  title: string;
  meta?: ReactNode;
  description?: string | null;
  link?: string | null;
  image?: string;
}) {
  return (
    <li className="flex gap-3 rounded-md border border-line bg-surface-1 p-3">
      {image && (
        // Signed URL, short-lived.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-16 shrink-0 rounded-md border border-line object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{title}</p>
        {meta && <p className="mt-0.5 text-[13px] text-fg-muted">{meta}</p>}
        {description && <p className="mt-1 line-clamp-3 break-words whitespace-pre-wrap text-fg-2">{description}</p>}
        {link && (
          <div className="mt-1">
            <SafeLink href={link} />
          </div>
        )}
      </div>
    </li>
  );
}

function CollectionList({
  field,
  items,
  imageUrls,
}: {
  field: CollectionField;
  items: ProfileVersion["content"][CollectionField];
  imageUrls: Record<string, string>;
}) {
  if (items.length === 0) return <Muted />;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((raw) => {
        const title = COLLECTION_META[field].summary(raw);
        switch (field) {
          case "portfolio": {
            const i = raw as PortfolioItem;
            return (
              <ItemCard key={i.id} title={title} description={i.description} link={i.url} image={i.image_path ? imageUrls[i.image_path] : undefined} />
            );
          }
          case "project_catalog": {
            const i = raw as ProjectCatalogItem;
            return <ItemCard key={i.id} title={title} meta={i.price !== null ? formatPrice(i.price) : undefined} description={i.description} link={i.url} />;
          }
          case "certifications": {
            const i = raw as Certification;
            const meta = [i.issuer, i.date && formatPlainDate(i.date)].filter(Boolean).join(" · ");
            return <ItemCard key={i.id} title={title} meta={meta || undefined} link={i.url} />;
          }
          case "employment_history": {
            const i = raw as EmploymentItem;
            const from = i.date_from ? formatPlainDate(i.date_from) : "—";
            const to = i.date_to ? formatPlainDate(i.date_to) : "по теперішній час";
            return <ItemCard key={i.id} title={title} meta={`${from} — ${to}`} description={i.description} />;
          }
          default:
            return <ItemCard key={raw.id} title={title} description={(raw as { description: string | null }).description} />;
        }
      })}
    </ul>
  );
}

/** Content of one version in its final state, in the order from Part B. */
export function VersionContentSections({
  version,
  imageUrls,
  startIndex = 1,
}: {
  version: Pick<ProfileVersion, "updateDate" | "content">;
  imageUrls: Record<string, string>;
  startIndex?: number;
}) {
  const c = version.content;
  let n = startIndex;
  return (
    <>
      <Section index={n++} label={FIELD_LABELS.update_date}>
        <span className="font-mono">{formatPlainDate(version.updateDate)}</span>
      </Section>
      <Section index={n++} label="Title">{c.title ?? <Muted />}</Section>
      <Section index={n++} label="Rate">
        {c.rate !== null ? <span className="font-mono">{formatRate(c.rate)}</span> : <Muted />}
      </Section>
      <Section index={n++} label="Description">
        {c.description ? (
          <>
            <p className="break-words whitespace-pre-wrap text-fg">{c.description}</p>
            <p className="mt-1 font-mono text-[11px] text-fg-muted">{c.description.length} / 5000</p>
          </>
        ) : (
          <Muted />
        )}
      </Section>
      <Section index={n++} label="Portfolio">
        <CollectionList field="portfolio" items={c.portfolio} imageUrls={imageUrls} />
      </Section>
      <Section index={n++} label="Skills">
        {c.skills.length === 0 ? (
          <Muted />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <span key={s} className="inline-flex h-6 items-center rounded-[5px] border border-line-strong bg-surface-2 px-2 text-[13px]">
                {s}
              </span>
            ))}
            <span className="self-center pl-1 font-mono text-[11px] text-fg-muted">{c.skills.length} / 20</span>
          </div>
        )}
      </Section>
      <Section index={n++} label="Project Catalog">
        <CollectionList field="project_catalog" items={c.project_catalog} imageUrls={imageUrls} />
      </Section>
      <Section index={n++} label="Certifications">
        <CollectionList field="certifications" items={c.certifications} imageUrls={imageUrls} />
      </Section>
      <Section index={n++} label="Employment history">
        <CollectionList field="employment_history" items={c.employment_history} imageUrls={imageUrls} />
      </Section>
      <Section index={n++} label="Other experiences">
        <CollectionList field="other_experiences" items={c.other_experiences} imageUrls={imageUrls} />
      </Section>
      <Section index={n++} label={FIELD_LABELS.additional_info}>
        {c.additional_info ? <p className="break-words whitespace-pre-wrap">{c.additional_info}</p> : <Muted />}
      </Section>
    </>
  );
}

/** Item titles by id across all collections, for naming items in reorder records. */
export function itemTitleMap(version: ProfileVersion, changes: DailyChange[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  // Items removed later are known only from their change records.
  for (const c of changes) {
    if (!(c.field in COLLECTION_META)) continue;
    const meta = COLLECTION_META[c.field as CollectionField];
    for (const v of [c.oldValue, c.newValue]) {
      if (v && typeof v === "object" && !Array.isArray(v) && "id" in v) {
        out[(v as { id: string }).id] = meta.summary(v as never);
      }
    }
  }
  for (const field of Object.keys(COLLECTION_META) as CollectionField[]) {
    for (const item of version.content[field]) out[item.id] = COLLECTION_META[field].summary(item);
  }
  return out;
}

export function VersionView({
  version,
  changes,
  imageUrls,
  editHref,
  currentHref,
}: {
  version: ProfileVersion;
  changes: DailyChange[];
  imageUrls: Record<string, string>;
  editHref: string;
  /** Link back to the current version; only for archived versions. */
  currentHref: string | null;
}) {
  const titles = itemTitleMap(version, changes);
  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-4 pb-3">
        <div>
          <p className="font-mono text-xs text-fg-muted">{version.isCurrent ? "// current version" : "// archived version"}</p>
          <h2 className="mt-1 flex items-center gap-3 text-lg font-semibold">
            {version.isCurrent ? "Актуальна версія" : "Архівна версія"}
            <span className="font-mono text-sm font-normal text-fg-muted">від {formatPlainDate(version.updateDate)}</span>
          </h2>
        </div>
        <div className="flex gap-2">
          {currentHref && (
            <Link href={currentHref} scroll={false} className={buttonClassName("ghost", "md")}>
              <ArrowLeft className="size-4" aria-hidden />
              Повернутися до актуальної
            </Link>
          )}
          <Link href={editHref} scroll={false} className={buttonClassName("secondary", "md")}>
            <Pencil className="size-4" aria-hidden />
            Редагувати
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-surface-1/40 px-5">
        <VersionContentSections version={version} imageUrls={imageUrls} />
        <Section index={12} label="Історія">
          {changes.length === 0 ? (
            <EmptyState icon={History} message="Щоденних змін у цій версії немає." className="py-6" />
          ) : (
            <div className="-my-3">
              {changes.map((c) => (
                <ChangeRecord key={c.id} change={c} itemTitles={titles} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
