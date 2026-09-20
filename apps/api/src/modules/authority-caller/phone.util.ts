// ponytail: India-only heuristic — a non-IN number stored without a country
// code could collide with a differently-formatted match. Upgrade to
// libphonenumber-js if a non-IN tenant appears; not building for that now.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (digits.length === 13 && digits.startsWith("091")) return "+" + digits.slice(1);
  return "+" + digits;
}
