import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor, AsyncPipe } from '@angular/common';
import { MonedasService } from '../../services/monedas';
import { ColeccionService } from '../../services/coleccion';
import { PokemonService } from '../../services/pokemon';
import { Carta } from '../../models/carta';
import { CartaPokemon } from '../../components/carta-pokemon/carta-pokemon';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [RouterLink, NgIf, NgFor, AsyncPipe, CartaPokemon],
  templateUrl: './tienda.html',
  styleUrls: ['./tienda.css']
})
export class Tienda implements OnInit {
  cargando = false;
  abriendoSobre = false;
  cartasMostradas: Carta[] = [];
  todasLasCartas: Carta[] = [];

  constructor(
    public monedasService: MonedasService,
    public coleccionService: ColeccionService,
    private pokemonService: PokemonService
  ) {}

  async ngOnInit() {
    this.cargando = true;
    try {
      this.todasLasCartas = await firstValueFrom(this.pokemonService.obtenerPokemones());
      
      // Si el jugador no tiene cartas en su colección, le damos un set base gratis
      if (this.coleccionService.coleccion.length === 0) {
        // Filtramos para darle unas cartas básicas (Bulbasaur, Charmander, Squirtle, Pikachu, etc)
        const iniciales = this.todasLasCartas.slice(0, 10); 
        this.coleccionService.inicializarColeccionBase(iniciales);
      }
    } catch(e) {
      console.error(e);
    }
    this.cargando = false;
  }

  comprarSobre() {
    if (this.abriendoSobre) return;
    
    if (this.monedasService.restar(100)) {
      this.abrirSobreAnimacion();
    } else {
      alert("No tienes suficientes monedas. ¡Gana partidas para conseguir más!");
    }
  }

  private abrirSobreAnimacion() {
    this.abriendoSobre = true;
    this.cartasMostradas = [];
    
    // Simular el tiempo de abrir el sobre
    setTimeout(() => {
      this.generarCartasAleatorias();
    }, 1500);
  }

  private generarCartasAleatorias() {
    const seleccionadas: Carta[] = [];
    
    // Generar 5 cartas
    for(let i = 0; i < 5; i++) {
      const rand = Math.random();
      let cartaElegida: Carta;

      // 5% Legendaria (las últimas de la pokedex, ej: Mewtwo, Articuno)
      // 15% Epica (Evoluciones finales)
      // 80% Normal / Rara
      
      if (rand > 0.95) {
        // Legendaria (vida > 110)
        const legendarias = this.todasLasCartas.filter(c => c.vida >= 120);
        cartaElegida = legendarias[Math.floor(Math.random() * legendarias.length)] || this.obtenerCualquiera();
      } else if (rand > 0.80) {
        // Epica (vida entre 90 y 110)
        const epicas = this.todasLasCartas.filter(c => c.vida >= 90 && c.vida < 120);
        cartaElegida = epicas[Math.floor(Math.random() * epicas.length)] || this.obtenerCualquiera();
      } else {
        // Común
        const comunes = this.todasLasCartas.filter(c => c.vida < 90);
        cartaElegida = comunes[Math.floor(Math.random() * comunes.length)] || this.obtenerCualquiera();
      }
      
      seleccionadas.push(cartaElegida);
    }

    this.cartasMostradas = seleccionadas;
    this.coleccionService.agregarCartas(seleccionadas);
    
    // Terminar animación
    setTimeout(() => {
      this.abriendoSobre = false;
    }, 500);
  }

  private obtenerCualquiera() {
    return this.todasLasCartas[Math.floor(Math.random() * this.todasLasCartas.length)];
  }

  cerrarResultados() {
    this.cartasMostradas = [];
  }
}
