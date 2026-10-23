/**
 * Módulo de captura de tela.
 *
 * A seleção da tela, janela ou aba é sempre controlada pelo navegador e exige
 * uma interação do usuário. A biblioteca nunca tenta contornar essa permissão.
 */

import { capturarDoVideo } from './formatos.js';
import {
  criarVideo,
  erroEstado,
  iniciarReproducao,
  limparVideo,
  obterDisplayMedia,
  observarFimDeFaixas,
  pararStream,
  resolverElemento,
  streamAtivo
} from './midia.js';

const TEMPO_LIMITE_VIDEO = 10_000;

let sessao = null;
let emAndamento = false;
let versaoDaOperacao = 0;

function validarOpcoesIniciar(opcoes = {}) {
  if (opcoes == null) opcoes = {};
  if (typeof opcoes !== 'object' || Array.isArray(opcoes)) {
    throw new TypeError('tela.iniciar(opcoes): informe um objeto de opções.');
  }

  const { elemento = null, audio = false } = opcoes;

  if (typeof audio !== 'boolean') {
    throw new TypeError('A opção "audio" deve ser booleana.');
  }

  return { elemento, audio };
}

function verificarCancelamento(versao) {
  if (versao !== versaoDaOperacao) {
    throw erroEstado('A operação de captura de tela foi cancelada por parar().');
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

/**
 * Inicia a captura de tela.
 *
 * Sem `elemento`, o <video> é mantido internamente e não é inserido na página.
 * Com `elemento`, o <video> é criado e inserido no contêiner.
 *
 * @param {{ elemento?: string|HTMLElement, audio?: boolean }} [opcoes]
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
      'Já existe uma operação de captura de tela em andamento. Aguarde a conclusão.'
    );
  }

  emAndamento = true;
  const versao = ++versaoDaOperacao;

  let fluxo = null;
  let videoCriado = null;

  try {
    if (sessao) encerrarSessao();

    fluxo = await obterDisplayMedia(
      { video: true, audio: Boolean(config.audio) },
      'a captura de tela'
    );
    verificarCancelamento(versao);

    videoCriado = criarVideo(container, {
      tipo: 'tela',
      mudo: !config.audio,
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
 * Captura o frame mais recente da tela compartilhada.
 *
 * Aceita os mesmos formatos e opções de `captura.camera.frame()`.
 *
 * @param {object} [opcoes]
 * @returns {Promise<Blob|string|ArrayBuffer|Uint8Array|ImageBitmap|HTMLCanvasElement>}
 */
export async function frame(opcoes = {}) {
  if (!sessao || !streamAtivo(sessao.fluxo)) {
    throw erroEstado(
      'A captura de tela não está ativa. Chame captura.tela.iniciar() antes de capturar um frame.'
    );
  }

  return capturarDoVideo(sessao.video, opcoes, { rotulo: 'captura de tela' });
}

/**
 * Encerra a captura de tela e libera as faixas.
 *
 * @returns {boolean} true se havia uma sessão para encerrar.
 */
export function parar() {
  versaoDaOperacao += 1;
  return encerrarSessao();
}

/**
 * Informa se a captura de tela está ativa.
 *
 * @returns {boolean}
 */
export function ativa() {
  return Boolean(sessao && streamAtivo(sessao.fluxo));
}
