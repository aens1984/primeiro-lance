# Licenças e créditos

O código do Primeiro Lance é distribuído sob GNU GPL versão 3, em [LICENSE](LICENSE). Componentes de terceiros conservam suas licenças.

| Componente | Uso | Licença / fontes |
| --- | --- | --- |
| Stockfish 19 | Motor de xadrez no Android | GPL v3; [projeto oficial](https://github.com/official-stockfish/Stockfish), [licença incluída](work/android/COPYING.txt). Fontes e rede correspondentes ao APK em `Stockfish-19-fontes.zip` na mesma Release; receita em `work/android/stockfish-build.ps1`. |
| chess.js | Regras e validação de lances | BSD de duas cláusulas; [licença](work/chess-LICENSE.txt). |
| PDF.js | Extração de PDFs | Apache 2.0; [licença](work/pdf-LICENSE.txt). |
| Tesseract.js / Tesseract | OCR local | Apache 2.0; [licença](work/tesseract-LICENSE.txt). Fontes: [Tesseract.js](https://github.com/naptha/tesseract.js), [Tesseract](https://github.com/tesseract-ocr/tesseract), [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast). |

Os avisos existentes nos arquivos de terceiros e as licenças incorporadas ao HTML devem ser preservados. Distribuições com Stockfish devem fornecer os fontes necessários para gerar o binário distribuído, incluindo eventuais alterações e rede NNUE usada. A chave privada de assinatura do APK não é distribuída.
