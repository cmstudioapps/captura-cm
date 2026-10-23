/**
 * Utilitários compartilhados de DOM, mídia e ciclo de vida.
 *
 * Este arquivo é interno da biblioteca. Ele existe para evitar duplicação
 * entre os módulos de câmera e de captura de tela.
 */

const TEMPO_LIMITE_PADRAO = 10_000;

const MENSAGENS_DE_ERRO = {
  NotAllowedError: 'permissão negada pelo usuário ou pela política do navegador',
  PermissionDeniedError: 'permissão negada pelo usuário ou pela política do navegador',
  NotFoundError: 'nenhum dispositivo de captura compatível foi encontrado',
  DevicesNotFoundError: 'nenhum dispositivo de captura compatível foi encontrado',
  NotReadableError: 'o dispositivo não pôde ser iniciado; ele pode estar em uso por outro aplicativo',
  TrackStartError: 'o dispositivo não pôde ser iniciado; ele pode estar em uso por outro aplicativo',
  OverconstrainedError: 'as restrições solicitadas não são suportadas pelo dispositivo',
  ConstraintNotSatisfiedError: 'as restrições solicitadas não são suportadas pelo dispositivo',
  SecurityError: 'é necessário um contexto seguro (HTTPS ou localhost)',
  AbortError: 'a operação foi cancelada',
  TypeError: 'as restrições de mídia são inválidas',
  InvalidStateError: 'o dispositivo não está disponível'
};

/**
 * Cria um Error com nome e causa opcionais.
 *
 * @param {string} mensagem
 * @param {{ nome?: string, causa?: unknown }} [opcoes]
 * @returns {Error}
 */
export function criarErro(mensagem, { nome = 'Error', causa } = {}) {
  const erro = new Error(mensagem);
  if (nome) erro.name = nome;
  if (causa !== undefined) erro.causa = causa;
  return erro;
}

export function erroEstado(mensagem) {
  return criarErro(mensagem, { nome: 'InvalidStateError' });
}

export function erroSuporte(mensagem) {
  return criarErro(mensagem, { nome: 'NotSupportedError' });
}

export function erroSeguranca(mensagem) {
  return criarErro(mensagem, { nome: 'SecurityError' });
}

export function erroNaoEncontrado(mensagem) {
  return criarErro(mensagem, { nome: 'NotFoundError' });
}

/**
 * Traduz um erro de mídia do navegador sem perder o nome/causa originais.
 *
 * @param {unknown} erro
 * @param {string} rotulo Ex.: "a câmera" ou "a captura de tela".
 * @returns {Error}
 */
export function traduzirErroMidia(erro, rotulo) {
  const nome = erro && typeof erro === 'object' && erro.name ? erro.name : 'Error';
  const detalhe = MENSAGENS_DE_ERRO[nome] || (erro && erro.message) || 'erro desconhecido';
  return criarErro(
    `Não foi possível iniciar ${rotulo}: ${detalhe} (${nome}).`,
    { nome, causa: erro }
  );
}

export function obterDocumento() {
  const documento = globalThis.document;
  if (!documento || typeof documento.createElement !== 'function') {
    throw erroSuporte(
      'Este recurso exige um ambiente com DOM (document). A biblioteca funciona apenas em navegadores.'
    );
  }
  return documento;
}

/**
 * Verifica o contexto seguro e devolve navigator.mediaDevices.
 *
 * @returns {MediaDevices}
 */
export function obterMediaDevices() {
  if (globalThis.isSecureContext === false) {
    throw erroSeguranca(
      'A captura de mídia exige um contexto seguro. Use HTTPS ou acesse a página por localhost.'
    );
  }

  const navegador = globalThis.navigator;
  if (!navegador || !navegador.mediaDevices) {
    throw erroSuporte(
      'navigator.mediaDevices não está disponível. Use HTTPS ou localhost e um navegador compatível.'
    );
  }

  return navegador.mediaDevices;
}

