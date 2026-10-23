import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import captura from '../src/index.js';
import {
  calcularDimensoes,
  normalizarOpcoesFrame
} from '../src/formatos.js';
import {
  BASE64_DE_TESTE,
  CONFIGURACOES_FRONTAL,
  CONFIGURACOES_TRASEIRA,
  CanvasFalso,
  ContainerFalso,
  FluxoFalso,
  FaixaFalsa,
  VideoFalso,
  criarAmbiente,
  removerAmbiente
} from './apoio.js';

let ambiente;

beforeEach(() => {
  captura.camera.parar();
  captura.tela.parar();
  ambiente = criarAmbiente();
});

afterEach(() => {
  captura.camera.parar();
  captura.tela.parar();
  removerAmbiente();
});

describe('formatos: validação e dimensões', () => {
  test('opções padrão usam Blob PNG e dimensões originais', () => {
    const opcoes = normalizarOpcoesFrame();

    assert.equal(opcoes.formato, 'blob');
    assert.equal(opcoes.tipo, 'png');
    assert.equal(opcoes.mime, 'image/png');
    assert.equal(opcoes.qualidade, undefined);
    assert.equal(opcoes.largura, null);
    assert.equal(opcoes.altura, null);
    assert.equal(opcoes.permitirDistorcao, false);
  });

  test('aceita aliases de imagem e converte para Blob', () => {
    const jpeg = normalizarOpcoesFrame({ formato: 'jpeg', qualidade: 0.8 });
    assert.equal(jpeg.formato, 'blob');
    assert.equal(jpeg.tipo, 'jpeg');
    assert.equal(jpeg.mime, 'image/jpeg');
    assert.equal(jpeg.qualidade, 0.8);

    const webp = normalizarOpcoesFrame({ formato: 'WEBP' });
    assert.equal(webp.formato, 'blob');
    assert.equal(webp.mime, 'image/webp');

    const jpg = normalizarOpcoesFrame({ formato: 'jpg' });
    assert.equal(jpg.mime, 'image/jpeg');
  });

  test('aceita formatos codificados com tipo explícito', () => {
    const base64 = normalizarOpcoesFrame({ formato: 'base64', tipo: 'jpeg' });
    assert.equal(base64.formato, 'base64');
    assert.equal(base64.mime, 'image/jpeg');

    const buffer = normalizarOpcoesFrame({ formato: 'array-buffer' });
    assert.equal(buffer.formato, 'arrayBuffer');

    const dataURL = normalizarOpcoesFrame({ formato: 'data-url', tipo: 'webp' });
    assert.equal(dataURL.formato, 'dataURL');
    assert.equal(dataURL.mime, 'image/webp');
  });

  test('rejeita formatos, tipos e opções inválidas', () => {
    assert.throws(() => normalizarOpcoesFrame({ formato: 'gif' }), TypeError);
    assert.throws(() => normalizarOpcoesFrame({ formato: 1 }), TypeError);
    assert.throws(() => normalizarOpcoesFrame({ tipo: 'gif' }), TypeError);
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'canvas', tipo: 'png' }),
      TypeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'png', tipo: 'webp' }),
      TypeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'blob', qualidade: 1.1 }),
      RangeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'blob', qualidade: '0.5' }),
      TypeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'blob', largura: 0 }),
      RangeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'blob', altura: 1.5 }),
      RangeError
    );
    assert.throws(
      () => normalizarOpcoesFrame({ formato: 'blob', permitirDistorcao: 'sim' }),
      TypeError
    );
  });

  test('calcula dimensões proporcionais, contidas e distorcidas', () => {
    assert.deepEqual(calcularDimensoes(640, 480), { largura: 640, altura: 480 });
    assert.deepEqual(calcularDimensoes(640, 480, 320), { largura: 320, altura: 240 });
    assert.deepEqual(calcularDimensoes(640, 480, null, 240), { largura: 320, altura: 240 });
    assert.deepEqual(
      calcularDimensoes(640, 480, 100, 100, false),
      { largura: 100, altura: 75 }
    );
    assert.deepEqual(
      calcularDimensoes(640, 480, 100, 100, true),
      { largura: 100, altura: 100 }
    );
    assert.deepEqual(
      calcularDimensoes(1920, 1080, 100, 50, false),
      { largura: 89, altura: 50 }
    );
  });

  test('rejeita dimensões originais ou solicitadas inválidas', () => {
    assert.throws(() => calcularDimensoes(0, 480), RangeError);
    assert.throws(() => calcularDimensoes(640, null), RangeError);
    assert.throws(() => calcularDimensoes(640, 480, '320'), TypeError);
    assert.throws(() => calcularDimensoes(640, 480, 320.5), RangeError);
  });
});

