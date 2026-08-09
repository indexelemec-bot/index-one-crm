export function normalizeWhatsAppPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `1${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const digits = normalizeWhatsAppPhone(phone);
  if (digits.length < 8) throw new Error("El contacto no tiene un número de WhatsApp válido.");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
