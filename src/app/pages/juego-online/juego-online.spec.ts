import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JuegoOnline } from './juego-online';

describe('JuegoOnline', () => {
  let component: JuegoOnline;
  let fixture: ComponentFixture<JuegoOnline>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JuegoOnline],
    }).compileComponents();

    fixture = TestBed.createComponent(JuegoOnline);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
