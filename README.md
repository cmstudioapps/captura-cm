# captura-cm

Biblioteca JavaScript **frontend**, leve e sem dependências, para **captura de câmera**, **captura de tela** e **extração de frames** em navegadores modernos.

A API é dividida em dois módulos independentes:

- `captura.camera` — abre a câmera, alterna entre frontal e traseira, captura frames e encerra a sessão.
- `captura.tela` — usa `getDisplayMedia()` para compartilhar tela, janela ou aba, captura frames e encerra a sessão.

Os dois módulos podem ser usados ao mesmo tempo, pois mantêm sessões separadas.

```js
import captura from 'captura-cm'

await captura.camera.iniciar({ elemento: '#camera' })

const png = await captura.camera.frame()
```

## Recursos

- JavaScript puro, ESM, sem TypeScript e sem dependências externas.
- Captura do frame mais recente diretamente do `<video>`, sem gravação prévia e sem histórico.
- Formatos de saída: `Blob`, PNG, JPEG, WebP, Base64, Data URL, `ArrayBuffer`, `Uint8Array`, `ImageBitmap` e `HTMLCanvasElement`.
- Redimensionamento com preservação de proporção por padrão.
- Sessões independentes para câmera e tela.
- Encerramento automático quando o usuário interrompe o compartilhamento de tela no navegador.
- Liberação de faixas de mídia, elementos de vídeo e recursos internos de canvas.
- Validação de opções e erros descritivos, preservando o `name` e a `causa` originais dos erros de mídia.
- Sem mecanismos de captura oculta e sem tentativa de contornar permissões do navegador.

## Requisitos

- Navegador moderno com suporte a `navigator.mediaDevices.getUserMedia()` e/ou `navigator.mediaDevices.getDisplayMedia()`.
- Contexto seguro: **HTTPS** ou **localhost**. Em `http://` fora de localhost, o navegador normalmente bloqueia o acesso à câmera e à tela.
- Permissão explícita do usuário para câmera, microfone (quando `audio: true`) e compartilhamento de tela.
- A captura de tela sempre depende da interface do navegador para o usuário escolher a fonte e autorizar.

Navegadores modernos como Chrome, Edge, Firefox e Safari suportam as APIs principais. A disponibilidade de áudio em `getDisplayMedia()`, da codificação WebP e de `createImageBitmap()` varia conforme navegador, sistema operacional e dispositivo. A biblioteca verifica a disponibilidade e lança `NotSupportedError` quando o recurso não existe.

## Instalação

```sh
npm install captura-cm
```

O pacote é **somente ESM**:

```js
import captura from 'captura-cm'
```

Também é possível importar os módulos nomeados:

```js
import { camera, tela } from 'captura-cm'
```

O objeto padrão é congelado e expõe `camera` e `tela`.

## Como usar no navegador

A biblioteca é **somente ESM**. Não existe build UMD/IIFE pronto, então um `<script src="...">` comum não funciona. Use uma das opções abaixo.

### 1. Com bundler (recomendado)

Funciona com Vite, webpack, Rollup, Parcel, esbuild, Next.js e similares:

```sh
npm install captura-cm
```

```js
import captura from 'captura-cm'
```

O bundler resolve o especificador `captura-cm` e empacota `src/index.js` e seus imports relativos.

### 2. Sem bundler, com import map

O navegador não resolve sozinho o especificador `captura-cm`. Use um import map para apontar para o arquivo real. Sirva também a pasta `node_modules` (ou copie `node_modules/captura-cm/src` para uma pasta pública):

```html
<script type="importmap">
{
  "imports": {
    "captura-cm": "/node_modules/captura-cm/src/index.js"
  }
}
</script>

<script type="module">
  import captura from 'captura-cm'

  await captura.camera.iniciar({ elemento: '#camera' })
</script>
```

### 3. Sem bundler, importando a URL do arquivo

Se a pasta `src` do pacote for copiada para o projeto:

```html
<script type="module">
  import captura from './captura-cm/src/index.js'
</script>
```

Também funciona apontando diretamente para o caminho servido:

```js
import captura from '/node_modules/captura-cm/src/index.js'
```

### 4. Via CDN (depois de publicar o pacote)

```html
<script type="module">
  import captura from 'https://esm.sh/captura-cm@1.0.0'
</script>
```

ou, servindo os módulos originais:

```html
<script type="module">
  import captura from 'https://cdn.jsdelivr.net/npm/captura-cm@1.0.0/src/index.js'
</script>
```

### Sobre os exemplos

Os exemplos usam `../src/index.js` porque fazem parte do próprio pacote. Em um projeto consumidor, importe `'captura-cm'` (com bundler/import map) ou a URL do arquivo servido. O restante do código dos exemplos é o mesmo.

## Início rápido

Exemplo com bundler/import map (veja a seção anterior para usar sem bundler):

