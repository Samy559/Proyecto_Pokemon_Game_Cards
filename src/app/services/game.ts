import { Injectable } from '@angular/core';
import { Carta } from '../models/carta';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  constructor() {}

  barajarMazo(cartas: Carta[]): Carta[] {
    const mazo = [...cartas];

    for (let i = mazo.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
    }

    return mazo;
  }

  robarCartas(mazo: Carta[], cantidad: number): {
    cartasRobadas: Carta[];
    mazoRestante: Carta[];
  } {
    const cartasRobadas = mazo.slice(0, cantidad);
    const mazoRestante = mazo.slice(cantidad);

    return {
      cartasRobadas,
      mazoRestante
    };
  }

  clonarCarta(carta: Carta): Carta {
    return {
      ...carta,
      vidaActual: carta.vida
    };
  }
    calcularDañoContraCarta(cartaAtacante: Carta, cartaDefensora: Carta): {
    vidaDefensora: number;
    vidaAtacante: number;
    mensaje: string;
  } {
    let vidaDefensora = cartaDefensora.vidaActual;
    let vidaAtacante = cartaAtacante.vidaActual;

    if (cartaAtacante.ataque > cartaDefensora.defensa) {
      const daño = cartaAtacante.ataque - cartaDefensora.defensa;
      vidaDefensora -= daño;

      return {
        vidaDefensora,
        vidaAtacante,
        mensaje: `${cartaAtacante.nombre} causó ${daño} de daño a ${cartaDefensora.nombre}.`
      };
    }

    if (cartaAtacante.ataque < cartaDefensora.defensa) {
      const daño = cartaDefensora.defensa - cartaAtacante.ataque;
      vidaAtacante -= daño;

      return {
        vidaDefensora,
        vidaAtacante,
        mensaje: `${cartaAtacante.nombre} no superó la defensa y recibió ${daño} de daño.`
      };
    }

    return {
      vidaDefensora,
      vidaAtacante,
      mensaje: 'El ataque y la defensa fueron iguales. No hubo daño.'
    };
  }

  calcularDañoDirecto(cartaAtacante: Carta): number {
    return cartaAtacante.ataque * 10;
  }
}