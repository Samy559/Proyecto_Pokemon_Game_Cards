import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mazo } from './mazo';

describe('Mazo', () => {
  let component: Mazo;
  let fixture: ComponentFixture<Mazo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mazo],
    }).compileComponents();

    fixture = TestBed.createComponent(Mazo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
