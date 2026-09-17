import assert from "node:assert/strict";
import {
  USDC_ATOMIC_PER_CENT,
  USDC_ATOMIC_PER_USDC,
  assertAtomicUsdc,
  atomicUsdcFromString,
  atomicUsdcToExactCents,
  centsToAtomicUsdc,
  formatAtomicUsd,
  formatAtomicUsdDisplay,
  formatAtomicUsdc,
} from "../src/lib/money/usdc.ts";

assert.equal(USDC_ATOMIC_PER_USDC, 1_000_000);
assert.equal(USDC_ATOMIC_PER_CENT, 10_000);

assert.equal(centsToAtomicUsdc(0), 0);
assert.equal(centsToAtomicUsdc(1), 10_000);
assert.equal(centsToAtomicUsdc(30), 300_000);
assert.throws(() => centsToAtomicUsdc(-1));
assert.throws(() => centsToAtomicUsdc(1.5));

assert.equal(assertAtomicUsdc(1), 1);
assert.equal(assertAtomicUsdc(999_999), 999_999);
assert.throws(() => assertAtomicUsdc(0));
assert.throws(() => assertAtomicUsdc(-1));
assert.throws(() => assertAtomicUsdc(1.5));

assert.equal(atomicUsdcFromString("1"), 1);
assert.equal(atomicUsdcFromString("10000"), 10_000);
assert.equal(atomicUsdcFromString("0"), null);
assert.equal(atomicUsdcFromString("-1"), null);
assert.equal(atomicUsdcFromString("1.5"), null);
assert.equal(atomicUsdcFromString("not-a-number"), null);

assert.equal(atomicUsdcToExactCents(0), 0);
assert.equal(atomicUsdcToExactCents(10_000), 1);
assert.equal(atomicUsdcToExactCents(300_000), 30);
assert.equal(atomicUsdcToExactCents(9_999), null);
assert.equal(atomicUsdcToExactCents(10_001), null);

assert.equal(formatAtomicUsdc(1), "0.000001");
assert.equal(formatAtomicUsdc(10_000), "0.01");
assert.equal(formatAtomicUsdc(300_000), "0.3");
assert.equal(formatAtomicUsdc(1_000_000), "1");
assert.equal(formatAtomicUsdc(1_234_567), "1.234567");
assert.equal(formatAtomicUsd(1), "$0.000001");
assert.equal(formatAtomicUsd(1_230_000), "$1.23");
assert.equal(formatAtomicUsdDisplay(1), "$0.000001");
assert.equal(formatAtomicUsdDisplay(10_000), "$0.01");
assert.equal(formatAtomicUsdDisplay(300_000), "$0.30");
assert.equal(formatAtomicUsdDisplay(1_230_000), "$1.23");

console.log("USDC atomic money invariants passed.");