```html
<div id="camera"></div>
<button id="iniciar" type="button">Iniciar câmera</button>
<button id="capturar" type="button" disabled>Capturar frame</button>

<script type="module">
  import captura from 'captura-cm'

  const botaoIniciar = document.querySelector('#iniciar')
  const botaoCapturar = document.querySelector('#capturar')

  botaoIniciar.addEventListener('click', async () => {
    try {
      await captura.camera.iniciar({
        elemento: '#camera',
        camera: 'traseira'
      })

      botaoIniciar.disabled = true
      botaoCapturar.disabled = false
    } catch (erro) {
      console.error(erro)
    }
  })

  botaoCapturar.addEventListener('click', async () => {
    try {
      const blob = await captura.camera.frame()
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = 'frame.png'
      link.click()

      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (erro) {
      console.error(erro)
    }
  })
</script>
```

## Captura sem exibir o vídeo

Não é obrigatório exibir o preview. O `<video>` continua existindo internamente porque é ele que decodifica os quadros, mas não é inserido na página.

```js
// Câmera sem preview
await captura.camera.iniciar({ camera: 'traseira' })
const pngCamera = await captura.camera.frame()
captura.camera.parar()

// Tela sem preview
await captura.tela.iniciar()
const pngTela = await captura.tela.frame()
captura.tela.parar()
```

Nos dois casos, `frame()`, `alternar()` (câmera) e `parar()` funcionam normalmente. Na câmera, `iniciar()` sem argumentos também funciona: usa a câmera traseira e não exibe preview. O retorno `video` continua sendo um `<video>` real; para exibi-lo depois, anexe o elemento a um contêiner.

A página `exemplos/index.html` inclui os botões **Iniciar sem preview** e **Compartilhar sem preview**.

Isso não é uma captura invisível para o usuário: o navegador continua exigindo autorização e mostrando os indicadores de câmera/tela em uso. A biblioteca não contorna permissões.

## API pública

```js
import captura from 'captura-cm'

captura.camera
captura.tela
```

### `captura.camera.iniciar(opcoes)`

Abre a câmera. Com `elemento`, insere um `<video>` no contêiner informado. Sem `elemento`, mantém o vídeo interno e a captura funciona sem preview.

```js
const { video, stream } = await captura.camera.iniciar({
  elemento: '#camera',
  camera: 'traseira',
  largura: 1280,
  altura: 720,
  audio: false
})
```

#### Parâmetros

| Opção | Tipo | Obrigatório | Padrão | Descrição |
| --- | --- | --- | --- | --- |
| `elemento` | `string \| HTMLElement` | não | — | Seletor CSS ou elemento que receberá o `<video>`. Se omitido, o vídeo fica interno e não é exibido. |
| `camera` | `'frontal' \| 'traseira'` | não | `'traseira'` | Câmera preferida. O valor é comparado sem diferenciar maiúsculas/minúsculas. |
| `largura` | `number` | não | — | Largura preferida, inteira e maior que zero. Usada como `width: { ideal }`. |
| `altura` | `number` | não | — | Altura preferida, inteira e maior que zero. Usada como `height: { ideal }`. |
| `audio` | `boolean` | não | `false` | Solicita áudio ao dispositivo. O vídeo de prévia da câmera permanece mutado para evitar realimentação. |

#### Retorno

`Promise<{ video: HTMLVideoElement, stream: MediaStream }>`

- `video`: elemento criado/reutilizado pela sessão. Se `elemento` for omitido, ele não está inserido na página.
- `stream`: fluxo de mídia da sessão.

O `<video>` recebe `autoplay`, `playsinline` e `muted`, além dos atributos `data-captura-cm="camera"` e da classe `captura-cm-video`.

#### Comportamento

- Usa `navigator.mediaDevices.getUserMedia()`.
- Com `elemento`, cria e insere um `<video>` no contêiner.
- Sem `elemento`, cria e mantém o `<video>` internamente, sem preview na página.
- Para `camera: 'frontal'`, usa `facingMode: { ideal: 'user' }`.
- Para `camera: 'traseira'`, usa `facingMode: { ideal: 'environment' }`.
- Não pressupõe que o dispositivo tenha duas câmeras.
- Aguarda o primeiro quadro disponível antes de resolver a Promise, com limite de 10 segundos.
- Se já houver uma sessão ativa, ela é encerrada antes de abrir a nova.
- Se `elemento` for um `<video>` existente, ele é usado diretamente e **não** é removido por `parar()`.
- Se a inicialização falhar, o fluxo e o `<video>` criados são liberados.

### `captura.camera.alternar()`

Alterna manualmente entre frontal e traseira.

```js
await captura.camera.alternar()
```

#### Retorno

`Promise<{ video: HTMLVideoElement, stream: MediaStream }>`

#### Comportamento

- Exige uma sessão ativa; caso contrário, rejeita com `InvalidStateError`.
- Encerra a faixa de vídeo anterior antes de solicitar a câmera oposta.
- Reutiliza o mesmo `<video>` e o mesmo contêiner.
- Se o navegador devolver a mesma câmera (por exemplo, dispositivo com apenas uma câmera), rejeita com `NotFoundError`.
- Se a solicitação falhar, a sessão é encerrada e o `<video>` criado pela biblioteca é removido.
- Não faz alternância automática.

