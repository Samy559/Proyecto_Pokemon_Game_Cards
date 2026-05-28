import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { NgFor, NgIf, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { Carta } from '../../models/carta';

import { HistorialService } from '../../services/historial';
import { HistorialPartida } from '../../models/historial-partida';

import { SupabaseService } from '../../services/supabase';
import { MazoService } from '../../services/mazo';
import { AudioService } from '../../services/audio';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-juego-cpu',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, CartaPokemon],
  templateUrl: './juego-cpu.html',
  styleUrl: './juego-cpu.css'
})
export class JuegoCpu implements OnInit, OnDestroy {
  vidaJugador = 4000;
  vidaCpu = 4000;

  mazoJugador: Carta[] = [];
  manoJugador: Carta[] = [];
  campoJugador: Carta[] = [];
  descarteJugador: Carta[] = [];

  mazoCpu: Carta[] = [];
  manoCpu: Carta[] = [];
  campoCpu: Carta[] = [];
  descarteCpu: Carta[] = [];

  turno: 'jugador' | 'cpu' = 'jugador';
  mensaje = 'Preparando partida...';
  cargando = true;

  tiempoTurno = 60;
  temporizador: any;

  cartaJugadorSeleccionada: number | null = null;

  yaRobo = false;
  yaInvoco = false;
  yaAtaco = false;
  yaUsoHabilidad = false;

  cpuUsoHabilidad = false;

  turnosPerdidosJugador = 0;
  turnosPerdidosCpu = 0;
  venenoJugador = 0;
  venenoCpu = 0;

  efectoShakeJugador = false;
  efectoShakeCpu = false;

  partidaTerminada = false;
  resultadoPartida = '';
  historialGuardado = false;

