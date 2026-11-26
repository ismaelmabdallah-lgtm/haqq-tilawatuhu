import "server-only";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QuranVerse } from "@/components/quran/QuranVerse";
import { QURAN_TOKEN, parseToken } from "@/lib/quran/ref";

/**
 * Renders reviewed Markdown at build time. Raw HTML is NOT rendered
 * (react-markdown default), so content cannot inject markup or scripts.
 * Quranic text can only appear through [[quran:s:a]] tokens, which are
 * resolved against the verified Tanzil bundle — never typed into the text.
 */
export function Markdown({ source, riwayahCode }: { source: string | null | undefined; riwayahCode?: string | null }) {
  if (!source?.trim()) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of source.matchAll(QURAN_TOKEN)) {
    const before = source.slice(last, m.index);
    if (before.trim()) parts.push(<Md key={`m${i++}`} text={before} />);
    const ref = parseToken(m);
    if (ref) parts.push(<QuranVerse key={`q${i++}`} quranRef={ref} riwayahCode={riwayahCode} />);
    last = (m.index ?? 0) + m[0].length;
  }
  const rest = source.slice(last);
  if (rest.trim()) parts.push(<Md key={`m${i++}`} text={rest} />);
  return <div className="prose-ar">{parts}</div>;
}

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}
      components={{ a: ({ href, children }) => <a href={href} rel="noopener noreferrer" target={href?.startsWith("/") ? undefined : "_blank"}>{children}</a> }}>
      {text}
    </ReactMarkdown>
  );
}
