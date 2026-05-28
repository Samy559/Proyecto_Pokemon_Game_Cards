import { Component, OnInit, OnDestroy, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { NgFor, NgIf, DatePipe, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SupabaseService } from '../../services/supabase';
import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { MazoService } from '../../services/mazo';
import { AudioService } from '../../services/audio';
import { Carta } from '../../models/carta';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

interface JugadorState {
  mazo: Carta[];
  mano: Carta[];
  campo: Carta[];
  descarte: Carta[];
  yaRobo: boolean;
  yaInvoco: boolean;
  yaAtaco: boolean;
  yaUsoHabilidad: boolean;
  turnosPerdidos: number;
  nivelVeneno: number;
}

@Component({
  selector: 'app-juego-online',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterLink, CartaPokemon],
  templateUrl: './juego-online.html',
  styleUrl: './juego-online.css'
})
export class JuegoOnline implements OnInit, OnDestroy {
  codigoSala = '';
  mensaje = '';
  cargando = false;

  partidaActual: any = null;
  partidas: any[] = [];
  usuarioActualId: string | null = null;
  sesionActiva = false;

  // Tablero
  vidaJugador = 4000;
  vidaRival = 4000;

  mazoJugador: Carta[] = [];
  manoJugador: Carta[] = [];
  campoJugador: Carta[] = [];
  descarteJugador: Carta[] = [];

  mazoRival: Carta[] = [];
  manoRival: Carta[] = [];
  campoRival: Carta[] = [];
  descarteRival: Carta[] = [];

  turno: 'jugador' | 'rival' = 'rival';
  cartaJugadorSeleccionada: number | null = null;

  tiempoTurno = 60;
  temporizador: any;

  yaRobo = false;
  yaInvoco = false;
  yaAtaco = false;
  yaUsoHabilidad = false;

  turnosPerdidosJugador = 0;
  turnosPerdidosRival = 0;
  venenoJugador = 0;
  venenoRival = 0;

  efectoShakeJugador = false;
  efectoShakeRival = false;

  partidaTerminada = false;
  resultadoPartida = '';

