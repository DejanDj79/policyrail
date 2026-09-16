import { NextResponse } from "next/server";
import { runBazaarDryRun } from "@/lib/resources/bazaar-probe";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runBazaarDryRun();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not run the Bazaar dry-run probe.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
