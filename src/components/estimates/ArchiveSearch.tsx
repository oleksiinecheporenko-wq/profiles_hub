"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/SearchInput";

/** Search box that keeps the query in `?q=`, debounced. */
export function ArchiveSearch({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const q = value.trim();
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [value, pathname, router]);

  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder="Клієнт, проєкт, джоб пост або розробник"
      label="Пошук в архіві"
      className="w-96"
    />
  );
}