  constructor(
    private pokemonService: PokemonService,
    private gameService: GameService,
    private historialService: HistorialService,
    private supabaseService: SupabaseService,
    private mazoService: MazoService,
    private audioService: AudioService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startBattleMusic();
      this.iniciarPartida();
    }
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startMenuMusic();
    }
  }

  iniciarPartida(): void {
    this.cargando = true;
    this.mensaje = 'Cargando cartas desde la API de Pokémon...';

    this.vidaJugador = 4000;
    this.vidaCpu = 4000;

    this.mazoJugador = [];
    this.manoJugador = [];
    this.campoJugador = [];
    this.descarteJugador = [];

    this.mazoCpu = [];
    this.manoCpu = [];
    this.campoCpu = [];
    this.descarteCpu = [];

    this.turno = 'jugador';
    this.partidaTerminada = false;
    this.resultadoPartida = '';
    this.historialGuardado = false;
    this.cpuUsoHabilidad = false;
    this.turnosPerdidosJugador = 0;
    this.turnosPerdidosCpu = 0;
    this.venenoJugador = 0;
    this.venenoCpu = 0;
    this.reiniciarAccionesJugador();

    this.pokemonService.obtenerPokemones().subscribe({
      next: (cartas) => {
        const mazoGuardado = this.mazoService.obtenerMazo();

        const cartasJugadorBase =
          mazoGuardado.length >= 5 ? mazoGuardado : cartas;

        const cartasClonadasJugador = cartasJugadorBase.map((carta) =>
          this.gameService.clonarCarta(carta)
        );

        const cartasClonadasCpu = cartas.map((carta) =>
          this.gameService.clonarCarta(carta)
        );

        this.mazoJugador = this.gameService.barajarMazo(cartasClonadasJugador);
        this.mazoCpu = this.gameService.barajarMazo(cartasClonadasCpu);

        if (mazoGuardado.length >= 5) {
          this.mensaje = 'Usando tu mazo personalizado...';
        }

        const roboJugador = this.gameService.robarCartas(this.mazoJugador, 5);
        this.manoJugador = roboJugador.cartasRobadas;
        this.mazoJugador = roboJugador.mazoRestante;

        const roboCpu = this.gameService.robarCartas(this.mazoCpu, 5);
        this.manoCpu = roboCpu.cartasRobadas;
        this.mazoCpu = roboCpu.mazoRestante;

        this.cargando = false;

        if (mazoGuardado.length >= 5) {
          this.mensaje = 'Partida iniciada con tu mazo personalizado. Es tu turno.';
        } else {
          this.mensaje = 'Partida iniciada con mazo aleatorio. Es tu turno.';
        }

        this.reiniciarAccionesJugador();
        this.iniciarTemporizador();
      },
      error: () => {
        this.cargando = false;
        this.mensaje = 'Error al cargar cartas para la partida.';
      }
    });
  }

  robarCartaJugador(): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    if (this.yaRobo) {
      this.mensaje = 'Ya robaste una carta en este turno.';
      return;
    }

    if (this.mazoJugador.length === 0) {
      this.mensaje = 'No tienes más cartas en el mazo.';
      return;
    }

    const robo = this.gameService.robarCartas(this.mazoJugador, 1);
    this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
    this.mazoJugador = robo.mazoRestante;

    this.yaRobo = true;
    this.mensaje = 'Robaste una carta.';
    this.audioService.playDrawCard();
  }

  invocarCarta(indice: number): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    if (this.yaInvoco) {
      this.mensaje = 'Ya invocaste una carta en este turno.';
      return;
    }

    if (this.campoJugador.length >= 5) {
      this.mensaje = 'Tu campo ya tiene el máximo de 5 cartas.';
      return;
    }

    const carta = this.manoJugador[indice];

    this.campoJugador.push(carta);
    this.manoJugador.splice(indice, 1);

    this.yaInvoco = true;
    this.mensaje = `Invocaste a ${carta.nombre}.`;
    this.audioService.playBeep();
  }

  seleccionarCartaJugador(indice: number): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    this.cartaJugadorSeleccionada = indice;
    this.mensaje = `Seleccionaste a ${this.campoJugador[indice].nombre} para atacar.`;
    this.audioService.playBeep();
  }

  atacarCartaCpu(indiceCpu: number): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    if (this.yaAtaco) {
      this.mensaje = 'Ya atacaste en este turno.';
      return;
    }

    if (this.cartaJugadorSeleccionada === null) {
      this.mensaje = 'Primero selecciona una carta de tu campo.';
      return;
    }

    const atacante = this.campoJugador[this.cartaJugadorSeleccionada];
    const defensora = this.campoCpu[indiceCpu];

    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    this.audioService.playAttack();

    atacante.animAtacando = true;
    defensora.animRecibiendoDano = true;

    setTimeout(() => {
      atacante.animAtacando = false;
      defensora.animRecibiendoDano = false;

      const resultado = this.gameService.calcularDañoContraCarta(
        atacante,
        defensora
      );

      defensora.vidaActual = resultado.vidaDefensora;
      atacante.vidaActual = resultado.vidaAtacante;

      this.mensaje = resultado.mensaje;

      if (defensora.vidaActual <= 0) {
        const idx = this.campoCpu.indexOf(defensora);
        if (idx > -1) {
          this.descarteCpu.push(defensora);
          this.campoCpu.splice(idx, 1);
        }
        this.mensaje += ` ${defensora.nombre} fue destruido.`;
      }

      if (atacante.vidaActual <= 0) {
        const idx = this.campoJugador.indexOf(atacante);
        if (idx > -1) {
          this.descarteJugador.push(atacante);
          this.campoJugador.splice(idx, 1);
        }
        this.mensaje += ` ${atacante.nombre} fue destruido.`;
      }

      this.verificarGanador();
    }, 500);
  }

  atacarDirectoCpu(): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    if (this.yaAtaco) {
      this.mensaje = 'Ya atacaste en este turno.';
      return;
    }

    if (this.cartaJugadorSeleccionada === null) {
      this.mensaje = 'Primero selecciona una carta de tu campo.';
      return;
    }

    if (this.campoCpu.length > 0) {
      this.mensaje = 'No puedes atacar directo mientras la CPU tenga cartas en campo.';
      return;
    }

    const atacante = this.campoJugador[this.cartaJugadorSeleccionada];
    
    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    this.audioService.playAttack();

    atacante.animAtacando = true;
    this.efectoShakeCpu = true;

    setTimeout(() => {
      atacante.animAtacando = false;
      this.efectoShakeCpu = false;

      const daño = this.gameService.calcularDañoDirecto(atacante);

      this.vidaCpu -= daño;
      this.mensaje = `${atacante.nombre} atacó directamente y causó ${daño} de daño.`;

      this.verificarGanador();
    }, 500);
  }

  usarHabilidadJugador(indice: number): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    if (this.yaUsoHabilidad) {
      this.mensaje = 'Ya usaste una habilidad en este turno.';
      return;
    }

    const carta = this.campoJugador[indice];
    const tipoPrincipal = carta.tipos[0];

    this.yaUsoHabilidad = true;
    this.audioService.playBeep();

    carta.animHabilidad = true;

    setTimeout(() => {
      carta.animHabilidad = false;

      if (tipoPrincipal === 'fire') {
        carta.multiplicadorAtaqueTemporal = 2;
        this.mensaje = `${carta.nombre} usó habilidad de fuego y duplicó su ataque este turno.`;
      } else if (tipoPrincipal === 'grass') {
        this.vidaJugador += 1000;
        if (this.vidaJugador > 4000) this.vidaJugador = 4000;
        this.mensaje = `${carta.nombre} usó habilidad de planta y te curó 1000 puntos de vida.`;
      } else if (tipoPrincipal === 'water') {
        if (this.campoCpu.length === 0) {
          this.mensaje = 'No hay cartas rivales para reducir defensa.';
          return;
        }
        this.campoCpu.forEach(c => {
          c.defensa -= 20;
          if (c.defensa < 0) c.defensa = 0;
        });
        this.mensaje = `${carta.nombre} usó habilidad de agua y redujo la defensa de todas las cartas enemigas en 20.`;
      } else if (tipoPrincipal === 'electric') {
        this.vidaCpu -= 500;
        this.mensaje = `${carta.nombre} usó habilidad eléctrica y causó 500 de daño directo a la CPU.`;
        this.efectoShakeCpu = true;
        setTimeout(() => this.efectoShakeCpu = false, 500);
        this.verificarGanador();
      } else if (tipoPrincipal === 'psychic') {
        this.turnosPerdidosCpu = 1;
        this.mensaje = `${carta.nombre} usó habilidad psíquica. ¡La CPU perderá su próximo turno!`;
      } else if (tipoPrincipal === 'poison') {
        this.venenoCpu = 300;
        this.mensaje = `${carta.nombre} usó habilidad de veneno. ¡La CPU perderá 300 PV cada turno!`;
      } else if (tipoPrincipal === 'fighting') {
        carta.ignoraDefensa = true;
        this.mensaje = `${carta.nombre} usó habilidad de lucha e ignorará la defensa en su próximo ataque.`;
      } else {
        if (this.mazoJugador.length === 0) {
          this.mensaje = 'No tienes cartas en el mazo para robar.';
          return;
        }
        const robo = this.gameService.robarCartas(this.mazoJugador, 1);
        this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
        this.mazoJugador = robo.mazoRestante;
        this.mensaje = `${carta.nombre} usó una habilidad especial y robaste una carta extra.`;
      }
    }, 800);
  }

  finalizarTurnoJugador(): void {
    if (this.turno !== 'jugador') {
      this.mensaje = 'No es tu turno.';
      return;
    }

    if (this.partidaTerminada) {
      this.mensaje = 'La partida ya terminó.';
      return;
    }

    this.detenerTemporizador();

    this.campoJugador.forEach(c => {
      c.multiplicadorAtaqueTemporal = 1;
      c.ignoraDefensa = false;
    });

    this.turno = 'cpu';
    this.mensaje = 'Turno de la computadora...';
    this.audioService.playBeep();

    setTimeout(() => {
      this.turnoCpu();
    }, 1000);
  }

  turnoCpu(): void {
    if (this.partidaTerminada) {
      return;
    }

    if (this.venenoCpu > 0) {
      this.vidaCpu -= this.venenoCpu;
      this.mensaje = `La CPU sufre ${this.venenoCpu} de daño por veneno.`;
      this.verificarGanador();
      if (this.partidaTerminada) return;
    }

    if (this.turnosPerdidosCpu > 0) {
      this.turnosPerdidosCpu--;
      this.mensaje += ` La CPU está confundida y pierde su turno.`;
      this.campoCpu.forEach(c => {
        c.multiplicadorAtaqueTemporal = 1;
        c.ignoraDefensa = false;
      });
      setTimeout(() => {
        this.iniciarTurnoJugador();
      }, 1500);
      return;
    }

    this.cpuUsoHabilidad = false;

    this.robarCartaCpu();
    this.invocarCartaCpu();
    this.usarHabilidadCpu();

    setTimeout(() => {
      if (this.partidaTerminada) {
        return;
      }

      this.atacarCpu();

      if (!this.partidaTerminada) {
        this.campoCpu.forEach(c => {
          c.multiplicadorAtaqueTemporal = 1;
          c.ignoraDefensa = false;
        });
        this.iniciarTurnoJugador();
      }
    }, 1500);
  }

  iniciarTurnoJugador(): void {
    this.turno = 'jugador';
    this.reiniciarAccionesJugador();

    if (this.venenoJugador > 0) {
      this.vidaJugador -= this.venenoJugador;
      this.mensaje = `Sufres ${this.venenoJugador} de daño por veneno.`;
      this.verificarGanador();
      if (this.partidaTerminada) return;
    }

    if (this.turnosPerdidosJugador > 0) {
      this.turnosPerdidosJugador--;
      this.mensaje += ` ¡Estás confundido y pierdes tu turno!`;
      setTimeout(() => {
        this.finalizarTurnoJugador();
      }, 1500);
      return;
    }

    this.mensaje += ' Es tu turno.';
    this.iniciarTemporizador();
  }

  iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.tiempoTurno = 60;
    if (isPlatformBrowser(this.platformId)) {
      this.temporizador = setInterval(() => {
        if (this.partidaTerminada || this.turno !== 'jugador') {
          this.detenerTemporizador();
          return;
        }
        this.tiempoTurno--;
        if (this.tiempoTurno <= 0) {
          this.mensaje = '¡Tiempo agotado! Tu turno terminó.';
          this.finalizarTurnoJugador();
        }
      }, 1000);
    }
  }

  detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  robarCartaCpu(): void {
    if (this.mazoCpu.length === 0) {
      return;
    }

    const robo = this.gameService.robarCartas(this.mazoCpu, 1);
    this.manoCpu = [...this.manoCpu, ...robo.cartasRobadas];
    this.mazoCpu = robo.mazoRestante;
  }

  invocarCartaCpu(): void {
    if (this.campoCpu.length >= 5) {
      return;
    }

    if (this.manoCpu.length === 0) {
      return;
    }

    let indiceMejorCarta = 0;

    for (let i = 1; i < this.manoCpu.length; i++) {
      if (this.manoCpu[i].ataque > this.manoCpu[indiceMejorCarta].ataque) {
        indiceMejorCarta = i;
      }
    }

    const carta = this.manoCpu[indiceMejorCarta];

    this.campoCpu.push(carta);
    this.manoCpu.splice(indiceMejorCarta, 1);

    this.mensaje = `La computadora invocó a ${carta.nombre}.`;
  }

  usarHabilidadCpu(): void {
    if (this.cpuUsoHabilidad) {
      return;
    }

    if (this.campoCpu.length === 0) {
      return;
    }

    let indiceCarta = 0;

    for (let i = 1; i < this.campoCpu.length; i++) {
      if (this.campoCpu[i].vidaActual < this.campoCpu[indiceCarta].vidaActual) {
        indiceCarta = i;
      }
    }

    const carta = this.campoCpu[indiceCarta];
    const tipoPrincipal = carta.tipos[0];

    if (tipoPrincipal === 'fire') {
      carta.multiplicadorAtaqueTemporal = 2;
      this.mensaje = `CPU: ${carta.nombre} duplicó su ataque este turno.`;
    } else if (tipoPrincipal === 'grass') {
      this.vidaCpu += 1000;
      if (this.vidaCpu > 4000) this.vidaCpu = 4000;
      this.mensaje = `CPU: ${carta.nombre} curó 1000 puntos de vida.`;
    } else if (tipoPrincipal === 'water') {
      if (this.campoJugador.length === 0) return;
      this.campoJugador.forEach(c => {
        c.defensa -= 20;
        if (c.defensa < 0) c.defensa = 0;
      });
      this.mensaje = `CPU: ${carta.nombre} redujo la defensa de todas tus cartas en 20.`;
    } else if (tipoPrincipal === 'electric') {
      this.vidaJugador -= 500;
      this.mensaje = `CPU: ${carta.nombre} causó 500 de daño directo.`;
      this.verificarGanador();
    } else if (tipoPrincipal === 'psychic') {
      this.turnosPerdidosJugador = 1;
      this.mensaje = `CPU: ${carta.nombre} usó psíquico. ¡Perderás tu próximo turno!`;
    } else if (tipoPrincipal === 'poison') {
      this.venenoJugador = 300;
      this.mensaje = `CPU: ${carta.nombre} usó veneno. ¡Perderás 300 PV cada turno!`;
    } else if (tipoPrincipal === 'fighting') {
      carta.ignoraDefensa = true;
      this.mensaje = `CPU: ${carta.nombre} ignorará la defensa en su próximo ataque.`;
    } else {
      if (this.mazoCpu.length === 0) return;
      const robo = this.gameService.robarCartas(this.mazoCpu, 1);
      this.manoCpu = [...this.manoCpu, ...robo.cartasRobadas];
      this.mazoCpu = robo.mazoRestante;
      this.mensaje = `CPU: ${carta.nombre} usó habilidad básica y robó una carta.`;
    }

    this.cpuUsoHabilidad = true;
  }

  atacarCpu(): void {
    if (this.campoCpu.length === 0) {
      this.mensaje = 'La computadora no tiene cartas para atacar.';
      return;
    }

    let indiceAtacante = 0;

    for (let i = 1; i < this.campoCpu.length; i++) {
      if (this.campoCpu[i].ataque > this.campoCpu[indiceAtacante].ataque) {
        indiceAtacante = i;
      }
    }

    const atacante = this.campoCpu[indiceAtacante];

    if (this.campoJugador.length === 0) {
      atacante.animAtacando = true;
      this.efectoShakeJugador = true;

      setTimeout(() => {
        atacante.animAtacando = false;
        this.efectoShakeJugador = false;

        const daño = this.gameService.calcularDañoDirecto(atacante);
        this.vidaJugador -= daño;

        this.mensaje = `La computadora atacó directamente con ${atacante.nombre} y causó ${daño} de daño.`;
        this.verificarGanador();
      }, 500);
      return;
    }

    let indiceDefensora = 0;

    for (let i = 1; i < this.campoJugador.length; i++) {
      if (this.campoJugador[i].vidaActual < this.campoJugador[indiceDefensora].vidaActual) {
        indiceDefensora = i;
      }
    }

    const defensora = this.campoJugador[indiceDefensora];
    
    atacante.animAtacando = true;
    defensora.animRecibiendoDano = true;

    setTimeout(() => {
      atacante.animAtacando = false;
      defensora.animRecibiendoDano = false;

      const resultado = this.gameService.calcularDañoContraCarta(
        atacante,
        defensora
      );

      defensora.vidaActual = resultado.vidaDefensora;
      atacante.vidaActual = resultado.vidaAtacante;

      this.mensaje = `CPU: ${resultado.mensaje}`;

      if (defensora.vidaActual <= 0) {
        const idx = this.campoJugador.indexOf(defensora);
        if (idx > -1) {
          this.descarteJugador.push(defensora);
          this.campoJugador.splice(idx, 1);
        }
        this.mensaje += ` ${defensora.nombre} fue destruido.`;
      }

      if (atacante.vidaActual <= 0) {
        const idx = this.campoCpu.indexOf(atacante);
        if (idx > -1) {
          this.descarteCpu.push(atacante);
          this.campoCpu.splice(idx, 1);
        }
        this.mensaje += ` ${atacante.nombre} fue destruido.`;
      }

      this.verificarGanador();
    }, 500);
  }

  verificarGanador(): void {
    if (this.vidaJugador <= 0) {
      this.vidaJugador = 0;
      this.partidaTerminada = true;
      this.resultadoPartida = 'Derrota';
      this.turno = 'cpu';
      this.mensaje = 'Perdiste la partida. Tus puntos de vida llegaron a 0.';
      this.audioService.playDefeat();
      this.guardarResultadoLocal();
      return;
    }

    if (this.vidaCpu <= 0) {
      this.vidaCpu = 0;
      this.partidaTerminada = true;
      this.resultadoPartida = 'Victoria';
      this.turno = 'cpu';
      this.mensaje = 'Ganaste la partida. La CPU llegó a 0 puntos de vida.';
      this.audioService.playVictory();
      this.guardarResultadoLocal();
      return;
    }

    if (
      this.mazoJugador.length === 0 &&
      this.manoJugador.length === 0 &&
      this.campoJugador.length === 0
    ) {
      this.partidaTerminada = true;
      this.resultadoPartida = 'Derrota';
      this.turno = 'cpu';
      this.mensaje = 'Perdiste porque te quedaste sin cartas disponibles.';
      this.audioService.playDefeat();
      this.guardarResultadoLocal();
      return;
    }

    if (
      this.mazoCpu.length === 0 &&
      this.manoCpu.length === 0 &&
      this.campoCpu.length === 0
    ) {
      this.partidaTerminada = true;
      this.resultadoPartida = 'Victoria';
      this.turno = 'cpu';
      this.mensaje = 'Ganaste porque la CPU se quedó sin cartas disponibles.';
      this.audioService.playVictory();
      this.guardarResultadoLocal();
      return;
    }
  }

  reiniciarAccionesJugador(): void {
    this.yaRobo = false;
    this.yaInvoco = false;
    this.yaAtaco = false;
    this.yaUsoHabilidad = false;
    this.cartaJugadorSeleccionada = null;
  }

  guardarResultadoLocal(): void {
    if (this.historialGuardado) {
      return;
    }

    const partida: HistorialPartida = {
      id: Date.now(),
      modo: 'Jugador contra computadora',
      resultado: this.resultadoPartida,
      vidaJugador: this.vidaJugador,
      vidaCpu: this.vidaCpu,
      fecha: new Date().toLocaleString()
    };

    this.historialService.guardarPartida(partida);
    this.historialGuardado = true;

    this.guardarResultadoSupabase();
  }

  async guardarResultadoSupabase(): Promise<void> {
    const { error: resultadoError } =
      await this.supabaseService.guardarResultadoCpu(
        this.resultadoPartida,
        this.vidaJugador,
        this.vidaCpu
      );

    if (resultadoError) {
      console.log('No se pudo guardar el resultado en Supabase:', resultadoError.message);
      return;
    }

    const { error: estadisticasError } =
      await this.supabaseService.actualizarEstadisticasPerfil(this.resultadoPartida);

    if (estadisticasError) {
      console.log('No se pudieron actualizar las estadísticas:', estadisticasError.message);
    }
  }
}
