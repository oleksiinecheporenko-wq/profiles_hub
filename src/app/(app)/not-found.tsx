import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      message="Сторінку не знайдено або запис видалено."
      className="mt-16"
      action={
        <Link href="/profiles" className={buttonClassName("secondary", "sm")}>
          До профілів
        </Link>
      }
    />
  );
}
