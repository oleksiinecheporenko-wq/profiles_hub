import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, PenLine } from "lucide-react";
import { CollapsibleDialog, Comments, ContractActions } from "@/components/contracts/ContractDetailParts";
import { ContractForm } from "@/components/contracts/ContractForm";
import { PageHeader } from "@/components/PageHeader";
import { ContractStatusBadge } from "@/components/ui/Badges";
import { FieldLabel, type FieldIconKey } from "@/components/ui/FieldLabel";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { getRequestRepository } from "@/lib/data";
import { profilePhotoUrls } from "@/lib/data/images";
import { formatDate, formatPlainDate, formatRate } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const repo = await getRequestRepository();
  return repo.getContract(id);
}

export async function generateMetadata(props: PageProps<"/contracts/[id]">): Promise<Metadata> {
  const contract = await load((await props.params).id);
  return { title: contract?.title ?? "Контракт" };
}

function Block({ icon, label, children }: { icon: FieldIconKey; label: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-6 border-b border-line py-4 last:border-b-0">
      <FieldLabel as="h2" icon={icon} className="pt-0.5">
        {label}
      </FieldLabel>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function ContractPage(props: PageProps<"/contracts/[id]">) {
  const { id } = await props.params;
  const { mode } = await props.searchParams;
  const contract = await load(id);
  if (!contract) notFound();
  const repo = await getRequestRepository();

  if (mode === "edit") {
    const profiles = (await repo.listProfiles())
      .map((p) => ({ id: p.id, fullName: p.fullName, profileUrl: p.profileUrl }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "uk"));
    return (
      <>
        <Link href={`/contracts/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden />
          До контракту
        </Link>
        <PageHeader icon={PenLine} title="Редагування контракту" />
        <ContractForm
          key={contract.updatedAt}
          mode="edit"
          contractId={contract.id}
          expectedUpdatedAt={contract.updatedAt}
          profiles={profiles}
          cancelHref={`/contracts/${id}`}
          initial={{
            profileId: contract.profileId,
            createdDate: contract.createdDate,
            title: contract.title,
            rate: contract.rate === null ? "" : String(contract.rate),
            description: contract.description ?? "",
            dialog: contract.dialog ?? "",
          }}
        />
      </>
    );
  }

  const photos = await profilePhotoUrls(repo, [contract.profile]);
  const photoUrl = contract.profile.photoPath ? photos[contract.profile.photoPath] : undefined;

  return (
    <>
      <Link href="/contracts" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden />
        Контракти
      </Link>

      <header className="flex items-start justify-between gap-6 pb-6">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-[26px] leading-tight font-semibold tracking-tight">
            <FileText className="size-6 shrink-0 text-accent" aria-hidden />
            <span className="break-words">{contract.title}</span>
            <ContractStatusBadge status={contract.status} />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-2">
            <Link href={`/profiles/${contract.profile.id}`} className="flex items-center gap-2 hover:text-accent">
              <ProfileAvatar name={contract.profile.fullName} src={photoUrl} size={24} />
              {contract.profile.fullName}
            </Link>
            {contract.profile.profileUrl && (
              <a
                href={contract.profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-fg-muted hover:text-accent"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Upwork
              </a>
            )}
            <span className="font-mono text-xs text-fg-muted">Створено {formatPlainDate(contract.createdDate)}</span>
            {contract.closedAt && (
              <span className="font-mono text-xs text-fg-muted">Закрито {formatDate(contract.closedAt)}</span>
            )}
          </div>
        </div>
        <ContractActions contract={{ id: contract.id, title: contract.title, status: contract.status }} />
      </header>

      <div className="max-w-4xl rounded-lg border border-line bg-surface-1/40 px-5">
        <Block icon="rate" label="Рейт">
          <span className={contract.rate === null ? "text-fg-muted" : "font-mono text-sm"}>{formatRate(contract.rate)}</span>
        </Block>
        <Block icon="description" label="Опис">
          {contract.description ? (
            <p className="text-sm break-words whitespace-pre-wrap">{contract.description}</p>
          ) : (
            <span className="text-fg-muted">—</span>
          )}
        </Block>
        <Block icon="dialog" label="Діалог">
          {contract.dialog ? <CollapsibleDialog text={contract.dialog} /> : <span className="text-fg-muted">—</span>}
        </Block>
        <Block icon="comments" label="Коментарі">
          <Comments contractId={contract.id} comments={contract.comments} />
        </Block>
      </div>
    </>
  );
}
