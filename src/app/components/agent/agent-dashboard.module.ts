import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AgentDashboardRoutingModule } from './agent-dashboard-routing.module';
import { AgentDashboardComponent } from './agent-dashboard.component';
import { SharedModule } from '../../theme/shared/shared.module';

@NgModule({
  declarations: [AgentDashboardComponent],
  imports: [
    CommonModule,
    AgentDashboardRoutingModule,
    SharedModule
  ]
})
export class AgentDashboardModule { }
