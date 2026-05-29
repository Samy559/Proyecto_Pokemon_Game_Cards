import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { MatchEngineService } from '../../services/match-engine';
import { Carta } from '../../models/carta';

import { HistorialService } from '../../services/historial';
import { HistorialPartida } from '../../models/historial-partida';

import { SupabaseService } from '../../services/supabase';
import { MazoService } from '../../services/mazo';
import { AudioService } from '../../services/audio';
import { MonedasService } from '../../services/monedas';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-juego-cpu',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, CartaPokemon],
  templateUrl: './juego-cpu.html',
  styleUrl: './juego-cpu.css'
})
export class JuegoCpu implements OnInit, OnDestroy {
  cargando = true;
  tiempoTurno = 60;
  temporizador: any;
  cartaJugadorSeleccionada: number | null = null;
  efectoShakeJugador = false;
  efectoShakeCpu = false;
  historialGuardado = false;
  
  // Delegación del estado a MatchEngineService para no romper el HTML
  get state() { return this.engine.state; }
  get p1() { return this.state?.estadoP1; }
  get p2() { return this.state?.estadoP2; }

  get vidaJugador() { return this.p1?.vida || 0; }
  get vidaCpu() { return this.p2?.vida || 0; }
  
  get mazoJugador() { return this.p1?.mazo || []; }
  get manoJugador() { return this.p1?.mano || []; }
  get campoJugador() { return this.p1?.campo || []; }
  
  get mazoCpu() { return this.p2?.mazo || []; }
  get manoCpu() { return this.p2?.mano || []; }
  get campoCpu() { return this.p2?.campo || []; }
  
  get turno() { return this.state?.turnoActual === 'P1' ? 'jugador' : 'cpu'; }
  get mensajes() { return this.state?.mensajes || []; }
  get mensaje() { return this.mensajes.length > 0 ? this.mensajes[0] : ''; }
  
  get yaRobo() { return this.p1?.yaRobo || false; }
  get yaInvoco() { return this.p1?.yaInvoco || false; }
  get yaAtaco() { return this.p1?.yaAtaco || false; }
  get yaUsoHabilidad() { return this.p1?.yaUsoHabilidad || false; }
  
  get venenoJugador() { return this.p1?.veneno || 0; }
  get venenoCpu() { return this.p2?.veneno || 0; }
  
  get partidaTerminada() { return this.state?.partidaTerminada || false; }
  get resultadoPartida() {
    if (!this.state?.partidaTerminada) return '';
    if (this.state.ganador === 'P1') return 'Victoria';
    if (this.state.ganador === 'P2') return 'Derrota';
    return 'Empate';
  }

  private subs = new Subscription();

