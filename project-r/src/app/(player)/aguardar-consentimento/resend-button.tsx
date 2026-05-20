"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResendButton() {
  const [sent, setSent] = useState(false);

  return sent ? (
    <p className="text-sm text-muted-foreground">Email reenviado.</p>
  ) : (
    <Button
      variant="ghost"
      onClick={() => setSent(true)}
      className="w-full"
    >
      Reenviar email
    </Button>
  );
}
