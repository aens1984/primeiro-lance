# Build the unchanged Stockfish 19 sources with Android NDK r28c and 16 KB pages.
# The network remains embedded in the executable; no network access at app startup.
function Test-StockfishElf([string]$File) {
    $data=[IO.File]::ReadAllBytes($File)
    if($data.Length -lt 64 -or $data[0] -ne 127 -or $data[1] -ne 69 -or $data[2] -ne 76 -or $data[3] -ne 70 -or $data[4] -ne 2 -or $data[5] -ne 1 -or [BitConverter]::ToUInt16($data,18) -ne 183) { throw 'O motor nao e um ELF ARM64 valido.' }
    $offset=[BitConverter]::ToUInt64($data,32)
    $size=[BitConverter]::ToUInt16($data,54)
    $count=[BitConverter]::ToUInt16($data,56)
    if($size -lt 56 -or $count -eq 0 -or $offset+$size*$count -gt $data.Length) { throw 'Cabecalho ELF invalido.' }
    $loads=0
    for($i=0;$i -lt $count;$i++) {
        $at=[int]($offset+$i*$size);$type=[BitConverter]::ToUInt32($data,$at)
        if($type -eq 1) {
            $loads++
            $align=[BitConverter]::ToUInt64($data,($at+48))
            $fileOffset=[BitConverter]::ToUInt64($data,($at+8))
            $address=[BitConverter]::ToUInt64($data,($at+16))
            if($align -lt 16384 -or ($fileOffset % 16384) -ne ($address % 16384)) { return $false }
        }
        if($type -eq 1685382482) { # PT_GNU_RELRO
            $address=[BitConverter]::ToUInt64($data,($at+16))
            $memorySize=[BitConverter]::ToUInt64($data,($at+40))
            if(($address+$memorySize) % 16384 -ne 0) { return $false }
        }
    }
    return $loads -gt 0
}

function Build-Stockfish16K([string]$SourceRoot,[string]$SdkRoot,[string]$ToolsRoot,[string]$BuildRoot,[string]$SdkManager) {
    $ndkVersion='28.2.13676358'
    $ndkRoot=Join-Path $SdkRoot ('ndk/'+$ndkVersion)
    $llvm=Join-Path $ndkRoot 'toolchains/llvm/prebuilt/windows-x86_64'
    $compiler=Join-Path $llvm 'bin/clang++.exe'
    if(!(Test-Path -LiteralPath $compiler)) {
        Write-Host 'Baixando NDK r28c oficial para recompilar o motor (primeira vez apenas)...'
        Run-Tool $SdkManager @("--sdk_root=$SdkRoot",('ndk;'+$ndkVersion))
    }
    if(!(Test-Path -LiteralPath $compiler)) { throw 'O compilador NDK nao foi encontrado apos a instalacao.' }
    $src=Join-Path $SourceRoot 'src'
    $header=[IO.File]::ReadAllText((Join-Path $src 'evaluate.h'))
    $networkMatch=[regex]::Match($header,'#define\s+EvalFileDefaultName\s+"(nn-([a-f0-9]{12})\.nnue)"')
    if(!$networkMatch.Success) { throw 'Rede NNUE padrao nao reconhecida nos fontes oficiais.' }
    $networkName=$networkMatch.Groups[1].Value
    $network=Join-Path $src $networkName
    if(!(Test-Path -LiteralPath $network)) {
        Write-Host 'Baixando a rede de avaliacao oficial do Stockfish...'
        try { Download-File ('https://tests.stockfishchess.org/api/nn/'+$networkName) $network }
        catch { Download-File ('https://github.com/official-stockfish/networks/raw/master/'+$networkName) $network }
    }
    $networkHash=(Get-FileHash -LiteralPath $network -Algorithm SHA256).Hash.ToLowerInvariant()
    if(!$networkHash.StartsWith($networkMatch.Groups[2].Value)) { throw 'A rede NNUE nao passou na verificacao de integridade.' }
    $target=Join-Path $BuildRoot 'stockfish-19-arm64-16k'
    $stamp=$target+'.recipe'
    $recipeHash=(Get-FileHash -LiteralPath (Join-Path $projectDir 'stockfish-build.ps1') -Algorithm SHA256).Hash
    if((Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $stamp)) {
        if(([IO.File]::ReadAllText($stamp) -eq ($recipeHash+':'+$networkHash)) -and (Test-StockfishElf $target)) { return Get-Item -LiteralPath $target }
    }
    $makefile=[IO.File]::ReadAllText((Join-Path $src 'Makefile'))
    $sourceBlock=[regex]::Match($makefile,'(?ms)^SRCS = (.*?)(?:\r?\n\r?\n)')
    if(!$sourceBlock.Success) { throw 'Lista de fontes nao reconhecida no Makefile oficial.' }
    $sources=($sourceBlock.Groups[1].Value -replace '\\\r?\n',' ') -split '\s+' | Where-Object {$_}
    if($sources.Count -lt 20 -or ($sources | Where-Object {$_ -notmatch '^[a-zA-Z0-9_./-]+\.cpp$'})) { throw 'Lista de fontes do motor invalida.' }
    $compileFlags=@('--target=aarch64-linux-android30',('--sysroot='+((Join-Path $llvm 'sysroot').Replace('\','/'))),'-std=c++17','-O3','-funroll-loops','-fno-exceptions','-DNDEBUG','-DIS_64BIT','-DUSE_POPCNT','-DUSE_NEON=8','-fPIE','-pthread','-stdlib=libc++','-static-libstdc++','-pie','-Wl,-z,max-page-size=16384','-Wl,-z,common-page-size=16384','-Wl,-z,relro','-Wl,-z,now','-s','-I.','-o',$target.Replace('\','/'))
    $response=Join-Path $BuildRoot 'stockfish-compile.rsp'
    $arguments=@($compileFlags)+@($sources)
    Write-Utf8 $response (($arguments | ForEach-Object {'"'+$_.Replace('\','/')+'"'}) -join "`n")
    Write-Host ('Recompilando Stockfish 19 ARM64 com alinhamento de 16 KB ('+$sources.Count+' arquivos)...')
    Push-Location $src
    try { Run-Tool $compiler @('@'+$response) } finally { Pop-Location }
    if(!(Test-StockfishElf $target)) { throw 'O motor recompilado nao passou nas verificacoes ELF de 16 KB e RELRO.' }
    Run-Tool (Join-Path $llvm 'bin/llvm-readelf.exe') @('--program-headers','--wide',$target)
    Write-Utf8 $stamp ($recipeHash+':'+$networkHash)
    Write-Host 'Stockfish recompilado e alinhamento de 16 KB confirmado.'
    return Get-Item -LiteralPath $target
}
