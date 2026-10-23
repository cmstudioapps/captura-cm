/**
 * Conversão de frames e validação de opções compartilhadas entre os módulos
 * de câmera e de captura de tela.
 */

import {
  criarErro,
  erroEstado,
  erroSuporte,
  obterDocumento
} from './midia.js';

const FORMATOS_DE_SAIDA = {
  blob: 'blob',
  base64: 'base64',
  dataurl: 'dataURL',
  'data-url': 'dataURL',
  arraybuffer: 'arrayBuffer',
  'array-buffer': 'arrayBuffer',
  buffer: 'buffer',
  bitmap: 'bitmap',
  canvas: 'canvas'
};

const ALIASES_DE_IMAGEM = {
  png: 'png',
  jpeg: 'jpeg',
  jpg: 'jpeg',
  webp: 'webp'
};

const MIMES = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

const FORMATOS_CODIFICADOS = new Set([
  'blob',
  'base64',
  'dataURL',
  'arrayBuffer',
  'buffer'
]);

const LIMITE_POOL_CANVAS = 2;
let poolDeCanvas = [];
let documentoDoPool = null;

/**
 * Valida uma dimensão opcional e devolve um inteiro positivo ou null.
 *
 * @param {unknown} valor
 * @param {string} nome
 * @returns {number|null}
 */
export function validarDimensaoPositiva(valor, nome) {
  if (valor == null) return null;

  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(`A opção "${nome}" deve ser um número finito.`);
  }

  if (!Number.isInteger(valor) || valor <= 0) {
    throw new RangeError(`A opção "${nome}" deve ser um inteiro maior que zero.`);
  }

  return valor;
}

function validarQualidade(valor) {
  if (valor == null) return undefined;

  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError('A opção "qualidade" deve ser um número entre 0 e 1.');
  }

  if (valor < 0 || valor > 1) {
    throw new RangeError('A opção "qualidade" deve estar entre 0 e 1.');
  }

  return valor;
}

/**
 * Normaliza e valida as opções aceitas por `frame()`.
 *
 * @param {object|null|undefined} opcoes
 * @returns {{
 *   formato: string,
 *   tipo: string|null,
 *   mime: string|null,
 *   qualidade: number|undefined,
 *   largura: number|null,
 *   altura: number|null,
 *   permitirDistorcao: boolean
 * }}
 */
export function normalizarOpcoesFrame(opcoes = {}) {
  if (opcoes == null) opcoes = {};
  if (typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    throw new TypeError('frame(opcoes): informe um objeto de opções.');
  }

  const formatoBruto = opcoes.formato ?? 'blob';
  if (typeof formatoBruto !== 'string') {
    throw new TypeError('A opção "formato" deve ser uma string.');
  }

  const chave = formatoBruto.trim().toLowerCase();
  let formato;
  let tipo = null;

  if (Object.prototype.hasOwnProperty.call(ALIASES_DE_IMAGEM, chave)) {
    formato = 'blob';
    tipo = ALIASES_DE_IMAGEM[chave];
  } else if (Object.prototype.hasOwnProperty.call(FORMATOS_DE_SAIDA, chave)) {
    formato = FORMATOS_DE_SAIDA[chave];
  } else {
    throw new TypeError(
      `Formato "${formatoBruto}" não suportado. Use "blob", "png", "jpeg" (ou "jpg"), ` +
      '"webp", "base64", "dataURL", "arrayBuffer", "buffer", "bitmap" ou "canvas".'
    );
  }

  let tipoInformado = null;
  if (opcoes.tipo != null) {
    if (typeof opcoes.tipo !== 'string') {
      throw new TypeError('A opção "tipo" deve ser uma string.');
    }

    const chaveTipo = opcoes.tipo.trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALIASES_DE_IMAGEM, chaveTipo)) {
      throw new TypeError(
        `Tipo de imagem "${opcoes.tipo}" não suportado. Use "png", "jpeg" ou "webp".`
      );
    }
    tipoInformado = ALIASES_DE_IMAGEM[chaveTipo];
  }

  if (!FORMATOS_CODIFICADOS.has(formato)) {
    if (tipoInformado) {
      throw new TypeError(
        `A opção "tipo" não se aplica ao formato "${formato}", que não é codificado em imagem.`
      );
    }
  } else {
    if (tipo && tipoInformado && tipo !== tipoInformado) {
      throw new TypeError(
        `As opções "formato" e "tipo" entram em conflito: "${formatoBruto}" e "${opcoes.tipo}".`
      );
    }
    tipo = tipoInformado || tipo || 'png';
  }

  const qualidade = validarQualidade(opcoes.qualidade);
  const largura = validarDimensaoPositiva(opcoes.largura, 'largura');
  const altura = validarDimensaoPositiva(opcoes.altura, 'altura');

  let permitirDistorcao = false;
  if (opcoes.permitirDistorcao != null) {
    if (typeof opcoes.permitirDistorcao !== 'boolean') {
      throw new TypeError('A opção "permitirDistorcao" deve ser booleana.');
    }
    permitirDistorcao = opcoes.permitirDistorcao;
  }

  return {
    formato,
    tipo,
    mime: tipo ? MIMES[tipo] : null,
    qualidade,
    largura,
    altura,
    permitirDistorcao
  };
}