### `captura.camera.frame(opcoes)`

Captura o frame mais recente disponível no vídeo naquele momento.

```js
const png = await captura.camera.frame()

const jpeg = await captura.camera.frame({
  formato: 'jpeg',
  qualidade: 0.8
})
```

#### Parâmetros

| Opção | Tipo | Padrão | Descrição |
| --- | --- | --- | --- |
| `formato` | `string` | `'blob'` | Formato de saída. Veja a tabela de formatos. |
| `tipo` | `'png' \| 'jpeg' \| 'jpg' \| 'webp'` | `'png'` | Codificação da imagem para formatos codificados. Não se aplica a `bitmap` e `canvas`. |
| `qualidade` | `number` | — | Número entre `0` e `1`, aplicável a JPEG e WebP. Em PNG é validado, mas não altera a codificação. |
| `largura` | `number` | — | Largura final desejada, inteira e maior que zero. |
| `altura` | `number` | — | Altura final desejada, inteira e maior que zero. |
| `permitirDistorcao` | `boolean` | `false` | Quando `largura` e `altura` são informadas, permite usar exatamente essas dimensões, mesmo alterando a proporção. |

#### Comportamento

- Lança `InvalidStateError` se a câmera não estiver ativa.
- Lança `InvalidStateError` se o vídeo ainda não tiver um quadro ou dimensões válidas.
- Desenha o quadro atual em um canvas interno.
- Para `canvas`, devolve o próprio canvas, sem codificar a imagem.
- Para `bitmap`, usa `createImageBitmap()` de verdade.
- Operações concorrentes recebem canvases distintos; um canvas nunca é mutado por duas capturas ao mesmo tempo.
- Não grava vídeo e não mantém histórico de frames.

### `captura.camera.parar()`

Encerra a sessão de câmera.

```js
const haviaSessao = captura.camera.parar()
```

#### Retorno

`boolean` — `true` se havia uma sessão para encerrar; `false` caso contrário.

#### Comportamento

- Interrompe todas as faixas de mídia pertencentes à sessão.
- Libera o dispositivo.
- Pausa o vídeo, remove `srcObject` e remove do contêiner **somente** o `<video>` criado pela biblioteca.
- Não remove outros elementos do contêiner.
- Permite uma nova inicialização posterior.
- Se chamado durante uma inicialização em andamento, cancela a operação: a Promise pendente é rejeitada e os recursos obtidos são liberados.

### `captura.camera.ativa()`

```js
if (captura.camera.ativa()) {
  // ...
}
```

Retorna `true` somente quando a sessão existe e ainda possui uma faixa de vídeo ativa. Retorna `false` antes da inicialização ou depois de `parar()`.

## API de captura de tela

### `captura.tela.iniciar(opcoes)`

Solicita ao usuário uma tela, janela ou aba por meio de `navigator.mediaDevices.getDisplayMedia()`.

```js
const { video, stream } = await captura.tela.iniciar({
  elemento: '#tela',
  audio: false
})
```

#### Parâmetros

| Opção | Tipo | Obrigatório | Padrão | Descrição |
| --- | --- | --- | --- | --- |
| `elemento` | `string \| HTMLElement` | não | — | Contêiner onde o `<video>` será exibido. Se omitido, o vídeo é mantido internamente, sem ser inserido na página. |
| `audio` | `boolean` | não | `false` | Solicita áudio do compartilhamento. O suporte depende do navegador e da fonte escolhida. |

#### Retorno

`Promise<{ video: HTMLVideoElement, stream: MediaStream }>`

#### Comportamento

- A escolha da fonte e a autorização são sempre controladas pelo navegador.
- Sem `elemento`, o vídeo é criado e mantido internamente, sem visualização na página.
- Com `elemento`, o vídeo é inserido no contêiner e recebe `data-captura-cm="tela"`.
- O vídeo de prévia é mutado quando `audio: false`; com `audio: true`, ele não é mutado.
- Se já houver uma sessão ativa, ela é encerrada antes de abrir a nova.
- Aguarda o primeiro quadro disponível, com limite de 10 segundos.
- Se o usuário interromper o compartilhamento pela interface do navegador, a sessão é encerrada automaticamente e `ativa()` passa a retornar `false`.
- Em caso de falha, o fluxo e o `<video>` criados são liberados.

### `captura.tela.frame(opcoes)`

Usa o mesmo sistema de conversão de `captura.camera.frame()`, com os mesmos formatos, validações e opções.

```js
const png = await captura.tela.frame()
const jpeg = await captura.tela.frame({ formato: 'jpeg', qualidade: 0.8 })
const bitmap = await captura.tela.frame({ formato: 'bitmap', largura: 640 })
```

