const smallNumbers = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
  "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"
];

const tens = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const hundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function underOneThousand(value: number): string {
  if (value < 30) return smallNumbers[value];
  if (value < 100) {
    const unit = value % 10;
    return unit ? `${tens[Math.floor(value / 10)]} y ${smallNumbers[unit]}` : tens[Math.floor(value / 10)];
  }
  if (value === 100) return "cien";
  const remainder = value % 100;
  return remainder ? `${hundreds[Math.floor(value / 100)]} ${underOneThousand(remainder)}` : hundreds[Math.floor(value / 100)];
}

function apocopate(value: string) {
  return value
    .replace(/veintiuno$/u, "veintiún")
    .replace(/ y uno$/u, " y un")
    .replace(/uno$/u, "un");
}

function integerToSpanish(value: number): string {
  if (value < 1_000) return underOneThousand(value);
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1_000);
    const remainder = value % 1_000;
    const prefix = thousands === 1 ? "mil" : `${apocopate(integerToSpanish(thousands))} mil`;
    return remainder ? `${prefix} ${integerToSpanish(remainder)}` : prefix;
  }

  const millions = Math.floor(value / 1_000_000);
  const remainder = value % 1_000_000;
  const prefix = millions === 1 ? "un millón" : `${apocopate(integerToSpanish(millions))} millones`;
  return remainder ? `${prefix} ${integerToSpanish(remainder)}` : prefix;
}

export function amountToSpanishWords(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1_000_000_000_000) {
    throw new Error("El monto de honorarios no puede convertirse a letras.");
  }

  const centsTotal = Math.round(amount * 100);
  const integer = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  return `${apocopate(integerToSpanish(integer))} con ${String(cents).padStart(2, "0")}/100`.toUpperCase();
}
