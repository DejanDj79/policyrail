-- PolicyRail current-state reference for atomic payment authorization hardening.
-- Production Supabase migration history already contains the applied migrations.
-- This file documents the final intended database state for review/recovery.

create index if not exists payment_requests_agent_status_created_idx
  on public.payment_requests (agent_id, settlement_status, created_at);

create index if not exists payment_requests_task_status_idx
  on public.payment_requests (task_id, settlement_status);

create or replace function public.authorize_payment_atomic(
  p_task_id uuid,
  p_provider text,
  p_resource text,
  p_category text,
  p_amount_atomic bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  v_agent_id uuid;
  v_task public.tasks%rowtype;
  v_policy public.policies%rowtype;
  v_task_reserved numeric := 0;
  v_daily_realized numeric := 0;
  v_daily_reserved numeric := 0;
  v_effective_task_budget numeric;
  v_task_used numeric;
  v_daily_used numeric;
  v_approved boolean := false;
  v_code text;
  v_reason text;
  v_payment_request_id uuid;
  v_legacy_amount_cents integer;
  v_remaining_task numeric;
  v_remaining_daily numeric;
  v_rolling_day_start timestamptz := now() - interval '24 hours';
  v_safe_integer_max numeric := 9007199254740991;
  v_amount_display text;
  v_limit_display text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_task_id is null
     or nullif(btrim(p_provider), '') is null
     or nullif(btrim(p_resource), '') is null
     or nullif(btrim(p_category), '') is null then
    raise exception 'Invalid payment request';
  end if;

  if p_amount_atomic is null or p_amount_atomic <= 0 then
    raise exception 'Invalid atomic USDC amount';
  end if;

  if p_amount_atomic::numeric > v_safe_integer_max then
    raise exception 'Atomic USDC amount exceeds application safe integer range';
  end if;

  select t.agent_id
  into v_agent_id
  from public.tasks t
  where t.id = p_task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  perform 1
  from public.agents a
  where a.id = v_agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  select *
  into v_task
  from public.tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'Task not found';
  end if;

  if v_task.status <> 'running' then
    raise exception 'Task is not running';
  end if;

  select *
  into v_policy
  from public.policies p
  where p.agent_id = v_agent_id
  for update;

  if not found then
    raise exception 'Policy not found';
  end if;

  if v_task.budget_atomic is null
     or v_task.spent_atomic is null
     or v_policy.task_budget_atomic is null
     or v_policy.daily_budget_atomic is null
     or v_policy.max_transaction_atomic is null
     or v_task.budget_atomic < 0
     or v_task.spent_atomic < 0
     or v_policy.task_budget_atomic < 0
     or v_policy.daily_budget_atomic < 0
     or v_policy.max_transaction_atomic < 0
     or v_task.budget_atomic::numeric > v_safe_integer_max
     or v_task.spent_atomic::numeric > v_safe_integer_max
     or v_policy.task_budget_atomic::numeric > v_safe_integer_max
     or v_policy.daily_budget_atomic::numeric > v_safe_integer_max
     or v_policy.max_transaction_atomic::numeric > v_safe_integer_max then
    raise exception 'Invalid atomic policy state';
  end if;

  select coalesce(sum(pr.amount_atomic), 0)
  into v_task_reserved
  from public.payment_requests pr
  where pr.task_id = p_task_id
    and pr.decision = 'approved'
    and pr.settlement_status = 'authorized';

  select coalesce(sum(pr.amount_atomic), 0)
  into v_daily_realized
  from public.payment_requests pr
  where pr.agent_id = v_agent_id
    and pr.decision = 'approved'
    and pr.settlement_status in ('simulated', 'settled')
    and coalesce(pr.settled_at, pr.created_at) >= v_rolling_day_start;

  select coalesce(sum(pr.amount_atomic), 0)
  into v_daily_reserved
  from public.payment_requests pr
  where pr.agent_id = v_agent_id
    and pr.decision = 'approved'
    and pr.settlement_status = 'authorized';

  if v_task_reserved > v_safe_integer_max
     or v_daily_realized > v_safe_integer_max
     or v_daily_reserved > v_safe_integer_max then
    raise exception 'Atomic spend exceeds application safe integer range';
  end if;

  v_effective_task_budget := least(v_task.budget_atomic, v_policy.task_budget_atomic);
  v_task_used := v_task.spent_atomic::numeric + v_task_reserved;
  v_daily_used := v_daily_realized + v_daily_reserved;

  if exists (
    select 1
    from unnest(v_policy.blocked_providers) as blocked(provider)
    where lower(btrim(blocked.provider)) = lower(btrim(p_provider))
  ) then
    v_code := 'PROVIDER_BLOCKED';
    v_reason := btrim(p_provider) || ' is blocked by policy.';
  elsif not (p_category = any(v_policy.allowed_categories)) then
    v_code := 'CATEGORY_NOT_ALLOWED';
    v_reason := 'Category "' || p_category || '" is not allowed by policy.';
  elsif p_amount_atomic::numeric > v_policy.max_transaction_atomic::numeric then
    v_code := 'TRANSACTION_LIMIT_EXCEEDED';
    v_amount_display := rtrim(rtrim(to_char(p_amount_atomic::numeric / 1000000, 'FM999999999999990.999999'), '0'), '.');
    v_limit_display := rtrim(rtrim(to_char(v_policy.max_transaction_atomic::numeric / 1000000, 'FM999999999999990.999999'), '0'), '.');
    v_reason := 'Requested $' || v_amount_display || ', above the $' || v_limit_display || ' per-transaction limit.';
  elsif v_task_used > v_effective_task_budget
     or p_amount_atomic::numeric > (v_effective_task_budget - v_task_used) then
    v_code := 'TASK_BUDGET_EXCEEDED';
    v_reason := 'This purchase would exceed the task budget.';
  elsif v_daily_used > v_policy.daily_budget_atomic::numeric
     or p_amount_atomic::numeric > (v_policy.daily_budget_atomic::numeric - v_daily_used) then
    v_code := 'DAILY_BUDGET_EXCEEDED';
    v_reason := 'This purchase would exceed the agent''s daily budget.';
  else
    v_approved := true;
    v_code := 'APPROVED';
    v_reason := 'Payment satisfies all active spending policies.';
  end if;

  v_remaining_task := greatest(
    0,
    v_effective_task_budget - v_task_used - case when v_approved then p_amount_atomic else 0 end
  );
  v_remaining_daily := greatest(
    0,
    v_policy.daily_budget_atomic::numeric - v_daily_used - case when v_approved then p_amount_atomic else 0 end
  );

  if mod(p_amount_atomic, 10000) = 0
     and (p_amount_atomic / 10000) <= 2147483647 then
    v_legacy_amount_cents := (p_amount_atomic / 10000)::integer;
  else
    v_legacy_amount_cents := null;
  end if;

  insert into public.payment_requests (
    agent_id, task_id, provider, resource, category,
    amount_atomic, amount_cents, decision, decision_code, reason, settlement_status
  ) values (
    v_agent_id, v_task.id, btrim(p_provider), btrim(p_resource), p_category,
    p_amount_atomic, v_legacy_amount_cents,
    case when v_approved then 'approved' else 'rejected' end,
    v_code, v_reason,
    case when v_approved then 'authorized' else 'not_applicable' end
  )
  returning id into v_payment_request_id;

  insert into public.audit_events (
    agent_id, task_id, payment_request_id, event_type, payload
  ) values (
    v_agent_id,
    v_task.id,
    v_payment_request_id,
    case when v_approved then 'payment_approved' else 'payment_rejected' end,
    jsonb_build_object(
      'provider', btrim(p_provider),
      'resource', btrim(p_resource),
      'category', p_category,
      'amount_atomic', p_amount_atomic,
      'amount_usdc', rtrim(rtrim(to_char(p_amount_atomic::numeric / 1000000, 'FM999999999999990.999999'), '0'), '.'),
      'amount_cents', v_legacy_amount_cents,
      'decision_code', v_code,
      'reason', v_reason,
      'settlement_status', case when v_approved then 'authorized' else 'not_applicable' end,
      'effective_task_budget_atomic', v_effective_task_budget,
      'task_realized_atomic', v_task.spent_atomic,
      'task_reserved_atomic', v_task_reserved,
      'daily_realized_atomic', v_daily_realized,
      'daily_reserved_atomic', v_daily_reserved
    )
  );

  return jsonb_build_object(
    'approved', v_approved,
    'code', v_code,
    'reason', v_reason,
    'remainingTaskBudgetAtomic', v_remaining_task,
    'remainingDailyBudgetAtomic', v_remaining_daily,
    'paymentRequestId', v_payment_request_id,
    'agentId', v_agent_id,
    'taskId', v_task.id
  );
end;
$$;

create or replace function public.finalize_payment_settlement(
  p_payment_request_id uuid,
  p_settlement_status text,
  p_transaction_signature text default null
)
returns public.payment_requests
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  payment_row public.payment_requests%rowtype;
begin
  if p_settlement_status not in ('simulated', 'settled') then
    raise exception 'Invalid settlement status';
  end if;

  select * into payment_row
  from public.payment_requests
  where id = p_payment_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;

  perform 1
  from public.agents a
  where a.id = payment_row.agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  if payment_row.decision <> 'approved' then
    raise exception 'Only approved payment requests can be settled';
  end if;

  if payment_row.settlement_status in ('simulated', 'settled') then
    return payment_row;
  end if;

  if payment_row.settlement_status <> 'authorized' then
    raise exception 'Payment request is not authorized for settlement';
  end if;

  update public.tasks
  set spent_atomic = spent_atomic + payment_row.amount_atomic,
      spent_cents = ((spent_atomic + payment_row.amount_atomic) / 10000)::integer
  where id = payment_row.task_id;

  if not found then
    raise exception 'Task not found';
  end if;

  update public.payment_requests
  set settlement_status = p_settlement_status,
      transaction_signature = coalesce(p_transaction_signature, transaction_signature),
      settled_at = now()
  where id = p_payment_request_id
  returning * into payment_row;

  return payment_row;
end;
$$;

create or replace function public.fail_payment_settlement(
  p_payment_request_id uuid,
  p_reason text
)
returns public.payment_requests
language plpgsql
security invoker
set search_path = 'public'
as $$
declare
  payment_row public.payment_requests%rowtype;
  v_reason text := left(coalesce(nullif(btrim(p_reason), ''), 'Payment settlement failed'), 2000);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into payment_row
  from public.payment_requests
  where id = p_payment_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;

  perform 1
  from public.agents a
  where a.id = payment_row.agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  if payment_row.settlement_status <> 'authorized' then
    return payment_row;
  end if;

  update public.payment_requests
  set settlement_status = 'failed'
  where id = p_payment_request_id
    and settlement_status = 'authorized'
  returning * into payment_row;

  if not found then
    select * into payment_row
    from public.payment_requests
    where id = p_payment_request_id;
    return payment_row;
  end if;

  insert into public.audit_events (
    agent_id, task_id, payment_request_id, event_type, payload
  ) values (
    payment_row.agent_id,
    payment_row.task_id,
    payment_row.id,
    'payment_settlement_failed',
    jsonb_build_object('reason', v_reason)
  );

  return payment_row;
end;
$$;

revoke all on function public.authorize_payment_atomic(uuid, text, text, text, bigint) from public;
revoke all on function public.authorize_payment_atomic(uuid, text, text, text, bigint) from anon;
grant execute on function public.authorize_payment_atomic(uuid, text, text, text, bigint) to authenticated;

revoke all on function public.finalize_payment_settlement(uuid, text, text) from public;
revoke all on function public.finalize_payment_settlement(uuid, text, text) from anon;
grant execute on function public.finalize_payment_settlement(uuid, text, text) to authenticated;

revoke all on function public.fail_payment_settlement(uuid, text) from public;
revoke all on function public.fail_payment_settlement(uuid, text) from anon;
grant execute on function public.fail_payment_settlement(uuid, text) to authenticated;