Lançará `InvalidStateError` se a captura de tela não estiver ativa.

### `captura.tela.parar()`

Encerra a captura de tela, interrompe as faixas e remove o vídeo criado pela biblioteca.

Retorna `boolean`, indicando se havia uma sessão para encerrar.

### `captura.tela.ativa()`

Retorna `true` somente quando a sessão de tela existe e ainda possui uma faixa de vídeo ativa.

## Formatos de saída

Os formatos abaixo são aceitos por `camera.frame()` e `tela.frame()`.

| `formato` | Retorno | Codificação |
| --- | --- | --- |
| `'blob'` (padrão) | `Blob` | PNG por padrão; pode ser alterada com `tipo`. |
| `'png'` | `Blob` | `image/png` |
| `'jpeg'` ou `'jpg'` | `Blob` | `image/jpeg` |
| `'webp'` | `Blob` | `image/webp` |
| `'base64'` | `string` | Somente a string Base64, sem o prefixo `data:image/...`. |
| `'dataURL'` ou `'data-url'` | `string` | Data URL completa, incluindo o prefixo. |
| `'arrayBuffer'` ou `'array-buffer'` | `ArrayBuffer` | Bytes da imagem codificada. |
| `'buffer'` | `Uint8Array` | Bytes da imagem codificada. Não é o `Buffer` do Node.js. |
| `'bitmap'` | `ImageBitmap` | Bitmap real, criado com `createImageBitmap()`. |
| `'canvas'` | `HTMLCanvasElement` | Canvas real com o frame desenhado. |

### Exemplos de todos os formatos

```js
// Blob PNG (padrão)
const png = await captura.camera.frame()

// Blob JPEG com qualidade
const jpeg = await captura.camera.frame({
  formato: 'jpeg',
  qualidade: 0.8
})

// Blob WebP
const webp = await captura.camera.frame({
  formato: 'webp',
  qualidade: 0.8
})

// String Base64 sem prefixo
const base64 = await captura.camera.frame({
  formato: 'base64'
})

// Base64 de uma imagem JPEG
const base64Jpeg = await captura.camera.frame({
  formato: 'base64',
  tipo: 'jpeg',
  qualidade: 0.8
})

// Data URL completa
const dataURL = await captura.camera.frame({
  formato: 'dataURL'
})

// ArrayBuffer
const arrayBuffer = await captura.camera.frame({
  formato: 'arrayBuffer'
})

// Uint8Array (não é Buffer do Node.js)
const bytes = await captura.camera.frame({
  formato: 'buffer'
})

// ImageBitmap real
const bitmap = await captura.camera.frame({
  formato: 'bitmap',
  largura: 320
})

// bitmap é um recurso gráfico; libere quando terminar
bitmap.close()

// Canvas real
const canvas = await captura.camera.frame({
  formato: 'canvas',
  largura: 320
})

document.body.appendChild(canvas)
```

### `tipo` e `qualidade`

- `tipo` escolhe a codificação da imagem: `'png'`, `'jpeg'` ou `'webp'`.
- `tipo` só é válido para formatos codificados (`blob`, `base64`, `dataURL`, `arrayBuffer`, `buffer`).
- Para `bitmap` e `canvas`, informar `tipo` gera `TypeError`.
- Usar `formato: 'jpeg'` é equivalente a `formato: 'blob', tipo: 'jpeg'`.
- Não combine `formato` de imagem com um `tipo` diferente; isso gera `TypeError`.
- `qualidade` deve estar entre `0` e `1`. É aplicada apenas a JPEG e WebP; em PNG é validada, mas não altera a codificação.

## Redimensionamento

Sem `largura` e `altura`, o frame mantém as dimensões originais do vídeo.

Com apenas uma dimensão, a outra é calculada proporcionalmente:

```js
// Vídeo 640×480
await captura.camera.frame({ formato: 'canvas', largura: 320 })
// Canvas 320×240
```

Com as duas dimensões e `permitirDistorcao: false` (padrão), a imagem é ajustada dentro da caixa solicitada preservando a proporção. O resultado pode ser menor que a caixa em um dos eixos:

```js
await captura.camera.frame({
  formato: 'canvas',
  largura: 100,
  altura: 100
})
// Canvas 100×75 para um vídeo 4:3
```

Com `permitirDistorcao: true`, as dimensões pedidas são usadas exatamente:

```js
await captura.camera.frame({
  formato: 'canvas',
  largura: 100,
  altura: 100,
  permitirDistorcao: true
})
// Canvas 100×100
```

A biblioteca permite ampliar a imagem. Se forem solicitadas dimensões maiores que o vídeo, o frame será escalado para cima.

## Erros

A biblioteca usa erros com `name`, `message` e, quando aplicável, `causa` com o erro original do navegador.

