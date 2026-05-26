import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Coleccion } from './coleccion';

describe('Coleccion', () => {
  let component: Coleccion;
  let fixture: ComponentFixture<Coleccion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Coleccion],
    }).compileComponents();

    fixture = TestBed.createComponent(Coleccion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
