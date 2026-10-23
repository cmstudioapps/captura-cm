/**
 * captura-cm
 *
 * Biblioteca leve para captura de câmera, captura de tela e extração de frames
 * em navegadores modernos.
 *
 * Uso:
 *
 *   import captura from 'captura-cm'
 *
 *   await captura.camera.iniciar({ elemento: '#camera' })
 *   const png = await captura.camera.frame()
 */

import * as camera from './camera.js';
import * as tela from './tela.js';

const captura = Object.freeze({ camera, tela });

export { camera, tela };
export default captura;
