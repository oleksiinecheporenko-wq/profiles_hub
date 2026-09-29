import { notFound } from "next/navigation";

// TODO(phase 4): profile header and tabs (`?tab=`), versions via `?version=`.
// No profile data exists yet, so every id resolves to 404.
export default async function ProfilePage(props: PageProps<"/profiles/[id]">) {
  await props.params;
  notFound();
}