describe('câmera: inicialização e validação', () => {
  test('cria vídeo no contêiner e usa a câmera traseira por padrão', async () => {
    const resultado = await captura.camera.iniciar({ elemento: '#camera' });

    assert.equal(ambiente.chamadas.userMedia.length, 1);
    const restricoes = ambiente.chamadas.userMedia[0];

    assert.deepEqual(restricoes.video.facingMode, { ideal: 'environment' });
    assert.equal(restricoes.audio, false);

    assert.ok(resultado.video instanceof VideoFalso);
    assert.equal(resultado.video.parentNode, ambiente.container);
    assert.equal(ambiente.container.children.length, 1);
    assert.equal(resultado.video.autoplay, true);
    assert.equal(resultado.video.playsInline, true);
    assert.equal(resultado.video.muted, true);
    assert.equal(resultado.video.attributes.playsinline, '');
    assert.equal(resultado.video.attributes['data-captura-cm'], 'camera');
    assert.ok(resultado.stream instanceof FluxoFalso);
    assert.equal(captura.camera.ativa(), true);
  });

  test('aceita câmera frontal, resolução, áudio e elemento DOM direto', async () => {
    const resultado = await captura.camera.iniciar({
      elemento: ambiente.container,
      camera: 'FRONTAL',
      largura: 1280,
      altura: 720,
      audio: true
    });

    const restricoes = ambiente.chamadas.userMedia[0];
    assert.deepEqual(restricoes.video.facingMode, { ideal: 'user' });
    assert.deepEqual(restricoes.video.width, { ideal: 1280 });
    assert.deepEqual(restricoes.video.height, { ideal: 720 });
    assert.equal(restricoes.audio, true);
    assert.equal(resultado.video.muted, true);
    assert.equal(ambiente.container.children.length, 1);
  });

  test('usa um <video> existente sem removê-lo ao parar', async () => {
    const video = new VideoFalso();

    const resultado = await captura.camera.iniciar({ elemento: video });

    assert.equal(resultado.video, video);
    assert.equal(video.parentNode, null);
    assert.equal(video.muted, true);
    assert.ok(captura.camera.ativa());

    assert.equal(captura.camera.parar(), true);
    assert.equal(video.srcObject, null);
    assert.equal(video.parentNode, null);
    assert.equal(captura.camera.ativa(), false);
  });

  test('inicia sem elemento e mantém o vídeo interno, sem preview', async () => {
    const resultado = await captura.camera.iniciar({ camera: 'frontal' });

    assert.equal(resultado.video.parentNode, null);
    assert.equal(ambiente.container.children.length, 0);
    assert.equal(resultado.video.attributes['data-captura-cm'], 'camera');
    assert.deepEqual(
      ambiente.chamadas.userMedia[0].video.facingMode,
      { ideal: 'user' }
    );
    assert.equal(ambiente.chamadas.userMedia[0].audio, false);
    assert.ok(captura.camera.ativa());

    const canvas = await captura.camera.frame({ formato: 'canvas' });
    assert.ok(canvas instanceof CanvasFalso);
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 480);

    const alternado = await captura.camera.alternar();
    assert.equal(alternado.video, resultado.video);
    assert.equal(alternado.video.parentNode, null);
    assert.ok(captura.camera.ativa());

    assert.equal(captura.camera.parar(), true);
    assert.equal(resultado.video.srcObject, null);
    assert.equal(captura.camera.ativa(), false);
  });

  test('iniciar() sem argumentos abre a câmera traseira sem preview', async () => {
    const resultado = await captura.camera.iniciar();

    assert.equal(resultado.video.parentNode, null);
    assert.equal(ambiente.container.children.length, 0);
    assert.deepEqual(
      ambiente.chamadas.userMedia[0].video.facingMode,
      { ideal: 'environment' }
    );
    assert.equal(ambiente.chamadas.userMedia[0].audio, false);
    assert.ok(captura.camera.ativa());
  });

  test('valida opções e elemento', async () => {
    await assert.rejects(() => captura.camera.iniciar('opcoes'), TypeError);
    await assert.rejects(() => captura.camera.iniciar(null), TypeError);
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: 123 }),
      TypeError
    );
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#inexistente' }),
      (erro) => {
        assert.equal(erro.name, 'NotFoundError');
        assert.match(erro.message, /nenhum elemento encontrado/i);
        return true;
      }
    );
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera', camera: 'lateral' }),
      TypeError
    );
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera', audio: 'sim' }),
      TypeError
    );
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera', largura: 0 }),
      RangeError
    );
    await assert.rejects(
      () => captura.camera.iniciar({ elemento: {} }),
      /contêiner válido/i
    );
  });

  test('informa APIs ausentes, contexto inseguro e permissão negada', async () => {
    ambiente.navegador.mediaDevices = {};

    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera' }),
      (erro) => {
        assert.equal(erro.name, 'NotSupportedError');
        assert.match(erro.message, /getUserMedia/i);
        return true;
      }
    );

    removerAmbiente();
    ambiente = criarAmbiente();
    globalThis.isSecureContext = false;

    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera' }),
      (erro) => {
        assert.equal(erro.name, 'SecurityError');
        assert.match(erro.message, /HTTPS|localhost/i);
        return true;
      }
    );

    removerAmbiente();
    ambiente = criarAmbiente();
    ambiente.definirUserMedia(() => {
      const erro = new Error('Permission denied');
      erro.name = 'NotAllowedError';
      throw erro;
    });

    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera' }),
      (erro) => {
        assert.equal(erro.name, 'NotAllowedError');
        assert.match(erro.message, /permissão negada/i);
        assert.equal(erro.causa.name, 'NotAllowedError');
        return true;
      }
    );
  });
});

