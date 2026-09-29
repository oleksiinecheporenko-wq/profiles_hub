import { getRepository } from "@/lib/data";
import { contractFileName } from "@/lib/export/common";
import { buildContractDocx } from "@/lib/export/docx";
import { buildContractPdf } from "@/lib/export/pdf";

// Font files and the PDF renderer need Node APIs.
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTENT_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

export async function GET(request: Request, ctx: RouteContext<"/api/contracts/[id]/export">) {
  const { id } = await ctx.params;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "docx" && format !== "pdf") {
    return new Response("format must be docx or pdf", { status: 400 });
  }
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const repo = await getRepository();
  const contract = await repo.getContract(id);
  if (!contract) return new Response("Not found", { status: 404 });

  const file = format === "docx" ? await buildContractDocx(contract) : await buildContractPdf(contract);
  const name = contractFileName(contract, format);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