/**
 * Calcula as dimensões finais preservando a proporção por padrão.
 *
 * - Nenhuma dimensão: usa as dimensões originais.
 * - Apenas uma dimensão: calcula a outra proporcionalmente.
 * - Ambas com `permitirDistorcao = true`: usa exatamente as dimensões pedidas.
 * - Ambas sem distorção: ajusta a imagem dentro da caixa pedida, mantendo a
 *   proporção. O resultado pode ser menor que a caixa em um dos eixos.
 *
 * @param {number} origemLargura
 * @param {number} origemAltura
 * @param {number|null} [alvoLargura]
 * @param {number|null} [alvoAltura]
 * @param {boolean} [permitirDistorcao]
 * @returns {{ largura: number, altura: number }}
 */
export function calcularDimensoes(
  origemLargura,
  origemAltura,
  alvoLargura = null,
  alvoAltura = null,
  permitirDistorcao = false
) {
  const larguraOrigem = validarDimensaoPositiva(origemLargura, 'origemLargura');
  const alturaOrigem = validarDimensaoPositiva(origemAltura, 'origemAltura');

  if (larguraOrigem == null || alturaOrigem == null) {
    throw new RangeError('As dimensões originais devem ser números positivos.');
  }

  const larguraAlvo = validarDimensaoPositiva(alvoLargura, 'largura');
  const alturaAlvo = validarDimensaoPositiva(alvoAltura, 'altura');

  if (larguraAlvo == null && alturaAlvo == null) {
    return {
      largura: Math.round(larguraOrigem),
      altura: Math.round(alturaOrigem)
    };
  }

  if (permitirDistorcao && larguraAlvo != null && alturaAlvo != null) {
    return { largura: larguraAlvo, altura: alturaAlvo };
  }

  if (larguraAlvo != null && alturaAlvo == null) {
    return {
      largura: larguraAlvo,
      altura: Math.max(1, Math.round((alturaOrigem * larguraAlvo) / larguraOrigem))
    };
  }

  if (alturaAlvo != null && larguraAlvo == null) {
    return {
      largura: Math.max(1, Math.round((larguraOrigem * alturaAlvo) / alturaOrigem)),
      altura: alturaAlvo
    };
  }

  const escala = Math.min(larguraAlvo / larguraOrigem, alturaAlvo / alturaOrigem);

  return {
    largura: Math.max(1, Math.min(larguraAlvo, Math.round(larguraOrigem * escala))),
    altura: Math.max(1, Math.min(alturaAlvo, Math.round(alturaOrigem * escala)))
  };
}

function obterDocumentoParaCanvas() {
  const documento = obterDocumento();

  if (documento !== documentoDoPool) {
    poolDeCanvas = [];
    documentoDoPool = documento;
  }

  return documento;
}

