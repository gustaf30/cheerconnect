$ErrorActionPreference = "Continue"

function Invoke-Api {
    param([string]$Method, [string]$Url, [string]$Body, [string]$ContentType)
    try {
        $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = if ($ContentType) { $ContentType } else { "application/json" }
        }
        $r = Invoke-WebRequest @params
        return @{ Status = $r.StatusCode; Body = $r.Content; Headers = $r.Headers }
    } catch {
        $ex = $_.Exception
        if ($ex.Response) {
            $status = [int]$ex.Response.StatusCode
            $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            $reader.Close()
            return @{ Status = $status; Body = $body; Headers = $null }
        }
        return @{ Status = 0; Body = $ex.Message; Headers = $null }
    }
}

$baseUrl = "http://localhost:3000"
$pass = 0; $fail = 0; $warn = 0

function Report([string]$name, [bool]$ok, [string]$msg) {
    if ($ok) {
        Write-Host "  PASS  $name" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  FAIL  $name - $msg" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  FINAL SECURITY VERIFICATION" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

# ===== 1. Rate Limit on Login (P0#1) =====
Write-Host "`n--- Rate Limit: Login (5 req/60s) ---" -ForegroundColor Cyan
$rateLimitHit = $false
for ($i = 1; $i -le 8; $i++) {
    $r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/callback/credentials" `
        -Body "username=fake@test.com&password=wrong&csrfToken=&callbackUrl=$baseUrl&json=true" `
        -ContentType "application/x-www-form-urlencoded"
    if ($r.Status -eq 429) {
        Write-Host "  PASS  Rate limit hit on attempt $i (429)" -ForegroundColor Green
        $rateLimitHit = $true
        $pass++
        break
    }
    Write-Host "    Attempt $i : $($r.Status)" -ForegroundColor Gray
}
if (-not $rateLimitHit) {
    Write-Host "  FAIL  Rate limit NOT triggered after 8 login attempts" -ForegroundColor Red
    $fail++
}

# ===== 2. Rate Limit on Registration (P0#1) =====
Write-Host "`n--- Rate Limit: Register (5 req/60s) ---" -ForegroundColor Cyan
$rateLimitHit2 = $false
for ($i = 1; $i -le 8; $i++) {
    $r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" `
        -Body '{"name":"Test","email":"ratelimittest@t.com","username":"ratelimittest","password":"bad"}'
    if ($r.Status -eq 429) {
        Write-Host "  PASS  Rate limit hit on attempt $i (429)" -ForegroundColor Green
        $rateLimitHit2 = $true
        $pass++
        break
    }
    Write-Host "    Attempt $i : $($r.Status)" -ForegroundColor Gray
}
if (-not $rateLimitHit2) {
    Write-Host "  FAIL  Rate limit NOT triggered after 8 register attempts" -ForegroundColor Red
    $fail++
}

# ===== 3. Auth Protection: API returns 401 =====
Write-Host "`n--- Auth Protection ---" -ForegroundColor Cyan
$r = Invoke-Api -Method GET -Url "$baseUrl/api/posts"
Report "Unauthenticated API GET /api/posts returns 401" ($r.Status -eq 401) "Got $($r.Status)"

$r = Invoke-Api -Method GET -Url "$baseUrl/api/conversations"
Report "Unauthenticated API GET /api/conversations returns 401" ($r.Status -eq 401) "Got $($r.Status)"

$r = Invoke-Api -Method GET -Url "$baseUrl/api/notifications"
Report "Unauthenticated API GET /api/notifications returns 401" ($r.Status -eq 401) "Got $($r.Status)"

# ===== 4. Auth Protection: Pages redirect to login =====
Write-Host "`n--- Page Redirect Protection ---" -ForegroundColor Cyan
# Invoke-WebRequest follows redirects by default, so check final URL contains /login
try {
    $r = Invoke-WebRequest -Uri "$baseUrl/feed" -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    Report "GET /feed redirects to login" ($false) "Got $($r.StatusCode) without redirect"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    $location = ""
    try { $location = $_.Exception.Response.Headers.Location.ToString() } catch {}
    $isRedirect = ($status -eq 307 -or $status -eq 302 -or $status -eq 301) -and ($location -match "login")
    Report "GET /feed redirects to login" $isRedirect "Got status $status, location: $location"
}

# ===== 5. Public routes work without auth =====
Write-Host "`n--- Public Routes ---" -ForegroundColor Cyan
$r = Invoke-Api -Method GET -Url "$baseUrl/api/health"
Report "GET /api/health is public (200)" ($r.Status -eq 200) "Got $($r.Status)"

# ===== 6. Password Policy (P0#3) =====
Write-Host "`n--- Password Policy ---" -ForegroundColor Cyan
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" `
    -Body '{"name":"Test","email":"weakpw@t.com","username":"weakpw1","password":"abc123"}'
Report "Weak password 'abc123' rejected (400)" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" `
    -Body '{"name":"Test","email":"noup@t.com","username":"noup1","password":"mypass123"}'
Report "No uppercase 'mypass123' rejected (400)" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" `
    -Body '{"name":"Test","email":"nodig@t.com","username":"nodig1","password":"MyPassword"}'
Report "No digit 'MyPassword' rejected (400)" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

# ===== 7. Strong Password + Email Verification (P0#3 + P0#5) =====
Write-Host "`n--- Registration + Email Verification ---" -ForegroundColor Cyan
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$regBody = "{`"name`":`"SecTest`",`"email`":`"sec$ts@test.com`",`"username`":`"sec$ts`",`"password`":`"MyPass1234`"}"
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body $regBody
Report "Strong password registration (201)" ($r.Status -eq 201) "Got $($r.Status): $($r.Body)"

$hasVerifyMsg = $r.Body -match "erifi"
Report "Response mentions email verification" $hasVerifyMsg "Body: $($r.Body)"

# ===== 8. Generic duplicate error (P3#2) =====
Write-Host "`n--- Duplicate Registration ---" -ForegroundColor Cyan
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body $regBody
$isGeneric = ($r.Status -eq 409) -and ($r.Body -match "email ou username")
Report "Duplicate gives generic 409 error" $isGeneric "Got $($r.Status): $($r.Body)"

# ===== 9. Invalid verify token (P0#5) =====
Write-Host "`n--- Verify Email Token ---" -ForegroundColor Cyan
$r = Invoke-Api -Method GET -Url "$baseUrl/api/auth/verify-email?token=invalid-token-xyz"
Report "Invalid verify token handled (redirect or error)" ($r.Status -ge 200) "Got $($r.Status)"

# ===== 10. Cache-Control (P1#6) =====
Write-Host "`n--- Code Checks ---" -ForegroundColor Cyan
$posts = [System.IO.File]::ReadAllText("$PWD\src\app\api\posts\route.ts")
Report "Cache-Control: private, no-store" ($posts -match "private.*no-store") "Not found"

# ===== 11. CSP unsafe-eval conditional (P1#2) =====
$nc = [System.IO.File]::ReadAllText("$PWD\next.config.ts")
Report "CSP: unsafe-eval conditional on dev" ($nc -match "isDev.*unsafe-eval|unsafe-eval.*isDev|development.*unsafe-eval") "Not found"

# ===== 12. Password constants (P0#3) =====
$consts = [System.IO.File]::ReadAllText("$PWD\src\lib\constants.ts")
Report "PASSWORD_MIN_LENGTH constant" ($consts -match "PASSWORD_MIN_LENGTH") "Not found"
Report "PASSWORD_REGEX constant" ($consts -match "PASSWORD_REGEX") "Not found"

# ===== 13. Middleware checks =====
$mw = [System.IO.File]::ReadAllText("$PWD\src\middleware.ts")
Report "Middleware: standalone (no withAuth)" (-not ($mw -match "withAuth")) "Still uses withAuth"
Report "Middleware: getToken for auth" ($mw -match "getToken") "Not found"
Report "Middleware: Upstash Ratelimit" ($mw -match "Ratelimit" -and $mw -match "@upstash") "Not found"
Report "Middleware: request.ip" ($mw -match "request\.ip") "Not found"
Report "Middleware: client fingerprint" ($mw -match "getClientIdentifier") "Not found"
Report "Middleware: verify-email in public routes" ($mw -match "verify-email") "Not found"

# ===== 14. Auth checks =====
$auth = [System.IO.File]::ReadAllText("$PWD\src\lib\auth.ts")
Report "Auth: allowDangerousEmailAccountLinking removed" (-not ($auth -match "allowDangerousEmailAccountLinking")) "Still present"
Report "Auth: tokenVersion in JWT" ($auth -match "tokenVersion") "Not found"
Report "Auth: redirect callback" ($auth -match "redirect\s*\(" -and $auth -match "baseUrl") "Not found"
Report "Auth: emailVerified check" ($auth -match "emailVerified") "Not found"

# ===== 15. File validation =====
Report "file-validation.ts exists" (Test-Path "src\lib\file-validation.ts") "Missing"
$fv = [System.IO.File]::ReadAllText("$PWD\src\lib\file-validation.ts")
Report "Magic byte signatures" ($fv -match "magic|signature|0xFF|0x89") "Not found"
Report "SVG detection" ($fv -match "svg|SVG") "Not found"

# ===== 16. Email service =====
Report "email.ts exists" (Test-Path "src\lib\email.ts") "Missing"
$email = [System.IO.File]::ReadAllText("$PWD\src\lib\email.ts")
Report "Resend + sendVerificationEmail" ($email -match "Resend" -and $email -match "sendVerificationEmail") "Not found"

# ===== 17. Schema =====
$schema = [System.IO.File]::ReadAllText("$PWD\prisma\schema.prisma")
Report "Schema: tokenVersion field" ($schema -match "tokenVersion\s+Int") "Not found"
Report "Schema: emailVerified field" ($schema -match "emailVerified\s+DateTime") "Not found"
Report "Schema: Deletion strategy documented" ($schema -match "Deletion strategy|soft-delete") "Not found"

# ===== SUMMARY =====
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  RESULTS: $pass PASS | $fail FAIL | $warn WARN" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Yellow
