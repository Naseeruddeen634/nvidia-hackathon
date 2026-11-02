"use client";

import { useState } from "react";
import type { RepoFile } from "@/lib/types";
import { Panel } from "./ui";

async function downloadZip(files: RepoFile[], name: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const root = zip.folder(name)!;
  for (const f of files) root.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RepoView({ files, company }: { files: RepoFile[]; company: string }) {
  const [selected, setSelected] = useState(files.find((f) => f.path.toLowerCase() === "readme.md")?.path ?? files[0]?.path);
  const file = files.find((f) => f.path === selected);
  const name = `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poc`;

  return (
    <Panel
      title="Starter repo"
      right={
        <button
          onClick={() => downloadZip(files, name)}
          className="rounded-md bg-fast px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
        >
          Download {name}.zip
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <ul className="space-y-0.5 font-mono text-xs">
          {files.map((f) => (
            <li key={f.path}>
              <button
                onClick={() => setSelected(f.path)}
                className={`w-full truncate rounded px-2 py-1 text-left ${f.path === selected ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}
              >
                {f.path}
              </button>
            </li>
          ))}
        </ul>
        <pre className="max-h-[480px] min-w-0 overflow-auto rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-text">
          {file?.content}
        </pre>
      </div>
      <p className="mt-3 font-mono text-xs text-muted">
        $ unzip {name}.zip && cd {name} && cp .env.example .env && docker compose up
      </p>
    </Panel>
  );
}
