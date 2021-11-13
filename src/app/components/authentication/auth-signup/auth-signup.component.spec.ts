import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AuthSignupComponent } from './auth-signup.component';

describe('AuthSignupComponent', () => {
  let component: AuthSignupComponent;
  let fixture: ComponentFixture<AuthSignupComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AuthSignupComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthSignupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
