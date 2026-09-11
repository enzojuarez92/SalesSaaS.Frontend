import { describe, it, expect } from "vitest";
import { money } from "./format";
describe("importes argentinos", () => {
  it("mantiene miles, decimales, cero y signo", () => {
    expect(money(1250000)).toBe("$ 1.250.000,00");
    expect(money(0)).toBe("$ 0,00");
    expect(money(-1234.5)).toBe("$ -1.234,50");
  });
});
