import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserWalletComponent } from './user-wallet.component';

describe('UserWalletComponent', () => {
  let component: UserWalletComponent;
  let fixture: ComponentFixture<UserWalletComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserWalletComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserWalletComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
