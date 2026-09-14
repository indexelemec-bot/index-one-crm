const small = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

const tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function underThousand(value: number): string {
  if (value < 30) return small[value];
  if (value < 100) {
    const unit = value % 10;
    return unit ? `${tens[Math.floor(value / 10)]} y ${small[unit]}` : tens[Math.floor(value / 10)];
  }
  if (value === 100) return "cien";
  const rest = value % 100;
  return rest ? `${hundreds[Math.floor(value / 100)]} ${underThousand(rest)}` : hundreds[Math.floor(value / 100)];
}

export function integerToSpanish(value: number): string {
  const integer = Math.trunc(value);
  if (!Number.isSafeInteger(integer) || integer < 0 || integer > 999_999_999) {
    throw new Error("El monto debe estar entre 0 y 999,999,999.");
  }
  if (integer < 1_000) return underThousand(integer);
  if (integer < 1_000_000) {
    const thousands = Math.floor(integer / 1_000);
    const rest = integer % 1_000;
    const prefix = thousands === 1 ? "mil" : `${integerToSpanish(thousands).replace(/uno$/, "un")} mil`;
    return rest ? `${prefix} ${underThousand(rest)}` : prefix;
  }
  const millions = Math.floor(integer / 1_000_000);
  const rest = integer % 1_000_000;
  const prefix = millions === 1 ? "un millón" : `${integerToSpanish(millions).replace(/uno$/, "un")} millones`;
  return rest ? `${prefix} ${integerToSpanish(rest)}` : prefix;
}

export function dominicanPesosInWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("El monto no es válido.");
  const roundedCents = Math.round(value * 100);
  const integer = Math.floor(roundedCents / 100);
  const cents = roundedCents % 100;
  const amount = integerToSpanish(integer).replace(/uno$/, "un");
  const connector = integer >= 1_000_000 && integer % 1_000_000 === 0 ? " de" : "";
  return `${amount}${connector} pesos dominicanos con ${String(cents).padStart(2, "0")}/100`.toUpperCase();
}

