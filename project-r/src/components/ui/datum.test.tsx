import { render, screen } from "@testing-library/react"
import { Datum } from "./datum"

describe("Datum", () => {
  it("renders value and label", () => {
    render(<Datum value={1.82} label="ACWR" />)
    expect(screen.getByText("1.82")).toBeInTheDocument()
    expect(screen.getByText("ACWR")).toBeInTheDocument()
  })

  it("renders unit when provided", () => {
    render(<Datum value={68} unit="kg" label="PESO" />)
    expect(screen.getByText("kg")).toBeInTheDocument()
  })

  it("applies color to value", () => {
    const { container } = render(<Datum value={5} label="FADIGA" color="#EF4444" />)
    const valueEl = container.querySelector(".font-mono.font-medium")
    expect(valueEl).not.toBeNull()
    expect(valueEl).toHaveStyle({ color: "#EF4444" })
  })
})