describe('câmera: frames', () => {
  test('captura antes da inicialização falha com InvalidStateError', async () => {
    await assert.rejects(
      () => captura.camera.frame(),
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /não está ativa/i);
        return true;
      }
    );
  });

  test('retorna Blob PNG por padrão', async () => {
    await captura.camera.iniciar({ elemento: '#camera' });

    const blob = await captura.camera.frame();

    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'image/png');
  });

  test('retorna base64 sem prefixo e Data URL completa', async () => {
    await captura.camera.iniciar({ elemento: '#camera' });

    const base64 = await captura.camera.frame({ formato: 'base64' });
    assert.equal(base64, BASE64_DE_TESTE);
    assert.equal(base64.startsWith('data:'), false);

    const dataURL = await captura.camera.frame({ formato: 'dataURL' });
    assert.equal(dataURL, `data:image/png;base64,${BASE64_DE_TESTE}`);
  });

  test('retorna ArrayBuffer e Uint8Array', async () => {
    await captura.camera.iniciar({ elemento: '#camera' });

    const arrayBuffer = await captura.camera.frame({ formato: 'arrayBuffer' });
    assert.ok(arrayBuffer instanceof ArrayBuffer);
    assert.deepEqual(
      Array.from(new Uint8Array(arrayBuffer)),
      [1, 2, 3, 4]
    );

    const buffer = await captura.camera.frame({ formato: 'buffer' });
    assert.ok(buffer instanceof Uint8Array);
    assert.equal(Buffer.isBuffer(buffer), false);
    assert.deepEqual(Array.from(buffer), [1, 2, 3, 4]);
  });

  test('retorna ImageBitmap real e canvas real para os formatos dedicados', async () => {
    const { video } = await captura.camera.iniciar({ elemento: '#camera' });

    const bitmap = await captura.camera.frame({ formato: 'bitmap' });
    assert.equal(bitmap.__bitmap, true);
    assert.equal(bitmap.width, 640);
    assert.equal(bitmap.height, 480);

    const canvas = await captura.camera.frame({ formato: 'canvas' });
    assert.ok(canvas instanceof CanvasFalso);
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 480);
    assert.equal(canvas.draws.length, 1);
    assert.equal(canvas.draws[0].origem, video);
    assert.deepEqual(canvas.limpezas[0], {
      x: 0,
      y: 0,
      largura: 640,
      altura: 480
    });
  });

  test('aplica JPEG/WebP e qualidade', async () => {
    const { video } = await captura.camera.iniciar({ elemento: '#camera' });

    const jpeg = await captura.camera.frame({ formato: 'jpeg', qualidade: 0.8 });
    assert.ok(jpeg instanceof Blob);
    assert.equal(jpeg.type, 'image/jpeg');

    const canvasUsado = ambiente.documento.criados.find(
      (elemento) => elemento instanceof CanvasFalso
    );
    assert.equal(canvasUsado.ultimoMime, 'image/jpeg');
    assert.equal(canvasUsado.ultimaQualidade, 0.8);

    const webp = await captura.camera.frame({ formato: 'webp', qualidade: 0.5 });
    assert.equal(webp.type, 'image/webp');

    const base64Jpeg = await captura.camera.frame({
      formato: 'base64',
      tipo: 'jpeg',
      qualidade: 0.9
    });
    assert.equal(base64Jpeg, BASE64_DE_TESTE);
    assert.equal(canvasUsado.ultimoMime, 'image/jpeg');
    assert.equal(canvasUsado.ultimaQualidade, 0.9);
    assert.equal(video.videoWidth, 640);
  });

  test('redimensiona preservando a proporção e permite distorção explícita', async () => {
    await captura.camera.iniciar({ elemento: '#camera' });

    const larguraApenas = await captura.camera.frame({
      formato: 'canvas',
      largura: 320
    });
    assert.equal(larguraApenas.width, 320);
    assert.equal(larguraApenas.height, 240);
    assert.deepEqual(
      {
        largura: larguraApenas.draws[0].largura,
        altura: larguraApenas.draws[0].altura
      },
      { largura: 320, altura: 240 }
    );

    const alturaApenas = await captura.camera.frame({
      formato: 'canvas',
      altura: 240
    });
    assert.equal(alturaApenas.width, 320);
    assert.equal(alturaApenas.height, 240);

    const contida = await captura.camera.frame({
      formato: 'canvas',
      largura: 100,
      altura: 100
    });
    assert.equal(contida.width, 100);
    assert.equal(contida.height, 75);

    const distorcida = await captura.camera.frame({
      formato: 'canvas',
      largura: 100,
      altura: 100,
      permitirDistorcao: true
    });
    assert.equal(distorcida.width, 100);
    assert.equal(distorcida.height, 100);
  });

  test('valida opções de frame e estado do vídeo', async () => {
    const { video } = await captura.camera.iniciar({ elemento: '#camera' });

    await assert.rejects(
      () => captura.camera.frame({ formato: 'gif' }),
      TypeError
    );
    await assert.rejects(
      () => captura.camera.frame({ qualidade: 1.5 }),
      RangeError
    );
    await assert.rejects(
      () => captura.camera.frame({ largura: -1 }),
      RangeError
    );

    video.readyState = 1;
    await assert.rejects(
      () => captura.camera.frame(),
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /ainda não está pronto/i);
        return true;
      }
    );

    video.readyState = 4;
    video.videoWidth = 0;
    await assert.rejects(
      () => captura.camera.frame(),
      /não possui dimensões válidas/i
    );
  });

  test('não compartilha um canvas mutável entre capturas concorrentes', async () => {
    await captura.camera.iniciar({ elemento: '#camera' });

    const [primeiroCanvas, segundoCanvas] = await Promise.all([
      captura.camera.frame({ formato: 'canvas' }),
      captura.camera.frame({ formato: 'canvas' })
    ]);

    assert.notEqual(primeiroCanvas, segundoCanvas);
    assert.equal(primeiroCanvas.width, 640);
    assert.equal(segundoCanvas.width, 640);

    const [primeiroBlob, segundoBlob] = await Promise.all([
      captura.camera.frame(),
      captura.camera.frame()
    ]);

    assert.ok(primeiroBlob instanceof Blob);
    assert.ok(segundoBlob instanceof Blob);
    assert.equal(primeiroBlob.type, 'image/png');
    assert.equal(segundoBlob.type, 'image/png');
  });
});

