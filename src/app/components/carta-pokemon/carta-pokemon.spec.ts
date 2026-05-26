import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CartaPokemon } from './carta-pokemon';

describe('CartaPokemon', () => {
  let component: CartaPokemon;
  let fixture: ComponentFixture<CartaPokemon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartaPokemon],
    }).compileComponents();

    fixture = TestBed.createComponent(CartaPokemon);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
