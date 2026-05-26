import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { PokemonService } from '../../services/pokemon';
import { Carta } from '../../models/carta';
import { RouterLink } from '@angular/router';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';

@Component({
  selector: 'app-coleccion',
  standalone: true,
  imports: [NgFor, NgIf, TitleCasePipe, RouterLink, CartaPokemon],
  templateUrl: './coleccion.html',
  styleUrl: './coleccion.css'
})
export class Coleccion implements OnInit {
  cartas: Carta[] = [];
  cargando = true;
  error = '';

  constructor(private pokemonService: PokemonService) {}

  ngOnInit(): void {
    this.cargarCartas();
  }

  cargarCartas(): void {
    this.cargando = true;
    this.error = '';

    this.pokemonService.obtenerPokemones().subscribe({
      next: (cartas) => {
        this.cartas = cartas;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar las cartas Pokémon.';
        this.cargando = false;
      }
    });
  }
}