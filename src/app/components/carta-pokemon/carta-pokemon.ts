import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Carta } from '../../models/carta';

@Component({
  selector: 'app-carta-pokemon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carta-pokemon.html',
  styleUrl: './carta-pokemon.css',
})
export class CartaPokemon {
  @Input() carta!: Carta;
  @Input() modo: 'completa' | 'mini' | 'mano' = 'completa';
  @Input() seleccionada = false;
  
  // Botones
  @Input() mostrarBotonHabilidad = false;
  @Input() mostrarBotonInvocar = false;
  @Input() deshabilitarBotonHabilidad = false;
  @Input() deshabilitarBotonInvocar = false;
  @Input() textoBotonHabilidad = 'Usar Habilidad';
  @Input() textoBotonInvocar = 'Invocar';
  @Input() esEnemiga = false;

  @Output() clickCarta = new EventEmitter<void>();
  @Output() clickHabilidad = new EventEmitter<void>();
  @Output() clickInvocar = new EventEmitter<void>();

  onClick() {
    this.clickCarta.emit();
  }

  onHabilidad(event: Event) {
    event.stopPropagation();
    this.clickHabilidad.emit();
  }

  onInvocar(event: Event) {
    event.stopPropagation();
    this.clickInvocar.emit();
  }

  getTipoPrincipal(): string {
    return this.carta?.tipos[0] || 'normal';
  }
}
