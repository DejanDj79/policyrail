export const USDC_ATOMIC_PER_USDC = 1_000_000;
export const USDC_ATOMIC_PER_CENT = 10_000;

export function assertAtomicUsdc(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("USDC atomic amount must be a positive safe integer.");
  }
  return value;
}

export function centsToAtomicUsdc(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Cent amount must be a non-negative safe integer.");
  }

  const atomic = cents * USDC_ATOMIC_PER_CENT;
  if (!Number.isSafeInteger(atomic)) {
    throw new Error("USDC atomic amount exceeds JavaScript safe integer range.");
  }
  return atomic;
}

export function atomicUsdcFromString(value: string) {
  try {
    const atomic = BigInt(value);
    if (atomic <= BigInt(0) || atomic > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(atomic);
  } catch {
    return null;
  }
}

export function atomicUsdcToExactCents(atomic: number) {
  if (!Number.isSafeInteger(atomic) || atomic < 0) return null;
  if (atomic % USDC_ATOMIC_PER_CENT !== 0) return null;
  return atomic / USDC_ATOMIC_PER_CENT;
}

export function formatAtomicUsdc(atomic: number) {
  if (!Number.isSafeInteger(atomic) || atomic < 0) return "0";

  const whole = Math.floor(atomic / USDC_ATOMIC_PER_USDC);
  const fraction = String(atomic % USDC_ATOMIC_PER_USDC)
    .padStart(6, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formatAtomicUsd(atomic: number) {
  return `$${formatAtomicUsdc(atomic)}`;
}
