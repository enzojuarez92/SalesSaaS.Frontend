const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cuitWeights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function digitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return maxLength ? digits.slice(0, maxLength) : digits;
}

export function isValidArgentineTaxId(value: string) {
  if (!/^\d{11}$/.test(value)) return false;
  const sum = cuitWeights.reduce(
    (total, weight, index) => total + Number(value[index]) * weight,
    0,
  );
  let verifier = 11 - (sum % 11);
  if (verifier === 11) verifier = 0;
  if (verifier === 10) verifier = 9;
  return verifier === Number(value[10]);
}

export function requiredText(value: string, label: string, maxLength: number) {
  if (!value.trim()) return `${label} es obligatorio.`;
  if (value.trim().length > maxLength)
    return `${label} no puede superar los ${maxLength} caracteres.`;
  return "";
}

export function nonNegative(value: number, label: string) {
  return Number.isFinite(value) && value >= 0
    ? ""
    : `${label} no puede ser negativo.`;
}
