"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updatePassword, getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Check if recovery token is present in URL
  useEffect(() => {
    const validateRecoveryLink = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();

      // If no session, the recovery link may be invalid
      if (!data.session) {
        // Check if there's a recovery link in the URL hash
        const hash = window.location.hash;
        if (!hash.includes("access_token")) {
          setError("Link de recuperação inválido ou expirado");
        }
      }
      setIsValidating(false);
    };

    validateRecoveryLink();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        setError("As passwords não correspondem");
        setIsLoading(false);
        return;
      }

      // Validate password length (minimum 6 characters as per Supabase default)
      if (password.length < 6) {
        setError("A password deve ter pelo menos 6 caracteres");
        setIsLoading(false);
        return;
      }

      // Update password
      const response = await updatePassword(password);

      if (!response.success) {
        setError(response.error?.message || "Erro ao atualizar password");
        setIsLoading(false);
        return;
      }

      // Redirect to login after successful reset
      router.push("/login");
    } catch (err) {
      setError("Erro ao atualizar password");
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">A validar link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
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
            <p className="mt-1 text-xs text-gray-500">
              Mínimo 6 caracteres
            </p>
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

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "A atualizar..." : "Atualizar password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
