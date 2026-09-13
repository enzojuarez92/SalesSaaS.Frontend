export const paymentMethodOptions = [
  { value: 1, label: "Efectivo" },
  { value: 2, label: "Tarjeta de crédito" },
  { value: 3, label: "Tarjeta de débito" },
  { value: 4, label: "Transferencia" },
  { value: 5, label: "Mercado Pago" },
  { value: 7, label: "Billetera virtual" },
  { value: 6, label: "Cuenta corriente" },
  { value: 8, label: "Otros" },
] as const;

export function paymentMethodLabel(value: number) {
  return paymentMethodOptions.find((option) => option.value === value)?.label ?? "Sin especificar";
}
