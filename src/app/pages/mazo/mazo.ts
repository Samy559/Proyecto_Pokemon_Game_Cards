import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PokemonService } from '../../services/pokemon';
import { MazoService } from '../../services/mazo';
import { Carta } from '../../models/carta';

import { SupabaseService } from '../../services/supabase';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-mazo',
  standalone: true,
  imports: [NgFor, NgIf, TitleCasePipe, RouterLink, CartaPokemon],
  templateUrl: './mazo.html',
  styleUrl: './mazo.css'
})
export class Mazo implements OnInit {
  cartasDisponibles: Carta[] = [];
  mazoSeleccionado: Carta[] = [];

  cargando = true;
  mensaje = '';

  constructor(
    private pokemonService: PokemonService,
    private mazoService: MazoService,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    this.cargarCartas();
    this.cargarMazoGuardado();
  }

  cargarCartas(): void {
    this.cargando = true;
    this.mensaje = 'Cargando cartas disponibles...';

    this.pokemonService.obtenerPokemones().subscribe({
      next: (cartas) => {
        this.cartasDisponibles = cartas;
        this.cargando = false;
        this.mensaje = 'Selecciona hasta 20 cartas para tu mazo.';
      },
      error: () => {
        this.cargando = false;
        this.mensaje = 'Error al cargar cartas.';
      }
    });
  }

  agregarCarta(carta: Carta): void {
    if (this.mazoSeleccionado.length >= 20) {
      this.mensaje = 'Tu mazo ya tiene el máximo de 20 cartas.';
      return;
    }

    const yaExiste = this.mazoSeleccionado.some(c => c.id === carta.id);

    if (yaExiste) {
      this.mensaje = 'Esa carta ya está en tu mazo.';
      return;
    }

    this.mazoSeleccionado.push(carta);
    this.mensaje = `${carta.nombre} fue agregado al mazo.`;
  }

  quitarCarta(indice: number): void {
    const carta = this.mazoSeleccionado[indice];
    this.mazoSeleccionado.splice(indice, 1);
    this.mensaje = `${carta.nombre} fue eliminado del mazo.`;
  }

  async guardarMazo(): Promise<void> {
    if (this.mazoSeleccionado.length < 5) {
      this.mensaje = 'Selecciona al menos 5 cartas para guardar el mazo.';
      return;
    }

    this.mazoService.guardarMazo(this.mazoSeleccionado);

    const { error } = await this.supabaseService.guardarMazoSupabase(
      this.mazoSeleccionado
    );

    if (error) {
      this.mensaje = 'Mazo guardado localmente. Inicia sesión para guardarlo en Supabase.';
      return;
    }

    this.mensaje = 'Mazo guardado correctamente en local y Supabase.';
  }

  async borrarMazo(): Promise<void> {
    this.mazoSeleccionado = [];
    this.mazoService.borrarMazo();

    const { error } = await this.supabaseService.borrarMazoSupabase();

    if (error) {
      this.mensaje = 'Mazo eliminado localmente. No había sesión activa para borrar en Supabase.';
      return;
    }

    this.mensaje = 'Mazo eliminado localmente y en Supabase.';
  }

  async cargarMazoGuardado(): Promise<void> {
    const mazoLocal = this.mazoService.obtenerMazo();
    this.mazoSeleccionado = mazoLocal;

    const { data, error } = await this.supabaseService.obtenerMazoSupabase();

    if (error || !data) {
      return;
    }

    this.mazoSeleccionado = data.cartas || [];
    this.mazoService.guardarMazo(this.mazoSeleccionado);
  }
}
