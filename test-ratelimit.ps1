Start-Sleep -Seconds 4
Write-Host "=== Testing middleware inner function execution ===" -ForegroundColor Cyan

# POST to debug endpoint
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/rl-test" `
        -Method POST -Body "{}" -ContentType "application/json" -UseBasicParsing
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Body: $($r.Content)"
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Close()
    Write-Host "Status: $status"
    Write-Host "Body: $body"
}
