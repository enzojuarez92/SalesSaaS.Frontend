const currency = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (value: number | null | undefined) =>
  `$ ${currency.format(Number(value ?? 0))}`;
export const number = (value: number) =>
  new Intl.NumberFormat("es-AR").format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
