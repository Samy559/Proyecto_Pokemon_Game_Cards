import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AudioService } from './services/audio';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(private audioService: AudioService) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // 1. Iniciar la música de fondo en el primer clic del usuario (evita el bloqueo del navegador)
    this.audioService.startMusic();

    // 2. Reproducir sonido global si el usuario hizo clic en un botón o enlace
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.carta-pokemon')) {
      this.audioService.playBeep();
    }
  }
}