import { Component, signal } from '@angular/core';
import { GameContainerComponent } from './game-container/game-container';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameContainerComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('proyectoFinal');
}
