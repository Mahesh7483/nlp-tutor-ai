import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy, Terminal } from "lucide-react";

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        className ||
        "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      }`}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Code block with language label + working copy button. */
function CodeBlock({ language, code, children }: { language: string; code: string; children: ReactNode }) {
  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700/80">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 dark:border-zinc-700/80 dark:bg-zinc-800/80">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          <Terminal size={12} />
          {language || "text"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="!my-0 !rounded-none !border-0 bg-white p-4 dark:bg-[#0b1020]">{children}</pre>
    </div>
  );
}

/** Recursively join hast node text (works with or without highlight spans). */
function hastText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(hastText).join("");
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (typeof n.value === "string") return n.value;
  return (n.children ?? []).map(hastText).join("");
}

/**
 * Renders model markdown safely: react-markdown escapes HTML by default,
 * math via remark/rehype KaTeX, highlighting via rehype-highlight.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          // Wrap fenced code in our shell (label + copy button) while keeping
          // the highlighted spans rehype-highlight produced. Text/copy content
          // comes from the hast node — never via String(children), which
          // destroys nested elements into "[object Object]".
          pre: ({ node, children }) => {
            const codeNode = ((node as { children?: Array<{ tagName?: string; properties?: { className?: string[] } }> })?.children ?? [])
              .find((c) => c?.tagName === "code");
            const classes = Array.isArray(codeNode?.properties?.className) ? codeNode.properties.className : [];
            const language =
              String(classes.find((c) => String(c).startsWith("language-")) ?? "").replace("language-", "") || "";
            const raw = hastText(codeNode).replace(/\n$/, "");
            return (
              <CodeBlock language={language} code={raw}>
                {children}
              </CodeBlock>
            );
          },
          a: ({ href, children }) => (
            <a href={href ?? undefined} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export { CopyButton };
