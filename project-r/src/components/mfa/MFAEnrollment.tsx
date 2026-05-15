"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface MFAEnrollmentProps {
  onSuccess: () => void;
}

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function MFAEnrollment({ onSuccess }: MFAEnrollmentProps) {
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  const handleEnroll = async () => {
    setError(null);
    setIsStarting(true);
    try {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (enrollError || !data) {
        setError("Erro ao iniciar configuração de MFA. Tenta novamente.");
        return;
      }
      setEnrollData({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch {
      setError("Erro inesperado. Tenta novamente.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleVerify = async (values: VerifyFormData) => {
    if (!enrollData) return;
    setError(null);
    setIsVerifying(true);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.factorId,
        code: values.code,
      });
      if (verifyError) {
        setError("Código inválido. Tenta novamente.");
        return;
      }
      setSuccess(true);
      // Clear sensitive enrollment data from memory
      setEnrollData(null);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch {
      setError("Erro inesperado. Tenta novamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (success) {
    return (
      <Alert variant="success">
        <AlertDescription>MFA ativado com sucesso</AlertDescription>
      </Alert>
    );
  }

  if (!enrollData) {
    return (
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          onClick={handleEnroll}
          disabled={isStarting}
          variant="default"
        >
          {isStarting ? "A configurar..." : "Ativar MFA"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm text-gray-700">
          Lê o código QR com a tua aplicação autenticadora (Google Authenticator,
          Authy, Microsoft Authenticator).
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- QR code is a data URL; Next.js Image optimisation does not apply to base64 data URIs */}
        <img
          src={enrollData.qrCode}
          alt="Código QR para configuração de MFA"
          className="rounded-lg border border-gray-200 bg-white p-2"
          width={200}
          height={200}
        />
      </div>

      <details className="rounded-lg border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Entrada manual (se não conseguires ler o QR)
        </summary>
        <p className="mt-2 text-xs text-gray-600">
          Chave secreta:
        </p>
        <code
          className="mt-1 block break-all rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800"
          aria-label="Chave secreta MFA"
        >
          {enrollData.secret}
        </code>
      </details>

      <form onSubmit={handleSubmit(handleVerify)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div>
          <label
            htmlFor="mfa-code"
            className="block text-sm font-medium text-gray-700"
          >
            Código de verificação (6 dígitos)
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            {...register("code")}
            className="mt-1 block w-40 appearance-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-center placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            disabled={isVerifying}
            aria-describedby={errors.code ? "mfa-code-error" : undefined}
          />
          {errors.code && (
            <p id="mfa-code-error" className="mt-1 text-xs text-red-600">
              {errors.code.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isVerifying}>
          {isVerifying ? "A verificar..." : "Verificar e ativar"}
        </Button>
      </form>
    </div>
  );
}
