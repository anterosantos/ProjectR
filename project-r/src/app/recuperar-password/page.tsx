"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requestPasswordRecovery } from "@/lib/supabase/client";
import Link from "next/link";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!email) {
        setIsLoading(false);
        return;
      }

      // Request recovery email
      await requestPasswordRecovery(email);

      // Always show success message to avoid enumeration
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      // Still show success message for security
      setSubmitted(true);
      setEmail("");
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
              Email enviado
            </h2>
          </div>

          <Alert variant="success">
            <AlertDescription>
              Se o email existir, vais receber um link em alguns minutos
            </AlertDescription>
          </Alert>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Recuperar password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Introduza o seu email para receber um link de recuperação
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Voltar para o login
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "A enviar..." : "Enviar link de recuperação"}
          </Button>
        </form>
      </div>
    </div>
  );
}
