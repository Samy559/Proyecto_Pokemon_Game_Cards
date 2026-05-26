import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';

import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, NgIf],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  modoRegistro = false;

  nombreUsuario = '';
  correo = '';
  password = '';
  confirmarPassword = '';

  mensaje = '';
  cargando = false;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  cambiarModo(): void {
    this.modoRegistro = !this.modoRegistro;
    this.mensaje = '';
    this.limpiarFormulario();
  }

  limpiarFormulario(): void {
    this.nombreUsuario = '';
    this.correo = '';
    this.password = '';
    this.confirmarPassword = '';
  }

  async iniciarSesion(): Promise<void> {
    if (!this.correo || !this.password) {
      this.mensaje = 'Completa correo y contraseña.';
      return;
    }

    if (!this.correo.includes('@')) {
      this.mensaje = 'Ingresa un correo válido.';
      return;
    }

    this.cargando = true;
    this.mensaje = 'Iniciando sesión...';

    const { data, error } = await this.supabaseService.iniciarSesion(
      this.correo,
      this.password
    );

    this.cargando = false;

    if (error) {
      this.mensaje = 'Error al iniciar sesión: ' + error.message;
      return;
    }

    this.mensaje = 'Inicio de sesión correcto.';
    this.router.navigate(['/menu']);
  }

  async registrarse(): Promise<void> {
    if (!this.nombreUsuario || !this.correo || !this.password || !this.confirmarPassword) {
      this.mensaje = 'Completa todos los campos.';
      return;
    }

    if (!this.correo.includes('@')) {
      this.mensaje = 'Ingresa un correo válido.';
      return;
    }

    if (this.password.length < 6) {
      this.mensaje = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.password !== this.confirmarPassword) {
      this.mensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;
    this.mensaje = 'Registrando usuario...';

    const { data, error } = await this.supabaseService.registrarUsuario(
      this.correo,
      this.password,
      this.nombreUsuario
    );

    this.cargando = false;

    if (error) {
      this.mensaje = 'Error al registrarse: ' + error.message;
      return;
    }

    if (data.user) {
      const { error: perfilError } = await this.supabaseService.crearPerfil(
        data.user.id,
        this.nombreUsuario,
        this.correo
      );

    if (perfilError) {
      this.mensaje = 'Usuario creado, pero hubo error al guardar el perfil: ' + perfilError.message;
      return;
    }
  }

  this.mensaje = 'Registro correcto. Ya puedes iniciar sesión.';
  this.modoRegistro = false;
  this.limpiarFormulario();
  }
}
