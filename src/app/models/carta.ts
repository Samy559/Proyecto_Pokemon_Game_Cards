export interface Carta {
  id: number;
  nombre: string;
  imagen: string;
  tipos: string[];
  ataque: number;
  defensa: number;
  vida: number;
  vidaActual: number;
  habilidad: string;
  rareza: string;
  descripcion: string;
}