  constructor(
    private pokemonService: PokemonService,
    private gameService: GameService,
    public engine: MatchEngineService,
    private historialService: HistorialService,
    private supabaseService: SupabaseService,
    private mazoService: MazoService,
    private audioService: AudioService,
    public monedasService: MonedasService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Inicializamos con un estado vacío para que la UI (HTML) no evalúe propiedades undefined antes de cargar las cartas
    this.engine.inicializarPartida([], [], 0);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startBattleMusic();
      
      this.subs.add(this.engine.onStateChanged.subscribe(() => {
        this.cdr.detectChanges();
        if (this.partidaTerminada) {
          this.manejarFinPartida();
        }
      }));

      this.subs.add(this.engine.onAnimShake.subscribe((target) => {
        if (target === 'P1') {
          this.efectoShakeJugador = true;
          setTimeout(() => { this.efectoShakeJugador = false; this.cdr.detectChanges(); }, 500);
        } else {
          this.efectoShakeCpu = true;
          setTimeout(() => { this.efectoShakeCpu = false; this.cdr.detectChanges(); }, 500);
        }
      }));

      this.iniciarPartida();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.detenerTemporizador();
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startMenuMusic();
    }
  }

  iniciarPartida(): void {
    this.cargando = true;
    this.historialGuardado = false;
    this.cartaJugadorSeleccionada = null;

    this.pokemonService.obtenerPokemones().subscribe({
      next: (cartas) => {
        const mazoGuardado = this.mazoService.obtenerMazo();
        const cartasJugadorBase = mazoGuardado.length >= 5 ? mazoGuardado : cartas;

        const cartasClonadasJugador = cartasJugadorBase.map(c => this.gameService.clonarCarta(c));
        const cartasClonadasCpu = cartas.map(c => this.gameService.clonarCarta(c));

        const mazoJugadorShuffled = this.gameService.barajarMazo(cartasClonadasJugador);
        const mazoCpuShuffled = this.gameService.barajarMazo(cartasClonadasCpu);

        this.engine.inicializarPartida(mazoJugadorShuffled, mazoCpuShuffled, 5);
        this.cargando = false;
        
        if (mazoGuardado.length >= 5) {
          this.engine.agregarMensaje('Partida iniciada con tu mazo personalizado. Es tu turno.');
        } else {
          this.engine.agregarMensaje('Partida iniciada con mazo aleatorio. Es tu turno.');
        }
        
        this.iniciarTemporizador();
      },
      error: () => {
        this.cargando = false;
        console.error('Error al cargar cartas para la partida.');
      }
    });
  }

  robarCartaJugador(): void {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaRobo) return;
    if (this.engine.robarCarta('P1', 1)) {
      this.audioService.playDrawCard();
      this.engine.agregarMensaje('Robaste una carta.');
    } else {
      this.engine.agregarMensaje('No tienes más cartas en el mazo.');
    }
  }

  invocarCarta(indice: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaInvoco) return;
    if (this.engine.invocarCarta('P1', indice, false)) {
      this.audioService.playBeep();
    }
  }

  seleccionarCartaJugador(indice: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    this.cartaJugadorSeleccionada = indice;
    this.engine.agregarMensaje(`Seleccionaste a ${this.campoJugador[indice].nombre} para atacar.`);
    this.audioService.playBeep();
  }

  atacarCartaCpu(indiceCpu: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    this.audioService.playAttack();
    const idxA = this.cartaJugadorSeleccionada;
    this.cartaJugadorSeleccionada = null;
    this.engine.atacarCarta('P1', idxA, indiceCpu);
  }

  atacarDirectoCpu(): void {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    if (this.campoCpu.length > 0) {
      this.engine.agregarMensaje('No puedes atacar directo mientras la CPU tenga cartas en campo.');
      return;
    }
    this.audioService.playAttack();
    const idxA = this.cartaJugadorSeleccionada;
    this.cartaJugadorSeleccionada = null;
    this.engine.atacarDirecto('P1', idxA);
  }

  usarHabilidadJugador(indice: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaUsoHabilidad) return;
    this.audioService.playBeep();
    this.engine.usarHabilidad('P1', indice, false);
  }

  finalizarTurnoJugador(): void {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    this.detenerTemporizador();
    this.cartaJugadorSeleccionada = null;
    
    this.engine.agregarMensaje('Turno de la computadora...');
    this.audioService.playBeep();
    this.engine.finalizarTurno('P1', true);
    
    if (!this.partidaTerminada && this.state.turnoActual === 'P2') {
      setTimeout(() => this.turnoCpu(), 1000);
    } else if (!this.partidaTerminada && this.state.turnoActual === 'P1') {
      this.iniciarTemporizador();
    }
  }

  turnoCpu(): void {
    if (this.partidaTerminada || this.state.turnoActual !== 'P2') return;

    this.engine.robarCarta('P2', 1);
    this.invocarCartaCpu();
    
    if (!this.p2?.yaUsoHabilidad && this.campoCpu.length > 0) {
       let idx = 0;
       for (let i = 1; i < this.campoCpu.length; i++) {
         if (this.campoCpu[i].vidaActual < this.campoCpu[idx].vidaActual) idx = i;
       }
       this.engine.usarHabilidad('P2', idx, true, () => {
         this.continuarTurnoCpu();
       });
    } else {
       this.continuarTurnoCpu();
    }
  }

  private continuarTurnoCpu() {
    if (this.partidaTerminada) return;

    setTimeout(() => {
      if (this.partidaTerminada) return;
      if (this.campoCpu.length > 0) {
        let idxAtacante = 0;
        for (let i = 1; i < this.campoCpu.length; i++) {
          if (this.campoCpu[i].ataque > this.campoCpu[idxAtacante].ataque) idxAtacante = i;
        }

        if (this.campoJugador.length === 0) {
          this.engine.atacarDirecto('P2', idxAtacante, () => this.terminarTurnoCpu());
        } else {
          let idxDefensor = 0;
          for (let i = 1; i < this.campoJugador.length; i++) {
            if (this.campoJugador[i].vidaActual < this.campoJugador[idxDefensor].vidaActual) idxDefensor = i;
          }
          this.engine.atacarCarta('P2', idxAtacante, idxDefensor, () => this.terminarTurnoCpu());
        }
      } else {
        this.terminarTurnoCpu();
      }
    }, 1500);
  }

  private invocarCartaCpu(): void {
    if (!this.p2 || this.p2.mano.length === 0) return;

    for (let i = 0; i < this.p2.mano.length; i++) {
      const carta = this.p2.mano[i];
      if (carta.evolucionaDe) {
        if (this.engine.invocarCarta('P2', i, true)) return;
      }
    }

    if (this.p2.campo.length >= 5) return;

    let idxMejor = -1;
    for (let i = 0; i < this.p2.mano.length; i++) {
      if (!this.p2.mano[i].evolucionaDe) {
        if (idxMejor === -1 || this.p2.mano[i].ataque > this.p2.mano[idxMejor].ataque) {
          idxMejor = i;
        }
      }
    }

    if (idxMejor > -1) {
      this.engine.invocarCarta('P2', idxMejor, true);
    }
  }

  private terminarTurnoCpu() {
    if (this.partidaTerminada) return;
    this.engine.finalizarTurno('P2');
    
    if (this.state.turnoActual === 'P1') {
      this.engine.agregarMensaje('Es tu turno.');
      this.iniciarTemporizador();
    } else if (this.state.turnoActual === 'P2') {
      setTimeout(() => this.turnoCpu(), 1500);
    }
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
          this.engine.agregarMensaje('¡Tiempo agotado! Tu turno terminó.');
          this.finalizarTurnoJugador();
        }
        this.cdr.detectChanges();
      }, 1000);
    }
  }

  detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private manejarFinPartida() {
    if (this.historialGuardado) return;
    if (this.resultadoPartida === 'Victoria') this.audioService.playVictory();
    else if (this.resultadoPartida === 'Derrota') this.audioService.playDefeat();
    this.guardarResultadoLocal();
  }

  guardarResultadoLocal(): void {
    if (this.historialGuardado) return;

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
    
    // Recompensa de Monedas
    if (this.resultadoPartida === 'Victoria') {
      this.monedasService.sumar(50);
      setTimeout(() => alert('¡Victoria! Ganaste 50 Monedas Pokémon 🪙'), 500);
    } else {
      this.monedasService.sumar(10);
      setTimeout(() => alert('Ganaste 10 Monedas Pokémon 🪙 por participar.'), 500);
    }

    this.guardarResultadoSupabase();
  }

  async guardarResultadoSupabase(): Promise<void> {
    const { error: resultadoError } = await this.supabaseService.guardarResultadoCpu(
      this.resultadoPartida,
      this.vidaJugador,
      this.vidaCpu
    );

    if (resultadoError) {
      console.log('No se pudo guardar el resultado en Supabase:', resultadoError.message);
      return;
    }

    const { error: estadisticasError } = await this.supabaseService.actualizarEstadisticasPerfil(this.resultadoPartida);

    if (estadisticasError) {
      console.log('No se pudieron actualizar las estadísticas:', estadisticasError.message);
    }
  }
}