describe('câmera: alternância e encerramento', () => {
  test('alterna entre traseira e frontal mantendo o mesmo vídeo e contêiner', async () => {
    const primeiro = await captura.camera.iniciar({ elemento: '#camera' });

    assert.deepEqual(
      ambiente.chamadas.userMedia[0].video.facingMode,
      { ideal: 'environment' }
    );

    const segundo = await captura.camera.alternar();

    assert.deepEqual(
      ambiente.chamadas.userMedia[1].video.facingMode,
      { ideal: 'user' }
    );
    assert.equal(primeiro.stream.faixas[0].stopCalls, 1);
    assert.equal(segundo.video, primeiro.video);
    assert.equal(segundo.video.parentNode, ambiente.container);
    assert.equal(ambiente.container.children.length, 1);
    assert.equal(captura.camera.ativa(), true);

    const terceiro = await captura.camera.alternar();

    assert.deepEqual(
      ambiente.chamadas.userMedia[2].video.facingMode,
      { ideal: 'environment' }
    );
    assert.equal(segundo.stream.faixas[0].stopCalls, 1);
    assert.equal(terceiro.video, primeiro.video);
    assert.equal(captura.camera.ativa(), true);
  });

  test('alternar antes da inicialização falha com InvalidStateError', async () => {
    await assert.rejects(
      () => captura.camera.alternar(),
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /não está ativa/i);
        return true;
      }
    );
  });

  test('rejeita quando o dispositivo devolve a mesma câmera', async () => {
    ambiente.definirUserMedia(
      () => new FluxoFalso([new FaixaFalsa({ settings: CONFIGURACOES_TRASEIRA })])
    );

    const { video } = await captura.camera.iniciar({ elemento: '#camera' });

    await assert.rejects(
      () => captura.camera.alternar(),
      (erro) => {
        assert.equal(erro.name, 'NotFoundError');
        assert.match(erro.message, /não disponibilizou/i);
        return true;
      }
    );

    assert.equal(captura.camera.ativa(), false);
    assert.equal(video.parentNode, null);
    assert.equal(ambiente.container.children.length, 0);
  });

  test('rejeita falha de permissão na alternância e limpa a sessão', async () => {
    let chamada = 0;

    ambiente.definirUserMedia(() => {
      chamada += 1;
      if (chamada === 2) {
        const erro = new Error('Permission denied');
        erro.name = 'NotAllowedError';
        throw erro;
      }
      return new FluxoFalso([
        new FaixaFalsa({ settings: CONFIGURACOES_TRASEIRA })
      ]);
    });

    const { video } = await captura.camera.iniciar({ elemento: '#camera' });

    await assert.rejects(
      () => captura.camera.alternar(),
      (erro) => {
        assert.equal(erro.name, 'NotAllowedError');
        assert.match(erro.message, /permissão negada/i);
        return true;
      }
    );

    assert.equal(captura.camera.ativa(), false);
    assert.equal(video.parentNode, null);
    assert.equal(ambiente.container.children.length, 0);
  });

  test('parar libera faixas, remove só o vídeo criado e permite reiniciar', async () => {
    const outroElemento = new ContainerFalso('SPAN');
    ambiente.container.appendChild(outroElemento);

    const primeiro = await captura.camera.iniciar({ elemento: '#camera' });
    assert.equal(ambiente.container.children.length, 2);

    assert.equal(captura.camera.parar(), true);
    assert.equal(primeiro.stream.faixas[0].stopCalls, 1);
    assert.equal(primeiro.video.srcObject, null);
    assert.equal(primeiro.video.parentNode, null);
    assert.deepEqual(ambiente.container.children, [outroElemento]);
    assert.equal(captura.camera.ativa(), false);
    assert.equal(captura.camera.parar(), false);

    const segundo = await captura.camera.iniciar({ elemento: '#camera' });
    assert.notEqual(segundo.video, primeiro.video);
    assert.equal(segundo.video.parentNode, ambiente.container);
    assert.equal(ambiente.container.children.length, 2);
    assert.ok(captura.camera.ativa());
  });

  test('iniciar novamente com sessão ativa encerra a sessão anterior', async () => {
    const primeiro = await captura.camera.iniciar({ elemento: '#camera' });
    const segundo = await captura.camera.iniciar({ elemento: '#camera' });

    assert.equal(primeiro.stream.faixas[0].stopCalls, 1);
    assert.notEqual(primeiro.video, segundo.video);
    assert.equal(ambiente.chamadas.userMedia.length, 2);
    assert.equal(ambiente.container.children.length, 1);
    assert.ok(captura.camera.ativa());
  });

  test('encerra a sessão quando a faixa de vídeo termina', async () => {
    const { video, stream } = await captura.camera.iniciar({ elemento: '#camera' });

    stream.faixas[0].encerrar();

    assert.equal(captura.camera.ativa(), false);
    assert.equal(video.srcObject, null);
    assert.equal(video.parentNode, null);
  });
});

