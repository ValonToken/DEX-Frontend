import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserSwapComponent } from './user-swap.component';

describe('UserSwapComponent', () => {
  let component: UserSwapComponent;
  let fixture: ComponentFixture<UserSwapComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserSwapComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserSwapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