| `name` | Quando ocorre |
| --- | --- |
| `TypeError` | Opções com tipo inválido, formato desconhecido, `tipo` incompatível, `permitirDistorcao` não booleano. |
| `RangeError` | Dimensões não inteiras/≤ 0 ou `qualidade` fora de `0..1`. |
| `InvalidStateError` | `frame()`/`alternar()` antes de `iniciar()`, vídeo sem quadro/dimensões, operação simultânea ou operação cancelada por `parar()`. |
| `NotSupportedError` | API indisponível, WebP não suportado, `createImageBitmap()` ausente ou canvas sem suporte a `toBlob()`/`toDataURL()`. |
| `SecurityError` | Contexto inseguro (`isSecureContext === false`). |
| `NotFoundError` | Seletor CSS sem elemento correspondente, nenhum dispositivo compatível ou câmera oposta indisponível. |
| `SyntaxError` | Seletor CSS inválido passado em `elemento`. |
| `NotAllowedError` | Permissão negada ou seleção de tela cancelada pelo usuário. |
| `NotReadableError` | Dispositivo em uso ou impossível de iniciar. |
| `OverconstrainedError` | Restrições de mídia não suportadas pelo dispositivo. |
| `TimeoutError` | O vídeo não ficou pronto em 10 segundos. |
| `MediaError` | O elemento `<video>` falhou ao carregar a transmissão. |

Exemplo de tratamento:

```js
try {
  await captura.camera.iniciar({ elemento: '#camera' })
  const frame = await captura.camera.frame({ formato: 'jpeg', qualidade: 0.8 })
  console.log(frame.type, frame.size)
} catch (erro) {
  if (erro.name === 'NotAllowedError') {
    console.warn('O usuário não autorizou a câmera.')
  } else if (erro.name === 'SecurityError') {
    console.warn('A página precisa de HTTPS ou localhost.')
  } else {
    console.error(erro.name, erro.message, erro.causa)
  }
}
```

## Limitações conhecidas

- A biblioteca captura **frames**, não grava vídeo ou áudio.
- Não existe reprodução, edição, filtro ou processamento de áudio.
- A resolução de câmera é uma preferência (`ideal`); o navegador/dispositivo pode entregar outra resolução.
- `alternar()` pode falhar em dispositivos com uma única câmera. Nesse caso, a sessão é encerrada e o erro é rejeitado.
- Em alguns dispositivos móveis, abrir a câmera oposta imediatamente após encerrar a faixa anterior pode falhar. A sessão anterior já terá sido liberada.
- A captura de tela depende do suporte e da interface do navegador. Em muitos navegadores móveis, `getDisplayMedia()` não está disponível ou é limitado.
- O áudio em `getDisplayMedia()` não é suportado por todos os navegadores/fontes. Pedir `audio: true` pode fazer a chamada falhar.
- Na câmera, `audio: true` também exige um microfone disponível e autorizado; se ele não existir, a inicialização pode falhar mesmo com a câmera disponível.
- Com `audio: true`, o vídeo de prévia da tela não é mutado. Se a política de reprodução automática do navegador bloquear a reprodução, a inicialização falha com uma mensagem clara.
- A prévia da câmera é sempre mutada, mesmo com `audio: true`, para evitar realimentação de áudio. A faixa de áudio ainda é solicitada e fica disponível no `stream` retornado.
- `ImageBitmap` devolvido por `frame({ formato: 'bitmap' })` deve ser liberado pelo consumidor com `bitmap.close()`.
- O `HTMLCanvasElement` devolvido por `frame({ formato: 'canvas' })` pertence ao consumidor e não é reutilizado pela biblioteca.
- `buffer` retorna `Uint8Array`, não o `Buffer` do Node.js.
- WebP e `ImageBitmap` dependem do navegador; quando a codificação não é suportada, a biblioteca lança `NotSupportedError` em vez de devolver silenciosamente outro formato.
- O frame capturado é o quadro atual do vídeo. Se a reprodução estiver pausada ou a transmissão não estiver entregando quadros, o frame pode não mudar.
- Na captura sem preview, o `<video>` interno continua decodificando a transmissão e consumindo recursos. O navegador também continua mostrando o indicador de câmera/tela em uso.
- A captura sem preview usa um `<video>` não anexado ao DOM. Se algum navegador/ambiente específico deixar de entregar quadros nesse modo, anexe o `video` retornado a um contêiner visualmente oculto via CSS (`position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none`).
- A suíte automatizada usa APIs simuladas; ela não substitui testes manuais com câmera física nem captura real de tela.

## Segurança e privacidade

- A câmera e a tela só são acessadas após autorização do usuário.
- A seleção da fonte de tela é sempre feita pelo navegador.
- A biblioteca permite capturar sem exibir preview, mas isso **não** torna a captura invisível para o usuário: o navegador continua exigindo autorização e mostrando os indicadores de câmera/tela em uso. Não há contorno de permissões nem coleta automática.
- Áudio não é solicitado por padrão.
- Prefira HTTPS. `localhost` também é considerado contexto seguro.
- O stream retornado por `iniciar()` é o mesmo da sessão. Evite chamar `track.stop()` manualmente; use `parar()` para encerrar corretamente e limpar a visualização.