function obterCanvas(largura, altura) {
  const documento = obterDocumentoParaCanvas();
  let canvas = poolDeCanvas.pop();

  if (!canvas) {
    canvas = documento.createElement('canvas');
  }

  if (!canvas || typeof canvas.getContext !== 'function') {
    throw erroSuporte('Não foi possível criar um canvas para capturar o frame.');
  }

  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

function devolverCanvas(canvas) {
  if (!canvas) return;
  if (documentoDoPool !== globalThis.document) return;
  if (poolDeCanvas.length >= LIMITE_POOL_CANVAS) return;

  try {
    canvas.width = 1;
    canvas.height = 1;
  } catch {
    return;
  }

  poolDeCanvas.push(canvas);
}

/**
 * Descarta os canvases reutilizáveis mantidos internamente.
 * Útil principalmente em testes e em ambientes que trocam de documento.
 */
export function limparPoolCanvas() {
  poolDeCanvas = [];
  documentoDoPool = null;
}

function validarVideoParaCaptura(video, rotulo) {
  if (!video) {
    throw erroEstado(`Não há vídeo disponível para capturar um frame da ${rotulo}.`);
  }

  if (typeof video.readyState === 'number' && video.readyState < 2) {
    throw erroEstado(
      `O vídeo da ${rotulo} ainda não está pronto para captura ` +
      `(readyState ${video.readyState}). Aguarde a reprodução e tente novamente.`
    );
  }

  const largura = Number(video.videoWidth) || 0;
  const altura = Number(video.videoHeight) || 0;

  if (largura <= 0 || altura <= 0) {
    throw erroEstado(
      `O vídeo da ${rotulo} não possui dimensões válidas. ` +
      'Verifique se a transmissão está ativa.'
    );
  }
}

function qualidadeEfetiva(config) {
  if (config.mime === 'image/jpeg' || config.mime === 'image/webp') {
    return config.qualidade;
  }
  return undefined;
}

function canvasParaBlob(canvas, mime, qualidade) {
  if (typeof canvas.toBlob !== 'function') {
    return Promise.reject(erroSuporte('O canvas não suporta toBlob neste navegador.'));
  }

  return new Promise((resolve, reject) => {
    let concluido = false;

    function finalizar(funcao, valor) {
      if (concluido) return;
      concluido = true;
      funcao(valor);
    }

    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          finalizar(reject, criarErro(
            'O navegador não conseguiu codificar o frame em Blob. ' +
            'Verifique se o canvas tem dimensões válidas.'
          ));
          return;
        }

        if (blob.type && blob.type !== mime) {
          finalizar(reject, criarErro(
            `O navegador não suporta a codificação "${mime}" e retornou "${blob.type}".`,
            { nome: 'NotSupportedError' }
          ));
          return;
        }

        finalizar(resolve, blob);
      }, mime, qualidade);
    } catch (erro) {
      finalizar(reject, criarErro(
        `Não foi possível converter o canvas em Blob: ${(erro && erro.message) || 'erro desconhecido'}.`,
        { nome: (erro && erro.name) || 'Error', causa: erro }
      ));
    }
  });
}

function canvasParaDataURL(canvas, mime, qualidade, modo) {
  if (typeof canvas.toDataURL !== 'function') {
    throw erroSuporte('O canvas não suporta toDataURL neste navegador.');
  }

  let dataURL;
  try {
    dataURL = canvas.toDataURL(mime, qualidade);
  } catch (erro) {
    throw criarErro(
      `Não foi possível codificar o frame em Data URL: ${(erro && erro.message) || 'erro desconhecido'}.`,
      { nome: (erro && erro.name) || 'Error', causa: erro }
    );
  }

  if (typeof dataURL !== 'string' || !dataURL.startsWith('data:')) {
    throw criarErro('O navegador retornou uma Data URL inválida ao capturar o frame.');
  }

  const virgula = dataURL.indexOf(',');
  if (virgula === -1) {
    throw criarErro('A Data URL retornada pelo navegador não contém dados.');
  }

  const cabecalho = dataURL.slice(0, virgula);
  if (!cabecalho.startsWith(`data:${mime}`)) {
    throw criarErro(
      `O navegador não suporta a codificação "${mime}" e retornou uma imagem diferente.`,
      { nome: 'NotSupportedError' }
    );
  }

  if (modo === 'dataURL') return dataURL;

  if (!cabecalho.includes(';base64')) {
    throw criarErro('O navegador não retornou a imagem em Base64.');
  }

  return dataURL.slice(virgula + 1);
}

async function blobParaArrayBuffer(blob) {
  if (blob && typeof blob.arrayBuffer === 'function') {
    try {
      return await blob.arrayBuffer();
    } catch (erro) {
      throw criarErro(
        `Não foi possível ler o Blob como ArrayBuffer: ${(erro && erro.message) || 'erro desconhecido'}.`,
        { nome: (erro && erro.name) || 'Error', causa: erro }
      );
    }
  }

  const Leitor = globalThis.FileReader;
  if (typeof Leitor === 'function') {
    return new Promise((resolve, reject) => {
      const leitor = new Leitor();

      leitor.onload = () => {
        if (leitor.result instanceof ArrayBuffer) {
          resolve(leitor.result);
        } else {
          reject(criarErro('O FileReader não retornou um ArrayBuffer.'));
        }
      };

      leitor.onerror = () => {
        reject(criarErro('Falha ao ler o Blob com FileReader.', {
          nome: 'NotReadableError',
          causa: leitor.error
        }));
      };

      leitor.readAsArrayBuffer(blob);
    });
  }

  throw erroSuporte(
    'Este navegador não suporta a leitura de Blob como ArrayBuffer. ' +
    'Use o formato "blob" e converta manualmente.'
  );
}

