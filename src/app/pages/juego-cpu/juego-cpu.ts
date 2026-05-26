import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { Carta } from '../../models/carta';

import { HistorialService } from '../../services/historial';
import { HistorialPartida } from '../../models/historial-partida';

import { SupabaseService } from '../../services/supabase';
import { MazoService } from '../../services/mazo';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-juego-cpu',
  standalone: true,
  imports: [NgFor, NgIf, TitleCasePipe, RouterLink, CartaPokemon],
  templateUrl: './juego-cpu.html',
  styleUrl: './juego-cpu.css'
})
export class JuegoCpu implements OnInit {
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

  cartaJugadorSeleccionada: number | null = null;

  yaRobo = false;
  yaInvoco = false;
  yaAtaco = false;
  yaUsoHabilidad = false;

  cpuUsoHabilidad = false;

  partidaTerminada = false;
  resultadoPartida = '';
  historialGuardado = false;

  constructor(
    private pokemonService: PokemonService,
    private gameService: GameService,
    private historialService: HistorialService,
    private supabaseService: SupabaseService,
    private mazoService: MazoService
  ) {}

  ngOnInit(): void {
    this.iniciarPartida();
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

    const resultado = this.gameService.calcularDañoContraCarta(
      atacante,
      defensora
    );

    defensora.vidaActual = resultado.vidaDefensora;
    atacante.vidaActual = resultado.vidaAtacante;

    this.mensaje = resultado.mensaje;

    if (defensora.vidaActual <= 0) {
      this.descarteCpu.push(defensora);
      this.campoCpu.splice(indiceCpu, 1);
      this.mensaje += ` ${defensora.nombre} fue destruido.`;
    }

    if (atacante.vidaActual <= 0) {
      this.descarteJugador.push(atacante);
      this.campoJugador.splice(this.cartaJugadorSeleccionada, 1);
      this.mensaje += ` ${atacante.nombre} fue destruido.`;
    }

    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    this.verificarGanador();
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
    const daño = this.gameService.calcularDañoDirecto(atacante);

    this.vidaCpu -= daño;
    this.mensaje = `${atacante.nombre} atacó directamente y causó ${daño} de daño.`;

    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    this.verificarGanador();
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

    if (tipoPrincipal === 'grass') {
      carta.vidaActual += 20;

      if (carta.vidaActual > carta.vida) {
        carta.vidaActual = carta.vida;
      }

      this.mensaje = `${carta.nombre} usó habilidad de planta y recuperó 20 puntos de vida.`;
    } else if (tipoPrincipal === 'fire') {
      carta.ataque += 10;
      this.mensaje = `${carta.nombre} usó habilidad de fuego y aumentó su ataque en 10.`;
    } else if (tipoPrincipal === 'water') {
      if (this.campoCpu.length === 0) {
        this.mensaje = 'No hay cartas rivales para reducir defensa.';
        return;
      }

      const cartaRival = this.campoCpu[0];
      cartaRival.defensa -= 10;

      if (cartaRival.defensa < 0) {
        cartaRival.defensa = 0;
      }

      this.mensaje = `${carta.nombre} usó habilidad de agua y redujo la defensa de ${cartaRival.nombre}.`;
    } else if (tipoPrincipal === 'electric') {
      const daño = 200;
      this.vidaCpu -= daño;
      this.mensaje = `${carta.nombre} usó habilidad eléctrica y causó ${daño} de daño directo a la CPU.`;
      this.verificarGanador();
    } else {
      if (this.mazoJugador.length === 0) {
        this.mensaje = 'No tienes cartas en el mazo para robar.';
        return;
      }

      const robo = this.gameService.robarCartas(this.mazoJugador, 1);
      this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
      this.mazoJugador = robo.mazoRestante;

      this.mensaje = `${carta.nombre} usó una habilidad básica y robaste una carta extra.`;
    }

    this.yaUsoHabilidad = true;
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

    this.turno = 'cpu';
    this.mensaje = 'Turno de la computadora...';

    setTimeout(() => {
      this.turnoCpu();
    }, 1000);
  }

  turnoCpu(): void {
    if (this.partidaTerminada) {
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
        this.turno = 'jugador';
        this.reiniciarAccionesJugador();
        this.mensaje += ' Es tu turno.';
      }
    }, 1000);
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

    if (tipoPrincipal === 'grass') {
      carta.vidaActual += 20;

      if (carta.vidaActual > carta.vida) {
        carta.vidaActual = carta.vida;
      }

      this.mensaje = `CPU: ${carta.nombre} recuperó 20 puntos de vida.`;
    } else if (tipoPrincipal === 'fire') {
      carta.ataque += 10;
      this.mensaje = `CPU: ${carta.nombre} aumentó su ataque en 10.`;
    } else if (tipoPrincipal === 'water') {
      if (this.campoJugador.length === 0) {
        return;
      }

      const cartaRival = this.campoJugador[0];
      cartaRival.defensa -= 10;

      if (cartaRival.defensa < 0) {
        cartaRival.defensa = 0;
      }

      this.mensaje = `CPU: ${carta.nombre} redujo la defensa de ${cartaRival.nombre}.`;
    } else if (tipoPrincipal === 'electric') {
      const daño = 200;
      this.vidaJugador -= daño;
      this.mensaje = `CPU: ${carta.nombre} causó ${daño} de daño directo.`;
      this.verificarGanador();
    } else {
      if (this.mazoCpu.length === 0) {
        return;
      }

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
      const daño = this.gameService.calcularDañoDirecto(atacante);
      this.vidaJugador -= daño;

      this.mensaje = `La computadora atacó directamente con ${atacante.nombre} y causó ${daño} de daño.`;

      this.verificarGanador();
      return;
    }

    let indiceDefensora = 0;

    for (let i = 1; i < this.campoJugador.length; i++) {
      if (this.campoJugador[i].vidaActual < this.campoJugador[indiceDefensora].vidaActual) {
        indiceDefensora = i;
      }
    }

    const defensora = this.campoJugador[indiceDefensora];

    const resultado = this.gameService.calcularDañoContraCarta(
      atacante,
      defensora
    );

    defensora.vidaActual = resultado.vidaDefensora;
    atacante.vidaActual = resultado.vidaAtacante;

    this.mensaje = `CPU: ${resultado.mensaje}`;

    if (defensora.vidaActual <= 0) {
      this.descarteJugador.push(defensora);
      this.campoJugador.splice(indiceDefensora, 1);
      this.mensaje += ` ${defensora.nombre} fue destruido.`;
    }

    if (atacante.vidaActual <= 0) {
      this.descarteCpu.push(atacante);
      this.campoCpu.splice(indiceAtacante, 1);
      this.mensaje += ` ${atacante.nombre} fue destruido.`;
    }

    this.verificarGanador();
  }

  verificarGanador(): void {
    if (this.vidaJugador <= 0) {
      this.vidaJugador = 0;
      this.partidaTerminada = true;
      this.resultadoPartida = 'Derrota';
      this.turno = 'cpu';
      this.mensaje = 'Perdiste la partida. Tus puntos de vida llegaron a 0.';
      this.guardarResultadoLocal();
      return;
    }

    if (this.vidaCpu <= 0) {
      this.vidaCpu = 0;
      this.partidaTerminada = true;
      this.resultadoPartida = 'Victoria';
      this.turno = 'cpu';
      this.mensaje = 'Ganaste la partida. La CPU llegó a 0 puntos de vida.';
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
