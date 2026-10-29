[CmdletBinding()]
param(
  [string] $CredentialPath = '.secrets/vertex-sa.json',
  [string] $OutputDirectory = 'design/plane-art/proofs/vertex',
  [string] $Model = 'gemini-3.1-flash-image',
  [string] $Location = 'global'
)

$ErrorActionPreference = 'Stop'

$resolvedCredential = (Resolve-Path -LiteralPath $CredentialPath).Path
$credential = Get-Content -Raw -LiteralPath $resolvedCredential | ConvertFrom-Json
if ($credential.type -ne 'service_account' -or -not $credential.project_id) {
  throw 'Credential must be a Google service-account JSON file with a project_id.'
}

$projectId = [string] $credential.project_id
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
$gcloudCommand = (Get-Command 'gcloud.cmd' -ErrorAction Stop).Source

$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$cloudConfig = Join-Path $tempRoot ('farmwebsite-vertex-' + [guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($cloudConfig) | Out-Null
$env:CLOUDSDK_CONFIG = $cloudConfig

$endpoint = "https://aiplatform.googleapis.com/v1/projects/$projectId/locations/$Location/publishers/google/models/${Model}:generateContent"
$records = [System.Collections.Generic.List[object]]::new()

function Invoke-VertexImage {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [string] $Prompt,
    [string] $ReferenceImage
  )

  $parts = [System.Collections.Generic.List[object]]::new()
  if ($ReferenceImage) {
    $referenceBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ReferenceImage).Path)
    $parts.Add(@{
      inlineData = @{
        mimeType = 'image/png'
        data = [Convert]::ToBase64String($referenceBytes)
      }
    })
  }
  $parts.Add(@{ text = $Prompt })

  $body = @{
    contents = @(@{ role = 'user'; parts = $parts })
    generationConfig = @{
      responseModalities = @('TEXT', 'IMAGE')
      imageConfig = @{ aspectRatio = '16:9' }
    }
  } | ConvertTo-Json -Depth 12 -Compress

  # Windows PowerShell's legacy web client is occasionally rejected by Google's
  # API edge. curl uses the same documented REST endpoint without that behavior.
  $requestId = [guid]::NewGuid().ToString('N')
  $bodyPath = Join-Path $cloudConfig ($requestId + '-body.json')
  $headersPath = Join-Path $cloudConfig ($requestId + '-headers.txt')
  $responsePath = Join-Path $cloudConfig ($requestId + '-response.json')
  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($bodyPath, $body, $utf8WithoutBom)
  [System.IO.File]::WriteAllText($headersPath, "Authorization: Bearer $script:accessToken`n", $utf8WithoutBom)
  & curl.exe --silent --show-error --fail-with-body --request POST `
    --header "@$headersPath" --header 'Content-Type: application/json' `
    --data-binary "@$bodyPath" --output $responsePath $endpoint
  if ($LASTEXITCODE -ne 0) {
    $errorBody = if (Test-Path -LiteralPath $responsePath) {
      (Get-Content -Raw -LiteralPath $responsePath).Substring(0, [Math]::Min(800, (Get-Item $responsePath).Length))
    } else { 'No response body.' }
    throw "Vertex request failed for '$Name': $errorBody"
  }
  $response = Get-Content -Raw -LiteralPath $responsePath | ConvertFrom-Json

  $imagePart = $response.candidates[0].content.parts |
    Where-Object { $_.inlineData -and $_.inlineData.data } |
    Select-Object -First 1
  if (-not $imagePart) {
    $finishReason = $response.candidates[0].finishReason
    throw "Vertex returned no image for '$Name'. Finish reason: $finishReason"
  }

  $mimeType = [string] $imagePart.inlineData.mimeType
  $extension = if ($mimeType -eq 'image/jpeg') { '.jpg' } else { '.png' }
  $outputPath = Join-Path $resolvedOutput ($Name + $extension)
  [System.IO.File]::WriteAllBytes($outputPath, [Convert]::FromBase64String($imagePart.inlineData.data))

  $records.Add([pscustomobject]@{
    name = $Name
    file = [System.IO.Path]::GetFileName($outputPath)
    mimeType = $mimeType
    prompt = $Prompt
    reference = if ($ReferenceImage) { [System.IO.Path]::GetFileName($ReferenceImage) } else { $null }
  })
  Write-Host "Created $outputPath"
  return $outputPath
}