  constructor(
    private supabaseService: SupabaseService,
    private pokemonService: PokemonService,
    private gameService: GameService,
    private mazoService: MazoService,
    private audioService: AudioService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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
    } else {
      this.mensaje = 'Cargando...';
    }
  }

  ngOnDestroy(): void {
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
    
    // Si somos el J2 y nos acabamos de unir, inicializamos nuestro mazo.
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
    this.partidaTerminada = this.partidaActual.estado === 'finalizada';
    
    this.supabaseService.suscribirseAPartidaOnline(this.partidaActual.codigo_sala, (payload) => {
      if (payload.eventType === 'DELETE') {
        this.partidaTerminada = true;
        this.resultadoPartida = this.resultadoPartida || 'Sala Eliminada';
        this.mensaje = 'La sala fue eliminada por el creador o la partida finalizó.';
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

    // Si somos J1 y nuestro estado no existe (recien creada)
    if (this.soyJugador1() && (!this.partidaActual.estado_juego || !this.partidaActual.estado_juego.jugador_1)) {
      this.inicializarMiEstadoEnPartida(this.partidaActual.id);
    } else {
      this.sincronizarEstadoLocal();
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
    
    const miEstado: JugadorState = {
      mazo: robo.mazoRestante,
      mano: robo.cartasRobadas,
      campo: [],
      descarte: [],
      yaRobo: false,
      yaInvoco: false,
      yaAtaco: false,
      yaUsoHabilidad: false,
      turnosPerdidos: 0,
      nivelVeneno: 0
    };

    // Usamos SIEMPRE el estado más reciente de partidaActual para no sobreescribir al rival si ya inicializó
    const estadoJuego = this.partidaActual?.estado_juego ? JSON.parse(JSON.stringify(this.partidaActual.estado_juego)) : {};
    
    if (this.soyJugador1()) estadoJuego.jugador_1 = miEstado;
    if (this.soyJugador2()) estadoJuego.jugador_2 = miEstado;

    await this.supabaseService.actualizarEstadoJuegoPartidaOnline(partidaId, {
      estado_juego: estadoJuego
    });
    
    if (this.esMiTurno()) {
      this.iniciarTemporizador();
    }
    
    this.mensaje = 'Mazo preparado. ¡A jugar!';
  }

  async obtenerMiMazo(): Promise<Carta[]> {
    const { data } = await this.supabaseService.obtenerMazoSupabase();
    let cartasBase = data && data.cartas ? data.cartas : null;
    
    if (!cartasBase || cartasBase.length < 5) {
      cartasBase = await firstValueFrom(this.pokemonService.obtenerPokemones());
    }
    
    return cartasBase.map((c: any) => this.gameService.clonarCarta(c));
  }

  sincronizarEstadoLocal(): void {
    const estado = this.partidaActual.estado_juego || {};
    const miClave = this.soyJugador1() ? 'jugador_1' : 'jugador_2';
    const rivalClave = this.soyJugador1() ? 'jugador_2' : 'jugador_1';

    if (estado[miClave]) {
      this.mazoJugador = estado[miClave].mazo || [];
      this.manoJugador = estado[miClave].mano || [];
      this.campoJugador = estado[miClave].campo || [];
      this.descarteJugador = estado[miClave].descarte || [];
      this.yaRobo = estado[miClave].yaRobo;
      this.yaAtaco = estado[miClave].yaAtaco;
      this.yaUsoHabilidad = estado[miClave].yaUsoHabilidad;
      this.turnosPerdidosJugador = estado[miClave].turnosPerdidos || 0;
      this.venenoJugador = estado[miClave].nivelVeneno || 0;
      this.vidaJugador = this.soyJugador1() ? this.partidaActual.vida_jugador_1 : this.partidaActual.vida_jugador_2;
    }

    if (estado[rivalClave]) {
      this.mazoRival = estado[rivalClave].mazo || [];
      this.manoRival = estado[rivalClave].mano || [];
      this.campoRival = estado[rivalClave].campo || [];
      this.descarteRival = estado[rivalClave].descarte || [];
      this.turnosPerdidosRival = estado[rivalClave].turnosPerdidos || 0;
      this.venenoRival = estado[rivalClave].nivelVeneno || 0;
      this.vidaRival = this.soyJugador1() ? this.partidaActual.vida_jugador_2 : this.partidaActual.vida_jugador_1;
    }

    this.turno = this.esMiTurno() ? 'jugador' : 'rival';
    this.partidaTerminada = this.partidaActual.estado === 'finalizada';
    
    if (this.partidaTerminada) {
      if (this.partidaActual.ganador === this.obtenerMiRol()) {
        this.resultadoPartida = 'Victoria';
      } else {
        this.resultadoPartida = 'Derrota';
      }
    }
  }

  async propagarEstado(siguienteTurno?: string): Promise<void> {
    const estado = this.partidaActual.estado_juego || {};
    const miClave = this.soyJugador1() ? 'jugador_1' : 'jugador_2';
    const rivalClave = this.soyJugador1() ? 'jugador_2' : 'jugador_1';

    estado[miClave] = {
      mazo: this.mazoJugador,
      mano: this.manoJugador,
      campo: this.campoJugador,
      descarte: this.descarteJugador,
      yaRobo: this.yaRobo,
      yaInvoco: this.yaInvoco,
      yaAtaco: this.yaAtaco,
      yaUsoHabilidad: this.yaUsoHabilidad,
      turnosPerdidos: this.turnosPerdidosJugador,
      nivelVeneno: this.venenoJugador
    };

    estado[rivalClave] = {
      mazo: this.mazoRival,
      mano: this.manoRival,
      campo: this.campoRival,
      descarte: this.descarteRival,
      yaRobo: estado[rivalClave]?.yaRobo || false,
      yaInvoco: estado[rivalClave]?.yaInvoco || false,
      yaAtaco: estado[rivalClave]?.yaAtaco || false,
      yaUsoHabilidad: estado[rivalClave]?.yaUsoHabilidad || false,
      turnosPerdidos: this.turnosPerdidosRival,
      nivelVeneno: this.venenoRival
    };

    const cambios: any = { estado_juego: estado };
    
    if (siguienteTurno) {
      cambios.turno_actual = siguienteTurno;
    }

    if (this.soyJugador1()) {
      cambios.vida_jugador_1 = this.vidaJugador;
      cambios.vida_jugador_2 = this.vidaRival;
    } else {
      cambios.vida_jugador_2 = this.vidaJugador;
      cambios.vida_jugador_1 = this.vidaRival;
    }

    await this.supabaseService.actualizarEstadoJuegoPartidaOnline(this.partidaActual.id, cambios);
  }

  async terminarPartida(miResultado: 'Victoria' | 'Derrota'): Promise<void> {
    this.partidaTerminada = true;
    this.resultadoPartida = miResultado;
    const ganador = miResultado === 'Victoria' ? this.obtenerMiRol() : (this.soyJugador1() ? 'Jugador 2' : 'Jugador 1');
    await this.supabaseService.finalizarPartidaOnline(this.partidaActual.id, ganador);
    await this.supabaseService.actualizarEstadisticasPerfil(miResultado);
    this.mensaje = miResultado === 'Victoria' ? '¡Ganaste la partida!' : 'Perdiste la partida.';
  }

  // --- LOGICA DE JUEGO (IDÉNTICA A JUEGO-CPU PERO PROPAGANDO ESTADO) ---

  async robarCartaJugador(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaRobo) return;
    if (this.mazoJugador.length === 0) {
      this.mensaje = 'No tienes más cartas.';
      return;
    }
    const robo = this.gameService.robarCartas(this.mazoJugador, 1);
    this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
    this.mazoJugador = robo.mazoRestante;
    this.yaRobo = true;
    this.mensaje = 'Robaste una carta.';
    await this.propagarEstado();
  }

  async invocarCarta(indice: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaInvoco) return;
    if (this.campoJugador.length >= 5) {
      this.mensaje = 'Tu campo está lleno.';
      return;
    }
    const carta = this.manoJugador[indice];
    this.campoJugador.push(carta);
    this.manoJugador.splice(indice, 1);
    this.yaInvoco = true;
    this.mensaje = `Invocaste a ${carta.nombre}.`;
    await this.propagarEstado();
  }

  seleccionarCartaJugador(indice: number): void {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    this.cartaJugadorSeleccionada = indice;
    this.mensaje = `Seleccionaste a ${this.campoJugador[indice].nombre} para atacar.`;
  }

  async atacarCartaRival(indiceRival: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;

    const atacante = this.campoJugador[this.cartaJugadorSeleccionada];
    const defensora = this.campoRival[indiceRival];

    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;

    atacante.animAtacando = true;
    defensora.animRecibiendoDano = true;

    setTimeout(async () => {
      atacante.animAtacando = false;
      defensora.animRecibiendoDano = false;

      const resultado = this.gameService.calcularDañoContraCarta(atacante, defensora);

      defensora.vidaActual = resultado.vidaDefensora;
      atacante.vidaActual = resultado.vidaAtacante;
      this.mensaje = resultado.mensaje;

      if (defensora.vidaActual <= 0) {
        this.descarteRival.push(defensora);
        this.campoRival.splice(indiceRival, 1);
        this.mensaje += ` Destruiste a ${defensora.nombre}.`;
      }
      if (atacante.vidaActual <= 0) {
        const idxAtacante = this.campoJugador.indexOf(atacante);
        if (idxAtacante > -1) {
          this.descarteJugador.push(atacante);
          this.campoJugador.splice(idxAtacante, 1);
        }
        this.mensaje += ` Tu ${atacante.nombre} fue destruido.`;
      }

      await this.propagarEstado();
      this.verificarGanador();
    }, 500);
  }

  async atacarDirectoRival(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    if (this.campoRival.length > 0) {
      this.mensaje = 'No puedes atacar directo si el rival tiene cartas en campo.';
      return;
    }

    const atacante = this.campoJugador[this.cartaJugadorSeleccionada];
    
    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;

    atacante.animAtacando = true;
    this.efectoShakeRival = true;

    setTimeout(async () => {
      atacante.animAtacando = false;
      this.efectoShakeRival = false;

      const daño = this.gameService.calcularDañoDirecto(atacante);
      this.vidaRival -= daño;
      this.mensaje = `Atacaste directo con ${atacante.nombre} por ${daño} de daño.`;
      
      await this.propagarEstado();
      this.verificarGanador();
    }, 500);
  }

  async usarHabilidadJugador(indice: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaUsoHabilidad) return;

    const carta = this.campoJugador[indice];
    const tipoPrincipal = carta.tipos[0];

    this.yaUsoHabilidad = true;
    carta.animHabilidad = true;

    setTimeout(async () => {
      carta.animHabilidad = false;

      if (tipoPrincipal === 'fire') {
        carta.multiplicadorAtaqueTemporal = 2;
        this.mensaje = `${carta.nombre} duplicó su ataque este turno.`;
      } else if (tipoPrincipal === 'grass') {
        this.vidaJugador += 1000;
        if (this.vidaJugador > 4000) this.vidaJugador = 4000;
        this.mensaje = `${carta.nombre} te curó 1000 puntos de vida.`;
      } else if (tipoPrincipal === 'water') {
        if (this.campoRival.length === 0) {
          this.mensaje = 'No hay cartas rivales.';
          return;
        }
        this.campoRival.forEach(c => {
          c.defensa -= 20;
          if (c.defensa < 0) c.defensa = 0;
        });
        this.mensaje = `Redujiste la defensa de todas las cartas enemigas en 20.`;
      } else if (tipoPrincipal === 'electric') {
        this.vidaRival -= 500;
        this.mensaje = `Causaste 500 de daño directo al rival.`;
        this.efectoShakeRival = true;
        setTimeout(() => this.efectoShakeRival = false, 500);
        await this.verificarGanador();
        if (this.partidaTerminada) return;
      } else if (tipoPrincipal === 'psychic') {
        this.turnosPerdidosRival = 1;
        this.mensaje = `¡El rival perderá su próximo turno!`;
      } else if (tipoPrincipal === 'poison') {
        this.venenoRival = 300;
        this.mensaje = `¡El rival perderá 300 PV cada turno!`;
      } else if (tipoPrincipal === 'fighting') {
        carta.ignoraDefensa = true;
        this.mensaje = `${carta.nombre} ignorará la defensa en su próximo ataque.`;
      } else {
        if (this.mazoJugador.length > 0) {
          const robo = this.gameService.robarCartas(this.mazoJugador, 1);
          this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
          this.mazoJugador = robo.mazoRestante;
          this.mensaje = `Robaste una carta extra.`;
        }
      }
      await this.propagarEstado();
    }, 800);
  }

  async finalizarTurnoJugador(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    
    this.campoJugador.forEach(c => {
      c.multiplicadorAtaqueTemporal = 1;
      c.ignoraDefensa = false;
    });

    if (this.venenoRival > 0) {
      this.vidaRival -= this.venenoRival;
    }

    if (this.vidaRival <= 0) {
      await this.verificarGanador();
      if (this.partidaTerminada) return;
    }

    if (this.turnosPerdidosRival > 0) {
      this.turnosPerdidosRival--;
      
      this.campoRival.forEach(c => {
        c.multiplicadorAtaqueTemporal = 1;
        c.ignoraDefensa = false;
      });
      this.yaRobo = false;
      this.yaInvoco = false;
      this.yaAtaco = false;
      this.yaUsoHabilidad = false;
      this.cartaJugadorSeleccionada = null;
      this.mensaje = `¡El rival está confundido y pierde su turno! Vuelve a ser tu turno.`;
      this.iniciarTemporizador();
      await this.propagarEstado();
      return;
    }

    this.yaRobo = false;
    this.yaInvoco = false;
    this.yaAtaco = false;
    this.yaUsoHabilidad = false;
    this.cartaJugadorSeleccionada = null;

    const idRival = this.soyJugador1() ? this.partidaActual.jugador_2 : this.partidaActual.jugador_1;
    if (!idRival) {
      this.mensaje = 'Aún no hay rival unido a la sala.';
      return;
    }

    this.turno = 'rival';
    this.detenerTemporizador();
    this.mensaje = 'Turno del rival...';
    
    await this.propagarEstado(idRival);
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

  async verificarGanador(): Promise<void> {
    if (this.vidaJugador <= 0 || (this.mazoJugador.length === 0 && this.manoJugador.length === 0 && this.campoJugador.length === 0)) {
      await this.terminarPartida('Derrota');
      return;
    }
    if (this.vidaRival <= 0 || (this.mazoRival.length === 0 && this.manoRival.length === 0 && this.campoRival.length === 0)) {
      await this.terminarPartida('Victoria');
      return;
    }
  }

  // --- HELPER METHODS ---

  soyJugador1(): boolean {
    return this.partidaActual?.jugador_1 === this.usuarioActualId;
  }

  soyJugador2(): boolean {
    return this.partidaActual?.jugador_2 === this.usuarioActualId;
  }

  esMiTurno(): boolean {
    return this.partidaActual?.turno_actual === this.usuarioActualId;
  }

  obtenerMiRol(): string {
    if (this.soyJugador1()) return 'Jugador 1';
    if (this.soyJugador2()) return 'Jugador 2';
    return 'Espectador';
  }
}
