// Shared validation helpers for frontend forms

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // optional
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (!/^\d{10}$/.test(cleaned)) return 'Phone must be exactly 10 digits';
  return null;
}

export function validateName(name: string, label = 'Name'): string | null {
  const trimmed = name.trim();
  if (!trimmed) return `${label} is required`;
  if (trimmed.length < 2) return `${label} must be at least 2 characters`;
  return null;
}

export function validatePrice(price: string | number, allowZero = false): string | null {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(n)) return 'Must be a valid number';
  if (allowZero ? n < 0 : n <= 0) return allowZero ? 'Price cannot be negative' : 'Price must be greater than 0';
  return null;
}

export function validateQuantity(qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 1) return 'Must be a positive whole number';
  if (qty > 99) return 'Maximum 99 items';
  return null;
}

export function validateRequired(value: string, label = 'Field'): string | null {
  if (!value.trim()) return `${label} is required`;
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
  return null;
}

export function hasErrors(errors: Record<string, string | null>): boolean {
  return Object.values(errors).some(e => e !== null);
}
