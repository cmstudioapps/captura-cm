# Contribuindo com captura-cm

Este documento reúne instruções para desenvolver e publicar a biblioteca. Para instalação e uso da API, consulte o [README](./README.md).

## Requisitos

- Node.js 18.8 ou superior para executar a suíte de testes.
- Nenhuma dependência de runtime ou de build.
- Navegador moderno para validar os exemplos manualmente.

## Estrutura do projeto

```text
captura-cm/
├── index.html         # redireciona para a página de testes
├── src/
│   ├── index.js       # API pública (captura.camera e captura.tela)
│   ├── camera.js      # sessão de câmera, alternância, frames e encerramento
│   ├── tela.js        # sessão de captura de tela, frames e encerramento
│   ├── formatos.js    # validação, canvas, conversão e redimensionamento
│   └── midia.js       # utilitários internos de DOM, mídia e ciclo de vida
├── exemplos/
│   ├── index.html     # página com câmera e captura de tela
│   ├── camera.html
│   └── tela.html
├── test/
│   ├── apoio.js
│   └── captura.test.js
├── package.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

`midia.js` concentra a lógica interna compartilhada por câmera e tela: criação de `<video>`, resolução de contêiner, reprodução, observação do fim das faixas e limpeza. Ele não faz parte da API pública.

## Testes

```sh
npm test
```

A suíte usa o test runner nativo do Node.js (Node.js 18.8 ou superior) e APIs de mídia simuladas. Ela cobre:

- Validação de opções, formatos, qualidade e dimensões.
- Cálculo de dimensões proporcionais, contidas e com distorção.
- Chamadas antes da inicialização.
- Erros de permissão, contexto inseguro e APIs ausentes.
- Criação de vídeo, áudio padrão, seleção frontal/traseira, captura sem preview e restrições.
- Alternância de câmera com APIs simuladas, incluindo falha e câmera única.
- Encerramento, reinicialização, cancelamento e concorrência.
- Todos os tipos de retorno: `Blob`, Base64, Data URL, `ArrayBuffer`, `Uint8Array`, `ImageBitmap` e canvas.
- Sessões independentes de câmera e tela.
- Encerramento automático quando a faixa de tela termina.

A suíte automatizada usa APIs simuladas. Validação com câmera física, permissões reais do navegador e captura real de tela deve ser feita manualmente em um navegador com HTTPS ou localhost.

## Executando os exemplos

```sh
python3 -m http.server 8080
```

Abra:

- `http://localhost:8080/` — redireciona para a página de testes.
- `http://localhost:8080/exemplos/index.html` — testa câmera e tela na mesma página.
- `http://localhost:8080/exemplos/camera.html`
- `http://localhost:8080/exemplos/tela.html`

Para a captura de tela, use uma aba normal do navegador. IDEs, previews embutidos e iframes podem bloquear `getDisplayMedia()`.

## Publicação

O pacote é ESM e não tem etapa de build: os arquivos de `src/` são publicados diretamente.

```sh
npm pack --dry-run
npm publish
```

O pacote inclui `src/`, `exemplos/`, `README.md`, `CONTRIBUTING.md` e `LICENSE`.

## Autor

Caio MUltiversando.

## Licença

MIT. Consulte [LICENSE](./LICENSE).
