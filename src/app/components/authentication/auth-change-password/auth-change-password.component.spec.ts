import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AuthChangePasswordComponent } from './auth-change-password.component';

describe('AuthChangePasswordComponent', () => {
  let component: AuthChangePasswordComponent;
  let fixture: ComponentFixture<AuthChangePasswordComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AuthChangePasswordComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthChangePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
