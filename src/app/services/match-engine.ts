import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Carta } from '../models/carta';
import { GameService } from './game';

export interface JugadorState {
  vida: number;
  mazo: Carta[];
  mano: Carta[];
  campo: Carta[];
  descarte: Carta[];
  yaRobo: boolean;
  yaInvoco: boolean;
  yaAtaco: boolean;
  yaUsoHabilidad: boolean;
  turnosPerdidos: number;
  veneno: number;
}

export interface MatchState {
  estadoP1: JugadorState;
  estadoP2: JugadorState;
  turnoActual: 'P1' | 'P2';
  partidaTerminada: boolean;
  ganador: 'P1' | 'P2' | null;
  mensajes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MatchEngineService {
  state!: MatchState;

  // Eventos para notificar a la UI (útil para animaciones como shake)
  onAnimShake = new Subject<'P1' | 'P2'>();
  onStateChanged = new Subject<void>(); // Se emite cada vez que el estado cambia

  constructor(private gameService: GameService) {}

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================

  crearEstadoVacio(): JugadorState {
    return {
      vida: 4000,
      mazo: [],
      mano: [],
      campo: [],
      descarte: [],
      yaRobo: false,
      yaInvoco: false,
      yaAtaco: false,
      yaUsoHabilidad: false,
      turnosPerdidos: 0,
      veneno: 0
    };
  }

  inicializarPartida(mazoP1: Carta[], mazoP2: Carta[], robarInicial = 5) {
    this.state = {
      estadoP1: this.crearEstadoVacio(),
      estadoP2: this.crearEstadoVacio(),
      turnoActual: 'P1',
      partidaTerminada: false,
      ganador: null,
      mensajes: ['Preparando partida...']
    };

    this.state.estadoP1.mazo = [...mazoP1];
    this.state.estadoP2.mazo = [...mazoP2];

    const roboP1 = this.gameService.robarCartas(this.state.estadoP1.mazo, robarInicial);
    this.state.estadoP1.mano = roboP1.cartasRobadas;
    this.state.estadoP1.mazo = roboP1.mazoRestante;

    const roboP2 = this.gameService.robarCartas(this.state.estadoP2.mazo, robarInicial);
    this.state.estadoP2.mano = roboP2.cartasRobadas;
    this.state.estadoP2.mazo = roboP2.mazoRestante;

    this.emitChange();
  }

  cargarEstado(estadoRecuperado: MatchState) {
    this.state = estadoRecuperado;
    this.emitChange();
  }

  private emitChange() {
    this.onStateChanged.next();
  }

  // ==========================================
  // MENSAJES BATTLE LOG
  // ==========================================

  agregarMensaje(msg: string) {
    if (this.state.mensajes.length > 0 && msg.startsWith(this.state.mensajes[0])) {
      this.state.mensajes[0] = msg;
    } else {
      this.state.mensajes.unshift(msg);
    }
    if (this.state.mensajes.length > 50) {
      this.state.mensajes.pop();
    }
    this.emitChange();
  }

  // ==========================================
  // HELPER PARA OBTENER JUGADOR
  // ==========================================

  getJugador(jugador: 'P1' | 'P2'): JugadorState {
    return jugador === 'P1' ? this.state.estadoP1 : this.state.estadoP2;
  }

  getRival(jugador: 'P1' | 'P2'): JugadorState {
    return jugador === 'P1' ? this.state.estadoP2 : this.state.estadoP1;
  }

  getNombreJugador(jugador: 'P1' | 'P2', esCpu = false): string {
    if (jugador === 'P1') return 'Tú';
    return esCpu ? 'Computadora' : 'Rival';
  }

  // ==========================================
  // MECÁNICAS
  // ==========================================

  robarCarta(jugador: 'P1' | 'P2', cantidad = 1) {
    const estado = this.getJugador(jugador);
    if (estado.mazo.length === 0) return false;

    const robo = this.gameService.robarCartas(estado.mazo, cantidad);
    estado.mano = [...estado.mano, ...robo.cartasRobadas];
    estado.mazo = robo.mazoRestante;
    
    estado.yaRobo = true;
    this.emitChange();
    return true;
  }

  invocarCarta(jugador: 'P1' | 'P2', indiceMano: number, esCpu = false): boolean {
    const estado = this.getJugador(jugador);
    const nombreJugador = this.getNombreJugador(jugador, esCpu);

    if (estado.campo.length >= 5) {
      this.agregarMensaje(`No puedes invocar. El campo está lleno (máximo 5 cartas).`);
      return false;
    }
    
    const carta = estado.mano[indiceMano];

    if (carta.evolucionaDe) {
      const idxEvolucion = estado.campo.findIndex(c => c.nombre.toLowerCase() === carta.evolucionaDe?.toLowerCase());
      if (idxEvolucion > -1) {
        const preEvolucion = estado.campo[idxEvolucion];
        estado.descarte.push(preEvolucion);
        estado.campo[idxEvolucion] = carta;
        estado.mano.splice(indiceMano, 1);
        
        carta.animEvolucion = true;
        carta.vidaActual = carta.vida; // curar al evolucionar
        setTimeout(() => { carta.animEvolucion = false; this.emitChange(); }, 1500);

        estado.yaInvoco = true;
        this.agregarMensaje(`${nombreJugador} evolucionó su ${preEvolucion.nombre} a ${carta.nombre}!`);
        return true;
      }
      // Si no tiene la pre-evolución, se permite jugarla como una carta normal (sin bonificación de curación de evolución)
    }

    estado.campo.push(carta);
    estado.mano.splice(indiceMano, 1);
    estado.yaInvoco = true;
    
    this.agregarMensaje(`${nombreJugador} invocó a ${carta.nombre}.`);
    this.emitChange();
    return true;
  }

  atacarCarta(atacanteJugador: 'P1' | 'P2', idxAtacante: number, idxDefensor: number, onComplete?: () => void) {
    const estadoA = this.getJugador(atacanteJugador);
    const estadoD = this.getRival(atacanteJugador);

    const atacante = estadoA.campo[idxAtacante];
    const defensora = estadoD.campo[idxDefensor];

    estadoA.yaAtaco = true;
    atacante.animAtacando = true;
    defensora.animRecibiendoDano = true;
    this.emitChange();

    setTimeout(() => {
      atacante.animAtacando = false;
      defensora.animRecibiendoDano = false;

      const resultado = this.gameService.calcularDañoContraCarta(atacante, defensora);

      defensora.vidaActual = resultado.vidaDefensora;
      atacante.vidaActual = resultado.vidaAtacante;

      let msg = resultado.mensaje;

      if (defensora.vidaActual <= 0) {
        estadoD.descarte.push(defensora);
        estadoD.campo.splice(idxDefensor, 1);
        msg += ` ${defensora.nombre} fue destruido.`;
      }

      if (atacante.vidaActual <= 0) {
        const iA = estadoA.campo.indexOf(atacante);
        if (iA > -1) {
          estadoA.descarte.push(atacante);
          estadoA.campo.splice(iA, 1);
        }
        msg += ` ${atacante.nombre} fue destruido.`;
      }

      this.agregarMensaje(msg);
      this.verificarGanador();
      if (onComplete) onComplete();
    }, 500);
  }

  atacarDirecto(atacanteJugador: 'P1' | 'P2', idxAtacante: number, onComplete?: () => void) {
    const estadoA = this.getJugador(atacanteJugador);
    const estadoD = this.getRival(atacanteJugador);

    const atacante = estadoA.campo[idxAtacante];
    
    estadoA.yaAtaco = true;
    atacante.animAtacando = true;
    this.onAnimShake.next(atacanteJugador === 'P1' ? 'P2' : 'P1');
    this.emitChange();

    setTimeout(() => {
      atacante.animAtacando = false;
      const daño = this.gameService.calcularDañoDirecto(atacante);
      estadoD.vida -= daño;

      this.agregarMensaje(`${atacante.nombre} atacó directamente y causó ${daño} de daño.`);
      
      this.verificarGanador();
      if (onComplete) onComplete();
    }, 500);
  }

  usarHabilidad(jugador: 'P1' | 'P2', idxCampo: number, esCpu = false, onComplete?: () => void) {
    const estado = this.getJugador(jugador);
    const rival = this.getRival(jugador);
    const carta = estado.campo[idxCampo];
    const tipoPrincipal = carta.tipos[0];
    const nombreJugador = this.getNombreJugador(jugador, esCpu);

    estado.yaUsoHabilidad = true;
    carta.animHabilidad = true;
    this.emitChange();

    setTimeout(() => {
      carta.animHabilidad = false;

      if (tipoPrincipal === 'fire') {
        carta.multiplicadorAtaqueTemporal = 2;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} duplicó su ataque este turno.`);
      } else if (tipoPrincipal === 'grass') {
        estado.vida += 1000;
        if (estado.vida > 4000) estado.vida = 4000;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} curó 1000 PV.`);
      } else if (tipoPrincipal === 'water') {
        if (rival.campo.length > 0) {
          rival.campo.forEach(c => {
            c.defensa -= 20;
            if (c.defensa < 0) c.defensa = 0;
          });
          this.agregarMensaje(`${nombreJugador}: ${carta.nombre} redujo la defensa enemiga en 20.`);
        } else {
          this.agregarMensaje(`No hay cartas enemigas para reducir defensa.`);
        }
      } else if (tipoPrincipal === 'electric') {
        rival.vida -= 500;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} causó 500 de daño directo.`);
        this.onAnimShake.next(jugador === 'P1' ? 'P2' : 'P1');
        this.verificarGanador();
      } else if (tipoPrincipal === 'psychic') {
        rival.turnosPerdidos = 1;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} usó Psíquico. ¡El rival pierde su próximo turno!`);
      } else if (tipoPrincipal === 'poison') {
        rival.veneno = 300;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} usó Veneno. ¡Daño continuo aplicado!`);
      } else if (tipoPrincipal === 'fighting') {
        carta.ignoraDefensa = true;
        this.agregarMensaje(`${nombreJugador}: ${carta.nombre} ignorará la defensa rival en su próximo ataque.`);
      } else {
        if (estado.mazo.length > 0) {
          this.robarCarta(jugador, 1);
          this.agregarMensaje(`${nombreJugador}: ${carta.nombre} robó una carta extra.`);
        }
      }
      
      this.emitChange();
      if (onComplete) onComplete();
    }, 800);
  }

  finalizarTurno(jugadorActual: 'P1' | 'P2', esCpuRival = false) {
    if (this.state.partidaTerminada) return;

    const estadoA = this.getJugador(jugadorActual);
    const jugadorRival = jugadorActual === 'P1' ? 'P2' : 'P1';
    const estadoD = this.getJugador(jugadorRival);
    const nombreRival = this.getNombreJugador(jugadorRival, esCpuRival);

    // Resetear buffs temporales del jugador que acaba de terminar
    estadoA.campo.forEach(c => {
      c.multiplicadorAtaqueTemporal = 1;
      c.ignoraDefensa = false;
    });

    // Aplicar veneno al jugador que empieza su turno
    if (estadoD.veneno > 0) {
      estadoD.vida -= estadoD.veneno;
      this.agregarMensaje(`${nombreRival} sufre ${estadoD.veneno} de daño por veneno.`);
      this.verificarGanador();
      if (this.state.partidaTerminada) return;
    }

    // Comprobar turnos perdidos del jugador que empieza su turno
    if (estadoD.turnosPerdidos > 0) {
      estadoD.turnosPerdidos--;
      
      estadoD.campo.forEach(c => {
        c.multiplicadorAtaqueTemporal = 1;
        c.ignoraDefensa = false;
      });
      estadoD.yaRobo = false;
      estadoD.yaInvoco = false;
      estadoD.yaAtaco = false;
      estadoD.yaUsoHabilidad = false;
      
      this.agregarMensaje(`${nombreRival} está confundido y pierde su turno.`);
      this.state.turnoActual = jugadorActual; // Devuelve el turno
      
      // Llamamos a reset acciones para el jugador original que recupera su turno
      this.resetearAcciones(jugadorActual);
      this.emitChange();
      return;
    }

    // Cambio de turno normal
    this.resetearAcciones(jugadorRival);
    this.state.turnoActual = jugadorRival;
    this.emitChange();
  }

  private resetearAcciones(jugador: 'P1' | 'P2') {
    const st = this.getJugador(jugador);
    st.yaRobo = false;
    st.yaInvoco = false;
    st.yaAtaco = false;
    st.yaUsoHabilidad = false;
  }

  verificarGanador() {
    if (this.state.partidaTerminada) return;

    const p1Lose = this.state.estadoP1.vida <= 0 || 
                  (this.state.estadoP1.mazo.length === 0 && this.state.estadoP1.mano.length === 0 && this.state.estadoP1.campo.length === 0);
    const p2Lose = this.state.estadoP2.vida <= 0 || 
                  (this.state.estadoP2.mazo.length === 0 && this.state.estadoP2.mano.length === 0 && this.state.estadoP2.campo.length === 0);

    if (p1Lose && p2Lose) {
      this.state.partidaTerminada = true;
      this.state.ganador = null;
      this.agregarMensaje('¡Empate simultáneo!');
    } else if (p1Lose) {
      this.state.partidaTerminada = true;
      this.state.ganador = 'P2';
      this.agregarMensaje('El Jugador 2 (Rival) ha ganado.');
    } else if (p2Lose) {
      this.state.partidaTerminada = true;
      this.state.ganador = 'P1';
      this.agregarMensaje('El Jugador 1 ha ganado.');
    }

    if (this.state.partidaTerminada) {
      this.state.estadoP1.vida = Math.max(0, this.state.estadoP1.vida);
      this.state.estadoP2.vida = Math.max(0, this.state.estadoP2.vida);
      this.emitChange();
    }
  }
}