## Exemplos completos

O projeto inclui estes exemplos executáveis:

- `exemplos/index.html` — página única com câmera e captura de tela (recomendado).
- `exemplos/camera.html` — exemplo focado em câmera.
- `exemplos/tela.html` — exemplo focado em captura de tela.

Sirva a raiz do projeto por HTTP:

```sh
python3 -m http.server 8080
```

Depois abra:

- `http://localhost:8080/` — redireciona para a página de testes.
- `http://localhost:8080/exemplos/index.html` — testa câmera e tela na mesma página.
- `http://localhost:8080/exemplos/camera.html`
- `http://localhost:8080/exemplos/tela.html`

### Se a captura de tela não abrir

A câmera e a tela usam APIs diferentes. Se a câmera funciona mas a captura de tela não, verifique:

1. **O navegador expõe `getDisplayMedia`?** A página `exemplos/index.html` mostra isso no diagnóstico. Muitos navegadores móveis e webviews não implementam essa API.
2. **A página está em uma aba normal?** IDEs, previews embutidos e iframes podem bloquear a captura de tela. Em iframe, a permissão `display-capture` precisa ser concedida pelo site que incorpora a página. A câmera usa uma permissão diferente (`camera`), por isso pode funcionar enquanto a tela falha.
3. **É HTTPS ou localhost?** A API exige contexto seguro.
4. **Houve interação do usuário?** Chame `tela.iniciar()` a partir de um clique. O navegador não permite abrir o seletor de tela automaticamente.
5. **O seletor foi cancelado?** O navegador rejeita com `NotAllowedError`.
6. **O sistema/navegador restringe a captura?** Em alguns ambientes Linux/Wayland, é necessário um portal de captura; em headless/automação, a API pode não estar disponível.

A página exibe `erro.name` e `erro.message` na tela e imprime o erro completo no console. Se a captura falhar, abra o DevTools e confira a mensagem. Os erros mais comuns são `NotSupportedError`, `NotAllowedError` e `SecurityError`.

