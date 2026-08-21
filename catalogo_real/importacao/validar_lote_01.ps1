$ErrorActionPreference = 'Stop'
$base = 'C:\Users\kl\Documents\concorciov2\catalogo_real'
$fichas = Get-ChildItem -LiteralPath (Join-Path $base 'fichas') -Recurse -Filter '*.md'
$fotos = Get-ChildItem -LiteralPath (Join-Path $base 'fotos') -Recurse -File
$required = @('name:', 'price:', 'type:', 'category:', 'brand:', 'model:', 'year:', 'description:', 'specs:', 'imageUrls:')
$errors = New-Object System.Collections.Generic.List[string]
foreach ($ficha in $fichas) {
  $content = Get-Content -LiteralPath $ficha.FullName -Raw
  if (-not $content.StartsWith('---')) { $errors.Add("SEM_FRONT_MATTER: $($ficha.FullName)") }
  foreach ($field in $required) {
    if ($content -notmatch [regex]::Escape($field)) { $errors.Add("CAMPO_AUSENTE $field`: $($ficha.FullName)") }
  }
}
foreach ($foto in $fotos) {
  if ($foto.Length -le 0) { $errors.Add("FOTO_VAZIA: $($foto.FullName)") }
  if ($foto.Name -cnotmatch '^[a-z0-9_]+\.(jpg|jpeg|png|webp)$') { $errors.Add("NOME_INVALIDO: $($foto.FullName)") }
}
"FICHAS=$($fichas.Count)"
"FOTOS=$($fotos.Count)"
"ERROS=$($errors.Count)"
$errors
if ($errors.Count -gt 0) { exit 1 }
