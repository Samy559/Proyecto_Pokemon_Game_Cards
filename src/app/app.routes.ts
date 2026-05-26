import { Routes } from '@angular/router';

import { Inicio } from './pages/inicio/inicio';
import { Login } from './pages/login/login';
import { Menu } from './pages/menu/menu';
import { Coleccion } from './pages/coleccion/coleccion';
import { Mazo } from './pages/mazo/mazo';
import { JuegoCpu } from './pages/juego-cpu/juego-cpu';
import { JuegoOnline } from './pages/juego-online/juego-online';
import { Historial } from './pages/historial/historial';
import { Resultados } from './pages/resultados/resultados';
import { Reglas } from './pages/reglas/reglas';

export const routes: Routes = [
  { path: '', component: Inicio },
  { path: 'login', component: Login },
  { path: 'menu', component: Menu },
  { path: 'coleccion', component: Coleccion },
  { path: 'mazo', component: Mazo },
  { path: 'juego-cpu', component: JuegoCpu },
  { path: 'juego-online', component: JuegoOnline },
  { path: 'historial', component: Historial },
  { path: 'resultados', component: Resultados },
  { path: 'reglas', component: Reglas },
  { path: '**', redirectTo: '' }
];
