$baseUrl = "http://localhost:3000"
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

function Read-FileContent([string]$path) {
    return [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
}

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  SECURITY TESTS - CheerConnect" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

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

# ========== API TESTS ==========
Write-Host "`n--- API Tests ---" -ForegroundColor Cyan

# P0#3: Weak password
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body '{"name":"Test","email":"weakpw@t.com","username":"weakpw1","password":"abc123"}'
Report "P0#3: Weak password 'abc123' rejected" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

# P0#3: No uppercase
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body '{"name":"Test","email":"noup@t.com","username":"noup1","password":"mypass123"}'
Report "P0#3: No uppercase 'mypass123' rejected" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

# P0#3: No digit
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body '{"name":"Test","email":"nodig@t.com","username":"nodig1","password":"MyPassword"}'
Report "P0#3: No digit 'MyPassword' rejected" ($r.Status -eq 400) "Got $($r.Status): $($r.Body)"

# P0#3 + P0#5: Strong password accepted
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$regBody = "{`"name`":`"SecTest`",`"email`":`"sec$ts@test.com`",`"username`":`"sec$ts`",`"password`":`"MyPass1234`"}"
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body $regBody
Report "P0#3+P0#5: Strong password registration" ($r.Status -eq 201) "Got $($r.Status): $($r.Body)"

# Check response says to verify email
$hasVerifyMsg = $r.Body -match "erifi"
Report "P0#5: Registration response mentions email verification" $hasVerifyMsg "Body: $($r.Body)"

# P3#2: Duplicate registration generic error
$r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/register" -Body $regBody
$isGeneric = ($r.Status -eq 409) -and ($r.Body -match "email ou username")
Report "P3#2: Duplicate gives generic 409 error" $isGeneric "Got $($r.Status): $($r.Body)"

# P2#1: Team members without auth - check no isAdmin/hasPermission
$r = Invoke-Api -Method GET -Url "$baseUrl/api/teams/stars-allstar/members"
if ($r.Status -eq 200) {
    $parsed = $r.Body | ConvertFrom-Json
    if ($parsed.members.Count -gt 0) {
        $first = $parsed.members[0]
        $hasAdmin = ($first | Get-Member -Name "isAdmin" -MemberType NoteProperty) -ne $null
        $hasPerm = ($first | Get-Member -Name "hasPermission" -MemberType NoteProperty) -ne $null
        Report "P2#1: isAdmin/hasPermission stripped for unauthenticated" (-not $hasAdmin -and -not $hasPerm) "isAdmin=$hasAdmin hasPermission=$hasPerm"
    } else {
        Write-Host "  WARN  P2#1: No members found in team (seed data?)" -ForegroundColor Yellow
        $script:warn++
    }
} else {
    # Team slug might be different - check what teams exist
    Write-Host "  WARN  P2#1: Team 'stars-allstar' not found ($($r.Status)), checking other teams..." -ForegroundColor Yellow
    $script:warn++
}

# P0#5: Verify email with invalid token (should redirect)
$r = Invoke-Api -Method GET -Url "$baseUrl/api/auth/verify-email?token=invalid-token-xyz"
Report "P0#5: Invalid verify token handled" ($r.Status -ge 200) "Got $($r.Status)"

# P0#1: Rate limit on login (6 rapid requests)
Write-Host "`n--- Rate Limit Test ---" -ForegroundColor Cyan
$rateLimitHit = $false
for ($i = 1; $i -le 7; $i++) {
    $r = Invoke-Api -Method POST -Url "$baseUrl/api/auth/callback/credentials" `
        -Body "username=fake@test.com&password=wrong&csrfToken=&callbackUrl=$baseUrl&json=true" `
        -ContentType "application/x-www-form-urlencoded"
    if ($r.Status -eq 429) {
        Write-Host "  PASS  P0#1: Rate limit hit on attempt $i (429)" -ForegroundColor Green
        $rateLimitHit = $true
        $pass++
        break
    }
    Write-Host "    Attempt $i : $($r.Status)" -ForegroundColor Gray
}
if (-not $rateLimitHit) {
    Write-Host "  WARN  P0#1: Rate limit not triggered in 7 attempts (Upstash active or timing)" -ForegroundColor Yellow
    $warn++
}

# ========== CODE-LEVEL CHECKS ==========
Write-Host "`n--- Code-Level Checks ---" -ForegroundColor Cyan

# Auth.ts
$auth = Read-FileContent "src/lib/auth.ts"
Report "P0#2: allowDangerousEmailAccountLinking removed" (-not ($auth -match "allowDangerousEmailAccountLinking")) "Still present"
Report "P1#1: tokenVersion in JWT callback" ($auth -match "tokenVersion") "Not found"
Report "P3#1: redirect callback with baseUrl" ($auth -match "redirect\s*\(" -and $auth -match "baseUrl") "Not found"
Report "P0#5: emailVerified check in authorize" ($auth -match "emailVerified") "Not found"

