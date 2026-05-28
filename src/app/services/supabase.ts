import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../supabase.config';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    const isBrowser = isPlatformBrowser(this.platformId);

    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.anonKey,
      {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser
        }
      }
    );
  }

  async registrarUsuario(correo: string, password: string, nombreUsuario: string) {
    return await this.supabase.auth.signUp({
      email: correo,
      password,
      options: {
        data: {
          nombre_usuario: nombreUsuario
        }
      }
    });
  }

  async iniciarSesion(correo: string, password: string) {
    return await this.supabase.auth.signInWithPassword({
      email: correo,
      password
    });
  }

  async cerrarSesion() {
    return await this.supabase.auth.signOut();
  }

  async obtenerUsuarioActual() {
    return await this.supabase.auth.getUser();
  }

  async obtenerSesionActual() {
    return await this.supabase.auth.getSession();
  }

  async crearPerfil(id: string, nombreUsuario: string, correo: string) {
    return await this.supabase
      .from('perfiles')
      .upsert({
        id,
        nombre_usuario: nombreUsuario,
        correo,
        victorias: 0,
        derrotas: 0
      });
  }

  async obtenerPerfilPorId(id: string) {
    return await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
  }

  async guardarResultadoCpu(
    resultado: string,
    vidaJugador: number,
    vidaCpu: number
  ) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('resultados')
      .insert({
        usuario_id: userData.user.id,
        modo: 'Jugador contra computadora',
        resultado,
        vida_jugador: vidaJugador,
        vida_cpu: vidaCpu
      });
  }

  async actualizarEstadisticasPerfil(resultado: string) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    const { data: perfil, error: perfilError } = await this.supabase
      .from('perfiles')
      .select('victorias, derrotas')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (perfilError || !perfil) {
      return { data: null, error: perfilError };
    }

    const nuevasVictorias =
      resultado === 'Victoria' ? perfil.victorias + 1 : perfil.victorias;

    const nuevasDerrotas =
      resultado === 'Derrota' ? perfil.derrotas + 1 : perfil.derrotas;

    return await this.supabase
      .from('perfiles')
      .update({
        victorias: nuevasVictorias,
        derrotas: nuevasDerrotas
      })
      .eq('id', userData.user.id);
  }

  async obtenerResultadosActuales() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('resultados')
      .select('*')
      .eq('usuario_id', userData.user.id)
      .order('fecha', { ascending: false });
  }

  async guardarMazoSupabase(cartas: any[]) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    const usuarioId = userData.user.id;

    const { data: mazoExistente } = await this.supabase
      .from('mazos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('nombre', 'Mazo principal')
      .maybeSingle();

    if (mazoExistente) {
      return await this.supabase
        .from('mazos')
        .update({
          cartas,
          updated_at: new Date().toISOString()
        })
        .eq('id', mazoExistente.id);
    }

    return await this.supabase
      .from('mazos')
      .insert({
        usuario_id: usuarioId,
        nombre: 'Mazo principal',
        cartas
      });
  }

  async obtenerMazoSupabase() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('mazos')
      .select('*')
      .eq('usuario_id', userData.user.id)
      .eq('nombre', 'Mazo principal')
      .maybeSingle();
  }

  async borrarMazoSupabase() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('mazos')
      .delete()
      .eq('usuario_id', userData.user.id)
      .eq('nombre', 'Mazo principal');
  }

  async crearPartidaOnline() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    const codigoSala = Math.random().toString(36).substring(2, 8).toUpperCase();

    return await this.supabase
      .from('partidas_online')
      .insert({
        codigo_sala: codigoSala,
        jugador_1: userData.user.id,
        turno_actual: userData.user.id
      })
      .select()
      .single();
  }

  async buscarPartidaPorCodigo(codigoSala: string) {
    return await this.supabase
      .from('partidas_online')
      .select('*')
      .eq('codigo_sala', codigoSala.toUpperCase())
      .maybeSingle();
  }

  async unirseAPartidaOnline(codigoSala: string) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    const { data: partida, error: buscarError } =
      await this.buscarPartidaPorCodigo(codigoSala);

    if (buscarError || !partida) {
      return { data: null, error: buscarError };
    }

    if (partida.jugador_1 === userData.user.id) {
      return { data: null, error: { message: 'No puedes unirte a tu propia partida.' } };
    }

    if (partida.jugador_2) {
      return { data: null, error: { message: 'La partida ya tiene dos jugadores.' } };
    }

    return await this.supabase
      .from('partidas_online')
      .update({
        jugador_2: userData.user.id,
        estado: 'en curso',
        updated_at: new Date().toISOString()
      })
      .eq('codigo_sala', codigoSala.toUpperCase())
      .select()
      .single();
  }

  async obtenerMisPartidasOnline() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('partidas_online')
      .select('*')
      .or(`jugador_1.eq.${userData.user.id},jugador_2.eq.${userData.user.id}`)
      .order('created_at', { ascending: false });
  }

  async actualizarVidaPartidaOnline(
    partidaId: number,
    vidaJugador1: number,
    vidaJugador2: number,
    siguienteTurno: string
  ) {
    return await this.supabase
      .from('partidas_online')
      .update({
        vida_jugador_1: vidaJugador1,
        vida_jugador_2: vidaJugador2,
        turno_actual: siguienteTurno,
        updated_at: new Date().toISOString()
      })
      .eq('id', partidaId)
      .select()
      .single();
  }

  async finalizarPartidaOnline(partidaId: number, ganador: string = 'Sin ganador') {
    return await this.supabase
      .from('partidas_online')
      .update({
        estado: 'finalizada',
        ganador,
        updated_at: new Date().toISOString()
      })
      .eq('id', partidaId)
      .select()
      .single();
  }

  async borrarPartidaOnline(partidaId: number) {
    return await this.supabase
      .from('partidas_online')
      .delete()
      .eq('id', partidaId);
  }

  async actualizarEstadoJuegoPartidaOnline(
    partidaId: number,
    cambios: any
  ) {
    return await this.supabase
      .from('partidas_online')
      .update({
        ...cambios,
        updated_at: new Date().toISOString()
      })
      .eq('id', partidaId)
      .select()
      .single();
  }

  private canalesActivos: { [codigo: string]: any } = {};

  suscribirseAPartidaOnline(codigoSala: string, callback: (partida: any) => void) {
    const channel = this.supabase
      .channel(`sala-${codigoSala}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partidas_online',
          filter: `codigo_sala=eq.${codigoSala.toUpperCase()}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    this.canalesActivos[codigoSala] = channel;
  }

  desuscribirseDePartidaOnline(codigoSala: string) {
    if (this.canalesActivos[codigoSala]) {
      this.supabase.removeChannel(this.canalesActivos[codigoSala]);
      delete this.canalesActivos[codigoSala];
    }
  }

  async obtenerIdUsuarioActual() {
    const { data, error } = await this.supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user.id;
  }

  async obtenerPerfilActual() {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData.user) {
      return { data: null, error: userError };
    }

    return await this.supabase
      .from('perfiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();
  }
}
