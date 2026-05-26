import { Injectable } from '@angular/core';
import { Carta } from '../models/carta';

@Injectable({
  providedIn: 'root'
})
export class MazoService {
  private claveMazo = 'mazo_personalizado';

  guardarMazo(cartas: Carta[]): void {
    localStorage.setItem(this.claveMazo, JSON.stringify(cartas));
  }

  obtenerMazo(): Carta[] {
    const datos = localStorage.getItem(this.claveMazo);

    if (!datos) {
      return [];
    }

    return JSON.parse(datos);
  }

  borrarMazo(): void {
    localStorage.removeItem(this.claveMazo);
  }
}