export async function obterUserMedia(restricoes, rotulo = 'a câmera') {
  const dispositivos = obterMediaDevices();

  if (typeof dispositivos.getUserMedia !== 'function') {
    throw erroSuporte('getUserMedia não é suportado por este navegador.');
  }

  let fluxo;
  try {
    fluxo = await dispositivos.getUserMedia(restricoes);
  } catch (erro) {
    throw traduzirErroMidia(erro, rotulo);
  }

  if (!fluxo || typeof fluxo.getTracks !== 'function') {
    throw erroSuporte('O navegador retornou um fluxo de mídia inválido para a câmera.');
  }

  return fluxo;
}

export async function obterDisplayMedia(restricoes, rotulo = 'a captura de tela') {
  const dispositivos = obterMediaDevices();

  if (typeof dispositivos.getDisplayMedia !== 'function') {
    throw erroSuporte('getDisplayMedia não é suportado por este navegador.');
  }

  let fluxo;
  try {
    fluxo = await dispositivos.getDisplayMedia(restricoes);
  } catch (erro) {
    throw traduzirErroMidia(erro, rotulo);
  }

  if (!fluxo || typeof fluxo.getTracks !== 'function') {
    throw erroSuporte('O navegador retornou um fluxo de mídia inválido para a captura de tela.');
  }

  return fluxo;
}

/**
 * Resolve um seletor CSS ou valida um elemento já existente.
 *
 * @param {string|Element|null|undefined} elemento
 * @param {{ obrigatorio?: boolean, descricao?: string }} [opcoes]
 * @returns {Element|null}
 */
export function resolverElemento(elemento, { obrigatorio = false, descricao = 'elemento' } = {}) {
  if (elemento == null || elemento === '') {
    if (obrigatorio) {
      throw new TypeError(
        `A opção "${descricao}" é obrigatória e deve ser um seletor CSS ou um elemento HTML.`
      );
    }
    return null;
  }

  if (typeof elemento === 'string') {
    const seletor = elemento.trim();
    if (!seletor) {
      throw new TypeError(`A opção "${descricao}" não pode ser uma string vazia.`);
    }

    const documento = obterDocumento();
    let encontrado;
    try {
      encontrado = documento.querySelector(seletor);
    } catch (erro) {
      throw criarErro(`O seletor CSS "${elemento}" é inválido.`, {
        nome: 'SyntaxError',
        causa: erro
      });
    }

    if (!encontrado) {
      throw erroNaoEncontrado(`Nenhum elemento encontrado para o seletor "${elemento}".`);
    }
    return encontrado;
  }

  if (typeof elemento !== 'object') {
    throw new TypeError(
      `A opção "${descricao}" deve ser um seletor CSS ou um elemento HTML.`
    );
  }

  return elemento;
}

function prepararAtributosDoVideo(video, { tipo, mudo }) {
  try {
    video.autoplay = true;
    video.playsInline = true;
    video.muted = mudo;
  } catch {
    // Alguns ambientes simulados podem ter propriedades somente leitura.
  }

  if (typeof video.setAttribute === 'function') {
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('data-captura-cm', tipo || '');

    if (mudo) {
      video.setAttribute('muted', '');
    } else if (typeof video.removeAttribute === 'function') {
      video.removeAttribute('muted');
    }
  }

  if (video.classList && typeof video.classList.add === 'function') {
    video.classList.add('captura-cm-video');
  }
}

/**
 * Cria (ou reaproveita) o elemento <video> de uma sessão.
 *
 * Se o contêiner recebido já for um <video>, ele é usado diretamente e não
 * será removido ao encerrar a sessão.
 *
 * @param {Element|null} container
 * @param {{ tipo?: string, mudo?: boolean, anexar?: boolean }} [opcoes]
 * @returns {{ video: HTMLVideoElement, criado: boolean }}
 */
