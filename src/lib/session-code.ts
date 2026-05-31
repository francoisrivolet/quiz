const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 6): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}
