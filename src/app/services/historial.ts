import { Injectable } from '@angular/core';
import { HistorialPartida } from '../models/historial-partida';

@Injectable({
  providedIn: 'root'
})
export class HistorialService {
  private claveStorage = 'historial_partidas_cpu';

  obtenerHistorial(): HistorialPartida[] {
    const datos = localStorage.getItem(this.claveStorage);

    if (!datos) {
      return [];
    }

    return JSON.parse(datos);
  }

  guardarPartida(partida: HistorialPartida): void {
    const historial = this.obtenerHistorial();
    historial.unshift(partida);

    localStorage.setItem(this.claveStorage, JSON.stringify(historial));
  }

  borrarHistorial(): void {
    localStorage.removeItem(this.claveStorage);
  }
}
