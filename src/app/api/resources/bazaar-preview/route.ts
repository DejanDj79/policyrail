import { NextResponse } from "next/server";
import { getBazaarPreview } from "@/lib/resources/bazaar-preview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const preview = await getBazaarPreview();
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load the x402 Bazaar preview.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
