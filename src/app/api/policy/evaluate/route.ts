import { NextResponse } from "next/server";
import { authorizePaymentForTask } from "@/lib/policy/authorize-payment";
import type { SpendingCategory } from "@/lib/policy/types";
import { createClient } from "@/lib/supabase/server";

interface EvaluateBody {
  taskId?: string;
  provider?: string;
  resource?: string;
  category?: SpendingCategory;
  amountCents?: number;
}

const VALID_CATEGORIES: SpendingCategory[] = [
  "search",
  "data",
  "compute",
  "inference",
  "other",
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: EvaluateBody;

  try {
    body = (await request.json()) as EvaluateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.taskId ||
    !body.provider?.trim() ||
    !body.resource?.trim() ||
    !body.category ||
    !VALID_CATEGORIES.includes(body.category) ||
    !Number.isInteger(body.amountCents) ||
    (body.amountCents ?? 0) <= 0
  ) {
    return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
  }

  try {
    const decision = await authorizePaymentForTask(supabase, {
      taskId: body.taskId,
      provider: body.provider,
      resource: body.resource,
      category: body.category,
      amountCents: body.amountCents as number,
    });

    return NextResponse.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Policy evaluation failed";
    const status = message === "Task not found" || message === "Policy not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
