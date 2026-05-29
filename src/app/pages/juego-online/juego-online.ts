import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { NgFor, NgIf, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { SupabaseService } from '../../services/supabase';
import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { MatchEngineService, MatchState } from '../../services/match-engine';
import { MazoService } from '../../services/mazo';
import { AudioService } from '../../services/audio';
import { MonedasService } from '../../services/monedas';
import { Carta } from '../../models/carta';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-juego-online',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, CartaPokemon],
  templateUrl: './juego-online.html',
  styleUrl: './juego-online.css'
})
export class JuegoOnline implements OnInit, OnDestroy {
  codigoSala = '';
  cargando = false;

  partidaActual: any = null;
  partidas: any[] = [];
  usuarioActualId: string | null = null;
  sesionActiva = false;

  tiempoTurno = 60;
  temporizador: any;
  cartaJugadorSeleccionada: number | null = null;
  efectoShakeJugador = false;
  efectoShakeRival = false;
  
  private subs = new Subscription();
  historialGuardado = false;
  yaDioRecompensas = false;

  // --- GETTERS DE DELEGACIÓN AL ENGINE PARA LA UI ---
  
  get myIdx() { return this.soyJugador1() ? 'P1' : 'P2'; }
  get rivalIdx() { return this.soyJugador1() ? 'P2' : 'P1'; }

  get state() { return this.engine.state; }
  get pMe() { return this.state ? this.engine.getJugador(this.myIdx) : null; }
  get pRival() { return this.state ? this.engine.getJugador(this.rivalIdx) : null; }

  get vidaJugador() { return this.pMe?.vida || 0; }
  get vidaRival() { return this.pRival?.vida || 0; }
  
  get mazoJugador() { return this.pMe?.mazo || []; }
  get manoJugador() { return this.pMe?.mano || []; }
  get campoJugador() { return this.pMe?.campo || []; }
  
  get mazoRival() { return this.pRival?.mazo || []; }
  get manoRival() { return this.pRival?.mano || []; }
  get campoRival() { return this.pRival?.campo || []; }
  
  get turno() { return this.state?.turnoActual === this.myIdx ? 'jugador' : 'rival'; }
  
  get mensajes() { return this.state?.mensajes || []; }
  get mensaje() { return this.mensajes.length > 0 ? this.mensajes[0] : ''; }
  set mensaje(msg: string) { if (!this.state) return; this.engine.agregarMensaje(msg); }
  
  get yaRobo() { return this.pMe?.yaRobo || false; }
  get yaInvoco() { return this.pMe?.yaInvoco || false; }
  get yaAtaco() { return this.pMe?.yaAtaco || false; }
  get yaUsoHabilidad() { return this.pMe?.yaUsoHabilidad || false; }
  
  get venenoJugador() { return this.pMe?.veneno || 0; }
  get venenoRival() { return this.pRival?.veneno || 0; }

  get partidaTerminada() { return this.state?.partidaTerminada || false; }
  get resultadoPartida() {
    if (!this.state?.partidaTerminada) return '';
    if (this.state.ganador === this.myIdx) return 'Victoria';
    if (this.state.ganador === this.rivalIdx) return 'Derrota';
    return 'Empate';
  }

  constructor(
    private supabaseService: SupabaseService,
    private pokemonService: PokemonService,
    private gameService: GameService,
    public engine: MatchEngineService,
    private mazoService: MazoService,
    private audioService: AudioService,
    public monedasService: MonedasService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Inicializar con un estado vacío para que no explote la UI antes de cargar Supabase
    this.engine.inicializarPartida([], [], 0);
  }

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startBattleMusic();
      this.usuarioActualId = await this.supabaseService.obtenerIdUsuarioActual();
      if (!this.usuarioActualId) {
        this.sesionActiva = false;
        this.mensaje = 'Debes iniciar sesión para usar el modo online.';
        return;
      }
      this.sesionActiva = true;
      this.cargarPartidas();

      this.subs.add(this.engine.onAnimShake.subscribe((target) => {
        if (target === this.myIdx) {
          this.efectoShakeJugador = true;
          setTimeout(() => { this.efectoShakeJugador = false; this.cdr.detectChanges(); }, 500);
        } else {
          this.efectoShakeRival = true;
          setTimeout(() => { this.efectoShakeRival = false; this.cdr.detectChanges(); }, 500);
        }
      }));

