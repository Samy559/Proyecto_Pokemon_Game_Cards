import { Injectable } from '@angular/core';
import { Carta } from '../models/carta';

const TYPE_CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, water: 0.5, electric: 2, grass: 0.5, ice: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

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

    const tipoA = cartaAtacante.tipos[0] || 'normal';
    let multiplicador = 1;
    
    for (const tipoD of cartaDefensora.tipos) {
      if (TYPE_CHART[tipoA] && TYPE_CHART[tipoA][tipoD] !== undefined) {
        multiplicador *= TYPE_CHART[tipoA][tipoD];
      }
    }

    const ataqueEfectivo = Math.floor(cartaAtacante.ataque * multiplicador * (cartaAtacante.multiplicadorAtaqueTemporal || 1));
    const defensaEfectiva = cartaAtacante.ignoraDefensa ? 0 : cartaDefensora.defensa;

    let efectividadMsg = '';
    if (multiplicador > 1) efectividadMsg = ' ¡Es muy eficaz!';
    else if (multiplicador < 1 && multiplicador > 0) efectividadMsg = ' No es muy eficaz...';
    else if (multiplicador === 0) efectividadMsg = ' ¡No tiene efecto!';

    if (multiplicador === 0) {
      return {
        vidaDefensora,
        vidaAtacante,
        mensaje: `${cartaAtacante.nombre} atacó a ${cartaDefensora.nombre}.${efectividadMsg} No hubo daño.`
      };
    }

    if (ataqueEfectivo > defensaEfectiva) {
      const daño = ataqueEfectivo - defensaEfectiva;
      vidaDefensora -= daño;

      return {
        vidaDefensora,
        vidaAtacante,
        mensaje: `${cartaAtacante.nombre} atacó a ${cartaDefensora.nombre}.${efectividadMsg} Causó ${daño} de daño.`
      };
    }

    if (ataqueEfectivo < defensaEfectiva) {
      const daño = defensaEfectiva - ataqueEfectivo;
      vidaAtacante -= daño;

      return {
        vidaDefensora,
        vidaAtacante,
        mensaje: `${cartaAtacante.nombre} atacó a ${cartaDefensora.nombre}.${efectividadMsg} No superó la defensa y recibió ${daño} de daño.`
      };
    }

    return {
      vidaDefensora,
      vidaAtacante,
      mensaje: `${cartaAtacante.nombre} atacó a ${cartaDefensora.nombre}.${efectividadMsg} El ataque y la defensa empataron. No hubo daño.`
    };
  }

  calcularDañoDirecto(cartaAtacante: Carta): number {
    return cartaAtacante.ataque * 10;
  }
}