import { getRepository } from "@/lib/data";
import { estimateFileName } from "@/lib/export/common";
import { buildEstimatePdf } from "@/lib/export/pdf";

// Font files and the PDF renderer need Node APIs.
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client PDF of a ready or archived estimate. `?inline=1` opens it in the browser. */
export async function GET(request: Request, ctx: RouteContext<"/api/estimates/[id]/pdf">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });

  const estimate = await (await getRepository()).getEstimate(id);
  if (!estimate) return new Response("Not found", { status: 404 });
  if (estimate.status === "in_progress") return new Response("Estimate is not ready yet", { status: 409 });

  const file = await buildEstimatePdf(estimate);
  const name = estimateFileName(estimate);
  const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
