import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AgentDashboardComponent } from './agent-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: AgentDashboardComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AgentDashboardRoutingModule { }
