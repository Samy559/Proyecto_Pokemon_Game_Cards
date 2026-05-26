import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

import { SupabaseService } from '../../services/supabase';
import { HistorialService } from '../../services/historial';

@Component({
  selector: 'app-resultados',
  imports: [NgIf, RouterLink],
  templateUrl: './resultados.html',
  styleUrl: './resultados.css'
})
export class Resultados implements OnInit {
  nombreUsuario = 'Invitado';
  correoUsuario = 'Sin sesión';

  victorias = 0;
  derrotas = 0;
  totalPartidas = 0;

  partidasLocales = 0;
  partidasSupabase = 0;

  porcentajeVictorias = 0;

  mensaje = 'Cargando resultados...';
  sesionActiva = false;

  constructor(
    private supabaseService: SupabaseService,
    private historialService: HistorialService
  ) {}

  ngOnInit(): void {
    this.cargarResultados();
  }

  async cargarResultados(): Promise<void> {
    const historialLocal = this.historialService.obtenerHistorial();
    this.partidasLocales = historialLocal.length;

    const { data: userData, error: userError } =
      await this.supabaseService.obtenerUsuarioActual();

    if (userError || !userData.user) {
      this.sesionActiva = false;
      this.mensaje = 'Debes iniciar sesión para ver tus resultados generales.';
      return;
    }

    this.sesionActiva = true;

    const usuario = userData.user;

    const { data: perfil } =
      await this.supabaseService.obtenerPerfilPorId(usuario.id);

    if (perfil) {
      this.nombreUsuario = perfil.nombre_usuario;
      this.correoUsuario = perfil.correo;
      this.victorias = perfil.victorias || 0;
      this.derrotas = perfil.derrotas || 0;
    } else {
      this.nombreUsuario =
        usuario.user_metadata?.['nombre_usuario'] || 'Jugador';

      this.correoUsuario = usuario.email || 'Correo no disponible';
      this.victorias = 0;
      this.derrotas = 0;
    }

    const { data: resultados } =
      await this.supabaseService.obtenerResultadosActuales();

    if (resultados) {
      this.partidasSupabase = resultados.length;
    }

    this.totalPartidas = this.victorias + this.derrotas;

    if (this.totalPartidas > 0) {
      this.porcentajeVictorias = Math.round(
        (this.victorias / this.totalPartidas) * 100
      );
    } else {
      this.porcentajeVictorias = 0;
    }

    this.mensaje = '';
  }
}
