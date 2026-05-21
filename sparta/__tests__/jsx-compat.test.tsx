/**
 * React 19 JSX Compatibility Test
 * Verifies that JSX rendering is consistent between vitest and Next.js dev server
 * React 19 uses automatic JSX transform; vitest uses @vitejs/plugin-react
 */

import { render, screen } from "@testing-library/react";

function TestComponent() {
  return (
    <div>
      <h1>Test Component</h1>
      <p>Rendered by vitest (should match next dev output)</p>
    </div>
  );
}

function ComponentWithState() {
  // Simple hook usage to verify React 19 behavior
  const [count] = React.useState(0);
  return <span data-testid="count">{count}</span>;
}

// Re-export for test access (React not imported in component)
import * as React from "react";

describe("React 19 JSX Compatibility", () => {
  it("renders basic component with JSX", () => {
    render(<TestComponent />);
    expect(screen.getByText("Test Component")).toBeInTheDocument();
    expect(screen.getByText(/Rendered by vitest/)).toBeInTheDocument();
  });

  it("renders component with React hooks", () => {
    render(<ComponentWithState />);
    expect(screen.getByTestId("count")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("supports fragment JSX syntax", () => {
    const Fragment = () => (
      <>
        <div>First</div>
        <div>Second</div>
      </>
    );

    render(<Fragment />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("supports conditional rendering", () => {
    const Conditional = ({ show }: { show: boolean }) => (
      <div>{show ? <span>Visible</span> : null}</div>
    );

    const { rerender } = render(<Conditional show={true} />);
    expect(screen.getByText("Visible")).toBeInTheDocument();

    rerender(<Conditional show={false} />);
    expect(screen.queryByText("Visible")).not.toBeInTheDocument();
  });
});
