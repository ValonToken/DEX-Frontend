import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { NavLeftComponent } from './nav-left.component';

describe('NavLeftComponent', () => {
  let component: NavLeftComponent;
  let fixture: ComponentFixture<NavLeftComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ NavLeftComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NavLeftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
