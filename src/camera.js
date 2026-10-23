/**
 * Módulo de captura de câmera.
 *
 * Cada sessão mantém seu próprio fluxo e elemento de vídeo. A câmera e a
 * captura de tela funcionam de forma independente.
 */

import { capturarDoVideo, validarDimensaoPositiva } from './formatos.js';
import {
  criarErro,
  erroEstado,
  limparVideo,
  obterUserMedia,
  observarFimDeFaixas,
  pararStream,
  resolverElemento,
  streamAtivo,
  criarVideo,
  iniciarReproducao,
  configuracoesDoVideo
} from './midia.js';

const TEMPO_LIMITE_VIDEO = 10_000;

let sessao = null;
let emAndamento = false;
let versaoDaOperacao = 0;

function normalizarCamera(camera) {
  if (typeof camera !== 'string') {
    throw new TypeError('A opção "camera" deve ser "frontal" ou "traseira".');
  }

  const valor = camera.trim().toLowerCase();
  if (valor === 'frontal') return 'frontal';
  if (valor === 'traseira') return 'traseira';

  throw new TypeError(
    `Valor inválido para "camera": "${camera}". Use "frontal" ou "traseira".`
  );
}

function validarOpcoesIniciar(opcoes) {
  if (opcoes == null || typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    throw new TypeError('camera.iniciar(opcoes): informe um objeto de opções.');
  }

  const {
    elemento = null,
    camera = 'traseira',
    largura,
    altura,
    audio = false
  } = opcoes;

  if (typeof audio !== 'boolean') {
    throw new TypeError('A opção "audio" deve ser booleana.');
  }

  return {
    elemento,
    camera: normalizarCamera(camera),
    largura: validarDimensaoPositiva(largura, 'largura'),
    altura: validarDimensaoPositiva(altura, 'altura'),
    audio
  };
}

function montarRestricoes({ camera, largura, altura, audio }) {
  const video = {
    facingMode: {
      ideal: camera === 'frontal' ? 'user' : 'environment'
    }
  };

  if (largura != null) video.width = { ideal: largura };
  if (altura != null) video.height = { ideal: altura };

  return {
    audio: Boolean(audio),
    video
  };
}

function verificarCancelamento(versao) {
  if (versao !== versaoDaOperacao) {
    throw erroEstado('A operação da câmera foi cancelada por parar().');
  }
}

function encerrarSessao() {
  const atual = sessao;
  sessao = null;

  if (!atual) return false;

  if (typeof atual.cancelarObservacao === 'function') {
    atual.cancelarObservacao();
  }

  pararStream(atual.fluxo);
  limparVideo(atual.video, atual.criado);
  return true;
}

function trocouDeCamera(anteriores, novas, alvo) {
  const esperado = alvo === 'frontal' ? 'user' : 'environment';

  // Se o navegador informou a direção, ela é a fonte mais confiável.
  if (novas && typeof novas.facingMode === 'string') {
    return novas.facingMode === esperado;
  }

  // Sem facingMode, evita aceitar explicitamente o mesmo deviceId.
  if (
    anteriores && novas &&
    anteriores.deviceId && novas.deviceId &&
    anteriores.deviceId === novas.deviceId
  ) {
    return false;
  }

  return true;
}

/**
 * Inicia a câmera.
 *
 * Com `elemento`, cria e insere um <video> no contêiner. Sem `elemento`, o
 * <video> é mantido internamente e não aparece na página (captura sem preview).
 *
 * Se já houver uma sessão ativa, ela é encerrada antes de abrir a nova.
 *
 * @param {{
 *   elemento?: string|HTMLElement|null,
 *   camera?: 'frontal'|'traseira',
 *   largura?: number,
 *   altura?: number,
 *   audio?: boolean
 * }} opcoes
 * @returns {Promise<{ video: HTMLVideoElement, stream: MediaStream }>}
 */
export async function iniciar(opcoes = {}) {
  const config = validarOpcoesIniciar(opcoes);
  const container = resolverElemento(config.elemento, {
    obrigatorio: false,
    descricao: 'elemento'
  });

  if (emAndamento) {
    throw erroEstado(
      'Já existe uma operação de câmera em andamento. Aguarde a conclusão.'
    );
  }

  emAndamento = true;
  const versao = ++versaoDaOperacao;

  let fluxo = null;
  let videoCriado = null;

  try {
    if (sessao) encerrarSessao();

    fluxo = await obterUserMedia(montarRestricoes(config), 'a câmera');
    verificarCancelamento(versao);

    videoCriado = criarVideo(container, {
      tipo: 'camera',
      mudo: true,
      anexar: Boolean(container)
    });

    await iniciarReproducao(videoCriado.video, fluxo, {
      tempoLimite: TEMPO_LIMITE_VIDEO
    });
    verificarCancelamento(versao);

    const cancelarObservacao = observarFimDeFaixas(fluxo, () => {
      if (sessao && sessao.fluxo === fluxo) encerrarSessao();
    });

    sessao = {
      fluxo,
      video: videoCriado.video,
      criado: videoCriado.criado,
      container,
      config,
      cancelarObservacao
    };

    return { video: sessao.video, stream: fluxo };
  } catch (erro) {
    if (fluxo) pararStream(fluxo);
    if (videoCriado) limparVideo(videoCriado.video, videoCriado.criado);
    throw erro;
  } finally {
    emAndamento = false;
  }
}