async function criarBitmap(canvas, rotulo) {
  if (typeof globalThis.createImageBitmap !== 'function') {
    throw erroSuporte('createImageBitmap não é suportado por este navegador.');
  }

  try {
    return await globalThis.createImageBitmap(canvas);
  } catch (erro) {
    throw criarErro(
      `Não foi possível criar o ImageBitmap a partir do frame da ${rotulo}: ` +
      `${(erro && erro.message) || 'erro desconhecido'}.`,
      { nome: (erro && erro.name) || 'Error', causa: erro }
    );
  }
}

async function codificarCanvas(canvas, config, rotulo) {
  const { formato, mime } = config;
  const qualidade = qualidadeEfetiva(config);

  try {
    switch (formato) {
      case 'blob':
        return await canvasParaBlob(canvas, mime, qualidade);

      case 'dataURL':
        return canvasParaDataURL(canvas, mime, qualidade, 'dataURL');

      case 'base64':
        return canvasParaDataURL(canvas, mime, qualidade, 'base64');

      case 'arrayBuffer': {
        const blob = await canvasParaBlob(canvas, mime, qualidade);
        return await blobParaArrayBuffer(blob);
      }

      case 'buffer': {
        const blob = await canvasParaBlob(canvas, mime, qualidade);
        return new Uint8Array(await blobParaArrayBuffer(blob));
      }

      default:
        throw new TypeError(`Formato "${formato}" não pode ser codificado.`);
    }
  } catch (erro) {
    if ((erro && erro.name) === 'NotSupportedError' || erro instanceof TypeError) {
      throw erro;
    }

    if (erro && erro.causa !== undefined) throw erro;

    throw criarErro(
      `Não foi possível codificar o frame da ${rotulo}: ${(erro && erro.message) || 'erro desconhecido'}.`,
      { nome: (erro && erro.name) || 'Error', causa: erro }
    );
  }
}

/**
 * Captura o quadro atual de um vídeo e converte para o formato pedido.
 *
 * @param {HTMLVideoElement} video
 * @param {object} [opcoes]
 * @param {{ rotulo?: string }} [contexto]
 * @returns {Promise<Blob|string|ArrayBuffer|Uint8Array|ImageBitmap|HTMLCanvasElement>}
 */
export async function capturarDoVideo(video, opcoes = {}, { rotulo = 'transmissão' } = {}) {
  const config = normalizarOpcoesFrame(opcoes);
  validarVideoParaCaptura(video, rotulo);

  const origemLargura = Number(video.videoWidth);
  const origemAltura = Number(video.videoHeight);

  const { largura, altura } = calcularDimensoes(
    origemLargura,
    origemAltura,
    config.largura,
    config.altura,
    config.permitirDistorcao
  );

  const canvas = obterCanvas(largura, altura);
  let entregarCanvas = false;

  try {
    const contexto = canvas.getContext('2d');
    if (!contexto || typeof contexto.drawImage !== 'function') {
      throw erroSuporte('Não foi possível obter o contexto 2D do canvas para capturar o frame.');
    }

    contexto.clearRect(0, 0, largura, altura);

    try {
      contexto.drawImage(video, 0, 0, largura, altura);
    } catch (erro) {
      throw criarErro(
        `Não foi possível desenhar o frame da ${rotulo} no canvas: ` +
        `${(erro && erro.message) || 'erro desconhecido'}.`,
        { nome: (erro && erro.name) || 'Error', causa: erro }
      );
    }

    if (config.formato === 'canvas') {
      entregarCanvas = true;
      return canvas;
    }

    if (config.formato === 'bitmap') {
      return await criarBitmap(canvas, rotulo);
    }

    return await codificarCanvas(canvas, config, rotulo);
  } finally {
    if (!entregarCanvas) devolverCanvas(canvas);
  }
}
