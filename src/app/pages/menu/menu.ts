import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, isPlatformBrowser } from '@angular/common';

import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-menu',
  imports: [RouterLink, NgIf],
  templateUrl: './menu.html',
  styleUrl: './menu.css'
})
export class Menu implements OnInit {
  nombreUsuario = '';
  correoUsuario = '';
  victorias = 0;
  derrotas = 0;
  totalPartidas = 0;

  sesionActiva = false;
  mensajeSesion = 'Cargando sesión...';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.cargarUsuario();
    } else {
      this.mensajeSesion = 'Cargando sesión...';
    }
  }

  async cargarUsuario(): Promise<void> {
    const { data: userData, error: userError } =
      await this.supabaseService.obtenerUsuarioActual();

    if (userError || !userData.user) {
      this.sesionActiva = false;
      this.mensajeSesion = 'No has iniciado sesión.';
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
      this.totalPartidas = this.victorias + this.derrotas;
    } else {
      const nombreMetadata = usuario.user_metadata?.['nombre_usuario'] || 'Jugador';
      const correo = usuario.email || 'Correo no disponible';

      await this.supabaseService.crearPerfil(usuario.id, nombreMetadata, correo);

      this.nombreUsuario = nombreMetadata;
      this.correoUsuario = correo;
      this.victorias = 0;
      this.derrotas = 0;
      this.totalPartidas = 0;
    }

    this.mensajeSesion = `Bienvenido, ${this.nombreUsuario}`;
  }

  async cerrarSesion(): Promise<void> {
    await this.supabaseService.cerrarSesion();

    this.nombreUsuario = '';
    this.correoUsuario = '';
    this.victorias = 0;
    this.derrotas = 0;
    this.totalPartidas = 0;
    this.mensajeSesion = 'Sesión cerrada.';

    this.router.navigate(['/login']);
  }
}