export function criarVideo(container, { tipo, mudo = true, anexar = true } = {}) {
  const tag = container && container.tagName
    ? String(container.tagName).toUpperCase()
    : '';

  if (tag === 'VIDEO') {
    prepararAtributosDoVideo(container, { tipo, mudo });
    return { video: container, criado: false };
  }

  if (container && typeof container.appendChild !== 'function') {
    throw new TypeError(
      'O elemento informado não é um contêiner válido: ele precisa aceitar a inserção de um <video>.'
    );
  }

  const documento = obterDocumento();
  const video = documento.createElement('video');
  if (!video) {
    throw erroSuporte('Não foi possível criar o elemento <video>.');
  }

  prepararAtributosDoVideo(video, { tipo, mudo });

  if (container && anexar) {
    container.appendChild(video);
  }

  return { video, criado: true };
}

function videoTemQuadro(video) {
  if (!video) return false;

  const largura = Number(video.videoWidth) || 0;
  const altura = Number(video.videoHeight) || 0;
  if (largura <= 0 || altura <= 0) return false;

  // HAVE_CURRENT_DATA (2) garante que existe um quadro disponível.
  if (typeof video.readyState === 'number' && video.readyState < 2) return false;

  return true;
}

/**
 * Aguarda o vídeo ter dimensões e um quadro atual disponível.
 *
 * @param {HTMLVideoElement} video
 * @param {number} [tempoLimite]
 * @returns {Promise<void>}
 */
export function aguardarVideoPronto(video, tempoLimite = TEMPO_LIMITE_PADRAO) {
  if (videoTemQuadro(video)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let finalizado = false;
    let temporizador;

    const eventos = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'resize'];

    function limpar() {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);

      if (typeof video.removeEventListener === 'function') {
        for (const evento of eventos) {
          video.removeEventListener(evento, verificar);
        }
        video.removeEventListener('error', aoErr);
      }
    }

    function verificar() {
      if (!videoTemQuadro(video)) return;
      limpar();
      resolve();
    }

    function aoErr(evento) {
      limpar();
      reject(criarErro(
        'O vídeo falhou ao carregar. Verifique se a transmissão foi iniciada corretamente.',
        { nome: 'MediaError', causa: (evento && evento.error) || video.error }
      ));
    }

    if (typeof video.addEventListener === 'function') {
      for (const evento of eventos) {
        video.addEventListener(evento, verificar);
      }
      video.addEventListener('error', aoErr);
    }

    temporizador = setTimeout(() => {
      limpar();
      reject(criarErro(
        `O vídeo não ficou pronto em ${Math.round(tempoLimite / 1000)} segundos. ` +
        'Verifique a transmissão e a política de reprodução automática do navegador.',
        { nome: 'TimeoutError' }
      ));
    }, tempoLimite);

    verificar();
  });
}

/**
 * Associa o fluxo ao vídeo, inicia a reprodução e aguarda o primeiro quadro.
 *
 * @param {HTMLVideoElement} video
 * @param {MediaStream} fluxo
 * @param {{ tempoLimite?: number }} [opcoes]
 * @returns {Promise<void>}
 */
export async function iniciarReproducao(video, fluxo, { tempoLimite = TEMPO_LIMITE_PADRAO } = {}) {
  try {
    video.srcObject = fluxo;
  } catch (erro) {
    throw criarErro('Não foi possível associar o fluxo de mídia ao elemento <video>.', {
      causa: erro
    });
  }

  if (typeof video.play === 'function') {
    try {
      const resultado = video.play();
      if (resultado && typeof resultado.then === 'function') {
        await resultado;
      }
    } catch (erro) {
      const nome = erro && erro.name ? erro.name : 'Error';
      const mensagem = nome === 'NotAllowedError'
        ? 'O navegador bloqueou a reprodução automática do vídeo. A captura precisa de uma interação do usuário.'
        : `Não foi possível reproduzir o vídeo: ${(erro && erro.message) || 'erro desconhecido'}.`;
      throw criarErro(mensagem, { nome, causa: erro });
    }
  }

  await aguardarVideoPronto(video, tempoLimite);
}

