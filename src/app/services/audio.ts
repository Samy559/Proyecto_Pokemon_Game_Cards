import { Injectable, NgZone, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private initAudio() {
    if (this.isBrowser && !this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    // Para que los navegadores modernos permitan reproducir el sonido
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBeep() {
    this.playTone(600, 'square', 0.08, 0.05, 0.01);
  }

  playDrawCard() {
    this.playTone(300, 'square', 0.15, 0.08, 0.02, 800);
  }

  playAttack() {
    this.playTone(150, 'sawtooth', 0.2, 0.15, 0.01, 50);
  }

  playError() {
    this.playTone(200, 'sawtooth', 0.2, 0.1, 0.02, 150);
  }

  playVictory() {
    if (!this.isBrowser) return;
    this.initAudio();
    if (!this.audioCtx) return;
    
    const now = this.audioCtx.currentTime;
    this.playNote(523.25, 'square', now, 0.15); // Do
    this.playNote(659.25, 'square', now + 0.15, 0.15); // Mi
    this.playNote(783.99, 'square', now + 0.3, 0.15); // Sol
    this.playNote(1046.50, 'square', now + 0.45, 0.4); // Do Alto
  }

  playDefeat() {
    this.playTone(300, 'sawtooth', 0.6, 0.15, 0.1, 100);
  }

  private musicPlaying = false;
  private currentMusicType: 'menu' | 'battle' | null = null;
  private musicInterval: any;

  startMusic() {
    if (this.musicPlaying) return;
    this.startMenuMusic(); // Por defecto iniciar la de menú
  }

  startMenuMusic() {
    if (!this.isBrowser) return;
    if (this.currentMusicType === 'menu') return;
    
    this.stopMusic();
    this.initAudio();
    if (!this.audioCtx) return;
    
    this.currentMusicType = 'menu';
    this.musicPlaying = true;
    
    // Melodía alegre estilo Pueblo Paleta / Ruta 1 (Pentatónica)
    const melody = [
      523.25, 0, 587.33, 659.25, 0, 659.25, 783.99, 659.25, // Do, Re, Mi, Mi, Sol, Mi
      587.33, 0, 523.25, 587.33, 0, 587.33, 659.25, 587.33, // Re, Do, Re, Re, Mi, Re
    ];
    
    let noteIndex = 0;
    const tempoMs = 250; 

    this.ngZone.runOutsideAngular(() => {
      this.musicInterval = setInterval(() => {
        const freq = melody[noteIndex % melody.length];
        if (freq > 0) {
          this.playNote(freq, 'square', this.audioCtx!.currentTime, 0.2, 0.02);
          this.playNote(freq / 2, 'triangle', this.audioCtx!.currentTime, 0.25, 0.03);
        }
        noteIndex++;
      }, tempoMs);
    });
  }

  startBattleMusic() {
    if (!this.isBrowser) return;
    if (this.currentMusicType === 'battle') return;
    
    this.stopMusic();
    this.initAudio();
    if (!this.audioCtx) return;
    
    this.currentMusicType = 'battle';
    this.musicPlaying = true;
    
    // Melodía rápida, tensa y de combate
    const melody = [
      440.00, 440.00, 493.88, 523.25, 493.88, 440.00, 0, 0, // A, A, B, C, B, A
      329.63, 329.63, 349.23, 392.00, 349.23, 329.63, 0, 0, // E, E, F, G, F, E
    ];
    
    let noteIndex = 0;
    const tempoMs = 110; // Mucho más rápida!

    this.ngZone.runOutsideAngular(() => {
      this.musicInterval = setInterval(() => {
        const freq = melody[noteIndex % melody.length];
        if (freq > 0) {
          this.playNote(freq, 'sawtooth', this.audioCtx!.currentTime, 0.1, 0.03);
          this.playNote(freq / 2, 'square', this.audioCtx!.currentTime, 0.1, 0.04);
        }
        noteIndex++;
      }, tempoMs);
    });
  }

  stopMusic() {
    this.musicPlaying = false;
    this.currentMusicType = null;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
    }
  }

  private playTone(
    frequency: number, 
    type: OscillatorType, 
    duration: number, 
    vol: number = 0.1, 
    attack: number = 0.01,
    endFrequency?: number
  ) {
    if (!this.isBrowser) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    osc.type = type;
    
    const now = this.audioCtx.currentTime;
    
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    }

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playNote(freq: number, type: OscillatorType, startTime: number, duration: number, maxVol: number = 0.1) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(maxVol, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}
