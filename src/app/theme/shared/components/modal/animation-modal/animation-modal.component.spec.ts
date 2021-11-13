import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { AnimationModalComponent } from './animation-modal.component';

describe('AnimationModalComponent', () => {
  let component: AnimationModalComponent;
  let fixture: ComponentFixture<AnimationModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AnimationModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