describe('tela: inicialização, frames e encerramento', () => {
  test('inicia sem exibir o vídeo e sem áudio por padrão', async () => {
    const resultado = await captura.tela.iniciar();

    assert.deepEqual(ambiente.chamadas.displayMedia[0], {
      video: true,
      audio: false
    });
    assert.ok(resultado.video instanceof VideoFalso);
    assert.equal(resultado.video.parentNode, null);
    assert.equal(resultado.video.muted, true);
    assert.ok(resultado.stream instanceof FluxoFalso);
    assert.equal(captura.tela.ativa(), true);
  });

  test('exibe o vídeo no contêiner e aceita áudio', async () => {
    const resultado = await captura.tela.iniciar({
      elemento: '#tela',
      audio: true
    });

    assert.deepEqual(ambiente.chamadas.displayMedia[0], {
      video: true,
      audio: true
    });
    assert.equal(resultado.video.parentNode, ambiente.containerTela);
    assert.equal(ambiente.containerTela.children.length, 1);
    assert.equal(resultado.video.muted, false);
    assert.equal(resultado.video.attributes['data-captura-cm'], 'tela');
  });

  test('valida opções, elemento e suporte', async () => {
    await assert.rejects(() => captura.tela.iniciar('opcoes'), TypeError);
    await assert.rejects(
      () => captura.tela.iniciar({ audio: 'sim' }),
      TypeError
    );
    await assert.rejects(
      () => captura.tela.iniciar({ elemento: '#inexistente' }),
      (erro) => {
        assert.equal(erro.name, 'NotFoundError');
        return true;
      }
    );

    ambiente.navegador.mediaDevices.getDisplayMedia = undefined;

    await assert.rejects(
      () => captura.tela.iniciar(),
      (erro) => {
        assert.equal(erro.name, 'NotSupportedError');
        assert.match(erro.message, /getDisplayMedia/i);
        return true;
      }
    );
  });

  test('propaga permissão negada com mensagem clara', async () => {
    ambiente.definirDisplayMedia(() => {
      const erro = new Error('Permission denied');
      erro.name = 'NotAllowedError';
      throw erro;
    });

    await assert.rejects(
      () => captura.tela.iniciar(),
      (erro) => {
        assert.equal(erro.name, 'NotAllowedError');
        assert.match(erro.message, /captura de tela/i);
        assert.match(erro.message, /permissão negada/i);
        assert.equal(erro.causa.name, 'NotAllowedError');
        return true;
      }
    );
  });

  test('captura frames com o mesmo sistema de formatos da câmera', async () => {
    const { video } = await captura.tela.iniciar();

    const blob = await captura.tela.frame();
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'image/png');

    const base64 = await captura.tela.frame({ formato: 'base64', tipo: 'jpeg' });
    assert.equal(base64, BASE64_DE_TESTE);

    const canvas = await captura.tela.frame({
      formato: 'canvas',
      largura: 320
    });
    assert.equal(canvas.width, 320);
    assert.equal(canvas.height, 240);
    assert.equal(canvas.draws[0].origem, video);
  });

  test('frame antes da inicialização falha com InvalidStateError', async () => {
    await assert.rejects(
      () => captura.tela.frame(),
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /não está ativa/i);
        return true;
      }
    );
  });

  test('encerra ao interromper o compartilhamento pelo navegador', async () => {
    const { video, stream } = await captura.tela.iniciar({ elemento: '#tela' });

    stream.faixas[0].encerrar();

    assert.equal(captura.tela.ativa(), false);
    assert.equal(video.srcObject, null);
    assert.equal(video.parentNode, null);
    assert.equal(ambiente.containerTela.children.length, 0);
  });

  test('parar encerra a sessão e permite reiniciar', async () => {
    const primeiro = await captura.tela.iniciar({ elemento: '#tela' });

    assert.equal(captura.tela.parar(), true);
    assert.equal(primeiro.stream.faixas[0].stopCalls, 1);
    assert.equal(primeiro.video.parentNode, null);
    assert.equal(captura.tela.ativa(), false);
    assert.equal(captura.tela.parar(), false);

    const segundo = await captura.tela.iniciar({ elemento: '#tela' });
    assert.equal(ambiente.chamadas.displayMedia.length, 2);
    assert.notEqual(segundo.video, primeiro.video);
    assert.ok(captura.tela.ativa());
  });

  test('câmera e tela mantêm sessões independentes', async () => {
    const camera = await captura.camera.iniciar({ elemento: '#camera' });
    const tela = await captura.tela.iniciar({ elemento: '#tela' });

    assert.ok(captura.camera.ativa());
    assert.ok(captura.tela.ativa());

    captura.tela.parar();

    assert.equal(captura.tela.ativa(), false);
    assert.equal(captura.camera.ativa(), true);
    assert.equal(camera.stream.faixas[0].stopCalls, 0);
    assert.equal(tela.stream.faixas[0].stopCalls, 1);
    assert.equal(ambiente.containerCamera.children.length, 1);
    assert.equal(ambiente.containerTela.children.length, 0);
  });
});

