const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

// At least three of: lowercase, uppercase, digit, symbol.
export function isStrongPassword(password: string): boolean {
  return CHARACTER_CLASSES.filter((pattern) => pattern.test(password)).length >= 3;
}
