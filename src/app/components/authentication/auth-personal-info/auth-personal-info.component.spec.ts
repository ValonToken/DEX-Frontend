import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AuthPersonalInfoComponent } from './auth-personal-info.component';

describe('AuthPersonalInfoComponent', () => {
  let component: AuthPersonalInfoComponent;
  let fixture: ComponentFixture<AuthPersonalInfoComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AuthPersonalInfoComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthPersonalInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