describe('sessões: cancelamento e concorrência', () => {
  test('parar durante a inicialização cancela a operação e libera o fluxo', async () => {
    let liberar;
    const espera = new Promise((resolve) => {
      liberar = resolve;
    });

    ambiente.definirUserMedia(async () => {
      await espera;
      return new FluxoFalso([
        new FaixaFalsa({ settings: CONFIGURACOES_TRASEIRA })
      ]);
    });

    const promessa = captura.camera.iniciar({ elemento: '#camera' });
    await Promise.resolve();
    captura.camera.parar();
    liberar();

    await assert.rejects(
      promessa,
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /cancelada/i);
        return true;
      }
    );

    assert.equal(captura.camera.ativa(), false);
    assert.equal(ambiente.container.children.length, 0);
  });

  test('uma segunda operação simultânea é rejeitada', async () => {
    let liberar;
    const espera = new Promise((resolve) => {
      liberar = resolve;
    });

    ambiente.definirUserMedia(async () => {
      await espera;
      return new FluxoFalso([
        new FaixaFalsa({ settings: CONFIGURACOES_TRASEIRA })
      ]);
    });

    const primeira = captura.camera.iniciar({ elemento: '#camera' });

    await assert.rejects(
      () => captura.camera.iniciar({ elemento: '#camera' }),
      (erro) => {
        assert.equal(erro.name, 'InvalidStateError');
        assert.match(erro.message, /em andamento/i);
        return true;
      }
    );

    liberar();
    await primeira;
    assert.ok(captura.camera.ativa());
  });
});
