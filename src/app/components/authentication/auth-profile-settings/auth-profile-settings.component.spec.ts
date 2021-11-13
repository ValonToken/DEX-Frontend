import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AuthProfileSettingsComponent } from './auth-profile-settings.component';

describe('AuthProfileSettingsComponent', () => {
  let component: AuthProfileSettingsComponent;
  let fixture: ComponentFixture<AuthProfileSettingsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AuthProfileSettingsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AuthProfileSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
