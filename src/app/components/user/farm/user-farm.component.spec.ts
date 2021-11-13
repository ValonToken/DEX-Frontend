import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserFarmComponent } from './user-farm.component';

describe('UserFarmComponent', () => {
  let component: UserFarmComponent;
  let fixture: ComponentFixture<UserFarmComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserFarmComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserFarmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
