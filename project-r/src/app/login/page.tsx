"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  signInWithPassword,
  getCurrentUserWithRole,
  getRoleHomePath,
  createClient,
} from "@/lib/supabase/client";
import Link from "next/link";

type Stage = "password" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaTimeout, setMfaTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mfaThrottled, setMfaThrottled] = useState(false);
  const mfaStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (stage === "mfa") {
      mfaStartTimeRef.current = Date.now();
      const timeout = setTimeout(() => {
        setStage("password");
        setMfaCode("");
        setFactorId(null);
        setError("Código expirou. Por favor, inicie o login novamente.");
        setIsLoading(false);
      }, 5 * 60 * 1000);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMfaTimeout(timeout);
      return () => clearTimeout(timeout);
    }
  }, [stage]);

  useEffect(() => {
    return () => {
      setMfaCode("");
    };
  }, []);

  const redirectToHome = async () => {
    try {
      const { user, role } = await getCurrentUserWithRole();
      if (!user) {
        setError("Email ou password incorretos");
        setIsLoading(false);
        return;
      }
      if (!role) {
        setError("Perfil não configurado. Contacta o administrador.");
        setIsLoading(false);
        return;
      }
      try {
        router.push(getRoleHomePath(role));
      } catch (navError) {
        console.error("Navigation error:", navError);
        setError("Erro ao redirecionar. Por favor, tenta novamente.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Session check error:", err);
      setError("Erro ao recuperar dados de sessão. Por favor, tenta novamente.");
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!email || !password) {
        setError("Email ou password incorretos");
        setIsLoading(false);
        return;
      }

      const response = await signInWithPassword(email, password);

      if (response.error) {
        setError("Email ou password incorretos");
        setIsLoading(false);
        return;
      }

      // Check if MFA elevation is required (AAL2)
      const supabase = createClient();
      let aalData = null;
      try {
        const aalResponse = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        aalData = aalResponse.data;
      } catch (aalError) {
        console.error("AAL check failed:", aalError);
        setError("Erro ao verificar MFA. Por favor, tenta novamente.");
        setIsLoading(false);
        return;
      }

      if (!aalData) {
        setError("Erro ao recuperar dados de segurança. Por favor, tenta novamente.");
        setIsLoading(false);
        return;
      }

      if (
        aalData.nextLevel === "aal2" &&
        aalData.currentLevel !== "aal2"
      ) {
        let factorsData = null;
        try {
          const factorsResponse = await supabase.auth.mfa.listFactors();
          factorsData = factorsResponse.data;
        } catch (factorsError) {
          console.error("Factors list failed:", factorsError);
          setError("Erro ao recuperar fatores MFA. Por favor, tenta novamente.");
          setIsLoading(false);
          return;
        }

        if (!factorsData?.totp || factorsData.totp.length === 0) {
          setError("MFA é obrigatório mas nenhum fator foi configurado. Contacta o administrador.");
          setIsLoading(false);
          return;
        }

        const totpFactor = factorsData.totp.find(
          (f) => f.status === "verified"
        ) ?? null;
        if (totpFactor?.id) {
          setFactorId(totpFactor.id);
          setStage("mfa");
          setIsLoading(false);
          return;
        }
      }

      // No MFA required — redirect based on role
      await redirectToHome();
    } catch (err) {
      console.error("Login error:", err);
      setError("Email ou password incorretos");
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (mfaThrottled) {
      setError("Demasiadas tentativas. Aguarda alguns segundos.");
      return;
    }

    if (mfaCode.length !== 6) {
      setError("Código deve ter exatamente 6 dígitos");
      return;
    }

    setIsLoading(true);

    try {
      if (!factorId) {
        setError("Sessão inválida. Por favor, inicia o login novamente.");
        setStage("password");
        setMfaCode("");
        setIsLoading(false);
        return;
      }

      const supabase = createClient();

      try {
        const { data: currentAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!currentAal || currentAal.currentLevel === "aal1") {
          setError("Sessão expirou. Por favor, inicia o login novamente.");
          setStage("password");
          setMfaCode("");
          setFactorId(null);
          setIsLoading(false);
          return;
        }
      } catch (aalError) {
        console.error("AAL validation failed:", aalError);
        setError("Erro ao validar sessão. Por favor, tenta novamente.");
        setIsLoading(false);
        return;
      }

      let verifyError = null;
      try {
        const verifyResponse = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: mfaCode,
        });
        verifyError = verifyResponse.error;
      } catch (err) {
        console.error("MFA verification failed:", err);
        setError("Erro ao verificar código. Por favor, tenta novamente.");
        setIsLoading(false);
        return;
      }

      if (verifyError) {
        setError("Código de verificação inválido");
        setMfaCode("");
        setMfaThrottled(true);
        setIsLoading(false);
        setTimeout(() => setMfaThrottled(false), 2000);
        return;
      }

      setMfaCode("");
      await redirectToHome();
    } catch (err) {
      console.error("Unexpected MFA error:", err);
      setError("Erro inesperado. Por favor, tenta novamente.");
      setIsLoading(false);
    }
  };

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Entrar em Project R
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {stage === "mfa"
              ? "Introduz o código da tua aplicação autenticadora"
              : "Acede com as suas credenciais"}
          </p>
        </div>

        {stage === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="seu.email@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link
                  href="/recuperar-password"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Esqueceu a password?
                </Link>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "A entrar..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMFASubmit} className="space-y-6">
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
                name="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-center font-mono placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="000000"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "A verificar..." : "Verificar"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
              onClick={() => {
                setStage("password");
                setError(null);
                setMfaCode("");
                setFactorId(null);
                setEmail("");
                setPassword("");
                if (mfaTimeout) clearTimeout(mfaTimeout);
              }}
            >
              ← Voltar ao login
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
