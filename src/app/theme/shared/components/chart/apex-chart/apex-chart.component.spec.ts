import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ApexChartComponent } from './apex-chart.component';

describe('ApexChartComponent', () => {
  let component: ApexChartComponent;
  let fixture: ComponentFixture<ApexChartComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ ApexChartComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ApexChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
