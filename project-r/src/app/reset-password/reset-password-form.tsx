"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updatePassword, getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [invalidToken, setInvalidToken] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Listen for PASSWORD_RECOVERY event — emitted by Supabase SDK when a valid
    // recovery link is clicked (works for both PKCE ?code= and implicit #access_token= flows)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        resolvedRef.current = true;
        setIsValidating(false);
      }
    });

    // If no PASSWORD_RECOVERY event fires within 3s, the link is invalid or expired
    const fallback = setTimeout(() => {
      if (!resolvedRef.current) {
        setInvalidToken(true);
        setIsValidating(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (password !== confirmPassword) {
        setError("As passwords não correspondem");
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("A password deve ter pelo menos 6 caracteres");
        setIsLoading(false);
        return;
      }

      const response = await updatePassword(password);

      if (!response.success) {
        setError(response.error?.message || "Erro ao atualizar password");
        setIsLoading(false);
        return;
      }

      setSucceeded(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError("Erro ao atualizar password");
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">A validar link...</p>
        </div>
      </main>
    );
  }

  if (invalidToken) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <Alert variant="destructive">
            <AlertDescription>
              Link de recuperação inválido ou expirado.
            </AlertDescription>
          </Alert>
          <div className="text-center">
            <Link
              href="/recuperar-password"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Pedir novo link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (succeeded) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <Alert variant="success">
            <AlertDescription>
              Password atualizada com sucesso. A redirecionar...
            </AlertDescription>
          </Alert>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Definir nova password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Introduza a sua nova password abaixo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Nova Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="••••••••"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirmar Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "A atualizar..." : "Atualizar password"}
          </Button>
        </form>
      </div>
    </main>
  );
}
