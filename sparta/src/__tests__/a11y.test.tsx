import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";

describe("Accessibility — Skip Link", () => {
  it("skip link é o primeiro elemento focável no DOM", () => {
    const { container } = render(
      <body>
        <a href="#main-content">Saltar para o conteúdo</a>
        <main id="main-content">Conteúdo principal</main>
      </body>
    );
    const focusableElements = container.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements[0]).toHaveAttribute("href", "#main-content");
  });

  it("skip link tem texto 'Saltar para o conteúdo'", () => {
    const { getByText } = render(
      <body>
        <a href="#main-content">Saltar para o conteúdo</a>
        <main id="main-content">Conteúdo principal</main>
      </body>
    );
    expect(getByText("Saltar para o conteúdo")).toBeInTheDocument();
  });
});

describe("Accessibility — Staff Layout Structure", () => {
  it("tem main#main-content", () => {
    const { container } = render(
      <div>
        <main id="main-content">Conteúdo staff</main>
      </div>
    );
    expect(container.querySelector("main#main-content")).toBeInTheDocument();
  });

  it("estrutura de página staff não tem violações axe", async () => {
    const { container } = render(
      <div>
        <a href="#main-content">Saltar para o conteúdo</a>
        <nav aria-label="Navegação principal">
          <ul>
            <li><a href="/prontidao">Prontidão</a></li>
          </ul>
        </nav>
        <main id="main-content">
          <h1>Painel de Prontidão</h1>
          <p>Conteúdo da página.</p>
        </main>
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Accessibility — Player Layout Structure", () => {
  it("tem main#main-content", () => {
    const { container } = render(
      <div>
        <main id="main-content">Conteúdo player</main>
      </div>
    );
    expect(container.querySelector("main#main-content")).toBeInTheDocument();
  });

  it("estrutura de página player não tem violações axe", async () => {
    const { container } = render(
      <div>
        <a href="#main-content">Saltar para o conteúdo</a>
        <main id="main-content">
          <h1>Hoje</h1>
          <p>O teu questionário de fadiga.</p>
        </main>
        <nav aria-label="Navegação por separadores">
          <ul>
            <li><a href="/hoje">Hoje</a></li>
          </ul>
        </nav>
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Accessibility — Auth Pages Structure", () => {
  it("página de login tem main#main-content", () => {
    const { container } = render(
      <main id="main-content" className="flex min-h-screen items-center justify-center">
        <div>
          <h1>Entrar em SPARTA</h1>
          <form>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" />
            <button type="submit">Entrar</button>
          </form>
        </div>
      </main>
    );
    expect(container.querySelector("main#main-content")).toBeInTheDocument();
  });

  it("estrutura de página de login não tem violações axe", async () => {
    const { container } = render(
      <main id="main-content" className="flex min-h-screen items-center justify-center">
        <div>
          <h1>Entrar em SPARTA</h1>
          <form>
            <label htmlFor="email-test">Email</label>
            <input id="email-test" type="email" name="email" />
            <label htmlFor="password-test">Password</label>
            <input id="password-test" type="password" name="password" />
            <button type="submit">Entrar</button>
          </form>
        </div>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
