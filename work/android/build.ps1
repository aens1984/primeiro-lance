# Portable Android build. No administrator rights, Gradle, npm or Android Studio required.
# Keep .signing private: it is deliberately excluded from the source distribution.
param([string]$BuildDirectory='')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$projectDir = $PSScriptRoot
$outputDir = Split-Path $projectDir -Parent
if ((Split-Path $projectDir -Leaf) -ne 'fontes') { $outputDir = Join-Path (Split-Path (Split-Path $projectDir -Parent) -Parent) 'outputs/Android' }
$toolsDir = Join-Path $projectDir '.tools'
$buildDir = if($BuildDirectory) { [IO.Path]::GetFullPath($BuildDirectory) } else { Join-Path $projectDir '.build' }
$signDir = Join-Path $projectDir '.signing'
$sdkDir = Join-Path $toolsDir 'sdk'
New-Item -ItemType Directory -Force -Path $toolsDir,$buildDir,$signDir,$outputDir | Out-Null
Start-Transcript -Path (Join-Path $projectDir 'build.log') -Force | Out-Null

function Run-Tool([string]$Executable,[string[]]$Arguments) {
    & $Executable @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "A ferramenta falhou (codigo $LASTEXITCODE): $Executable" }
}
function Download-File([string]$Url,[string]$Destination,[string]$Sha256='') {
    if (!(Test-Path -LiteralPath $Destination)) {
        Write-Host ('Baixando ' + (Split-Path $Destination -Leaf) + '...')
        $partial=$Destination+'.partial'
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $partial -TimeoutSec 600 -Headers @{'User-Agent'='PrimeiroLance-Android-Build/1.0'}
        Move-Item -LiteralPath $partial -Destination $Destination -Force
    }
    if ($Sha256 -and ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $Sha256)) { throw "A verificacao do download falhou: $Destination. Remova esse arquivo e tente novamente." }
}
function Write-Utf8([string]$Path,[string]$Text) { [IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($false))) }
. (Join-Path $projectDir 'stockfish-build.ps1')

