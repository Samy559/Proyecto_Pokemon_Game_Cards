import { TestBed } from '@angular/core/testing';

import { Mazo } from './mazo';

describe('Mazo', () => {
  let service: Mazo;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Mazo);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