/**
 * Alterna manualmente entre a câmera frontal e a traseira.
 *
 * A faixa anterior é encerrada antes da solicitação da câmera oposta. Em caso
 * de falha, a sessão é encerrada e a Promise é rejeitada.
 *
 * @returns {Promise<{ video: HTMLVideoElement, stream: MediaStream }>}
 */
export async function alternar() {
  if (emAndamento) {
    throw erroEstado(
      'Já existe uma operação de câmera em andamento. Aguarde a conclusão.'
    );
  }

  if (!sessao) {
    throw erroEstado(
      'A câmera não está ativa. Chame captura.camera.iniciar() antes de alternar().'
    );
  }

  emAndamento = true;
  const versao = ++versaoDaOperacao;
  const anterior = sessao;
  sessao = null;

  const alvo = anterior.config.camera === 'frontal' ? 'traseira' : 'frontal';
  let novoFluxo = null;

  try {
    const configuracoesAnteriores = configuracoesDoVideo(anterior.fluxo);

    if (typeof anterior.cancelarObservacao === 'function') {
      anterior.cancelarObservacao();
    }

    pararStream(anterior.fluxo);

    try {
      anterior.video.srcObject = null;
    } catch {
      // O vídeo pode já ter sido descartado.
    }

    verificarCancelamento(versao);

    novoFluxo = await obterUserMedia(
      montarRestricoes({ ...anterior.config, camera: alvo }),
      `a câmera ${alvo}`
    );
    verificarCancelamento(versao);

    const configuracoesNovas = configuracoesDoVideo(novoFluxo);
    if (!trocouDeCamera(configuracoesAnteriores, configuracoesNovas, alvo)) {
      throw criarErro(
        `O dispositivo não disponibilizou a câmera ${alvo}. ` +
        'Verifique se ele possui mais de uma câmera disponível.',
        { nome: 'NotFoundError' }
      );
    }

    await iniciarReproducao(anterior.video, novoFluxo, {
      tempoLimite: TEMPO_LIMITE_VIDEO
    });
    verificarCancelamento(versao);

    const cancelarObservacao = observarFimDeFaixas(novoFluxo, () => {
      if (sessao && sessao.fluxo === novoFluxo) encerrarSessao();
    });

    sessao = {
      ...anterior,
      fluxo: novoFluxo,
      config: { ...anterior.config, camera: alvo },
      cancelarObservacao
    };

    return { video: anterior.video, stream: novoFluxo };
  } catch (erro) {
    if (novoFluxo) pararStream(novoFluxo);
    limparVideo(anterior.video, anterior.criado);

    if (erro && (erro.name !== 'Error' || erro.causa !== undefined)) {
      throw erro;
    }

    throw criarErro(
      `Não foi possível alternar para a câmera ${alvo}: ` +
      `${(erro && erro.message) || 'erro desconhecido'}.`,
      { causa: erro }
    );
  } finally {
    emAndamento = false;
  }
}

/**
 * Captura o frame mais recente da câmera.
 *
 * @param {{
 *   formato?: string,
 *   tipo?: 'png'|'jpeg'|'webp',
 *   qualidade?: number,
 *   largura?: number,
 *   altura?: number,
 *   permitirDistorcao?: boolean
 * }} [opcoes]
 * @returns {Promise<Blob|string|ArrayBuffer|Uint8Array|ImageBitmap|HTMLCanvasElement>}
 */
export async function frame(opcoes = {}) {
  if (!sessao || !streamAtivo(sessao.fluxo)) {
    throw erroEstado(
      'A câmera não está ativa. Chame captura.camera.iniciar() antes de capturar um frame.'
    );
  }

  return capturarDoVideo(sessao.video, opcoes, { rotulo: 'câmera' });
}

/**
 * Encerra a sessão, libera as faixas e remove o vídeo criado pela biblioteca.
 *
 * @returns {boolean} true se havia uma sessão para encerrar.
 */
export function parar() {
  versaoDaOperacao += 1;
  return encerrarSessao();
}

/**
 * Informa se a sessão de câmera está ativa.
 *
 * @returns {boolean}
 */
export function ativa() {
  return Boolean(sessao && streamAtivo(sessao.fluxo));
}
