import { runFullPipeline } from "@/lib/pipeline";
import type { PipelineEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST { company } → text/event-stream of PipelineEvent JSON lines.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 80) : "";
  if (!company) return Response.json({ error: "company is required" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: PipelineEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        emit({ type: "done", totals: await runFullPipeline(company, emit) });
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
