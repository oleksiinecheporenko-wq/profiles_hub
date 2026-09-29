import { AppFrame } from "@/components/shell/AppFrame";
import { isMockMode } from "@/lib/data/mode";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppFrame mockData={isMockMode()}>{children}</AppFrame>;
}