### `exemplos/camera.html`

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>captura-cm — câmera</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #f4f5f7;
      color: #18191c;
    }

    main {
      max-width: 880px;
      margin: 0 auto;
    }

    h1 {
      margin-top: 0;
    }

    .aviso {
      padding: 12px 16px;
      border-left: 4px solid #d98b00;
      background: #fff7e6;
      border-radius: 6px;
    }

    .preview {
      display: grid;
      place-items: center;
      min-height: 260px;
      margin: 16px 0;
      overflow: hidden;
      border: 1px solid #ccd0d6;
      border-radius: 10px;
      background: #111;
    }

    .preview video {
      display: block;
      width: 100%;
      max-height: 70vh;
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }

    button {
      padding: 9px 14px;
      border: 1px solid #b8bec8;
      border-radius: 7px;
      background: #fff;
      color: #18191c;
      font: inherit;
      cursor: pointer;
    }

    button:hover {
      background: #eef1f5;
    }

    #status {
      min-height: 1.5em;
      font-weight: 600;
    }

    #preview {
      max-width: 100%;
      border-radius: 10px;
      border: 1px solid #ccd0d6;
      background: #111;
    }

    @media (prefers-color-scheme: dark) {
      body { background: #17181b; color: #eef0f4; }
      .aviso { background: #2b2416; border-color: #d98b00; }
      button { background: #26282d; color: #eef0f4; border-color: #444850; }
      button:hover { background: #32353c; }
      #preview, .preview { border-color: #444850; }
    }
  </style>
</head>
<body>
  <main>
    <h1>captura-cm — câmera</h1>

    <p class="aviso">
      Sirva esta página por <strong>HTTP em localhost</strong> ou por
      <strong>HTTPS</strong>. O acesso à câmera exige um contexto seguro e a
      autorização do usuário. Exemplo:
      <code>python3 -m http.server 8080</code> e abra
      <code>http://localhost:8080/exemplos/camera.html</code>.
    </p>

    <p>
      <a href="index.html">Painel com câmera e tela</a>
      &middot;
      <a href="tela.html">Testar captura de tela</a>
    </p>

    <div id="camera" class="preview"></div>

    <div class="acoes">
      <button id="iniciar-traseira" type="button">Iniciar (traseira)</button>
      <button id="iniciar-frontal" type="button">Iniciar (frontal)</button>
      <button id="alternar" type="button">Alternar câmera</button>
      <button id="parar" type="button">Parar</button>
    </div>

    <div class="acoes">
      <button id="frame-png" type="button">Baixar PNG</button>
      <button id="frame-jpeg" type="button">Baixar JPEG 0.8</button>
      <button id="frame-webp" type="button">Baixar WebP 0.8</button>
      <button id="frame-base64" type="button">Prévia Base64 (JPEG)</button>
      <button id="frame-bitmap" type="button">Prévia ImageBitmap</button>
    </div>

    <p id="status">Câmera inativa.</p>
    <img id="preview" alt="Último frame capturado" hidden>
  </main>

  <script type="module">
    import captura from '../src/index.js'

    const status = document.querySelector('#status')
    const preview = document.querySelector('#preview')

    function mostrar(mensagem) {
      status.textContent = mensagem
    }

    function mostrarErro(erro) {
      mostrar(`Erro: ${erro.message}`)
      console.error(erro)
    }

    async function iniciar(camera) {
      try {
        const { video } = await captura.camera.iniciar({
          elemento: '#camera',
          camera
        })
        mostrar(`Câmera ${camera} ativa: ${video.videoWidth}×${video.videoHeight}.`)
      } catch (erro) {
        mostrarErro(erro)
      }
    }

    async function baixarFrame(opcoes, nomeArquivo) {
      try {
        const blob = await captura.camera.frame(opcoes)
        const url = URL.createObjectURL(blob)

        preview.src = url
        preview.hidden = false

        const link = document.createElement('a')
        link.href = url
        link.download = nomeArquivo
        link.click()

        mostrar(`Frame capturado: ${nomeArquivo}.`)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } catch (erro) {
        mostrarErro(erro)
      }
    }

    document.querySelector('#iniciar-traseira').addEventListener('click', () => {
      iniciar('traseira')
    })

    document.querySelector('#iniciar-frontal').addEventListener('click', () => {
      iniciar('frontal')
    })

    document.querySelector('#alternar').addEventListener('click', async () => {
      try {
        await captura.camera.alternar()
        mostrar('Câmera alternada com sucesso.')
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    document.querySelector('#parar').addEventListener('click', () => {
      const haviaSessao = captura.camera.parar()
      preview.hidden = true
      preview.removeAttribute('src')
      mostrar(haviaSessao ? 'Câmera encerrada.' : 'A câmera já estava inativa.')
    })

    document.querySelector('#frame-png').addEventListener('click', () => {
      baixarFrame({ formato: 'blob' }, 'frame.png')
    })

    document.querySelector('#frame-jpeg').addEventListener('click', () => {
      baixarFrame({ formato: 'jpeg', qualidade: 0.8 }, 'frame.jpg')
    })

    document.querySelector('#frame-webp').addEventListener('click', () => {
      baixarFrame({ formato: 'webp', qualidade: 0.8 }, 'frame.webp')
    })

    document.querySelector('#frame-base64').addEventListener('click', async () => {
      try {
        const base64 = await captura.camera.frame({
          formato: 'base64',
          tipo: 'jpeg',
          qualidade: 0.8,
          largura: 480
        })

        preview.src = `data:image/jpeg;base64,${base64}`
        preview.hidden = false
        mostrar('Frame Base64 (JPEG, 480 px de largura) exibido.')
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    document.querySelector('#frame-bitmap').addEventListener('click', async () => {
      try {
        const bitmap = await captura.camera.frame({
          formato: 'bitmap',
          largura: 480
        })

        const largura = bitmap.width
        const altura = bitmap.height

        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura
        canvas.getContext('2d').drawImage(bitmap, 0, 0)

        preview.src = canvas.toDataURL('image/png')
        preview.hidden = false
        bitmap.close()

        mostrar(`ImageBitmap exibido (${largura}×${altura}).`)
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    window.addEventListener('beforeunload', () => captura.camera.parar())
  </script>
</body>
</html>
```

### `exemplos/tela.html`

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>captura-cm — tela</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #f4f5f7;
      color: #18191c;
    }

    main {
      max-width: 960px;
      margin: 0 auto;
    }

    h1 {
      margin-top: 0;
    }

    .aviso {
      padding: 12px 16px;
      border-left: 4px solid #d98b00;
      background: #fff7e6;
      border-radius: 6px;
    }

    .preview {
      display: grid;
      place-items: center;
      min-height: 260px;
      margin: 16px 0;
      overflow: hidden;
      border: 1px solid #ccd0d6;
      border-radius: 10px;
      background: #111;
    }

    .preview video {
      display: block;
      width: 100%;
      max-height: 70vh;
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 12px 0;
    }

    button {
      padding: 9px 14px;
      border: 1px solid #b8bec8;
      border-radius: 7px;
      background: #fff;
      color: #18191c;
      font: inherit;
      cursor: pointer;
    }

    button:hover {
      background: #eef1f5;
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    #status {
      min-height: 1.5em;
      font-weight: 600;
    }

    #preview {
      max-width: 100%;
      border-radius: 10px;
      border: 1px solid #ccd0d6;
      background: #111;
    }

    @media (prefers-color-scheme: dark) {
      body { background: #17181b; color: #eef0f4; }
      .aviso { background: #2b2416; border-color: #d98b00; }
      button { background: #26282d; color: #eef0f4; border-color: #444850; }
      button:hover { background: #32353c; }
      #preview, .preview { border-color: #444850; }
    }
  </style>
</head>
<body>
  <main>
    <h1>captura-cm — captura de tela</h1>

    <p class="aviso">
      Sirva esta página por <strong>HTTP em localhost</strong> ou por
      <strong>HTTPS</strong>. A escolha da tela, janela ou aba e a autorização
      são sempre controladas pelo navegador. Exemplo:
      <code>python3 -m http.server 8080</code> e abra
      <code>http://localhost:8080/exemplos/tela.html</code>.
    </p>

    <p>
      <a href="index.html">Painel com câmera e tela</a>
      &middot;
      <a href="camera.html">Testar câmera</a>
    </p>

    <div id="tela" class="preview"></div>

    <div class="acoes">
      <label>
        <input id="com-audio" type="checkbox">
        Capturar áudio (quando suportado)
      </label>
      <button id="iniciar" type="button">Compartilhar tela</button>
      <button id="parar" type="button">Parar</button>
    </div>

    <div class="acoes">
      <button id="frame-png" type="button">Baixar PNG</button>
      <button id="frame-jpeg" type="button">Baixar JPEG 0.8</button>
      <button id="frame-base64" type="button">Prévia Base64</button>
      <button id="frame-canvas" type="button">Prévia canvas 50%</button>
    </div>

    <p id="status">Captura de tela inativa.</p>
    <img id="preview" alt="Último frame da tela capturado" hidden>
  </main>

  <script type="module">
    import captura from '../src/index.js'

    const status = document.querySelector('#status')
    const preview = document.querySelector('#preview')
    const checkboxAudio = document.querySelector('#com-audio')

    let estavaAtiva = false

    function mostrar(mensagem) {
      status.textContent = mensagem
    }

    function mostrarErro(erro) {
      mostrar(`Erro: ${erro.message}`)
      console.error(erro)
    }

    document.querySelector('#iniciar').addEventListener('click', async () => {
      try {
        const { video } = await captura.tela.iniciar({
          elemento: '#tela',
          audio: checkboxAudio.checked
        })

        estavaAtiva = true
        mostrar(`Compartilhamento ativo: ${video.videoWidth}×${video.videoHeight}.`)
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    document.querySelector('#parar').addEventListener('click', () => {
      const haviaSessao = captura.tela.parar()
      estavaAtiva = false
      preview.hidden = true
      preview.removeAttribute('src')
      mostrar(haviaSessao ? 'Compartilhamento encerrado.' : 'A captura já estava inativa.')
    })

    async function baixarFrame(opcoes, nomeArquivo) {
      try {
        const blob = await captura.tela.frame(opcoes)
        const url = URL.createObjectURL(blob)

        preview.src = url
        preview.hidden = false

        const link = document.createElement('a')
        link.href = url
        link.download = nomeArquivo
        link.click()

        mostrar(`Frame capturado: ${nomeArquivo}.`)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } catch (erro) {
        mostrarErro(erro)
      }
    }

    document.querySelector('#frame-png').addEventListener('click', () => {
      baixarFrame({ formato: 'blob' }, 'tela.png')
    })

    document.querySelector('#frame-jpeg').addEventListener('click', () => {
      baixarFrame({ formato: 'jpeg', qualidade: 0.8 }, 'tela.jpg')
    })

    document.querySelector('#frame-base64').addEventListener('click', async () => {
      try {
        const base64 = await captura.tela.frame({
          formato: 'base64',
          tipo: 'png'
        })

        preview.src = `data:image/png;base64,${base64}`
        preview.hidden = false
        mostrar('Frame Base64 exibido.')
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    document.querySelector('#frame-canvas').addEventListener('click', async () => {
      try {
        const video = document.querySelector('#tela video')
        if (!video) {
          throw new Error('Compartilhe uma tela antes de capturar.')
        }

        const largura = Math.max(1, Math.round(video.videoWidth * 0.5))
        const canvas = await captura.tela.frame({
          formato: 'canvas',
          largura
        })

        preview.src = canvas.toDataURL('image/png')
        preview.hidden = false
        mostrar(`Canvas exibido (${canvas.width}×${canvas.height}).`)
      } catch (erro) {
        mostrarErro(erro)
      }
    })

    // Detecta o encerramento feito pela interface do navegador.
    setInterval(() => {
      const ativa = captura.tela.ativa()

      if (estavaAtiva && !ativa) {
        estavaAtiva = false
        preview.hidden = true
        preview.removeAttribute('src')
        mostrar('O compartilhamento foi encerrado pela interface do navegador.')
      }
    }, 500)

    window.addEventListener('beforeunload', () => captura.tela.parar())
  </script>
</body>
</html>
```

## Contribuição

Instruções de desenvolvimento, estrutura do projeto, testes e publicação estão em [CONTRIBUTING.md](./CONTRIBUTING.md).

## Autor

Caio MUltiversando.

## Licença

MIT. Copyright (c) 2026 Caio MUltiversando. Consulte [LICENSE](./LICENSE).
