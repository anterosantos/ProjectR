"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signInWithPassword, getCurrentUserWithRole, getRoleHomePath } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Basic client-side validation — use same generic message to avoid leaking field hints
      if (!email || !password) {
        setError("Email ou password incorretos");
        setIsLoading(false);
        return;
      }

      // Attempt sign in
      const response = await signInWithPassword(email, password);

      if (response.error) {
        setError(response.error.message);
        setIsLoading(false);
        return;
      }

      // Sign in successful - get user role and redirect
      const { user, role } = await getCurrentUserWithRole();
      if (!user) {
        setError("Email ou password incorretos");
        setIsLoading(false);
        return;
      }

      if (!role) {
        setError("Perfil não configurado. Contacte o administrador.");
        setIsLoading(false);
        return;
      }

      // Redirect to role-specific home page
      const homePath = getRoleHomePath(role);
      router.push(homePath);
    } catch (err) {
      setError("Email ou password incorretos");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Entrar em Project R
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Aceda com as suas credenciais
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "A entrar..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
