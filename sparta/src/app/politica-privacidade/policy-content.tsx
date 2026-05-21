"use client";

import ReactMarkdown from "react-markdown";
import { TooltipExplain } from "@/components/ui/tooltip-explain";

const GLOSSARY: Record<string, string> = {
  RGPD: "Regulamento Geral de Proteção de Dados — a lei europeia que protege os teus dados pessoais.",
  "dados pessoais":
    "Informações que te identificam, como o teu nome, email ou data de nascimento.",
};

interface PolicyContentProps {
  content: string;
  isU14: boolean;
}

export function PolicyContent({ content, isU14 }: PolicyContentProps) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <ReactMarkdown
        components={
          isU14
            ? {
                p({ children }) {
                  return <p>{processChildren(children)}</p>;
                },
                li({ children }) {
                  return <li>{processChildren(children)}</li>;
                },
              }
            : undefined
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function processChildren(
  children: React.ReactNode
): React.ReactNode {
  if (typeof children === "string") {
    return renderWithGlossary(children);
  }
  if (Array.isArray(children)) {
    return children.flatMap((child) =>
      typeof child === "string" ? renderWithGlossary(child) : [child]
    );
  }
  return children;
}

function renderWithGlossary(
  text: string
): (string | React.ReactElement)[] {
  const terms = Object.keys(GLOSSARY);
  let parts: (string | React.ReactElement)[] = [text];
  let keyIndex = 0;

  for (const term of terms) {
    const updated: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        updated.push(part);
        continue;
      }
      const segments = part.split(new RegExp(`(${term})`, "gi"));
      for (const seg of segments) {
        if (seg.toLowerCase() === term.toLowerCase()) {
          updated.push(
            <TooltipExplain
              key={`glossary-${keyIndex++}`}
              term={seg}
              definition={GLOSSARY[term] ?? ""}
            />
          );
        } else if (seg.length > 0) {
          updated.push(seg);
        }
      }
    }
    parts = updated;
  }

  return parts;
}
