import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { Carta } from '../models/carta';

export interface ColeccionItem {
  cartaId: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ColeccionService {
  private coleccionSubject = new BehaviorSubject<ColeccionItem[]>([]);
  coleccion$ = this.coleccionSubject.asObservable();
  private readonly STORAGE_KEY = 'pokemon_coleccion';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.cargar();
    }
  }

  get coleccion() { return this.coleccionSubject.value; }

  private cargar() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.coleccionSubject.next(JSON.parse(stored));
    }
  }

  inicializarColeccionBase(cartasIniciales: Carta[]) {
    if (this.coleccion.length > 0) return; // Ya tiene una colección

    // Entregar 3 copias de las cartas iniciales básicas para asegurar que pueda jugar
    const nueva: ColeccionItem[] = cartasIniciales.map(c => ({ cartaId: c.id, cantidad: 3 }));
    this.coleccionSubject.next(nueva);
    this.guardar(nueva);
  }

  agregarCartas(cartasNuevas: Carta[]) {
    const col = [...this.coleccion];
    for (const c of cartasNuevas) {
      const idx = col.findIndex(item => item.cartaId === c.id);
      if (idx > -1) {
        col[idx].cantidad++;
      } else {
        col.push({ cartaId: c.id, cantidad: 1 });
      }
    }
    this.coleccionSubject.next(col);
    this.guardar(col);
  }

  poseeCarta(cartaId: number): boolean {
    return this.coleccion.some(item => item.cartaId === cartaId && item.cantidad > 0);
  }

  cantidadPoseida(cartaId: number): number {
    const item = this.coleccion.find(i => i.cartaId === cartaId);
    return item ? item.cantidad : 0;
  }

  private guardar(col: ColeccionItem[]) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(col));
    }
  }
}