      this.subs.add(this.engine.onStateChanged.subscribe(() => {
        this.cdr.detectChanges();
        if (this.partidaTerminada) {
          // Si la partida terminó y no hemos procesado recompensas
          if (this.state && this.state.ganador !== null && !this.yaDioRecompensas) {
            this.yaDioRecompensas = true;
            this.terminarPartidaCentralizado();
          }
        }
      }));

    } else {
      this.mensaje = 'Cargando...';
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.detenerTemporizador();
    if (isPlatformBrowser(this.platformId)) {
      this.audioService.startMenuMusic();
      if (this.partidaActual) {
        this.supabaseService.desuscribirseDePartidaOnline(this.partidaActual.codigo_sala);
      }
    }
  }

  // --- LOBBY Y SALAS ---

  async crearPartida(): Promise<void> {
    this.cargando = true;
    this.mensaje = 'Creando partida online...';
    const { data, error } = await this.supabaseService.crearPartidaOnline();
    this.cargando = false;
    if (error) {
      this.mensaje = 'Error al crear partida online.';
      return;
    }
    this.abrirPartida(data);
    this.mensaje = `Sala creada: ${data.codigo_sala}. Esperando rival...`;
  }

  async unirseAPartida(): Promise<void> {
    if (!this.codigoSala.trim()) {
      this.mensaje = 'Escribe un código de sala.';
      return;
    }
    this.cargando = true;
    const { data, error } = await this.supabaseService.unirseAPartidaOnline(this.codigoSala.trim());
    this.cargando = false;
    if (error) {
      this.mensaje = 'Error: ' + error.message;
      return;
    }
    this.codigoSala = '';
    this.abrirPartida(data);
    
    if (this.soyJugador2()) {
      await this.inicializarMiEstadoEnPartida(data.id);
    }
  }

  async cargarPartidas(): Promise<void> {
    const { data } = await this.supabaseService.obtenerMisPartidasOnline();
    this.partidas = data || [];
  }

  abrirPartida(partida: any): void {
    if (this.partidaActual) {
      this.supabaseService.desuscribirseDePartidaOnline(this.partidaActual.codigo_sala);
    }
    this.partidaActual = partida;
    
    this.supabaseService.suscribirseAPartidaOnline(this.partidaActual.codigo_sala, (payload) => {
      if (payload.eventType === 'DELETE') {
        this.mensaje = 'La sala fue eliminada por el creador o la partida finalizó.';
        this.engine.state.partidaTerminada = true;
        this.cdr.detectChanges();
        return;
      }
      
      const viejoTurno = this.partidaActual.turno_actual;
      this.partidaActual = payload.new;
      this.sincronizarEstadoLocal();

      if (viejoTurno !== this.partidaActual.turno_actual) {
        if (this.esMiTurno()) {
          this.iniciarTemporizador();
        } else {
          this.detenerTemporizador();
        }
      }
      this.cdr.detectChanges();
    });

    if (this.soyJugador1() && (!this.partidaActual.estado_juego || !this.partidaActual.estado_juego.estadoP1)) {
      this.inicializarMiEstadoEnPartida(this.partidaActual.id).catch(err => {
        console.error('Error inicializando mazo online:', err);
        this.mensaje = 'Error fatal al cargar tu mazo: ' + err.message;
        this.cdr.detectChanges();
      });
    } else {
      try {
        this.sincronizarEstadoLocal();
      } catch (e: any) {
        console.error('Error sincronizando estado:', e);
      }
      if (this.esMiTurno()) {
        this.iniciarTemporizador();
      }
    }
  }

  async borrarSala(partida: any): Promise<void> {
    if (!confirm(`¿Estás seguro de que deseas borrar la sala ${partida.codigo_sala}?`)) return;
    await this.supabaseService.borrarPartidaOnline(partida.id);
    this.cargarPartidas();
  }

  async salirYBorrarSala(partida: any = null): Promise<void> {
    const p = partida || this.partidaActual;
    if (p && p.jugador_1 === this.usuarioActualId) {
      await this.supabaseService.borrarPartidaOnline(p.id);
    }
    this.partidaActual = null;
    this.cargarPartidas();
  }

  // --- SINCRONIZACION ESTADO MULTIJUGADOR ---

  async inicializarMiEstadoEnPartida(partidaId: number): Promise<void> {
    this.mensaje = 'Preparando tu mazo...';
    let cartas = await this.obtenerMiMazo();
    cartas = this.gameService.barajarMazo(cartas);
    const robo = this.gameService.robarCartas(cartas, 5);
    
    let baseEstado = this.partidaActual?.estado_juego;
    if (typeof baseEstado === 'string') {
      try { baseEstado = JSON.parse(baseEstado); } catch (e) {}
    }

    const estadoJuego: MatchState = (baseEstado && baseEstado.estadoP1) ? 
      JSON.parse(JSON.stringify(baseEstado)) : 
      {
        estadoP1: this.engine.crearEstadoVacio(),
        estadoP2: this.engine.crearEstadoVacio(),
        turnoActual: 'P1',
        partidaTerminada: false,
        ganador: null,
        mensajes: ['Preparando partida...']
      };
    
    const miClave = this.soyJugador1() ? 'estadoP1' : 'estadoP2';
    estadoJuego[miClave].mazo = robo.mazoRestante;
    estadoJuego[miClave].mano = robo.cartasRobadas;

    this.engine.cargarEstado(estadoJuego);

    await this.supabaseService.actualizarEstadoJuegoPartidaOnline(partidaId, {
      estado_juego: JSON.stringify(estadoJuego),
      vida_jugador_1: estadoJuego.estadoP1.vida,
      vida_jugador_2: estadoJuego.estadoP2.vida
    });
    
    if (this.esMiTurno()) {
      this.iniciarTemporizador();
    }
    this.mensaje = 'Mazo preparado. ¡A jugar!';
  }

  async obtenerMiMazo(): Promise<Carta[]> {
    // 1. Intentar cargar el mazo armado localmente
    const mazoLocal = this.mazoService.obtenerMazo();
    if (mazoLocal && mazoLocal.length >= 5) {
      return mazoLocal.map(c => this.gameService.clonarCarta(c));
    }

    // 2. Si no hay mazo local, intentar cargar de Supabase
    const { data } = await this.supabaseService.obtenerMazoSupabase();
    let cartasBase = data && data.cartas ? data.cartas : null;
    
    // 3. Fallback a los 50 Pokémon iniciales
    if (!cartasBase || cartasBase.length < 5) {
      cartasBase = await firstValueFrom(this.pokemonService.obtenerPokemones());
    }
    return cartasBase.map((c: any) => this.gameService.clonarCarta(c));
  }

  sincronizarEstadoLocal(): void {
    let estado = this.partidaActual.estado_juego;
    if (estado) {
      if (typeof estado === 'string') {
        try { estado = JSON.parse(estado); } catch (e) {}
      }
      
      if (!estado.estadoP1) return; // IGNORAR ESTADOS VACÍOS O CORRUPTOS

      this.engine.cargarEstado(estado);
      
      if (estado.partidaTerminada) {
        let miResultado = 'Empate';
        if (estado.ganador === this.myIdx) miResultado = 'Victoria';
        else if (estado.ganador === this.rivalIdx) miResultado = 'Derrota';
        
        // Terminar partida localmente si ya terminó en supabase (por si me desconecté)
        // La actualización de estadísticas se hace solo cuando uno causa el final.
      }
    }
  }

  async propagarEstado(siguienteTurnoJugador?: string): Promise<void> {
    const estado = JSON.parse(JSON.stringify(this.engine.state));
    // Guardarlo explícitamente como string JSON por si la columna en Supabase es tipo text
    const cambios: any = { estado_juego: JSON.stringify(estado) };
    
    if (siguienteTurnoJugador) {
      cambios.turno_actual = siguienteTurnoJugador;
    }

    cambios.vida_jugador_1 = estado.estadoP1.vida;
    cambios.vida_jugador_2 = estado.estadoP2.vida;

    await this.supabaseService.actualizarEstadoJuegoPartidaOnline(this.partidaActual.id, cambios);
  }

  async terminarPartidaCentralizado(): Promise<void> {
    const ganadorIdx = this.engine.state.ganador;
    let ganadorUserId = null;
    let miResultado: 'Victoria'|'Derrota'|'Empate' = 'Empate';

    if (ganadorIdx === 'P1') ganadorUserId = this.partidaActual.jugador_1;
    if (ganadorIdx === 'P2') ganadorUserId = this.partidaActual.jugador_2;
    
    if (ganadorIdx === this.myIdx) miResultado = 'Victoria';
    else if (ganadorIdx === this.rivalIdx) miResultado = 'Derrota';

    await this.supabaseService.finalizarPartidaOnline(this.partidaActual.id, ganadorUserId || 'Empate');
    await this.supabaseService.actualizarEstadisticasPerfil(miResultado);
    this.mensaje = miResultado === 'Victoria' ? '¡Ganaste la partida!' : 'Perdiste la partida.';

    if (miResultado === 'Victoria') {
      this.monedasService.sumar(50);
      setTimeout(() => alert('¡Victoria! Ganaste 50 Monedas Pokémon 🪙'), 500);
    } else {
      this.monedasService.sumar(10);
      setTimeout(() => alert('Ganaste 10 Monedas Pokémon 🪙 por participar.'), 500);
    }
  }

  // --- LOGICA DE JUEGO UI A ENGINE ---

  async robarCartaJugador(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaRobo) return;
    if (this.engine.robarCarta(this.myIdx, 1)) {
      this.audioService.playDrawCard();
      this.mensaje = 'Robaste una carta.';
      await this.propagarEstado();
    }
  }

  async invocarCarta(indice: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaInvoco) return;
    if (this.engine.invocarCarta(this.myIdx, indice, false)) {
      this.audioService.playBeep();
      await this.propagarEstado();
    }
  }

  seleccionarCartaJugador(indice: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    this.cartaJugadorSeleccionada = indice;
    this.mensaje = `Seleccionaste a ${this.campoJugador[indice].nombre} para atacar.`;
    this.audioService.playBeep();
  }

  async atacarCartaRival(indiceRival: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    this.audioService.playAttack();
    const idxA = this.cartaJugadorSeleccionada;
    this.cartaJugadorSeleccionada = null;
    
    this.engine.atacarCarta(this.myIdx, idxA, indiceRival, async () => {
      await this.propagarEstado();
      if (this.partidaTerminada) this.terminarPartidaCentralizado();
    });
  }

  async atacarDirectoRival(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    if (this.campoRival.length > 0) {
      this.mensaje = 'No puedes atacar directo si el rival tiene cartas en campo.';
      return;
    }
    
    this.audioService.playAttack();
    const idxA = this.cartaJugadorSeleccionada;
    this.cartaJugadorSeleccionada = null;

    this.engine.atacarDirecto(this.myIdx, idxA, async () => {
      await this.propagarEstado();
      if (this.partidaTerminada) this.terminarPartidaCentralizado();
    });
  }

  async usarHabilidadJugador(indice: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaUsoHabilidad) return;
    this.audioService.playBeep();
    
    this.engine.usarHabilidad(this.myIdx, indice, false, async () => {
      await this.propagarEstado();
      if (this.partidaTerminada) this.terminarPartidaCentralizado();
    });
  }

  async finalizarTurnoJugador(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    this.cartaJugadorSeleccionada = null;
    
    const idRival = this.soyJugador1() ? this.partidaActual.jugador_2 : this.partidaActual.jugador_1;
    if (!idRival) {
      this.mensaje = 'Aún no hay rival unido a la sala.';
      return;
    }

    this.detenerTemporizador();
    this.mensaje = 'Turno del rival...';
    this.audioService.playBeep();
    
    this.engine.finalizarTurno(this.myIdx, false);

    // Guardar los cambios e indicar de quién es el turno
    const idTurnoGlobal = this.engine.state.turnoActual === 'P1' ? this.partidaActual.jugador_1 : this.partidaActual.jugador_2;
    await this.propagarEstado(idTurnoGlobal);

    if (this.partidaTerminada) this.terminarPartidaCentralizado();
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

  soyJugador1(): boolean { return this.partidaActual?.jugador_1 === this.usuarioActualId; }
  soyJugador2(): boolean { return this.partidaActual?.jugador_2 === this.usuarioActualId; }
  esMiTurno(): boolean { return this.partidaActual?.turno_actual === this.usuarioActualId; }

  obtenerMiRol(): string {
    if (this.soyJugador1()) return 'Jugador 1';
    if (this.soyJugador2()) return 'Jugador 2';
    return 'Espectador';
  }
}
