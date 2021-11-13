import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserLiquidityComponent } from './user-liquidity.component';

describe('UserLiquidityComponent', () => {
  let component: UserLiquidityComponent;
  let fixture: ComponentFixture<UserLiquidityComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserLiquidityComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserLiquidityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
