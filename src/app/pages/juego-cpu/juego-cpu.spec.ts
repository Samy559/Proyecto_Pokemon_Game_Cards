import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JuegoCpu } from './juego-cpu';

describe('JuegoCpu', () => {
  let component: JuegoCpu;
  let fixture: ComponentFixture<JuegoCpu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JuegoCpu],
    }).compileComponents();

    fixture = TestBed.createComponent(JuegoCpu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
