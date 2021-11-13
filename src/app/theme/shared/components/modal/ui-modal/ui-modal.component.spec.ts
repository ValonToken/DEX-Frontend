import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { UiModalComponent } from './ui-modal.component';

describe('UiModalComponent', () => {
  let component: UiModalComponent;
  let fixture: ComponentFixture<UiModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ UiModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UiModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
