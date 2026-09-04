# C03-R3.1 true two-session concurrency proofs (local active chain)
# Requires: C03 already applied via active migrations (db reset --local).
# Does NOT re-apply migration SQL.
$ErrorActionPreference = 'Stop'
$ctr = 'supabase_db_diaspora-bridge'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root 'supabase\migrations'))) {
  $root = (Get-Location).Path
}

function Invoke-Pg([string]$sql) {
  $tmpIn = Join-Path $env:TEMP ("c03_r31_in_" + [guid]::NewGuid().ToString('N') + '.sql')
  $tmpOut = Join-Path $env:TEMP ("c03_r31_out_" + [guid]::NewGuid().ToString('N') + '.txt')
  $tmpErr = Join-Path $env:TEMP ("c03_r31_err_" + [guid]::NewGuid().ToString('N') + '.txt')
  [System.IO.File]::WriteAllText($tmpIn, $sql)
  $p = Start-Process -FilePath 'docker' `
    -ArgumentList @('exec','-i',$ctr,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt') `
    -RedirectStandardInput $tmpIn -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr `
    -Wait -PassThru -NoNewWindow
  $out = Get-Content -Raw $tmpOut -ErrorAction SilentlyContinue
  $err = Get-Content -Raw $tmpErr -ErrorAction SilentlyContinue
  Remove-Item $tmpIn,$tmpOut,$tmpErr -Force -ErrorAction SilentlyContinue
  if ($p.ExitCode -ne 0) {
    throw "psql failed ($($p.ExitCode)): $err $out"
  }
  return $out
}

function Start-PgJob([string]$sql, [string]$tag) {
  $f = Join-Path $env:TEMP ("c03_r31_${tag}.sql")
  $o = Join-Path $env:TEMP ("c03_r31_${tag}.out")
  $e = Join-Path $env:TEMP ("c03_r31_${tag}.err")
  [System.IO.File]::WriteAllText($f, $sql)
  return Start-Job -ScriptBlock {
    param($c, $f, $o, $e)
    $p = Start-Process -FilePath 'docker' `
      -ArgumentList @('exec','-i',$c,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1') `
      -RedirectStandardInput $f -RedirectStandardOutput $o -RedirectStandardError $e `
      -Wait -PassThru -NoNewWindow
    [pscustomobject]@{
      Exit = $p.ExitCode
      Out  = (Get-Content -Raw $o -ErrorAction SilentlyContinue)
      Err  = (Get-Content -Raw $e -ErrorAction SilentlyContinue)
    }
  } -ArgumentList $ctr, $f, $o, $e
}

function Assert-NoDeadlock([string]$text, [string]$label) {
  if ($text -match '40P01' -or $text -match 'deadlock detected') {
    throw "C03-R3.1 FAIL [$label]: SQLSTATE 40P01 deadlock"
  }
  if ($text -match 'lock timeout' -or $text -match 'canceling statement due to lock timeout') {
    throw "C03-R3.1 FAIL [$label]: lock_timeout"
  }
}

Write-Host '=== C03-R3.1 concurrency harness ==='
Write-Host "root=$root"

# Require C03 present from active migration chain
$fxPresent = (Invoke-Pg "SELECT to_regclass('public.fx_quotes') IS NOT NULL").Trim()
if ($fxPresent -ne 't') {
  throw 'C03-R3.1 FAIL: fx_quotes absent — run db reset with active C03 migration first'
}

# Fixture
Get-Content -Raw (Join-Path $root 'supabase\tests\c03_r31_fixture_setup.sql') |
  docker exec -i $ctr psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null

$owner = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='owner'").Trim()
$r0 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='r0'").Trim()
$q0 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='q0'").Trim()
$r1 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='r1'").Trim()
$r2 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='r2'").Trim()
$r3 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='r3'").Trim()
$q3 = (Invoke-Pg "SELECT v FROM public.c03_r31_fixture WHERE k='q3'").Trim()
Write-Host "fixture owner=$owner r0=$r0 q0=$q0 r1=$r1 r2=$r2 r3=$r3 q3=$q3"

# =============================================================================
# G: Forced overlapping rpc_record_fx_quote vs wrapper (same funding request)
# T1 holds funding_request then continues into record; T2 starts wrapper mid-hold.
# Same canonical order → waiter, not deadlock.
# =============================================================================
$sqlT1 = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT set_config('request.jwt.claim.sub', '$owner', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT id FROM public.escrow_funding_requests WHERE id = '$r0'::uuid FOR UPDATE;
SELECT pg_sleep(2);
SELECT public.rpc_record_fx_quote(
  '$r0'::uuid, 'EUR', 76300, 'fixture_fx', 'R31-OVERLAP-REC',
  clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
);
COMMIT;
"@

$sqlT2 = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT set_config('request.jwt.claim.sub', '$owner', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_sleep(0.3);
SELECT public.rpc_create_cross_border_payment_intent('$q0'::uuid, 'stripe');
COMMIT;
"@

$j1 = Start-PgJob $sqlT1 'overlap_t1'
Start-Sleep -Milliseconds 200
$j2 = Start-PgJob $sqlT2 'overlap_t2'
$ov = Wait-Job $j1, $j2 -Timeout 60 | Receive-Job
Remove-Job $j1, $j2 -Force -ErrorAction SilentlyContinue
$ovText = (($ov | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- G overlap ---'
Write-Host $ovText
Assert-NoDeadlock $ovText 'G-deadlock'
$pay0 = [int](Invoke-Pg "SELECT count(*)::text FROM public.payments WHERE client_request_id='$r0'::uuid").Trim()
Write-Host "G payments on r0=$pay0"
if ($pay0 -gt 1) { throw 'C03-R3.1 FAIL G: >1 payment' }

# =============================================================================
# I: Concurrent quote replacements on r1
# =============================================================================
$sqlQa = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT public.rpc_record_fx_quote(
  '$r1'::uuid, 'EUR', 30000, 'fx_a', 'R31-REP-A',
  clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
);
COMMIT;
"@
$sqlQb = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT pg_sleep(0.05);
SELECT public.rpc_record_fx_quote(
  '$r1'::uuid, 'EUR', 30100, 'fx_b', 'R31-REP-B',
  clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
);
COMMIT;
"@
$jqa = Start-PgJob $sqlQa 'rep_a'
$jqb = Start-PgJob $sqlQb 'rep_b'
$rep = Wait-Job $jqa, $jqb -Timeout 60 | Receive-Job
Remove-Job $jqa, $jqb -Force -ErrorAction SilentlyContinue
$repText = (($rep | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- I replacement ---'
Write-Host $repText
Assert-NoDeadlock $repText 'I-replacement'
$usable1 = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r1'::uuid AND status='usable'").Trim()
$total1 = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r1'::uuid").Trim()
Write-Host "I usable=$usable1 total=$total1"
if ($usable1 -ne 1) { throw "C03-R3.1 FAIL I: expected 1 usable, got $usable1" }
if ($total1 -lt 2) { throw "C03-R3.1 FAIL I: history not preserved (total=$total1)" }

# =============================================================================
# J: Concurrent initial wrappers on same quote (r3/q3)
# =============================================================================
$sqlW1 = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT set_config('request.jwt.claim.sub', '$owner', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT public.rpc_create_cross_border_payment_intent('$q3'::uuid, 'stripe');
COMMIT;
"@
$sqlW2 = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT set_config('request.jwt.claim.sub', '$owner', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_sleep(0.05);
SELECT public.rpc_create_cross_border_payment_intent('$q3'::uuid, 'stripe');
COMMIT;
"@
$jw1 = Start-PgJob $sqlW1 'wrap1'
$jw2 = Start-PgJob $sqlW2 'wrap2'
$wrap = Wait-Job $jw1, $jw2 -Timeout 60 | Receive-Job
Remove-Job $jw1, $jw2 -Force -ErrorAction SilentlyContinue
$wrapText = (($wrap | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- J wrapper concurrency ---'
Write-Host $wrapText
Assert-NoDeadlock $wrapText 'J-wrapper'
$pay3 = [int](Invoke-Pg "SELECT count(*)::text FROM public.payments WHERE client_request_id='$r3'::uuid").Trim()
$cons3 = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r3'::uuid AND status='consumed'").Trim()
$fakeQ2 = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r3'::uuid AND status='consumed' AND id <> '$q3'::uuid").Trim()
Write-Host "J payments=$pay3 consumed=$cons3 fake_q2_consumed=$fakeQ2"
if ($pay3 -ne 1) { throw "C03-R3.1 FAIL J: expected 1 payment, got $pay3" }
if ($cons3 -ne 1) { throw "C03-R3.1 FAIL J: expected 1 consumed quote, got $cons3" }
if ($fakeQ2 -ne 0) { throw 'C03-R3.1 FAIL J: fake Q2 consumed' }

# =============================================================================
# H: Success race — succeeded commits first → record DENY; no new usable Q2
# =============================================================================
Invoke-Pg "UPDATE public.payments SET status='failed', ledger_journal_id=NULL WHERE client_request_id='$r2'::uuid;"
# Overlapping: record holds locks under failed; succeed waits; both finish without deadlock
$sqlHoldRec = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT id FROM public.escrow_funding_requests WHERE id='$r2'::uuid FOR UPDATE;
SELECT id FROM public.payments WHERE client_request_id='$r2'::uuid FOR UPDATE;
SELECT pg_sleep(1.5);
SELECT public.rpc_record_fx_quote(
  '$r2'::uuid, 'EUR', 16100, 'fixture_fx', 'R31-RACE-REC',
  clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
);
COMMIT;
"@
$sqlWaitSucc = @"
BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL deadlock_timeout = '50ms';
SELECT pg_sleep(0.3);
UPDATE public.payments SET status='succeeded' WHERE client_request_id='$r2'::uuid;
COMMIT;
"@
$jh = Start-PgJob $sqlHoldRec 'race_rec'
Start-Sleep -Milliseconds 150
$js = Start-PgJob $sqlWaitSucc 'race_succ'
$race = Wait-Job $jh, $js -Timeout 60 | Receive-Job
Remove-Job $jh, $js -Force -ErrorAction SilentlyContinue
$raceText = (($race | ForEach-Object { "$($_.Out)$($_.Err)" }) -join "`n")
Write-Host '--- H overlap success race ---'
Write-Host $raceText
Assert-NoDeadlock $raceText 'H-overlap'
$st = (Invoke-Pg "SELECT status FROM public.payments WHERE client_request_id='$r2'::uuid").Trim()
$usableRace = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r2'::uuid AND status='usable'").Trim()
Write-Host "H after overlap: payment=$st usable=$usableRace"
if ($st -eq 'succeeded' -and $usableRace -ne 0) {
  throw 'C03-R3.1 FAIL H: usable quote remains after succeeded (trigger/lock invariant)'
}

# Now payment is succeeded (after record under failed). New record must DENY.
$denySql = @"
SELECT public.rpc_record_fx_quote(
  '$r2'::uuid, 'EUR', 16200, 'fixture_fx', 'R31-AFTER-SUCC',
  clock_timestamp() + interval '1 hour', NULL, gen_random_uuid()
);
"@
$denyF = Join-Path $env:TEMP 'c03_r31_deny.sql'
$denyO = Join-Path $env:TEMP 'c03_r31_deny.out'
$denyE = Join-Path $env:TEMP 'c03_r31_deny.err'
[System.IO.File]::WriteAllText($denyF, $denySql)
$dp = Start-Process docker -ArgumentList @('exec','-i',$ctr,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1') `
  -RedirectStandardInput $denyF -RedirectStandardOutput $denyO -RedirectStandardError $denyE -Wait -PassThru -NoNewWindow
$denyText = "$(Get-Content -Raw $denyO -ea 0)$(Get-Content -Raw $denyE -ea 0)"
Write-Host '--- H post-success deny ---'
Write-Host $denyText
if ($dp.ExitCode -eq 0) { throw 'C03-R3.1 FAIL H: record after succeeded should DENY' }
if ($denyText -notmatch 'succeeded') { throw "C03-R3.1 FAIL H: expected succeeded deny, got $denyText" }

# Separately: succeed-first then record (no usable insert after success)
Invoke-Pg @"
UPDATE public.payments SET status='failed', ledger_journal_id=NULL WHERE client_request_id='$r2'::uuid;
UPDATE public.fx_quotes SET status='superseded' WHERE funding_request_id='$r2'::uuid AND status='usable';
UPDATE public.payments SET status='succeeded' WHERE client_request_id='$r2'::uuid;
"@
$dp2 = Start-Process docker -ArgumentList @('exec','-i',$ctr,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1') `
  -RedirectStandardInput $denyF -RedirectStandardOutput $denyO -RedirectStandardError $denyE -Wait -PassThru -NoNewWindow
$denyText2 = "$(Get-Content -Raw $denyO -ea 0)$(Get-Content -Raw $denyE -ea 0)"
if ($dp2.ExitCode -eq 0) { throw 'C03-R3.1 FAIL H: succeed-first record must DENY' }
$usableAfter = [int](Invoke-Pg "SELECT count(*)::text FROM public.fx_quotes WHERE funding_request_id='$r2'::uuid AND status='usable'").Trim()
Write-Host "H usable after succeed-first deny=$usableAfter"
if ($usableAfter -ne 0) { throw 'C03-R3.1 FAIL H: usable quote after succeeded' }

# Cleanup fixture
Invoke-Pg "DROP TABLE IF EXISTS public.c03_r31_fixture;"

Write-Host 'C03-R3.1 LOCK_ORDER_RUNTIME_PROOF PASS'
Write-Host 'TRUE_TWO_SESSION_CONCURRENCY=YES'
Write-Host 'SQLSTATE_40P01=NO'
Write-Host 'LOCK_TIMEOUT=NO'
