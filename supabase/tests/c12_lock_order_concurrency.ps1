# C12-R true two-session concurrency (disposable; C12 candidate already applied)
$ErrorActionPreference = 'Stop'
$ctr = 'supabase_db_diaspora-bridge'
$root = (Get-Location).Path

function Invoke-Pg([string]$sql) {
  $tmpIn = Join-Path $env:TEMP ("c12_in_" + [guid]::NewGuid().ToString('N') + '.sql')
  $tmpOut = Join-Path $env:TEMP ("c12_out_" + [guid]::NewGuid().ToString('N') + '.txt')
  $tmpErr = Join-Path $env:TEMP ("c12_err_" + [guid]::NewGuid().ToString('N') + '.txt')
  [System.IO.File]::WriteAllText($tmpIn, $sql)
  $p = Start-Process -FilePath 'docker' -ArgumentList @('exec','-i',$ctr,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt') `
    -RedirectStandardInput $tmpIn -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr -Wait -PassThru -NoNewWindow
  $out = Get-Content -Raw $tmpOut -ErrorAction SilentlyContinue
  $err = Get-Content -Raw $tmpErr -ErrorAction SilentlyContinue
  Remove-Item $tmpIn,$tmpOut,$tmpErr -Force -ErrorAction SilentlyContinue
  if ($p.ExitCode -ne 0) { throw "psql failed: $err $out" }
  return $out
}

function Start-PgJob([string]$sql, [string]$tag) {
  $f = Join-Path $env:TEMP "c12_${tag}.sql"
  $o = Join-Path $env:TEMP "c12_${tag}.out"
  $e = Join-Path $env:TEMP "c12_${tag}.err"
  [System.IO.File]::WriteAllText($f, $sql)
  return Start-Job -ScriptBlock {
    param($c,$f,$o,$e)
    $p = Start-Process docker -ArgumentList @('exec','-i',$c,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1') `
      -RedirectStandardInput $f -RedirectStandardOutput $o -RedirectStandardError $e -Wait -PassThru -NoNewWindow
    [pscustomobject]@{ Exit=$p.ExitCode; Out=(Get-Content -Raw $o -ea 0); Err=(Get-Content -Raw $e -ea 0) }
  } -ArgumentList $ctr,$f,$o,$e
}

function Assert-NoDeadlock([string]$text, [string]$label) {
  if ($text -match '40P01' -or $text -match 'deadlock detected') { throw "C12 FAIL [$label]: 40P01" }
  if ($text -match 'lock timeout') { throw "C12 FAIL [$label]: lock_timeout" }
}

Write-Host '=== C12-R concurrency harness ==='
$present = (Invoke-Pg "SELECT to_regclass('public.payment_attempts') IS NOT NULL").Trim()
if ($present -ne 't') { throw 'C12 candidate not installed' }

# Fixture: one pending request + quote + P1 cross_border, no attempt; plus failed-attempt payment for requote race
$setup = @'
DO $d$
DECLARE
  u_owner uuid := gen_random_uuid();
  u_cof uuid := gen_random_uuid();
  u_prov uuid := gen_random_uuid();
  v_project uuid;
  r0 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  v_q uuid;
  v_res jsonb;
  v_pay uuid;
  v_a uuid;
BEGIN
  CREATE TABLE IF NOT EXISTS public.c12_r_fixture (k text PRIMARY KEY, v text NOT NULL);
  TRUNCATE public.c12_r_fixture;
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (u_owner,'authenticated','authenticated','c12c_o_'||u_owner::text||'@t.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','','','',''),
    (u_cof,'authenticated','authenticated','c12c_c_'||u_cof::text||'@t.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','','','',''),
    (u_prov,'authenticated','authenticated','c12c_p_'||u_prov::text||'@t.local', crypt('x', gen_salt('bf')), now(), now(), now(), '00000000-0000-0000-0000-000000000000','','','','');
  INSERT INTO public.profiles(id,role) VALUES (u_owner,'client'),(u_cof,'client'),(u_prov,'provider');
  INSERT INTO public.projects(owner_id, assigned_provider_id, funder_ids, status, title)
  VALUES (u_owner, u_prov, ARRAY[u_cof]::uuid[], 'open', 'c12-conc') RETURNING id INTO v_project;
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.rpc_create_funding_request(v_project, 300000, r0);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r0);
  v_res := public.rpc_record_fx_quote(r0,'EUR',45000,'fixture_fx','C12C-Q0', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid());
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_create_cross_border_payment_intent((v_res->>'fx_quote_id')::uuid, 'stripe');
  v_pay := (v_res->>'payment_id')::uuid;

  PERFORM public.rpc_create_funding_request(v_project, 150000, r1);
  PERFORM set_config('request.jwt.claim.sub', u_cof::text, true);
  PERFORM public.rpc_approve_funding_request(r1);
  PERFORM set_config('request.jwt.claim.sub', u_owner::text, true);
  v_res := public.rpc_record_fx_quote(r1,'EUR',22000,'fixture_fx','C12C-Q1', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid());
  v_res := public.rpc_create_cross_border_payment_intent((v_res->>'fx_quote_id')::uuid, 'stripe');
  v_pay := (v_res->>'payment_id')::uuid;
  v_a := (public.rpc_create_payment_attempt(v_pay, gen_random_uuid(), NULL)->>'attempt_id')::uuid;
  PERFORM public.rpc_fail_payment_attempt(v_a, 'failed');
  v_res := public.rpc_record_fx_quote(r1,'EUR',22100,'fixture_fx','C12C-Q2', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid());

  INSERT INTO public.c12_r_fixture(k,v) VALUES
    ('pay0', (SELECT id::text FROM public.payments WHERE client_request_id = r0)),
    ('r0', r0::text), ('r1', r1::text),
    ('pay1', v_pay::text), ('q2', (v_res->>'fx_quote_id')), ('owner', u_owner::text);
END;
$d$;
'@
Invoke-Pg $setup | Out-Null
$pay0 = (Invoke-Pg "SELECT v FROM public.c12_r_fixture WHERE k='pay0'").Trim()
$pay1 = (Invoke-Pg "SELECT v FROM public.c12_r_fixture WHERE k='pay1'").Trim()
$q2 = (Invoke-Pg "SELECT v FROM public.c12_r_fixture WHERE k='q2'").Trim()
$r0 = (Invoke-Pg "SELECT v FROM public.c12_r_fixture WHERE k='r0'").Trim()
$r1 = (Invoke-Pg "SELECT v FROM public.c12_r_fixture WHERE k='r1'").Trim()
Write-Host "pay0=$pay0 pay1=$pay1 q2=$q2"

# Concurrent create attempts different request ids (bootstrap A1)
$idA = [guid]::NewGuid().ToString()
$idB = [guid]::NewGuid().ToString()
$j1 = Start-PgJob @"
BEGIN;
SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_create_payment_attempt('$pay0'::uuid, '$idA'::uuid, NULL);
COMMIT;
"@ 'ca'
$j2 = Start-PgJob @"
BEGIN;
SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_create_payment_attempt('$pay0'::uuid, '$idB'::uuid, NULL);
COMMIT;
"@ 'cb'
$r = Wait-Job $j1,$j2 -Timeout 60 | Receive-Job
Remove-Job $j1,$j2 -Force -ErrorAction SilentlyContinue
$txt = (($r | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- concurrent create ---'
Write-Host $txt
Assert-NoDeadlock $txt 'create'
$active = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE payment_id='$pay0'::uuid AND status IN ('created','submitted','processing')").Trim()
Write-Host "active=$active"
if ($active -ne 1) { throw "C12 FAIL: expected 1 active, got $active" }

# Same request id concurrent retry (pay1 already has failed A1 + usable Q2)
$idS = [guid]::NewGuid().ToString()
$js1 = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_create_payment_attempt('$pay1'::uuid, '$idS'::uuid, '$q2'::uuid);
COMMIT;
"@ 'sa'
$js2 = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_create_payment_attempt('$pay1'::uuid, '$idS'::uuid, '$q2'::uuid);
COMMIT;
"@ 'sb'
$rs = Wait-Job $js1,$js2 -Timeout 60 | Receive-Job
Remove-Job $js1,$js2 -Force -ErrorAction SilentlyContinue
$ts = (($rs | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Assert-NoDeadlock $ts 'same-id'
$n = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE attempt_request_id='$idS'::uuid").Trim()
if ($n -ne 1) { throw "C12 FAIL same request id count=$n" }

# Failure vs requote: fail pay0's active A1 vs record Q on r0
$a0 = (Invoke-Pg "SELECT id::text FROM public.payment_attempts WHERE payment_id='$pay0'::uuid AND status IN ('created','submitted','processing') LIMIT 1").Trim()
$jf = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_fail_payment_attempt('$a0'::uuid, 'failed');
COMMIT;
"@ 'ff'
$jq0 = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_record_fx_quote('$r0'::uuid,'EUR',46000,'fx_failrace','C12-FAIL-RQ', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid());
COMMIT;
"@ 'fr'
$rf = Wait-Job $jf,$jq0 -Timeout 60 | Receive-Job
Remove-Job $jf,$jq0 -Force -ErrorAction SilentlyContinue
$tf = (($rf | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- fail vs requote ---'
Write-Host $tf
Assert-NoDeadlock $tf 'fail-vs-requote'
$act0 = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE payment_id='$pay0'::uuid AND status IN ('created','submitted','processing')").Trim()
if ($act0 -ne 0) { throw "C12 FAIL: expected A1 failed before/during requote race, active=$act0" }

# Requote vs retry create on pay1: terminalize current A2, then race new quote vs consume of a fresh usable quote
Invoke-Pg @"
SELECT public.rpc_fail_payment_attempt(id, 'failed')
  FROM public.payment_attempts
 WHERE payment_id='$pay1'::uuid AND status IN ('created','submitted','processing');
"@ | Out-Null
$q3 = (Invoke-Pg @"
SELECT (public.rpc_record_fx_quote('$r1'::uuid,'EUR',22200,'fixture_fx','C12C-Q3', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid())->>'fx_quote_id');
"@).Trim()
$idR = [guid]::NewGuid().ToString()
$jq = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_record_fx_quote('$r1'::uuid,'EUR',22300,'fx_race','C12-RACE', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid());
COMMIT;
"@ 'rq'
$ja = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_create_payment_attempt('$pay1'::uuid, '$idR'::uuid, '$q3'::uuid);
COMMIT;
"@ 'ra'
$rr = Wait-Job $jq,$ja -Timeout 60 | Receive-Job
Remove-Job $jq,$ja -Force -ErrorAction SilentlyContinue
$tr = (($rr | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- requote vs attempt ---'
Write-Host $tr
Assert-NoDeadlock $tr 'requote-vs-attempt'
$act1 = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE payment_id='$pay1'::uuid AND status IN ('created','submitted','processing')").Trim()
if ($act1 -gt 1) { throw "C12 FAIL: two active attempts after requote/retry race" }

# Success vs retry: closest valid race — A1 still nonterminal so retry must DENY
# Use pay0: requote if needed, create A_live, attach, then race finalize vs retry
Invoke-Pg @"
SELECT public.rpc_fail_payment_attempt(id, 'failed')
  FROM public.payment_attempts
 WHERE payment_id='$pay0'::uuid AND status IN ('created','submitted','processing');
UPDATE public.payments SET status='requires_action' WHERE id='$pay0'::uuid AND status='processing';
"@ | Out-Null
$qLive = (Invoke-Pg @"
SELECT (public.rpc_record_fx_quote('$r0'::uuid,'EUR',47000,'fixture_fx','C12C-QLIVE', clock_timestamp()+interval '1 hour', NULL, gen_random_uuid())->>'fx_quote_id');
"@).Trim()
$aLive = (Invoke-Pg "SELECT (public.rpc_create_payment_attempt('$pay0'::uuid, gen_random_uuid(), '$qLive'::uuid)->>'attempt_id');").Trim()
Invoke-Pg "SELECT public.rpc_attach_payment_attempt_ref('$aLive'::uuid, 'conc-win-1');" | Out-Null
$jSucc = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_finalize_payment_attempt_success('$aLive'::uuid, 'conc-win-1', 'stripe');
COMMIT;
"@ 'succ'
$jRetry = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_create_payment_attempt('$pay0'::uuid, gen_random_uuid(), NULL);
COMMIT;
"@ 'retry'
$sr = Wait-Job $jSucc,$jRetry -Timeout 60 | Receive-Job
Remove-Job $jSucc,$jRetry -Force -ErrorAction SilentlyContinue
$srText = (($sr | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- success vs retry ---'
Write-Host $srText
Assert-NoDeadlock $srText 'success-vs-retry'
$succN = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE payment_id='$pay0'::uuid AND status='succeeded'").Trim()
$jN = [int](Invoke-Pg "SELECT count(*)::text FROM public.ledger_journals WHERE idempotency_key = 'escrow_funding:' || '$pay0'").Trim()
if ($succN -gt 1) { throw "C12 FAIL: >1 succeeded attempt" }
if ($jN -gt 1) { throw "C12 FAIL: >1 escrow journal" }

# Double success same attempt
$jS1 = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_finalize_payment_attempt_success('$aLive'::uuid, 'conc-win-1', 'stripe');
COMMIT;
"@ 'ds1'
$jS2 = Start-PgJob @"
BEGIN; SET LOCAL lock_timeout='8s'; SET LOCAL deadlock_timeout='50ms';
SELECT public.rpc_finalize_payment_attempt_success('$aLive'::uuid, 'conc-win-1', 'stripe');
COMMIT;
"@ 'ds2'
$ds = Wait-Job $jS1,$jS2 -Timeout 60 | Receive-Job
Remove-Job $jS1,$jS2 -Force -ErrorAction SilentlyContinue
$dsText = (($ds | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Assert-NoDeadlock $dsText 'double-success'
$succN2 = [int](Invoke-Pg "SELECT count(*)::text FROM public.payment_attempts WHERE payment_id='$pay0'::uuid AND status='succeeded'").Trim()
$jN2 = [int](Invoke-Pg "SELECT count(*)::text FROM public.ledger_journals WHERE idempotency_key = 'escrow_funding:' || '$pay0'").Trim()
if ($succN2 -ne 1) { throw "C12 FAIL double success attempts=$succN2" }
if ($jN2 -ne 1) { throw "C12 FAIL double success journals=$jN2" }

Invoke-Pg "DROP TABLE IF EXISTS public.c12_r_fixture;" | Out-Null
Write-Host 'C12-R LOCK_ORDER_RUNTIME_PROOF PASS'
Write-Host 'SQLSTATE_40P01=NO'
Write-Host 'LOCK_TIMEOUT=NO'
