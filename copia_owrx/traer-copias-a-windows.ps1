# Trae al Windows las copias más recientes del servidor OpenWebRX+ (EA7CL), para tenerlas
# fuera del servidor por si falla el equipo entero:
#   - la última copia_owrx (copia-FECHA.tar.gz) con restaurar.sh y la carpeta paquetes/ (.deb)
#   - la última copia diaria completa del segundo disco (servidor-FECHA.tar.gz)
# Se guardan en Documentos\copias-servidor-owrx y se conservan las 5 últimas de cada tipo.
# OJO: llevan la configuración del receptor (usuarios, contraseñas cifradas, claves):
#      no las subas a git ni las compartas.
# Uso (PowerShell):  powershell -ExecutionPolicy Bypass -File copia_owrx\traer-copias-a-windows.ps1
param(
    [string]$Servidor = 'openwebrx',
    [string]$Destino = "$env:USERPROFILE\Documents\copias-servidor-owrx",
    [int]$Guardar = 5
)
$ErrorActionPreference = 'Stop'
$BASE = '/home/ea7cl/owrx-personalizado'
$DIARIAS = '/mnt/copias/copias-servidor/diarias'
New-Item -ItemType Directory -Force "$Destino\copia_owrx", "$Destino\diarias" | Out-Null

function Remoto([string]$orden) { $r = & ssh -o BatchMode=yes $Servidor $orden; if ($LASTEXITCODE) { throw "Falla en el servidor: $orden" }; $r }
function Huella([string]$archivo) { (Get-FileHash -Algorithm SHA256 $archivo).Hash.ToLower() }

# 1) copia_owrx: la más reciente, sus instrucciones y los .deb para reinstalar la misma versión
$copia = Remoto "ls -1t $BASE/copia-*.tar.gz | head -1"
$nombre = Split-Path $copia -Leaf
if (Test-Path "$Destino\copia_owrx\$nombre") { Write-Host "Ya estaba: $nombre" }
else {
    & scp -q -o BatchMode=yes "${Servidor}:$copia" "$Destino\copia_owrx\"
    if ((Huella "$Destino\copia_owrx\$nombre") -ne ((Remoto "sha256sum $copia") -split ' ')[0]) { throw "La copia $nombre ha llegado mal" }
    Write-Host "Traída: $nombre"
}
& scp -q -o BatchMode=yes "${Servidor}:$BASE/LEEME.txt" "${Servidor}:$BASE/restaurar.sh" "$Destino\copia_owrx\"
& scp -q -r -o BatchMode=yes "${Servidor}:$BASE/paquetes" "$Destino\copia_owrx\"

# 2) copia diaria completa (es de root: se saca por /tmp con una copia temporal)
$diaria = Remoto "sudo -n ls -1t $DIARIAS/servidor-*.tar.gz | head -1"
$nombre = Split-Path $diaria -Leaf
if (Test-Path "$Destino\diarias\$nombre") { Write-Host "Ya estaba: $nombre" }
else {
    $tmp = "/tmp/traer-$nombre"
    Remoto "sudo -n cp $diaria $tmp && sudo -n chown `$(id -u) $tmp && chmod 600 $tmp" | Out-Null
    try {
        & scp -q -o BatchMode=yes "${Servidor}:$tmp" "$Destino\diarias\$nombre"
        if ((Huella "$Destino\diarias\$nombre") -ne ((Remoto "sha256sum $tmp") -split ' ')[0]) { throw "La copia $nombre ha llegado mal" }
    } finally { Remoto "rm -f $tmp" | Out-Null }
    Write-Host "Traída: $nombre"
}
& scp -q -o BatchMode=yes "${Servidor}:/mnt/copias/copias-servidor/LEEME.txt" "$Destino\diarias\LEEME.txt"

# 3) conservar solo las últimas
foreach ($d in 'copia_owrx\copia-*.tar.gz', 'diarias\servidor-*.tar.gz') {
    Get-ChildItem "$Destino\$d" | Sort-Object Name -Descending | Select-Object -Skip $Guardar | Remove-Item
}
Write-Host ""
Get-ChildItem $Destino -Recurse -File -Filter *.tar.gz | Sort-Object FullName |
    ForEach-Object { '{0,8:N1} MB  {1}' -f ($_.Length / 1MB), $_.FullName.Substring($Destino.Length + 1) }
Write-Host "Copias en $Destino"
