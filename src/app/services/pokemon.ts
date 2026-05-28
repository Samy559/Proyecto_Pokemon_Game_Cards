import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, tap, mergeMap, toArray } from 'rxjs/operators';
import { Carta } from '../models/carta';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {
  private apiUrl = 'https://pokeapi.co/api/v2/pokemon';
  private cacheCartas: Carta[] | null = null;

  constructor(private http: HttpClient) {}

  obtenerPokemones(): Observable<Carta[]> {
    if (this.cacheCartas) {
      return of(this.cacheCartas);
    }

    const ids = [];
    for (let i = 906; i <= 1025; i++) {
      ids.push(i);
    }

    return from(ids).pipe(
      mergeMap(id => this.http.get<any>(`${this.apiUrl}/${id}`), 10),
      toArray(),
      map(pokemones => pokemones.map(p => this.convertirPokemonACarta(p))),
      tap(cartas => this.cacheCartas = cartas)
    );
  }

  private convertirPokemonACarta(pokemon: any): Carta {
    const ataque = this.obtenerStat(pokemon, 'attack');
    const defensa = this.obtenerStat(pokemon, 'defense');
    const vida = this.obtenerStat(pokemon, 'hp');

    return {
      id: pokemon.id,
      nombre: pokemon.name,
      imagen:
        pokemon.sprites.other['official-artwork'].front_default ||
        pokemon.sprites.front_default,
      tipos: pokemon.types.map((t: any) => t.type.name),
      ataque,
      defensa,
      vida,
      vidaActual: vida,
      habilidad: pokemon.abilities[0]?.ability.name || 'Sin habilidad',
      rareza: this.calcularRareza(ataque, defensa, vida),
      descripcion: `Carta de ${pokemon.name} de tipo ${pokemon.types
        .map((t: any) => t.type.name)
        .join(', ')}.`
    };
  }

  private obtenerStat(pokemon: any, nombreStat: string): number {
    const stat = pokemon.stats.find((s: any) => s.stat.name === nombreStat);
    return stat ? stat.base_stat : 0;
  }

  private calcularRareza(ataque: number, defensa: number, vida: number): string {
    const total = ataque + defensa + vida;

    if (total >= 230) {
      return 'Legendaria';
    } else if (total >= 180) {
      return 'Épica';
    } else if (total >= 130) {
      return 'Rara';
    } else {
      return 'Común';
    }
  }
}