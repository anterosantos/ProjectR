"use client";

import { useRef, useState, useEffect } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string>("");

  useEffect(() => {
    urlRef.current = typeof window !== "undefined" ? window.location.href : "";
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopyLink = async () => {
    setError(false);

    try {
      await navigator.clipboard.writeText(urlRef.current);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setError(true);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopyLink}
      aria-label={
        error
          ? "Falha ao copiar link. Tenta novamente."
          : "Copiar link desta página"
      }
      className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {error ? "Erro ao copiar" : copied ? "Link copiado!" : "Copiar link"}
    </button>
  );
}
