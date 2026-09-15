import { NextResponse } from "next/server";
import { evaluatePayment } from "@/lib/policy/engine";
import type { PaymentRequest, SpendingPolicy } from "@/lib/policy/types";

interface EvaluateBody {
  policy: SpendingPolicy;
  request: PaymentRequest;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EvaluateBody;

    if (!body.policy || !body.request) {
      return NextResponse.json(
        { error: "policy and request are required" },
        { status: 400 }
      );
    }

    return NextResponse.json(evaluatePayment(body.policy, body.request));
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
