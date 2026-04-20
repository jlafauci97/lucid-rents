/**
 * Tiny, safe markdown renderer for our own auto-generated article bodies.
 *
 * We control the upstream (our own LLM drafter), which produces a narrow
 * dialect: paragraphs (blank line separated), ## headings, **bold**, *italic*,
 * and [text](url) links. A full library is overkill for this shape.
 *
 * All user/model text is HTML-escaped before any markdown-to-HTML replacement,
 * so the output is XSS-safe even if the drafter goes rogue.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(s: string): string {
  // Links — only http(s), relative, or mailto.
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|mailto:[^\s)]+)\)/g,
    (_, text, href) =>
      `<a href="${href}" class="text-[#3B82F6] underline underline-offset-2 hover:text-[#2563EB]" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );
  // Bold — **text**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic — *text*
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return s;
}

function markdownToHtml(md: string): string {
  const blocks = md.trim().split(/\n\s*\n/);
  return blocks
    .map((raw) => {
      const block = raw.trim();
      if (!block) return "";
      const escaped = escapeHtml(block);
      // Heading ## foo
      const h2 = escaped.match(/^##\s+(.+)$/m);
      if (h2 && escaped.split("\n").length === 1) {
        return `<h2 class="text-xl font-bold text-[#0F1D2E] mt-6 mb-3">${inlineMarkdown(h2[1])}</h2>`;
      }
      const h3 = escaped.match(/^###\s+(.+)$/m);
      if (h3 && escaped.split("\n").length === 1) {
        return `<h3 class="text-lg font-semibold text-[#0F1D2E] mt-5 mb-2">${inlineMarkdown(h3[1])}</h3>`;
      }
      // Otherwise paragraph. Newlines within a paragraph become <br>.
      const paragraph = escaped.replace(/\n/g, "<br />");
      return `<p class="text-base leading-relaxed text-[#334155] mb-4">${inlineMarkdown(paragraph)}</p>`;
    })
    .join("\n");
}

export function ArticleBody({ body }: { body: string }) {
  const html = markdownToHtml(body);
  return (
    <div
      className="article-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
