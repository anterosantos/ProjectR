"use client";

import { useTransition, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { Button } from "@/components/ui/button";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { createSession, updateSession } from "@/lib/actions/sessions";
import {
  SessionCreateSchema,
  SessionUpdateSchema,
  type Session,
} from "@/lib/schemas/sessions";

// Use z.input<> to match zodResolver's expected input types (handles .default())
type SessionCreateInput = z.input<typeof SessionCreateSchema>;
type SessionUpdateInput = z.input<typeof SessionUpdateSchema>;

const SESSION_TYPE_LABELS: Record<string, string> = {
  training: "Treino",
  match: "Jogo",
  friendly: "Jogo amigável",
};

// Convert ISO datetime string to local datetime-local input format
function toDateTimeLocal(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert datetime-local input value to ISO string, accounting for browser timezone offset
function toISOFromLocal(localStr: string): string {
  const d = new Date(localStr);
  // datetime-local input is interpreted as UTC by JS, so we adjust for browser's timezone offset
  const offset = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() + offset).toISOString();
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface SessionFormCreateProps {
  mode: "create";
  hasSeason: boolean;
}

function SessionCreateForm({ hasSeason }: SessionFormCreateProps) {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const form = useForm<SessionCreateInput>({
    resolver: zodResolver(SessionCreateSchema),
    defaultValues: {
      type: "training",
      scheduledAt: "",
      durationMin: 90,
      location: "",
      notes: "",
    },
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function handleClose() {
    setOpen(false);
    router.push("/calendario");
  }

  function onSubmit(data: SessionCreateInput) {
    startTransition(async () => {
      try {
        const result = await createSession({
          type: data.type,
          scheduledAt: data.scheduledAt ? toISOFromLocal(data.scheduledAt) : "",
          durationMin: data.durationMin ?? 90,
          location: data.location || undefined,
          notes: data.notes || undefined,
        });
        if (!isMountedRef.current) return;
        if (!result.ok) {
          form.setError("root", { message: result.error.message });
          return;
        }
        setShowConfirmation(true);
      } catch (e) {
        if (!isMountedRef.current) return;
        form.setError("root", { message: "Erro ao comunicar com servidor" });
      }
    });
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Sessão criada"
          onDismiss={() => router.push("/calendario")}
        />
      )}
      <DrillDownSheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <h2 className="text-base font-semibold mb-4">Nova sessão</h2>

        {!hasSeason && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sem época actual definida. Configure em{" "}
            <a href="/configuracoes/epocas" className="underline font-medium">
              /configuracoes/epocas
            </a>
            .
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="session-type" className="text-sm font-medium">
              Tipo de sessão <span aria-hidden>*</span>
            </label>
            <select
              id="session-type"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              disabled={!hasSeason}
              {...form.register("type")}
            >
              {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {form.formState.errors.type && (
              <p className="text-xs text-destructive">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-scheduled-at" className="text-sm font-medium">
              Data e hora <span aria-hidden>*</span>
            </label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("scheduledAt")}
            />
            {form.formState.errors.scheduledAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledAt.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-duration" className="text-sm font-medium">
              Duração (minutos) <span aria-hidden>*</span>
            </label>
            <input
              id="session-duration"
              type="number"
              min={15}
              max={240}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("durationMin", { valueAsNumber: true })}
            />
            {form.formState.errors.durationMin && (
              <p className="text-xs text-destructive">
                {form.formState.errors.durationMin.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-location" className="text-sm font-medium">
              Local
            </label>
            <input
              id="session-location"
              type="text"
              maxLength={100}
              placeholder="ex: Campo Municipal"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={!hasSeason}
              {...form.register("location")}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="session-notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="session-notes"
              maxLength={500}
              rows={3}
              placeholder="Observações adicionais..."
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              disabled={!hasSeason}
              {...form.register("notes")}
            />
          </div>

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={isPending || !hasSeason}
            >
              {isPending ? "A guardar…" : "Criar sessão"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface SessionFormEditProps {
  mode: "edit";
  session: Session;
}

function SessionEditForm({ session }: SessionFormEditProps) {
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isLocked =
    session.status === "cancelled" || session.status === "completed";

  const form = useForm<SessionUpdateInput>({
    resolver: zodResolver(SessionUpdateSchema),
    defaultValues: {
      id: session.id,
      type: session.type as SessionUpdateInput["type"],
      scheduledAt: toDateTimeLocal(session.scheduled_at),
      durationMin: session.duration_min,
      location: session.location ?? "",
      notes: session.notes ?? "",
    },
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function handleClose() {
    setOpen(false);
    router.push("/calendario");
  }

  function onSubmit(data: SessionUpdateInput) {
    startTransition(async () => {
      try {
        const result = await updateSession({
          id: data.id,
          type: data.type,
          scheduledAt: data.scheduledAt ? toISOFromLocal(data.scheduledAt) : "",
          durationMin: data.durationMin ?? 90,
          location: data.location || undefined,
          notes: data.notes || undefined,
        });
        if (!isMountedRef.current) return;
        if (!result.ok) {
          form.setError("root", { message: result.error.message });
          return;
        }
        setShowConfirmation(true);
      } catch (e) {
        if (!isMountedRef.current) return;
        form.setError("root", { message: "Erro ao comunicar com servidor" });
      }
    });
  }

  return (
    <>
      {showConfirmation && (
        <CalmConfirmation
          message="Sessão actualizada"
          onDismiss={() => router.push("/calendario")}
        />
      )}
      <DrillDownSheet open={open} onOpenChange={(v) => !v && handleClose()}>
        <h2 className="text-base font-semibold mb-4">Editar sessão</h2>

        {isLocked && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Esta sessão não pode ser editada (cancelada/concluída)
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="session-type" className="text-sm font-medium">
              Tipo de sessão <span aria-hidden>*</span>
            </label>
            <select
              id="session-type"
              className="w-full rounded border px-3 py-2 text-sm bg-background"
              disabled={isLocked}
              {...form.register("type")}
            >
              {Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {form.formState.errors.type && (
              <p className="text-xs text-destructive">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-scheduled-at" className="text-sm font-medium">
              Data e hora <span aria-hidden>*</span>
            </label>
            <input
              id="session-scheduled-at"
              type="datetime-local"
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("scheduledAt")}
            />
            {form.formState.errors.scheduledAt && (
              <p className="text-xs text-destructive">
                {form.formState.errors.scheduledAt.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-duration" className="text-sm font-medium">
              Duração (minutos) <span aria-hidden>*</span>
            </label>
            <input
              id="session-duration"
              type="number"
              min={15}
              max={240}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("durationMin", { valueAsNumber: true })}
            />
            {form.formState.errors.durationMin && (
              <p className="text-xs text-destructive">
                {form.formState.errors.durationMin.message}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="session-location" className="text-sm font-medium">
              Local
            </label>
            <input
              id="session-location"
              type="text"
              maxLength={100}
              className="w-full rounded border px-3 py-2 text-sm"
              disabled={isLocked}
              {...form.register("location")}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="session-notes" className="text-sm font-medium">
              Notas
            </label>
            <textarea
              id="session-notes"
              maxLength={500}
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm resize-none"
              disabled={isLocked}
              {...form.register("notes")}
            />
          </div>

          {form.formState.errors.root && (
            <p className="text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {!isLocked && (
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "A guardar…" : "Actualizar sessão"}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleClose}>
              {isLocked ? "Fechar" : "Cancelar"}
            </Button>
          </div>
        </form>
      </DrillDownSheet>
    </>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

type Props = SessionFormCreateProps | SessionFormEditProps;

export function SessionForm(props: Props) {
  if (props.mode === "edit") {
    return <SessionEditForm {...props} />;
  }
  return <SessionCreateForm {...props} />;
}
