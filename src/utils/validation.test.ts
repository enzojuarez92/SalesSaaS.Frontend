import { describe, expect, it } from "vitest";
import { digitsOnly, isValidArgentineTaxId, isValidEmail } from "./validation";

describe("client validation", () => {
  it("accepts only a valid 11-digit Argentine CUIT", () => {
    expect(isValidArgentineTaxId("20123456786")).toBe(true);
    expect(isValidArgentineTaxId("20123456789")).toBe(false);
    expect(isValidArgentineTaxId("20-12345678-6")).toBe(false);
    expect(digitsOnly("20-12345678-6", 11)).toBe("20123456786");
  });

  it("requires a standard email shape", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});
