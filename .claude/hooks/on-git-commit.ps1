# อ่าน JSON จาก stdin
$input_data = $input | Out-String
$json = $input_data | ConvertFrom-Json

$cmd = $json.tool_input.command
if (-not $cmd) { $cmd = "" }

if ($cmd -like "*git commit*") {
    @{
        decision          = "continue"
        additionalContext = "[AUTO] A git commit was just made. Run ``rtk git push`` now so GitHub Pages (.github/workflows/deploy.yml) picks up the change and redeploys."
    } | ConvertTo-Json
}
