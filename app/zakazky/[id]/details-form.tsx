"use client";

import { useEffect, useState } from "react";
import { SECTIONS, type DetailField, type JobDetails } from "@/lib/crm/job-details";

/**
 * Obsáhlý formulář parametrů zakázky. Generuje se z konfigurace (SECTIONS),
 * sekce jsou sbalitelné. Commit na blur (u textu/čísel), ať se cloud záloha
 * nespouští po každém písmenu.
 */
/** Hodnota do náhledu: bool → Áno, jinak text. */
function fmt(v: string | number | boolean | null | undefined): string {
  if (v === true) return "Áno";
  if (v === false || v == null) return "";
  return String(v);
}

export default function DetailsForm({
  details,
  onChange,
}: {
  details: JobDetails | null;
  onChange: (d: JobDetails) => void;
}) {
  const [d, setD] = useState<JobDetails>(details ?? {});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => setD(details ?? {}), [details]);

  function commit(key: string, value: string | number | boolean | null) {
    const next = { ...d, [key]: value };
    setD(next);
    onChange(next);
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Parametre zákazky
      </h2>
      {/* Masonry — kartičky vedle sebe, ať se využije šířka a míň scrolluje. */}
      <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {SECTIONS.map((s) => {
          const isOpen = open === s.title;
          const filled = s.fields.filter((f) => {
            const v = d[f.key];
            return v != null && v !== "" && v !== false;
          }).length;
          // Náhled prvních vyplněných polí (ukáže se po najetí myší, když je sbaleno).
          const preview = s.fields
            .filter((f) => {
              const v = d[f.key];
              return v != null && v !== "" && v !== false;
            })
            .slice(0, 2)
            .map((f) => `${f.label.split(" (")[0].split(" —")[0]}: ${fmt(d[f.key])}`);
          return (
            <section
              key={s.title}
              className="group overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-soft transition hover:border-brand-300"
            >
            <button
              onClick={() => setOpen(isOpen ? null : s.title)}
              className="flex w-full items-center justify-between gap-3 p-5 text-left"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{s.title}</span>
                {filled > 0 && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {filled} vyplnené
                  </span>
                )}
              </span>
              <span className="text-neutral-400">{isOpen ? "▲" : "▼"}</span>
            </button>

            {/* Náhled po najetí myší — když je sbaleno a něco vyplněné. */}
            {!isOpen && preview.length > 0 && (
              <div className="grid grid-rows-[0fr] overflow-hidden opacity-0 transition-all duration-200 group-hover:grid-rows-[1fr] group-hover:opacity-100">
                <div className="min-h-0">
                  <div className="space-y-1 border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
                    {preview.map((p, n) => (
                      <p key={n} className="truncate">{p}</p>
                    ))}
                    <p className="pt-0.5 text-xs text-brand-700">Klikni pre úpravu →</p>
                  </div>
                </div>
              </div>
            )}

            {isOpen && (
              <div className="border-t border-neutral-100 p-5">
                {s.note && <p className="-mt-1 mb-4 text-xs leading-relaxed text-neutral-400">{s.note}</p>}
                <div className="space-y-3.5">
                  {s.fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={d[f.key] ?? null}
                      onCommit={(v) => commit(f.key, v)}
                    />
                  ))}
                </div>
              </div>
            )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onCommit,
}: {
  field: DetailField;
  value: string | number | boolean | null;
  onCommit: (v: string | number | boolean | null) => void;
}) {
  // Boolean = přepínač, commit hned.
  if (field.type === "bool") {
    const checked = value === true;
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-[15px] leading-snug">{field.label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCommit(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-brand-600"
        />
      </label>
    );
  }

  // Date = commit hned při změně.
  if (field.type === "date") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs text-neutral-400">{field.label}</span>
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(e) => onCommit(e.target.value || null)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
        />
      </label>
    );
  }

  // Text / num / textarea = lokální stav, commit na blur.
  return <TextLike field={field} value={value} onCommit={onCommit} />;
}

function TextLike({
  field,
  value,
  onCommit,
}: {
  field: DetailField;
  value: string | number | boolean | null;
  onCommit: (v: string | number | boolean | null) => void;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);

  function commit() {
    if (field.type === "num") {
      const n = parseFloat(v.replace(",", "."));
      onCommit(v.trim() === "" ? null : Number.isFinite(n) ? n : null);
    } else {
      onCommit(v.trim() === "" ? null : v);
    }
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">
        {field.label}
        {field.hint && <span className="ml-1 text-neutral-300">· {field.hint}</span>}
      </span>
      {field.type === "textarea" ? (
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          rows={3}
          className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
        />
      ) : (
        <input
          type="text"
          inputMode={field.type === "num" ? "decimal" : undefined}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
        />
      )}
    </label>
  );
}
