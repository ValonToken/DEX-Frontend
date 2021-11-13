import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UserLptComponent } from './user-lpt.component';

describe('UserLptComponent', () => {
  let component: UserLptComponent;
  let fixture: ComponentFixture<UserLptComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UserLptComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserLptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
