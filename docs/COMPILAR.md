# Como compilar

## Interface web

Instale Node.js 20 ou superior. Na raiz deste repositório:

```text
npm run build
```

Abra `outputs/Treinador-de-Xadrez.html` no navegador. O HTML incorpora as dependências e licenças. Isoladamente, usa o adversário básico; a biblioteca integrada e o Stockfish do celular pertencem à edição Android.

## Aplicativo Android

O gerador fornecido foi usado no Windows x64 e usa PowerShell, Java, Android SDK/NDK e Stockfish. As ferramentas oficiais são baixadas na primeira compilação; é necessário espaço em disco e conexão. Respeite os termos dos fornecedores e confira os scripts antes de executá-los.

```text
npm run prepare:android
```

Depois execute `outputs/Android/Gerar APK.cmd`. O arquivo `outputs/Android/fontes/build.ps1` baixa/prepara as ferramentas, gera Java/DEX/APK e verifica assinatura e alinhamento de 16 KB. O resultado fica em `outputs/Android/Primeiro-Lance.apk`.

A compilação cria uma **chave de assinatura própria** em `.signing/`. Guarde essa pasta em local privado e seguro; nunca publique seus arquivos. Um APK compilado por outra pessoa com outra chave não atualiza diretamente a instalação assinada pelo mantenedor.

O aplicativo inclui Stockfish 19, com fontes e rede de avaliação correspondentes. O script `stockfish-build.ps1` documenta a recompilação ARM64 para páginas de 16 KB. Os fontes e a receita devem acompanhar qualquer distribuição do motor. Nas Releases, `Stockfish-19-fontes.zip` acompanha o APK; a receita está neste repositório.

## Estrutura

- `work/template.html`: interface principal e lógica de xadrez.
- `work/build.cjs`: montagem do HTML autossuficiente.
- `work/board-3d.js`, `board-motion.js` e `board-sound.js`: visualização, movimentos e som.
- `work/bottom-menu.js` e `bottom-menu.css`: navegação móvel.
- `work/layout-editor.js` e `layout-editor.css`: editor de disposição.
- `work/android/`: aplicativo Android, ponte nativa e geração do pacote.
- `outputs/stockfish-support/`: parser PGN e regras usados na preparação dos exemplos.

As dependências da interface estão incluídas para permitir a montagem sem buscar pacotes durante o build. Os APKs e fontes grandes do motor são distribuídos em Releases, fora do histórico Git.
