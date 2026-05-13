import { useMemo } from "react";
import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
  imageBlock?: boolean;
}

interface Segment {
  type: "text" | "math-inline" | "math-display" | "image" | "table";
  value: string;
}

function tokenize(input: string): Segment[] {
  if (!input) return [];

  const segments: Segment[] = [];
  let i = 0;
  const n = input.length;
  let buffer = "";

  const flush = () => {
    if (buffer.length > 0) {
      segments.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === "[" && input.slice(i, i + 12) === "[TABLE_HTML:") {
      const end = input.indexOf("]", i + 12);
      if (end !== -1) {
        const b64 = input.slice(i + 12, end).trim();
        if (b64) {
          flush();
          segments.push({ type: "table", value: b64 });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === "[" && input.slice(i, i + 5) === "[IMG:") {
      const end = input.indexOf("]", i + 5);
      if (end !== -1) {
        const url = input.slice(i + 5, end).trim();
        if (url) {
          flush();
          segments.push({ type: "image", value: url });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === "$" && next === "$") {
      const end = input.indexOf("$$", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math-display", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (ch === "$") {
      const end = input.indexOf("$", i + 1);
      if (end !== -1) {
        flush();
        segments.push({ type: "math-inline", value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "\\" && next === "(") {
      const end = input.indexOf("\\)", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math-inline", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (ch === "\\" && next === "[") {
      const end = input.indexOf("\\]", i + 2);
      if (end !== -1) {
        flush();
        segments.push({ type: "math-display", value: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    buffer += ch;
    i++;
  }

  flush();
  return segments;
}

function renderMath(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      output: "html",
      trust: false,
    });
  } catch {
    return display ? `\\[${value}\\]` : `\\(${value}\\)`;
  }
}

function decodeTableHtml(b64: string): string {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

const IMAGE_HOST_FALLBACKS = [
  "https://chorcha.net",
  "https://assets.chorcha.net",
  "https://cdn.chorcha.net",
  "https://media.chorcha.net",
  "https://api.chorcha.net",
];

function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  const tried = (img.dataset.triedHosts ?? "").split("|").filter(Boolean);
  try {
    const path = new URL(img.src).pathname + new URL(img.src).search;
    for (const host of IMAGE_HOST_FALLBACKS) {
      if (tried.includes(host)) continue;
      tried.push(host);
      img.dataset.triedHosts = tried.join("|");
      img.src = `${host}${path}`;
      return;
    }
  } catch {
    /* fall through */
  }
  img.style.display = "none";
}

export function MathText({ text, className, imageBlock = true }: MathTextProps) {
  const nodes = useMemo(() => tokenize(text), [text]);

  return (
    <>
      {nodes.map((seg, idx) => {
        if (seg.type === "text") {
          return (
            <span key={idx} style={{ whiteSpace: "pre-wrap" }}>
              {seg.value}
            </span>
          );
        }

        if (seg.type === "table") {
          const tableHtml = decodeTableHtml(seg.value);
          if (!tableHtml) return null;
          return (
            <span
              key={idx}
              className="chorcha-table-wrapper"
              style={{ display: "block", overflowX: "auto", margin: "0.75rem 0" }}
              dangerouslySetInnerHTML={{ __html: tableHtml }}
            />
          );
        }

        if (seg.type === "image") {
          if (imageBlock) {
            return (
              <span
                key={idx}
                style={{ display: "block", textAlign: "center", margin: "0.75rem 0" }}
              >
                <img
                  src={seg.value}
                  alt=""
                  loading="lazy"
                  style={{ maxWidth: "100%", height: "auto", borderRadius: "0.5rem" }}
                  className="border border-border/40 bg-background p-2 chorcha-img"
                  onError={handleImageError}
                />
              </span>
            );
          }
          return (
            <img
              key={idx}
              src={seg.value}
              alt=""
              loading="lazy"
              className="inline-block max-h-12 w-auto align-middle mx-1 rounded border border-border/40 bg-background p-0.5 chorcha-img"
              onError={handleImageError}
            />
          );
        }

        if (seg.type === "math-display") {
          const html = renderMath(seg.value, true);
          return (
            <span
              key={idx}
              className="math-display-block"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        const html = renderMath(seg.value, false);
        return (
          <span
            key={idx}
            className="math-inline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}
