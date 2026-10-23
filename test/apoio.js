/**
 * Ambiente simulado para testes sem hardware real.
 *
 * Este arquivo não testa câmera física nem captura real de tela: ele simula
 * getUserMedia, getDisplayMedia, <video>, <canvas>, ImageBitmap e eventos de
 * faixas de mídia para validar a lógica da biblioteca.
 */

import { limparPoolCanvas } from '../src/formatos.js';

export const BASE64_DE_TESTE = 'AQIDBA==';

export const CONFIGURACOES_FRONTAL = {
  facingMode: 'user',
  deviceId: 'camera-frontal'
};

export const CONFIGURACOES_TRASEIRA = {
  facingMode: 'environment',
  deviceId: 'camera-traseira'
};

let contador = 0;

function criarSistemaDeEventos() {
  const ouvintes = new Map();

  return {
    adicionar(tipo, ouvinte) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo).add(ouvinte);
    },
    remover(tipo, ouvinte) {
      if (ouvintes.has(tipo)) ouvintes.get(tipo).delete(ouvinte);
    },
    disparar(tipo, evento = {}) {
      if (!ouvintes.has(tipo)) return;
      for (const ouvinte of [...ouvintes.get(tipo)]) {
        ouvinte(evento);
      }
    }
  };
}

export class FaixaFalsa {
  constructor({ kind = 'video', settings = {} } = {}) {
    this.id = `faixa-${++contador}`;
    this.kind = kind;
    this.readyState = 'live';
    this._settings = { ...settings };
    this._eventos = criarSistemaDeEventos();
    this.stopCalls = 0;
  }

  stop() {
    this.stopCalls += 1;
    this.readyState = 'ended';
  }

  encerrar() {
    this.readyState = 'ended';
    this._eventos.disparar('ended', { target: this });
  }

  getSettings() {
    return { ...this._settings };
  }

  addEventListener(tipo, ouvinte) {
    this._eventos.adicionar(tipo, ouvinte);
  }

  removeEventListener(tipo, ouvinte) {
    this._eventos.remover(tipo, ouvinte);
  }
}

export class FluxoFalso {
  constructor(faixas = []) {
    this.faixas = faixas;
  }

  getTracks() {
    return [...this.faixas];
  }

  getVideoTracks() {
    return this.faixas.filter((faixa) => faixa.kind === 'video');
  }

  getAudioTracks() {
    return this.faixas.filter((faixa) => faixa.kind === 'audio');
  }
}

export class VideoFalso {
  constructor() {
    this.tagName = 'VIDEO';
    this.autoplay = false;
    this.playsInline = false;
    this.muted = false;
    this.readyState = 4;
    this.videoWidth = 640;
    this.videoHeight = 480;
    this.srcObject = null;
    this.paused = true;
    this.parentNode = null;
    this.attributes = {};
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.erroDePlay = null;
    this._eventos = criarSistemaDeEventos();
  }

  play() {
    this.playCalls += 1;
    if (this.erroDePlay) return Promise.reject(this.erroDePlay);
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  setAttribute(nome, valor) {
    this.attributes[nome] = String(valor);
  }

  removeAttribute(nome) {
    delete this.attributes[nome];
  }

  addEventListener(tipo, ouvinte) {
    this._eventos.adicionar(tipo, ouvinte);
  }

  removeEventListener(tipo, ouvinte) {
    this._eventos.remover(tipo, ouvinte);
  }

  disparar(tipo, evento = {}) {
    this._eventos.disparar(tipo, evento);
  }
}

export class CanvasFalso {
  constructor() {
    this._width = 300;
    this._height = 150;
    this.draws = [];
    this.limpezas = [];
    this.ultimoMime = null;
    this.ultimaQualidade = null;
    this.toBlobCalls = 0;
    this._contexto = null;
  }

  // Redimensionar um canvas real limpa o contexto e o conteúdo.
  get width() {
    return this._width;
  }

  set width(valor) {
    this._width = valor;
    this._resetarConteudo();
  }

  get height() {
    return this._height;
  }

  set height(valor) {
    this._height = valor;
    this._resetarConteudo();
  }

  _resetarConteudo() {
    this._contexto = null;
    this.draws = [];
    this.limpezas = [];
  }

  getContext(tipo) {
    if (tipo !== '2d') return null;

    if (!this._contexto) {
      this._contexto = {
        clearRect: (x, y, largura, altura) => {
          this.limpezas.push({ x, y, largura, altura });
        },
        drawImage: (origem, x, y, largura, altura) => {
          this.draws.push({ origem, x, y, largura, altura });
        }
      };
    }

    return this._contexto;
  }

