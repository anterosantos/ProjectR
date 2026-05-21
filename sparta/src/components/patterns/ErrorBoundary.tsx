"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error("Error in BrowserGate:", error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full max-w-sm text-center">
              <h1 className="text-xl font-semibold mb-2">Ocorreu um erro</h1>
              <p className="text-sm text-muted-foreground">
                Ocorreu um problema ao processar a tua solicitação. Por favor, recarrega a página.
              </p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
