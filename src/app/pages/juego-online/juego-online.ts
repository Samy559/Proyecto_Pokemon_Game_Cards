import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SupabaseService } from '../../services/supabase';
import { PokemonService } from '../../services/pokemon';
import { GameService } from '../../services/game';
import { MazoService } from '../../services/mazo';
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
}

@Component({
  selector: 'app-juego-online',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, RouterLink, TitleCasePipe, CartaPokemon],
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

  yaRobo = false;
  yaInvoco = false;
  yaAtaco = false;
  yaUsoHabilidad = false;

  partidaTerminada = false;
  resultadoPartida = '';

  constructor(
    private supabaseService: SupabaseService,
    private pokemonService: PokemonService,
    private gameService: GameService,
    private mazoService: MazoService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.usuarioActualId = await this.supabaseService.obtenerIdUsuarioActual();
    if (!this.usuarioActualId) {
      this.sesionActiva = false;
      this.mensaje = 'Debes iniciar sesión para usar el modo online.';
      return;
    }
    this.sesionActiva = true;
    this.cargarPartidas();
  }

  ngOnDestroy(): void {
    if (this.partidaActual) {
      this.supabaseService.desuscribirseDePartidaOnline(this.partidaActual.codigo_sala);
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
      this.partidaActual = payload.new;
      this.sincronizarEstadoLocal();
      this.cdr.detectChanges();
    });

    // Si somos J1 y nuestro estado no existe (recien creada)
    if (this.soyJugador1() && (!this.partidaActual.estado_juego || !this.partidaActual.estado_juego.jugador_1)) {
      this.inicializarMiEstadoEnPartida(this.partidaActual.id);
    } else {
      this.sincronizarEstadoLocal();
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
      yaUsoHabilidad: false
    };

    // Usamos SIEMPRE el estado más reciente de partidaActual para no sobreescribir al rival si ya inicializó
    const estadoJuego = this.partidaActual?.estado_juego ? JSON.parse(JSON.stringify(this.partidaActual.estado_juego)) : {};
    
    if (this.soyJugador1()) estadoJuego.jugador_1 = miEstado;
    if (this.soyJugador2()) estadoJuego.jugador_2 = miEstado;

    await this.supabaseService.actualizarEstadoJuegoPartidaOnline(partidaId, {
      estado_juego: estadoJuego
    });
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
      this.yaInvoco = estado[miClave].yaInvoco;
      this.yaAtaco = estado[miClave].yaAtaco;
      this.yaUsoHabilidad = estado[miClave].yaUsoHabilidad;
      this.vidaJugador = this.soyJugador1() ? this.partidaActual.vida_jugador_1 : this.partidaActual.vida_jugador_2;
    }

    if (estado[rivalClave]) {
      this.mazoRival = estado[rivalClave].mazo || [];
      this.manoRival = estado[rivalClave].mano || [];
      this.campoRival = estado[rivalClave].campo || [];
      this.descarteRival = estado[rivalClave].descarte || [];
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
      yaUsoHabilidad: this.yaUsoHabilidad
    };

    estado[rivalClave] = {
      mazo: this.mazoRival,
      mano: this.manoRival,
      campo: this.campoRival,
      descarte: this.descarteRival,
      yaRobo: estado[rivalClave]?.yaRobo || false,
      yaInvoco: estado[rivalClave]?.yaInvoco || false,
      yaAtaco: estado[rivalClave]?.yaAtaco || false,
      yaUsoHabilidad: estado[rivalClave]?.yaUsoHabilidad || false
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
      this.descarteJugador.push(atacante);
      this.campoJugador.splice(this.cartaJugadorSeleccionada, 1);
      this.mensaje += ` Tu ${atacante.nombre} fue destruido.`;
    }

    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    await this.propagarEstado();
    this.verificarGanador();
  }

  async atacarDirectoRival(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaAtaco || this.cartaJugadorSeleccionada === null) return;
    if (this.campoRival.length > 0) {
      this.mensaje = 'No puedes atacar directo si el rival tiene cartas en campo.';
      return;
    }

    const atacante = this.campoJugador[this.cartaJugadorSeleccionada];
    const daño = this.gameService.calcularDañoDirecto(atacante);
    this.vidaRival -= daño;
    this.mensaje = `Atacaste directo con ${atacante.nombre} por ${daño} de daño.`;
    
    this.yaAtaco = true;
    this.cartaJugadorSeleccionada = null;
    await this.propagarEstado();
    this.verificarGanador();
  }

  async usarHabilidadJugador(indice: number): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada || this.yaUsoHabilidad) return;

    const carta = this.campoJugador[indice];
    const tipoPrincipal = carta.tipos[0];

    if (tipoPrincipal === 'grass') {
      carta.vidaActual = Math.min(carta.vida, carta.vidaActual + 20);
      this.mensaje = `${carta.nombre} se curó 20 puntos de vida.`;
    } else if (tipoPrincipal === 'fire') {
      carta.ataque += 10;
      this.mensaje = `${carta.nombre} aumentó su ataque en 10.`;
    } else if (tipoPrincipal === 'water') {
      if (this.campoRival.length > 0) {
        const cartaRival = this.campoRival[0];
        cartaRival.defensa = Math.max(0, cartaRival.defensa - 10);
        this.mensaje = `Redujiste la defensa de ${cartaRival.nombre}.`;
      } else {
        this.mensaje = 'No hay cartas rivales.';
        return;
      }
    } else if (tipoPrincipal === 'electric') {
      this.vidaRival -= 200;
      this.mensaje = `Causaste 200 de daño eléctrico directo al rival.`;
      this.verificarGanador();
    } else {
      if (this.mazoJugador.length > 0) {
        const robo = this.gameService.robarCartas(this.mazoJugador, 1);
        this.manoJugador = [...this.manoJugador, ...robo.cartasRobadas];
        this.mazoJugador = robo.mazoRestante;
        this.mensaje = `Robaste una carta extra.`;
      }
    }
    this.yaUsoHabilidad = true;
    await this.propagarEstado();
  }

  async finalizarTurnoJugador(): Promise<void> {
    if (this.turno !== 'jugador' || this.partidaTerminada) return;
    
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
    this.mensaje = 'Turno del rival...';
    
    await this.propagarEstado(idRival);
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
