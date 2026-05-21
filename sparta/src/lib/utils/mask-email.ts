export function maskEmail(email: string): string {
  if (!email || email.length === 0) return email;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const visible = local[0] ?? "";
  return `${visible}***${domain}`;
}