/**
 * Para todas as faixas de um fluxo. É seguro chamar mais de uma vez.
 *
 * @param {MediaStream|null|undefined} fluxo
 */
export function pararStream(fluxo) {
  if (!fluxo || typeof fluxo.getTracks !== 'function') return;

  for (const faixa of fluxo.getTracks()) {
    if (!faixa) continue;
    try {
      faixa.stop();
    } catch {
      // A faixa pode já ter sido encerrada pelo navegador.
    }
  }
}

/**
 * Indica se o fluxo ainda possui uma faixa de vídeo ativa.
 *
 * @param {MediaStream|null|undefined} fluxo
 * @returns {boolean}
 */
export function streamAtivo(fluxo) {
  if (!fluxo) return false;

  let faixas;
  if (typeof fluxo.getVideoTracks === 'function') {
    faixas = fluxo.getVideoTracks();
  } else if (typeof fluxo.getTracks === 'function') {
    faixas = fluxo.getTracks();
  } else {
    return false;
  }

  if (!faixas || typeof faixas.length !== 'number') return false;

  return Array.from(faixas).some(
    (faixa) => faixa && faixa.readyState !== 'ended'
  );
}

/**
 * Observa o término das faixas (por exemplo, quando o usuário interrompe
 * o compartilhamento pela interface do navegador).
 *
 * @param {MediaStream} fluxo
 * @param {() => void} aoEncerrar
 * @returns {() => void} Função para remover os ouvintes.
 */
export function observarFimDeFaixas(fluxo, aoEncerrar) {
  if (!fluxo || typeof fluxo.getTracks !== 'function') {
    return () => {};
  }

  const registros = [];

  const aoFim = () => {
    if (!streamAtivo(fluxo)) aoEncerrar();
  };

  for (const faixa of fluxo.getTracks()) {
    if (!faixa || typeof faixa.addEventListener !== 'function') continue;
    faixa.addEventListener('ended', aoFim);
    registros.push({ faixa, aoFim });
  }

  return () => {
    for (const { faixa, aoFim: ouvinte } of registros) {
      if (typeof faixa.removeEventListener === 'function') {
        faixa.removeEventListener('ended', ouvinte);
      }
    }
  };
}

/**
 * Pausa o vídeo, remove o fluxo e, se o vídeo foi criado pela biblioteca,
 * remove somente ele do contêiner.
 *
 * @param {HTMLVideoElement|null} video
 * @param {boolean} criado
 */
export function limparVideo(video, criado) {
  if (!video) return;

  try {
    if (typeof video.pause === 'function') video.pause();
  } catch {
    // Ignora falhas ao pausar um vídeo já descartado.
  }

  try {
    video.srcObject = null;
  } catch {
    // Ignora ambientes que não permitem redefinir srcObject.
  }

  if (!criado) return;

  const pai = video.parentNode;
  if (pai && typeof pai.removeChild === 'function') {
    try {
      pai.removeChild(video);
    } catch {
      // O elemento já pode ter sido removido pelo usuário.
    }
  } else if (typeof video.remove === 'function') {
    try {
      video.remove();
    } catch {
      // O elemento já pode ter sido removido pelo usuário.
    }
  }
}

/**
 * Lê as configurações da primeira faixa de vídeo de um fluxo.
 *
 * @param {MediaStream|null|undefined} fluxo
 * @returns {MediaTrackSettings}
 */
export function configuracoesDoVideo(fluxo) {
  if (!fluxo || typeof fluxo.getVideoTracks !== 'function') return {};

  let faixas;
  try {
    faixas = fluxo.getVideoTracks();
  } catch {
    return {};
  }

  if (!faixas || typeof faixas.length !== 'number') return {};

  const faixa = faixas[0];
  if (!faixa || typeof faixa.getSettings !== 'function') return {};

  try {
    return faixa.getSettings() || {};
  } catch {
    return {};
  }
}
