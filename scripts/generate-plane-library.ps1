[CmdletBinding()]
param(
  [Alias('Id')]
  [string[]] $ArtworkId,
  [ValidateSet('left', 'right', 'both')]
  [string] $Direction = 'both',
  [switch] $All,
  [switch] $ConfirmAll,
  [switch] $DryRun,
  [switch] $Force,
  [string] $CredentialPath,
  [string] $ProjectId,
  [string] $Model,
  [string] $Location = 'global',
  [ValidateRange(1, 4)]
  [int] $CandidateCount = 1,
  [string] $CatalogPath = 'design/plane-art/prompts.json',
  [string] $ShapeGuideInventoryPath = 'design/plane-art/shape-guides/inventory.json',
  [string] $GeneratedRoot = '.generated/plane-art',
  [string] $ApprovedRoot = 'assets/planes/v1'
)

$ErrorActionPreference = 'Stop'
$script:accessToken = $null
$script:cloudConfig = $null
$script:savedCloudConfig = $env:CLOUDSDK_CONFIG
$script:tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

function Resolve-RepoPath {
  param([Parameter(Mandatory)] [string] $Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return [System.IO.Path]::GetFullPath($Path) }
  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
}

function Test-PathBeneath {
  param([Parameter(Mandatory)] [string] $Path, [Parameter(Mandatory)] [string] $Parent)
  $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
  $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\', '/')
  return $fullPath.Equals($fullParent, [System.StringComparison]::OrdinalIgnoreCase) -or
    $fullPath.StartsWith($fullParent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-Sha256 {
  param([Parameter(Mandatory)] [string] $Path)
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-TextSha256 {
  param([Parameter(Mandatory)] [string] $Text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($utf8WithoutBom.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Write-JsonAtomic {
  param([Parameter(Mandatory)] $Value, [Parameter(Mandatory)] [string] $Path, [int] $Depth = 12)
  $parent = Split-Path -Parent $Path
  [System.IO.Directory]::CreateDirectory($parent) | Out-Null
  $temporary = Join-Path $parent ([System.IO.Path]::GetFileName($Path) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
  [System.IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth $Depth), $utf8WithoutBom)
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Protect-LogText {
  param([AllowNull()] [string] $Text)
  if (-not $Text) { return '' }
  $safe = $Text
  $safe = [regex]::Replace($safe, '(?is)-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----', '[REDACTED PRIVATE KEY]')
  $safe = [regex]::Replace($safe, '(?i)(authorization\s*:\s*bearer\s+)[^\s"'']+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '(?i)(access[_-]?token["'']?\s*[:=]\s*["'']?)[^\s,"'']+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '(?i)(private_key["'']?\s*:\s*)"(?:\\.|[^"])*"', '$1"[REDACTED]"')
  if ($script:accessToken) { $safe = $safe.Replace($script:accessToken, '[REDACTED]') }
  return $safe.Substring(0, [Math]::Min(1200, $safe.Length))
}

function Get-MimeType {
  param([Parameter(Mandatory)] [string] $Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.png' { return 'image/png' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.webp' { return 'image/webp' }
    default { throw "Unsupported image reference type for '$([System.IO.Path]::GetFileName($Path))'." }
  }
}

try {
  $safeGeneratedParent = Resolve-RepoPath '.generated/plane-art'
  $resolvedGeneratedRoot = Resolve-RepoPath $GeneratedRoot
  if (-not (Test-PathBeneath -Path $resolvedGeneratedRoot -Parent $safeGeneratedParent)) {
    throw "Unsafe output path. GeneratedRoot must be .generated/plane-art or one of its children."
  }
  $resolvedApprovedRoot = Resolve-RepoPath $ApprovedRoot
  $resolvedCatalogPath = Resolve-RepoPath $CatalogPath
  $resolvedInventoryPath = Resolve-RepoPath $ShapeGuideInventoryPath
  if (-not (Test-Path -LiteralPath $resolvedCatalogPath -PathType Leaf)) { throw 'Prompt catalog is missing.' }
  if (-not (Test-Path -LiteralPath $resolvedInventoryPath -PathType Leaf)) { throw 'Shape-guide inventory is missing.' }

  $catalog = Get-Content -Raw -LiteralPath $resolvedCatalogPath | ConvertFrom-Json
  $inventory = Get-Content -Raw -LiteralPath $resolvedInventoryPath | ConvertFrom-Json
  if (-not $catalog.records) { throw 'Prompt catalog has no records.' }
  if (-not $inventory.guides) { throw 'Shape-guide inventory has no guides.' }
  $generationAmendments = @($catalog.generationAmendments | Where-Object { $_.id -and $_.text })
  $scopedGenerationExceptions = @($catalog.scopedGenerationExceptions | Where-Object { $_.id -and $_.text -and $_.recordKeys })

  $knownIds = @($catalog.records | Select-Object -ExpandProperty artworkId -Unique | Sort-Object)
  $requestedIds = @($ArtworkId | ForEach-Object { if ($_){ $_.Trim() } } | Where-Object { $_ } | Select-Object -Unique)
  if ($All) {
    if ($requestedIds.Count -gt 0) { throw 'Use either -ArtworkId or -All, not both.' }
    if (-not $ConfirmAll) { throw 'An all-library run requires both -All and -ConfirmAll.' }
    $requestedIds = $knownIds
  } elseif ($ConfirmAll) {
    throw '-ConfirmAll is valid only with -All.'
  } elseif ($requestedIds.Count -eq 0) {
    throw 'Specify one or more -ArtworkId values. Use -All -ConfirmAll only for a deliberate full-library run.'
  }

  $unknownIds = @($requestedIds | Where-Object { $knownIds -notcontains $_ })
  if ($unknownIds.Count -gt 0) { throw "Unknown artwork ID(s): $($unknownIds -join ', ')." }
  if (@($requestedIds | Where-Object { $_ -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$' }).Count -gt 0) { throw 'Selected artwork IDs are not safe path components.' }
  $directions = if ($Direction -eq 'both') { @('right', 'left') } else { @($Direction) }
  $referenceById = @{}
  foreach ($reference in @($catalog.referenceCatalog)) { $referenceById[[string]$reference.id] = $reference }
  $guideById = @{}
  foreach ($guide in @($inventory.guides)) { $guideById[[string]$guide.id] = $guide }

  $records = @()
  foreach ($id in ($requestedIds | Sort-Object)) {
    foreach ($selectedDirection in $directions) {
      $matches = @($catalog.records | Where-Object { $_.artworkId -eq $id -and $_.direction -eq $selectedDirection })
      if ($matches.Count -ne 1) { throw "Expected exactly one prompt for '$id' direction '$selectedDirection'." }
      $records += $matches[0]
    }
  }

  $recordProjects = @($records | ForEach-Object { [string]$_.projectId } | Where-Object { $_ } | Select-Object -Unique)
  if (-not $ProjectId) {
    if ($recordProjects.Count -ne 1) { throw 'Selected prompts do not identify exactly one project ID; supply -ProjectId.' }
    $ProjectId = $recordProjects[0]
  }
  $recordModels = @($records | ForEach-Object { [string]$_.modelId } | Where-Object { $_ } | Select-Object -Unique)
  if (-not $Model) {
    if ($recordModels.Count -ne 1) { throw 'Selected prompts do not identify exactly one pinned model ID; supply -Model.' }
    $Model = $recordModels[0]
  }
  if ($ProjectId -notmatch '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') { throw 'ProjectId is invalid.' }
  if ($Model -notmatch '^[A-Za-z0-9._-]+$') { throw 'Model is invalid.' }
  if ($Location -notmatch '^[a-z0-9-]+$') { throw 'Location is invalid.' }

  $plan = @()
  foreach ($record in $records) {
    if (-not $record.prompt -or -not $record.key) { throw "Prompt definition is incomplete for '$($record.artworkId):$($record.direction)'." }
    if ([string]$record.status -like 'blocked*') { throw "Prompt '$($record.key)' is blocked: $($record.blockedReason)" }
    $recordException = if ($record.generationException -and $record.generationException.id -and $record.generationException.text) {
      @($record.generationException)
    } else {
      @()
    }
    $scopedExceptions = @($scopedGenerationExceptions | Where-Object { @($_.recordKeys) -contains [string]$record.key })
    $effectivePrompt = ((@([string]$record.prompt) +
      @($generationAmendments | ForEach-Object { [string]$_.text }) +
      @($scopedExceptions | ForEach-Object { [string]$_.text }) +
      @($recordException | ForEach-Object { [string]$_.text })) -join "`n`n")
    $promptRevision = ((@([string]$record.key) +
      @($generationAmendments | ForEach-Object { [string]$_.id }) +
      @($scopedExceptions | ForEach-Object { [string]$_.id }) +
      @($recordException | ForEach-Object { [string]$_.id })) -join '+')
    $guide = $guideById[[string]$record.shapeGuideId]
    if (-not $guide -or $guide.status -ne 'available' -or -not $guide.file) {
      throw "Shape guide '$($record.shapeGuideId)' is not available for '$($record.artworkId)'."
    }
    $guidePath = Resolve-RepoPath ([string]$guide.file)
    if (-not (Test-Path -LiteralPath $guidePath -PathType Leaf)) { throw "Shape guide file is missing for '$($record.artworkId)'." }

    $inputs = New-Object System.Collections.Generic.List[object]
    foreach ($referenceId in @($record.referenceIds)) {
      if ([string]$referenceId -like 'shape-guide:*') { continue }
      $reference = $referenceById[[string]$referenceId]
      if (-not $reference -or -not $reference.file) { throw "Reference '$referenceId' is missing for '$($record.key)'." }
      $referencePath = Resolve-RepoPath ([string]$reference.file)
      if (-not (Test-Path -LiteralPath $referencePath -PathType Leaf)) { throw "Reference '$referenceId' is missing for '$($record.key)'." }
      $inputs.Add([pscustomobject]@{ id = [string]$referenceId; path = $referencePath; sha256 = Get-Sha256 $referencePath; image = @('.png','.jpg','.jpeg','.webp') -contains [System.IO.Path]::GetExtension($referencePath).ToLowerInvariant() })
    }
    $inputs.Add([pscustomobject]@{ id = "shape-guide:$($record.shapeGuideId)"; path = $guidePath; sha256 = Get-Sha256 $guidePath; image = $true })

    if ($record.direction -eq 'left') {
      $rightMatches = @($catalog.records | Where-Object { $_.artworkId -eq $record.artworkId -and $_.direction -eq 'right' })
      if ($rightMatches.Count -ne 1 -or $rightMatches[0].status -ne 'approved' -or -not $rightMatches[0].output.sha256) {
        throw "An approved right treatment with a recorded SHA-256 is required before generating '$($record.artworkId):left'."
      }
      $rightPath = Join-Path $resolvedApprovedRoot ("$($record.artworkId)-right.webp")
      if (-not (Test-Path -LiteralPath $rightPath -PathType Leaf)) { throw "The approved right input is missing for '$($record.artworkId):left'." }
      $rightHash = Get-Sha256 $rightPath
      if ($rightHash -ne ([string]$rightMatches[0].output.sha256).ToLowerInvariant()) { throw "The approved right input hash does not match metadata for '$($record.artworkId):left'." }
      $inputs.Add([pscustomobject]@{ id = [string]$record.styleReferenceKey; path = $rightPath; sha256 = $rightHash; image = $true })
    }

    $approvedOutput = Join-Path $resolvedApprovedRoot ("$($record.artworkId)-$($record.direction).webp")
    if (Test-Path -LiteralPath $approvedOutput) { throw "Approved output already exists for '$($record.artworkId):$($record.direction)'; generation will not overwrite it." }
    $requestIdentity = @($promptRevision, $Model, $Location, $ProjectId, $CandidateCount, (Get-TextSha256 $effectivePrompt)) + @($inputs | ForEach-Object { $_.sha256 })
    $requestKey = (Get-TextSha256 ($requestIdentity -join '|')).Substring(0, 20)
    $outputDirectory = Join-Path (Join-Path (Join-Path $resolvedGeneratedRoot 'candidates') ([string]$record.artworkId)) (Join-Path ([string]$record.direction) $requestKey)
    $plan += [pscustomobject]@{ record = $record; prompt = $effectivePrompt; promptRevision = $promptRevision; inputs = $inputs.ToArray(); approvedOutput = $approvedOutput; requestKey = $requestKey; outputDirectory = $outputDirectory }
  }

  $ledgerPath = Join-Path $resolvedGeneratedRoot 'ledger.json'
  $ledger = if (Test-Path -LiteralPath $ledgerPath) { Get-Content -Raw -LiteralPath $ledgerPath | ConvertFrom-Json } else { [pscustomobject]@{ schemaVersion = 1; requests = @() } }
  if (-not $ledger.requests) { $ledger | Add-Member -Force NoteProperty requests @() }
  $pending = @()
  foreach ($item in $plan) {
    $completed = @($ledger.requests | Where-Object { $_.requestKey -eq $item.requestKey -and $_.status -eq 'completed' })
    $metadataPath = Join-Path $item.outputDirectory 'metadata.json'
    $item | Add-Member NoteProperty metadataPath $metadataPath
    $item | Add-Member NoteProperty skipped (($completed.Count -gt 0) -and (Test-Path -LiteralPath $metadataPath) -and -not $Force)
    if (-not $item.skipped) { $pending += $item }
  }

  Write-Output "Vertex plane-library generation plan"
  Write-Output "Model: $Model"
  Write-Output "Location: $Location"
  Write-Output "Project: $ProjectId"
  Write-Output "Candidate count per request: $CandidateCount"
  Write-Output "Selected items: $($plan.Count)"
  Write-Output "Estimated Vertex requests: $($pending.Count)"
  foreach ($item in $plan) {
    $state = if ($item.skipped) { 'SKIP completed' } else { 'GENERATE' }
    Write-Output "[$state] $($item.record.artworkId) $($item.record.direction)"
    Write-Output "  prompt revision: $($item.promptRevision)"
    foreach ($input in $item.inputs) { Write-Output "  input: $($input.id) => $($input.path) (sha256:$($input.sha256))" }
    Write-Output "  raw output: $($item.outputDirectory)"
    Write-Output "  approved target (read-only): $($item.approvedOutput)"
  }
  if ($DryRun) { Write-Output 'Dry run complete; Vertex was not called.'; return }
  if ($pending.Count -eq 0) { Write-Output 'Nothing to generate; all selected requests are complete.'; return }

  $gcloud = (Get-Command 'gcloud.cmd' -ErrorAction SilentlyContinue)
  if (-not $gcloud) { $gcloud = Get-Command 'gcloud' -ErrorAction SilentlyContinue }
  if (-not $gcloud) { throw 'Google Cloud CLI is required for authentication.' }
  $script:cloudConfig = Join-Path $script:tempRoot ('farmwebsite-plane-library-' + [guid]::NewGuid().ToString('N'))
  [System.IO.Directory]::CreateDirectory($script:cloudConfig) | Out-Null

  if ($CredentialPath) {
    $resolvedCredential = Resolve-RepoPath $CredentialPath
    if (-not (Test-Path -LiteralPath $resolvedCredential -PathType Leaf)) { throw 'The supplied service-account credential file is missing.' }
    try { $credential = Get-Content -Raw -LiteralPath $resolvedCredential | ConvertFrom-Json } catch { throw 'The supplied credential file is not valid JSON.' }
    if ($credential.type -ne 'service_account' -or -not $credential.project_id -or -not $credential.private_key) { throw 'The supplied credential is not a valid service-account credential.' }
    $env:CLOUDSDK_CONFIG = $script:cloudConfig
    $savedPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & $gcloud.Source auth activate-service-account --key-file=$resolvedCredential --project=$ProjectId --quiet *> $null
    $authExit = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($authExit -ne 0) { throw 'Google Cloud service-account authentication failed.' }
    $tokenOutput = & $gcloud.Source auth print-access-token --quiet 2>$null
  } else {
    $tokenOutput = & $gcloud.Source auth application-default print-access-token --quiet 2>$null
  }
  $tokenExit = $LASTEXITCODE
  $script:accessToken = ([string]$tokenOutput).Trim()
  if ($tokenExit -ne 0 -or -not $script:accessToken) { throw 'Google Cloud authentication is unavailable. Supply -CredentialPath or configure Application Default Credentials.' }

  $endpoint = "https://aiplatform.googleapis.com/v1/projects/$ProjectId/locations/$Location/publishers/google/models/${Model}:generateContent"
  foreach ($item in $pending) {
    [System.IO.Directory]::CreateDirectory($item.outputDirectory) | Out-Null
    $parts = New-Object System.Collections.Generic.List[object]
    foreach ($input in @($item.inputs | Where-Object { $_.image })) {
      $parts.Add(@{ inlineData = @{ mimeType = Get-MimeType $input.path; data = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($input.path)) } })
    }
    $parts.Add(@{ text = [string]$item.prompt })
    $body = @{ contents = @(@{ role = 'user'; parts = $parts }); generationConfig = @{ candidateCount = $CandidateCount; responseModalities = @('TEXT', 'IMAGE'); imageConfig = @{ aspectRatio = '16:9' } } } | ConvertTo-Json -Depth 14 -Compress
    $requestId = [guid]::NewGuid().ToString('N')
    $bodyPath = Join-Path $script:cloudConfig ($requestId + '-body.json')
    $headersPath = Join-Path $script:cloudConfig ($requestId + '-headers.txt')
    $responsePath = Join-Path $script:cloudConfig ($requestId + '-response.json')
    [System.IO.File]::WriteAllText($bodyPath, $body, $utf8WithoutBom)
    [System.IO.File]::WriteAllText($headersPath, "Authorization: Bearer $script:accessToken`n", $utf8WithoutBom)
    & curl.exe --silent --show-error --request POST --header "@$headersPath" --header 'Content-Type: application/json' --data-binary "@$bodyPath" --output $responsePath --write-out '%{http_code}' $endpoint 2>$null | ForEach-Object { $httpStatus = $_ }
    $curlExit = $LASTEXITCODE
    if ($curlExit -ne 0 -or [int]$httpStatus -lt 200 -or [int]$httpStatus -ge 300) {
      $errorBody = if (Test-Path -LiteralPath $responsePath) { Get-Content -Raw -LiteralPath $responsePath } else { 'No response body.' }
      throw "Vertex request failed for '$($item.record.key)' (HTTP $httpStatus): $(Protect-LogText $errorBody)"
    }
    try { $response = Get-Content -Raw -LiteralPath $responsePath | ConvertFrom-Json } catch { throw "Vertex returned invalid JSON for '$($item.record.key)'." }
    $candidateFiles = New-Object System.Collections.Generic.List[object]
    $candidateIndex = 0
    foreach ($candidate in @($response.candidates)) {
      $candidateIndex++
      $imagePart = @($candidate.content.parts | Where-Object { $_.inlineData -and $_.inlineData.data } | Select-Object -First 1)
      if ($imagePart.Count -eq 0) { continue }
      $mimeType = [string]$imagePart[0].inlineData.mimeType
      $extension = if ($mimeType -eq 'image/jpeg') { '.jpg' } elseif ($mimeType -eq 'image/webp') { '.webp' } else { '.png' }
      $candidatePath = Join-Path $item.outputDirectory ("candidate-$candidateIndex$extension")
      [System.IO.File]::WriteAllBytes($candidatePath, [Convert]::FromBase64String([string]$imagePart[0].inlineData.data))
      $candidateFiles.Add([pscustomobject]@{ index = $candidateIndex; file = [System.IO.Path]::GetFileName($candidatePath); mimeType = $mimeType; sha256 = Get-Sha256 $candidatePath })
    }
    if ($candidateFiles.Count -eq 0) { throw "Vertex returned no image candidates for '$($item.record.key)'." }
    $requestTime = [DateTimeOffset]::UtcNow.ToString('o')
    $metadata = [ordered]@{ schemaVersion = 1; requestKey = $item.requestKey; artworkId = [string]$item.record.artworkId; direction = [string]$item.record.direction; promptRevision = [string]$item.promptRevision; promptSha256 = Get-TextSha256 ([string]$item.prompt); provider = 'Google Cloud Vertex AI'; modelId = $Model; location = $Location; projectId = $ProjectId; requestTime = $requestTime; requestedCandidateCount = $CandidateCount; returnedCandidateCount = $candidateFiles.Count; references = @($item.inputs | ForEach-Object { [ordered]@{ id = $_.id; sha256 = $_.sha256 } }); candidates = $candidateFiles.ToArray() }
    Write-JsonAtomic -Value $metadata -Path $item.metadataPath
    $ledger.requests = @($ledger.requests | Where-Object { $_.requestKey -ne $item.requestKey }) + @([pscustomobject]@{ requestKey = $item.requestKey; artworkId = [string]$item.record.artworkId; direction = [string]$item.record.direction; status = 'completed'; completedAt = $requestTime; metadata = $item.metadataPath.Substring($resolvedGeneratedRoot.Length).TrimStart('\', '/') })
    Write-JsonAtomic -Value $ledger -Path $ledgerPath
    Write-Output "Completed $($item.record.key): $($candidateFiles.Count) candidate(s)."
  }
}
catch {
  $failureLine = $_.InvocationInfo.ScriptLineNumber
  Write-Error "$(Protect-LogText $_.Exception.Message) (generator line $failureLine)"
  exit 1
}
finally {
  $script:accessToken = $null
  $env:CLOUDSDK_CONFIG = $script:savedCloudConfig
  if ($script:cloudConfig -and [System.IO.Directory]::Exists($script:cloudConfig)) {
    $resolvedCloudConfig = [System.IO.Path]::GetFullPath($script:cloudConfig)
    if ((Test-PathBeneath -Path $resolvedCloudConfig -Parent $script:tempRoot) -and [System.IO.Path]::GetFileName($resolvedCloudConfig).StartsWith('farmwebsite-plane-library-')) {
      Remove-Item -LiteralPath $resolvedCloudConfig -Recurse -Force
    }
  }
}
