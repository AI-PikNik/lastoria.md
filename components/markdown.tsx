import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function Markdown({ content }: { content: string }) {
  return (
    <div className="max-w-none space-y-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-display [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