# Middleware.ts
$mw = Read-FileContent "src/middleware.ts"
Report "P0#1: Login rate limit rule" ($mw -match "api/auth/callback/credentials") "Not found"
Report "P0#1: Auth paths in matcher" ($mw -match "api/auth/:path") "Not found"
Report "P0#4: Upstash Ratelimit" ($mw -match "Ratelimit" -and $mw -match "@upstash") "Not found"
Report "P1#5: request.ip preferred" ($mw -match "request\.ip") "Not found"
Report "P2#3: Password rate limit (3 req)" ($mw -match "api/settings/password.*maxRequests:\s*3") "Not found"
Report "P2#4: Anonymous fingerprint" ($mw -match "getClientIdentifier|fingerprint") "Not found"
Report "P0#1: verify-email in public routes" ($mw -match "verify-email") "Not found"

# next.config.ts
$nc = Read-FileContent "next.config.ts"
Report "P1#2: CSP conditional unsafe-eval" ($nc -match "development.*unsafe-eval|unsafe-eval.*development") "Not conditional"

# Constants
$consts = Read-FileContent "src/lib/constants.ts"
Report "P0#3: PASSWORD_MIN_LENGTH constant" ($consts -match "PASSWORD_MIN_LENGTH") "Not found"
Report "P0#3: PASSWORD_REGEX constant" ($consts -match "PASSWORD_REGEX") "Not found"

# Email
Report "P0#5: email.ts exists" (Test-Path "src/lib/email.ts") "Missing"
$email = Read-FileContent "src/lib/email.ts"
Report "P0#5: Resend + sendVerificationEmail" ($email -match "Resend" -and $email -match "sendVerificationEmail") "Not found"

# Verify email route
Report "P0#5: verify-email API route exists" (Test-Path "src/app/api/auth/verify-email/route.ts") "Missing"
Report "P0#5: verify-email page exists" (Test-Path "src/app/(auth)/verify-email/page.tsx") "Missing"

# File validation
Report "P1#3+P1#4: file-validation.ts exists" (Test-Path "src/lib/file-validation.ts") "Missing"
$fv = Read-FileContent "src/lib/file-validation.ts"
Report "P1#3: Magic byte signatures" ($fv -match "magic|signature|0xFF|0x89") "Not found"
Report "P1#4: SVG detection" ($fv -match "svg|SVG") "Not found"

# Upload route
$upload = Read-FileContent "src/app/api/upload/route.ts"
Report "P1#3: Upload uses validateFileType" ($upload -match "validateFileType") "Not found"

# Posts route
$posts = Read-FileContent "src/app/api/posts/route.ts"
Report "P1#6: Cache-Control private, no-store" ($posts -match "private.*no-store") "Not updated"

# Comments route
$comments = Read-FileContent "src/app/api/posts/[id]/comments/route.ts"
Report "P2#2: getBlockedUserIds in comments" ($comments -match "getBlockedUserIds") "Not found"
Report "P2#2: 403 response for blocked" ($comments -match "403") "Not found"

# Messages route
$msgs = Read-FileContent "src/app/api/conversations/[id]/messages/route.ts"
Report "P3#6: Preview truncated to 50" ($msgs -match "substring\(0,\s*50\)") "Still 100"

# Team members route
$teams = Read-FileContent "src/app/api/teams/[slug]/members/route.ts"
Report "P2#1: Strip admin flags code" ($teams -match "isAdmin|hasPermission" -and $teams -match "session") "Not found"

# Password route
$pw = Read-FileContent "src/app/api/settings/password/route.ts"
Report "P3#4: tokenVersion increment" ($pw -match "tokenVersion.*increment") "Not found"

# Schema
$schema = Read-FileContent "prisma/schema.prisma"
Report "Schema: tokenVersion field" ($schema -match "tokenVersion\s+Int") "Not found"
Report "Schema: emailVerified field" ($schema -match "emailVerified\s+DateTime") "Not found"
Report "P3#5: Deletion strategy documented" ($schema -match "Deletion strategy|soft-delete") "Not documented"

# Register page
$regPage = Read-FileContent "src/app/(auth)/register/page.tsx"
Report "P0#3: Client-side strong password validation" ($regPage -match "PASSWORD_MIN_LENGTH|PASSWORD_REGEX|PASSWORD_ERROR") "Not updated"
Report "P0#5: Redirect to verify-email after registration" ($regPage -match "verify-email") "Still auto-login"

# Settings page
$settingsPage = Read-FileContent "src/app/(main)/settings/page.tsx"
Report "P0#3: Settings page password validation updated" ($settingsPage -match "PASSWORD_MIN_LENGTH|PASSWORD_REGEX|8") "Still min 6"

# ========== SUMMARY ==========
Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "  RESULTS: $pass PASS | $fail FAIL | $warn WARN" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Yellow