$baseConstraints = @'
Create a premium photorealistic website asset: one modern Boeing 737-800-style passenger jet, nose pointing right, mostly side-on three-quarter view with the port side visible, landing gear fully retracted. Show the entire aircraft centered on a wide 16:9 canvas with generous even padding. Exactly two under-wing engines, realistic intact anatomy and proportions, clean daylight from above-left, restrained highlights, no ground shadow, no scenery, no clouds, no contrails, no people, no watermark, and no cropped aircraft parts. Isolate the plane on a plain pure white background suitable for later background removal.
'@

try {
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $gcloudCommand auth activate-service-account --key-file=$resolvedCredential --project=$projectId --quiet *> $null
  $authExitCode = $LASTEXITCODE
  $tokenOutput = & $gcloudCommand auth print-access-token --quiet 2>$null
  $tokenExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedErrorActionPreference
  if ($authExitCode -ne 0) { throw 'Google Cloud service-account authentication failed.' }
  $script:accessToken = ([string] $tokenOutput).Trim()
  if ($tokenExitCode -ne 0 -or -not $script:accessToken) { throw 'Could not obtain a Google Cloud access token.' }

  $americanNoLogoPrompt = @"
$baseConstraints
Paint the aircraft in an original American-airline-inspired scheme: pearl white and light silver fuselage, restrained navy and red geometric tail stripes, and small tasteful red and blue accent panels. Do not include any airline name, logo, letters, words, registration number, fake text, or recognizable brand mark.
"@
  $americanNoLogo = Invoke-VertexImage -Name 'american-inspired-no-logo' -Prompt $americanNoLogoPrompt

  $americanBrandedPrompt = @'
Edit the supplied aircraft image. Preserve the aircraft, anatomy, pose, camera angle, crop, lighting, background, windows, wings, and exactly two engines. Change only the paint details into an accurate, polished American Airlines treatment with the correct official tail branding and the official American wordmark on the forward fuselage. Spell “American” exactly once, clearly and normally from left to right. Add no registration, extra text, watermark, scenery, shadow, clouds, or landing gear.
'@
  Invoke-VertexImage -Name 'american-branded' -Prompt $americanBrandedPrompt -ReferenceImage $americanNoLogo | Out-Null

  $southwestNoLogoPrompt = @"
$baseConstraints
Paint the aircraft in an original Southwest-airline-inspired scheme: rich cobalt-blue fuselage, warm red underside and tail, a narrow golden-yellow divider accent, and tasteful red-yellow-blue tail bands. Make it cheerful, modern, and balanced. Do not include any airline name, logo, heart symbol, letters, words, registration number, fake text, or recognizable brand mark.
"@
  $southwestNoLogo = Invoke-VertexImage -Name 'southwest-inspired-no-logo' -Prompt $southwestNoLogoPrompt

  $southwestBrandedPrompt = @'
Edit the supplied aircraft image. Preserve the aircraft, anatomy, pose, camera angle, crop, lighting, background, windows, wings, exactly two engines, and blue-red-yellow palette. Change only the livery details into an accurate current Southwest Airlines branded treatment with the correct official heart/tail branding and official Southwest wordmark on the forward fuselage. Spell “SOUTHWEST” exactly once, clearly and normally from left to right. Add no registration, extra text, watermark, scenery, shadow, clouds, or landing gear.
'@
  Invoke-VertexImage -Name 'southwest-branded' -Prompt $southwestBrandedPrompt -ReferenceImage $southwestNoLogo | Out-Null

  $metadata = [ordered]@{
    provider = 'Google Cloud Vertex AI'
    model = $Model
    location = $Location
    projectId = $projectId
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    note = 'Proof images only. White backgrounds have not yet been removed or production-optimized.'
    images = $records
  }
  $metadataPath = Join-Path $resolvedOutput 'metadata.json'
  $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding utf8
  Write-Host "Created $metadataPath"
}
finally {
  if ($savedErrorActionPreference) { $ErrorActionPreference = $savedErrorActionPreference }
  $script:accessToken = $null
  if ([System.IO.Directory]::Exists($cloudConfig)) {
    $resolvedCloudConfig = [System.IO.Path]::GetFullPath($cloudConfig)
    if ($resolvedCloudConfig.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($resolvedCloudConfig).StartsWith('farmwebsite-vertex-')) {
      Remove-Item -LiteralPath $resolvedCloudConfig -Recurse -Force
    }
  }
}
