import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { base58 } from "@scure/base";
import { Keypair } from "@solana/web3.js";

const envPath = resolve(process.cwd(), ".env.local");
let envText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

function getValue(name) {
  const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match?.[1]?.trim() || null;
}

function setValue(name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const line = `${name}=${value}`;

  if (pattern.test(envText)) {
    envText = envText.replace(pattern, line);
  } else {
    if (envText && !envText.endsWith("\n")) envText += "\n";
    envText += `${line}\n`;
  }
}

function loadOrCreateWallet(privateKeyName, addressName) {
  const existingPrivateKey = getValue(privateKeyName);
  let keypair;

  if (existingPrivateKey) {
    try {
      keypair = Keypair.fromSecretKey(base58.decode(existingPrivateKey));
    } catch {
      throw new Error(
        `${privateKeyName} exists but is not a valid base58 Solana secret key.`
      );
    }
  } else {
    keypair = Keypair.generate();
    setValue(privateKeyName, base58.encode(keypair.secretKey));
  }

  const address = keypair.publicKey.toBase58();
  setValue(addressName, address);
  return address;
}

if (!getValue("POLICYRAIL_X402_ENABLED")) {
  setValue("POLICYRAIL_X402_ENABLED", "false");
}
if (!getValue("SOLANA_RPC_URL")) {
  setValue("SOLANA_RPC_URL", "https://api.devnet.solana.com");
}
if (!getValue("X402_FACILITATOR_URL")) {
  setValue("X402_FACILITATOR_URL", "https://x402.org/facilitator");
}

const agentAddress = loadOrCreateWallet(
  "POLICYRAIL_AGENT_PRIVATE_KEY",
  "POLICYRAIL_AGENT_ADDRESS"
);
const merchantAddress = loadOrCreateWallet(
  "POLICYRAIL_MERCHANT_PRIVATE_KEY",
  "POLICYRAIL_MERCHANT_ADDRESS"
);

writeFileSync(envPath, envText, { mode: 0o600 });

console.log("PolicyRail Solana Devnet wallets are ready.");
console.log("");
console.log(`Agent wallet:    ${agentAddress}`);
console.log(`Merchant wallet: ${merchantAddress}`);
console.log("");
console.log("Private keys were written only to .env.local and were not printed.");
console.log("Fund BOTH public addresses with Solana Devnet USDC using Circle's public faucet.");
console.log("After both wallets have a USDC token account, set POLICYRAIL_X402_ENABLED=true in .env.local.");