  toBlob(retorno, mime = 'image/png', qualidade) {
    this.toBlobCalls += 1;
    this.ultimoMime = mime;
    this.ultimaQualidade = qualidade;
    retorno(new Blob([new Uint8Array([1, 2, 3, 4])], { type: mime }));
  }

  toDataURL(mime = 'image/png', qualidade) {
    this.ultimoMime = mime;
    this.ultimaQualidade = qualidade;
    return `data:${mime};base64,${BASE64_DE_TESTE}`;
  }
}

export class ContainerFalso {
  constructor(tagName = 'DIV') {
    this.tagName = tagName;
    this.children = [];
  }

  appendChild(filho) {
    this.children.push(filho);
    filho.parentNode = this;
    return filho;
  }

  removeChild(filho) {
    const indice = this.children.indexOf(filho);
    if (indice >= 0) this.children.splice(indice, 1);
    filho.parentNode = null;
    return filho;
  }
}

export class DocumentoFalso {
  constructor() {
    this.criados = [];
    this.seletores = new Map();
  }

  createElement(tag) {
    let elemento;

    if (tag === 'video') {
      elemento = new VideoFalso();
    } else if (tag === 'canvas') {
      elemento = new CanvasFalso();
    } else {
      elemento = new ContainerFalso(String(tag).toUpperCase());
    }

    this.criados.push(elemento);
    return elemento;
  }

  querySelector(seletor) {
    return this.seletores.get(seletor) || null;
  }
}

function criarFabricaPadraoDeCamera() {
  return (restricoes) => {
    const facingMode = restricoes && restricoes.video && restricoes.video.facingMode;
    const valor = typeof facingMode === 'string'
      ? facingMode
      : (facingMode && (facingMode.ideal || facingMode.exact));

    const settings = valor === 'user'
      ? CONFIGURACOES_FRONTAL
      : CONFIGURACOES_TRASEIRA;

    return new FluxoFalso([new FaixaFalsa({ settings })]);
  };
}

function criarFabricaPadraoDeTela() {
  return () => new FluxoFalso([
    new FaixaFalsa({ settings: { displaySurface: 'browser' } })
  ]);
}

/**
 * Instala document, navigator, isSecureContext e createImageBitmap simulados.
 */
export function criarAmbiente(opcoes = {}) {
  const documento = new DocumentoFalso();
  const containerCamera = new ContainerFalso('DIV');
  const containerTela = new ContainerFalso('DIV');

  documento.seletores.set('#camera', containerCamera);
  documento.seletores.set('#tela', containerTela);
  documento.seletores.set('#inexistente', null);

  const chamadas = {
    userMedia: [],
    displayMedia: []
  };

  let fabricaUserMedia = opcoes.getUserMedia || criarFabricaPadraoDeCamera();
  let fabricaDisplayMedia = opcoes.getDisplayMedia || criarFabricaPadraoDeTela();

  const navegador = {
    mediaDevices: {
      async getUserMedia(restricoes) {
        chamadas.userMedia.push(restricoes);
        return fabricaUserMedia(restricoes, chamadas.userMedia.length);
      },
      async getDisplayMedia(restricoes) {
        chamadas.displayMedia.push(restricoes);
        return fabricaDisplayMedia(restricoes, chamadas.displayMedia.length);
      }
    }
  };

  Object.defineProperty(globalThis, 'document', {
    value: documento,
    configurable: true,
    writable: true
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: navegador,
    configurable: true,
    writable: true
  });
  Object.defineProperty(globalThis, 'isSecureContext', {
    value: true,
    configurable: true,
    writable: true
  });
  Object.defineProperty(globalThis, 'createImageBitmap', {
    value: async (canvas) => ({
      __bitmap: true,
      width: canvas.width,
      height: canvas.height,
      close() {}
    }),
    configurable: true,
    writable: true
  });

  limparPoolCanvas();

  return {
    documento,
    container: containerCamera,
    containerCamera,
    containerTela,
    chamadas,
    navegador,
    definirUserMedia(fabrica) {
      fabricaUserMedia = fabrica;
    },
    definirDisplayMedia(fabrica) {
      fabricaDisplayMedia = fabrica;
    }
  };
}

export function removerAmbiente() {
  delete globalThis.document;
  delete globalThis.navigator;
  delete globalThis.isSecureContext;
  delete globalThis.createImageBitmap;
  limparPoolCanvas();
}
