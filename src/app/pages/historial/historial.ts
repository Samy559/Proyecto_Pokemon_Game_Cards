import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HistorialService } from '../../services/historial';
import { HistorialPartida } from '../../models/historial-partida';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-historial',
  imports: [NgFor, NgIf, RouterLink, DatePipe],
  templateUrl: './historial.html',
  styleUrl: './historial.css'
})
export class Historial implements OnInit {
  historialLocal: HistorialPartida[] = [];
  historialSupabase: any[] = [];

  cargandoSupabase = false;
  mensajeSupabase = '';

  constructor(
    private historialService: HistorialService,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    this.cargarHistorialLocal();
    this.cargarHistorialSupabase();
  }

  cargarHistorialLocal(): void {
    this.historialLocal = this.historialService.obtenerHistorial();
  }

  async cargarHistorialSupabase(): Promise<void> {
    this.cargandoSupabase = true;
    this.mensajeSupabase = 'Cargando historial remoto...';

    const { data, error } = await this.supabaseService.obtenerResultadosActuales();

    this.cargandoSupabase = false;

    if (error) {
      this.mensajeSupabase = 'Inicia sesión para ver el historial guardado en Supabase.';
      this.historialSupabase = [];
      return;
    }

    this.historialSupabase = data || [];

    if (this.historialSupabase.length === 0) {
      this.mensajeSupabase = 'No hay resultados guardados en Supabase todavía.';
    } else {
      this.mensajeSupabase = '';
    }
  }

  borrarHistorialLocal(): void {
    this.historialService.borrarHistorial();
    this.cargarHistorialLocal();
  }
}