try {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (!(Test-Path -LiteralPath (Join-Path $projectDir 'assets/index.html'))) { throw 'Prepare a edicao web primeiro: node work/android/build-web.cjs, na raiz do projeto.' }
    Write-Host '1/6 - Preparando Java e ferramentas oficiais do Android.'
    $javaExe = Get-ChildItem -LiteralPath $toolsDir -Filter javac.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$javaExe) {
        $releases=Invoke-RestMethod -Uri 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse' -TimeoutSec 60
        $package=$releases[0].binary.package
        if (!$package.link -or !$package.checksum) { throw 'Nao foi possivel localizar o Java oficial da Eclipse Adoptium.' }
        $javaZip=Join-Path $toolsDir 'jdk21.zip'
        Download-File $package.link $javaZip $package.checksum
        Expand-Archive -LiteralPath $javaZip -DestinationPath (Join-Path $toolsDir 'java') -Force
        $javaExe=Get-ChildItem -LiteralPath (Join-Path $toolsDir 'java') -Filter javac.exe -Recurse | Select-Object -First 1
    }
    if (!$javaExe) { throw 'Java nao encontrado apos a extracao.' }
    $javaBin=$javaExe.DirectoryName
    $env:JAVA_HOME=Split-Path $javaBin -Parent
    $env:PATH=$javaBin+';'+$env:PATH
    $sdkManager=Join-Path $sdkDir 'cmdline-tools/latest/bin/sdkmanager.bat'
    if (!(Test-Path -LiteralPath $sdkManager)) {
        $cliZip=Join-Path $toolsDir 'android-command-tools.zip'
        Download-File 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' $cliZip '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
        Expand-Archive -LiteralPath $cliZip -DestinationPath (Join-Path $toolsDir 'command-tools') -Force
        New-Item -ItemType Directory -Force -Path (Join-Path $sdkDir 'cmdline-tools/latest') | Out-Null
        Copy-Item -Path (Join-Path $toolsDir 'command-tools/cmdline-tools/*') -Destination (Join-Path $sdkDir 'cmdline-tools/latest') -Recurse -Force
    }
    $sdkReady=Join-Path $sdkDir 'platforms/android-36/android.jar'
    $buildTools=Join-Path $sdkDir 'build-tools/36.0.0'
    if (!(Test-Path -LiteralPath $sdkReady) -or !(Test-Path -LiteralPath (Join-Path $buildTools 'aapt2.exe'))) {
        Write-Host 'A ferramenta oficial vai exibir as licencas do SDK. Leia e aceite somente se concordar.'
        Run-Tool $sdkManager @("--sdk_root=$sdkDir",'--licenses')
        Run-Tool $sdkManager @("--sdk_root=$sdkDir",'platforms;android-36','build-tools;36.0.0')
    }

    Write-Host '2/6 - Preparando Stockfish 19 para ARM64 e os fontes correspondentes.'
    $releaseCache=Join-Path $toolsDir 'stockfish-release.json'
    if(Test-Path -LiteralPath $releaseCache) { $release=Get-Content -LiteralPath $releaseCache -Raw | ConvertFrom-Json }
    else {
        $release=Invoke-RestMethod -Uri 'https://api.github.com/repos/official-stockfish/Stockfish/releases/tags/sf_19' -Headers @{'User-Agent'='PrimeiroLance-Android-Build/1.0'} -TimeoutSec 60
        Write-Utf8 $releaseCache ($release | ConvertTo-Json -Depth 30)
    }
    if($release.tag_name -ne 'sf_19') { throw 'Metadados do Stockfish nao correspondem a versao 19.' }
    $asset=$release.assets | Where-Object { $_.name -eq 'stockfish-android-arm64-universal.tar.gz' } | Select-Object -First 1
    if (!$asset) { throw 'A versao ARM64 do Stockfish 19 nao foi encontrada na publicacao oficial.' }
    $stockfishTar=Join-Path $toolsDir $asset.name
    $digest=''
    if ($asset.digest -like 'sha256:*') { $digest=$asset.digest.Substring(7) }
    Download-File $asset.browser_download_url $stockfishTar $digest
    if ((Get-Item -LiteralPath $stockfishTar).Length -ne $asset.size) { throw 'O download do Stockfish esta incompleto.' }
    $stockfishDir=Join-Path $toolsDir 'stockfish'
    New-Item -ItemType Directory -Force -Path $stockfishDir | Out-Null
    $sourceMarker=Join-Path $stockfishDir 'stockfish/src/Makefile'
    $binaryMarker=Join-Path $stockfishDir 'stockfish/stockfish-android-arm64-universal'
    if(!(Test-Path -LiteralPath $sourceMarker) -or !(Test-Path -LiteralPath $binaryMarker)) {
        Run-Tool 'tar.exe' @('-xzf',$stockfishTar,'-C',$stockfishDir)
    }
    $engineFile=Get-ChildItem -LiteralPath $stockfishDir -File -Recurse | Where-Object { $_.Name -eq 'stockfish-android-arm64-universal' } | Select-Object -First 1
    if (!$engineFile) { throw 'Executavel ARM64 nao encontrado no pacote oficial do Stockfish.' }
    $engineRoot=$engineFile.Directory.FullName
    $rebuilt=$false
    if (!(Test-StockfishElf $engineFile.FullName)) {
        Write-Host 'O motor oficial usa alinhamento antigo. Preparando recompilacao automatica...'
        $engineFile=Build-Stockfish16K $engineRoot $sdkDir $toolsDir $buildDir $sdkManager
        $rebuilt=$true
    }
    $sourceZip=Join-Path $outputDir 'Stockfish-19-fontes.zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    # Include the exact source tree and embedded network used for the rebuild.
    $sourceTemp=Join-Path $buildDir ('stockfish-fontes-'+[guid]::NewGuid().ToString('N')+'.zip')
    $sourceStamp=Join-Path $buildDir 'stockfish-fontes.sha256'
    $sourceHash=(Get-FileHash -LiteralPath $stockfishTar -Algorithm SHA256).Hash
    foreach($net in (Get-ChildItem -LiteralPath (Join-Path $engineRoot 'src') -Filter '*.nnue')) { $sourceHash+=':'+(Get-FileHash -LiteralPath $net.FullName -Algorithm SHA256).Hash }
    if(!(Test-Path -LiteralPath $sourceZip) -or !(Test-Path -LiteralPath $sourceStamp) -or [IO.File]::ReadAllText($sourceStamp) -ne $sourceHash) {
        [IO.Compression.ZipFile]::CreateFromDirectory($engineRoot,$sourceTemp,[IO.Compression.CompressionLevel]::Optimal,$false)
        Copy-Item -LiteralPath $sourceTemp -Destination $sourceZip -Force
        Write-Utf8 $sourceStamp $sourceHash
    }
    # The original binary distribution is retained too: includes its build files/networks.
    Copy-Item -LiteralPath $stockfishTar -Destination (Join-Path $outputDir $asset.name) -Force
    $license=Get-ChildItem -LiteralPath $stockfishDir -File -Recurse | Where-Object { $_.Name -in @('Copying.txt','COPYING','LICENSE') } | Select-Object -First 1
    if (!$license) { throw 'A licenca do Stockfish nao foi encontrada no pacote oficial.' }
    Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $projectDir 'assets/stockfish-license.txt') -Force
    Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $projectDir 'COPYING.txt') -Force
    Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $outputDir 'COPYING-Stockfish.txt') -Force

    Write-Host '3/6 - Compilando aplicativo e recursos.'
    $classes=Join-Path $buildDir 'classes'
    $dexDir=Join-Path $buildDir 'dex'
    New-Item -ItemType Directory -Force -Path $classes,$dexDir | Out-Null
    $javaSources=@((Join-Path $projectDir 'MainActivity.java'),(Join-Path $projectDir 'StockfishEngine.java'))
    $lambdaStubs=Join-Path $buildTools 'core-lambda-stubs.jar'
    if (!(Test-Path -LiteralPath $lambdaStubs)) { throw 'O SDK baixado nao contem os stubs de compilacao Java. Confira a instalacao de build-tools 36.0.0.' }
    Run-Tool (Join-Path $javaBin 'java.exe') (@((Join-Path $projectDir 'CompileAndroid.java'),$sdkReady,$lambdaStubs,$classes)+$javaSources)
    # Use an argument file to avoid command-line length limits and quote paths with spaces.
    # D8 argument files use one argument per line; quotation marks are literal.
    $dexInputs=Get-ChildItem -LiteralPath $classes -Filter '*.class' -Recurse | ForEach-Object { $_.FullName.Replace('\','/') }
    $dexArgs=Join-Path $buildDir 'dex-inputs.txt'
    Write-Utf8 $dexArgs ($dexInputs -join "`n")
    Run-Tool (Join-Path $buildTools 'd8.bat') @('--min-api','30','--lib',$sdkReady,'--output',$dexDir,('@'+$dexArgs))
    $compiledRes=Join-Path $buildDir 'resources.zip'
    Run-Tool (Join-Path $buildTools 'aapt2.exe') @('compile','--dir',(Join-Path $projectDir 'res'),'-o',$compiledRes)
    $unsigned=Join-Path $buildDir 'unsigned.apk'
    Run-Tool (Join-Path $buildTools 'aapt2.exe') @('link','-o',$unsigned,'-I',$sdkReady,'--manifest',(Join-Path $projectDir 'AndroidManifest.xml'),'--min-sdk-version','30','--target-sdk-version','36','-A',(Join-Path $projectDir 'assets'),$compiledRes)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $apk=[IO.Compression.ZipFile]::Open($unsigned,[IO.Compression.ZipArchiveMode]::Update)
    try {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,(Join-Path $dexDir 'classes.dex'),'classes.dex',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apk,$engineFile.FullName,'lib/arm64-v8a/libstockfish.so',[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    } finally { $apk.Dispose() }

    Write-Host '4/6 - Assinando com a chave privada local deste aplicativo.'
    $keyFile=Join-Path $signDir 'primeiro-lance.p12'
    $passwordFile=Join-Path $signDir 'password.txt'
    if (!(Test-Path -LiteralPath $keyFile)) {
        $random=New-Object byte[] 32
        $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        Write-Utf8 $passwordFile ([Convert]::ToBase64String($random))
        Run-Tool (Join-Path $javaBin 'keytool.exe') @('-genkeypair','-keystore',$keyFile,'-storetype','PKCS12','-storepass:file',$passwordFile,'-keypass:file',$passwordFile,'-alias','primeiro-lance','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Primeiro Lance, O=Uso pessoal, C=BR')
    }
    if (!(Test-Path -LiteralPath $passwordFile)) { throw 'A senha da chave local esta ausente. Restaure sua pasta .signing a partir do backup.' }
    $aligned=Join-Path $buildDir 'aligned.apk'
    Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-f','-P','16','4',$unsigned,$aligned)
    # Build to a staging name. Never replace a previous working APK with a failed build.
    $signed=Join-Path $buildDir 'signed.apk'
    # PKCS12 uses the store password for its key. Reading the same password file
    # twice makes apksigner expect a second line and fail with end-of-file.
    Run-Tool (Join-Path $buildTools 'apksigner.bat') @('sign','--ks',$keyFile,'--ks-key-alias','primeiro-lance','--ks-pass',('file:'+$passwordFile),'--out',$signed,$aligned)

    Write-Host '5/6 - Verificando assinatura, pacote e arquitetura.'
    Run-Tool (Join-Path $buildTools 'apksigner.bat') @('verify','--verbose','--print-certs',$signed)
    Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-c','-P','16','4',$signed)
    Run-Tool (Join-Path $buildTools 'aapt2.exe') @('dump','badging',$signed)

    Write-Host '6/6 - Guardando APK e fontes, sem incluir chaves ou dados privados.'
    $sourceStage=Join-Path $buildDir 'fontes-distribuicao'
    New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null
    foreach ($name in @('MainActivity.java','StockfishEngine.java','CompileAndroid.java','AndroidManifest.xml','android-runtime.js','landscape.css','landscape.js','build.ps1','stockfish-build.ps1','LEIA-ME.txt','COPYING.txt','assets','res')) { Copy-Item -LiteralPath (Join-Path $projectDir $name) -Destination $sourceStage -Recurse -Force }
    $ownSources=Join-Path $outputDir 'Primeiro-Lance-fontes.zip'
    $sourceArchive=Join-Path $buildDir ('fontes-'+[guid]::NewGuid().ToString('N')+'.zip')
    [IO.Compression.ZipFile]::CreateFromDirectory($sourceStage,$sourceArchive,[IO.Compression.CompressionLevel]::Optimal,$false)
    Copy-Item -LiteralPath $sourceArchive -Destination $ownSources -Force
    $finalApk=Join-Path $outputDir 'Primeiro-Lance.apk'
    Copy-Item -LiteralPath $signed -Destination $finalApk -Force
    $hash=(Get-FileHash -LiteralPath $finalApk -Algorithm SHA256).Hash
    Write-Utf8 (Join-Path $outputDir 'Primeiro-Lance.apk.sha256.txt') ($hash+'  Primeiro-Lance.apk')
    Write-Utf8 (Join-Path $outputDir 'Compilacao.txt') ("APK compilado e assinatura verificada em "+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+".`r`nARM64, Android 11 ou superior, alvo Android 16.`r`nAinda exige verificacao em aparelho fisico.`r`nSHA-256: "+$hash)
    Write-Host ('Concluido: '+$finalApk)
} catch {
    Write-Host ('FALHA: '+$_.Exception.Message) -ForegroundColor Red
    Stop-Transcript | Out-Null
    exit 1
}
Stop-Transcript | Out-Null
exit 0
