"use client";

import { useReducer, useRef, useState } from "react";
import { BriefView } from "@/components/BriefView";
import { CostPanel } from "@/components/CostPanel";
import { DesignView } from "@/components/DesignView";
import { RepoView } from "@/components/RepoView";
import { StackView } from "@/components/StackView";
import { Trace } from "@/components/Trace";
import { initialState, readEvents, reduce } from "@/lib/runState";

const EXAMPLES = ["Spotify", "Shopify", "Monzo"];

export default function Home() {
  const [state, dispatch] = useReducer(reduce, initialState());
  const [company, setCompany] = useState("");
  const abort = useRef<AbortController | null>(null);

  async function run(name: string) {
    const target = name.trim();
    if (!target || state.running) return;
    // ?fixture replays synthetic events from a dev-only route (404 in production).
    const url = new URLSearchParams(window.location.search).has("fixture") ? "/api/dev-fixture" : "/api/run";
    setCompany(target);
    abort.current = new AbortController();
    dispatch({ type: "start", company: target });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: target }),
        signal: abort.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        dispatch({ type: "event", event: { type: "error", message: body.error ?? `Request failed (${res.status})` }, now: Date.now() });
      } else {
        for await (const event of readEvents(res)) dispatch({ type: "event", event, now: Date.now() });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        dispatch({ type: "event", event: { type: "error", message: e instanceof Error ? e.message : String(e) }, now: Date.now() });
      }
    } finally {
      dispatch({ type: "end" });
    }
  }

  const started = state.company !== "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className={started ? "mb-6" : "mb-10 mt-16 text-center"}>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-fast">POCForge</p>
        <h1 className={`mt-2 font-semibold tracking-tight ${started ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          A prospect&apos;s stack in, a working integration out.
        </h1>
        {!started && (
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Type a company. POCForge researches its public engineering footprint, infers the stack with cited evidence, designs
            how Nebius Token Factory fits in, and generates a runnable starter repo and a discovery brief for the first call.
          </p>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(company);
        }}
        className={`flex flex-col gap-2 sm:flex-row ${started ? "" : "mx-auto max-w-xl"}`}
      >
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name, e.g. Spotify"
          maxLength={80}
          className="flex-1 rounded-lg border border-line bg-panel px-4 py-3 text-text outline-none placeholder:text-muted focus:border-fast"
        />
        {state.running ? (
          <button
            type="button"
            onClick={() => abort.current?.abort()}
            className="rounded-lg border border-line px-5 py-3 font-semibold text-text hover:bg-panel-2"
          >
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!company.trim()} className="rounded-lg bg-fast px-5 py-3 font-semibold text-black hover:brightness-110 disabled:opacity-40">
            Forge POC
          </button>
        )}
      </form>

      {!started && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => run(ex)} className="rounded-full border border-line px-3 py-1 text-text hover:border-fast">
              {ex}
            </button>
          ))}
        </div>
      )}

      {started && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-4">
            {state.stack.length > 0 || state.stages.score.status === "done" ? <StackView stack={state.stack} /> : null}
            {state.design && <DesignView design={state.design} />}
            {state.repo && <RepoView files={state.repo} company={state.company} />}
            {state.questions && <BriefView questions={state.questions} company={state.company} />}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Trace state={state} />
            <CostPanel calls={state.calls} totals={state.totals} />
          </aside>
        </div>
      )}

      <footer className="mt-16 text-center text-xs text-muted">
        Public sources only · every stack claim links to its evidence · NVIDIA Nemotron on Nebius Token Factory · research by Tavily
      </footer>
    </main>
  );
}
