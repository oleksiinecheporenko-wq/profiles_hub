import { notFound } from "next/navigation";

// TODO(phase 10): contract detail — header actions, body, comments, export.
// No contract data exists yet, so every id resolves to 404.
export default async function ContractPage(props: PageProps<"/contracts/[id]">) {
  await props.params;
  notFound();
}
