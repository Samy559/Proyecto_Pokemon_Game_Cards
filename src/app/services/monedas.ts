import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MonedasService {
  private monedasSubject = new BehaviorSubject<number>(0);
  monedas$ = this.monedasSubject.asObservable();
  private readonly STORAGE_KEY = 'pokemon_coins';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.monedasSubject.next(parseInt(stored, 10));
      } else {
        // Regalo inicial de 500 monedas para que el usuario pueda abrir sobres al empezar
        this.monedasSubject.next(500);
        this.guardar(500);
      }
    }
  }

  get monedas(): number {
    return this.monedasSubject.value;
  }

  sumar(cantidad: number) {
    const total = this.monedas + cantidad;
    this.monedasSubject.next(total);
    this.guardar(total);
  }

  restar(cantidad: number): boolean {
    if (this.monedas >= cantidad) {
      const total = this.monedas - cantidad;
      this.monedasSubject.next(total);
      this.guardar(total);
      return true;
    }
    return false;
  }

  private guardar(cantidad: number) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, cantidad.toString());
    }
  }
}
