import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { AuthComponent } from './theme/layout/auth/auth.component';
import { AuthGuardService as authGuard } from './services/auth.guard.service';
import { FrontpageComponent } from './components/frontpage/frontpage.component';
import { ROLES } from './interfaces/auth.interface';

const routes: Routes = [
  /*{
    path: '',
    component: FrontpageComponent,
  },*/
  {
    path: '',
    component: AdminComponent,
    data: { role: ROLES.USER },
    children: [
      {
        path: '',
        loadChildren: () => import('./components/user/user-dashboard.module').then(module => module.UserDashboardModule)
      }
    ]
  },
  /*{
    path: 'agent',
    component: AdminComponent,
    canActivate: [authGuard],
    data: { role: ROLES.AGENT },
    children: [
      {
        path: '',
        redirectTo: 'index',
        pathMatch: 'full'
      },
      {
        path: 'index',
        loadChildren: () => import('./components/agent/agent-dashboard.module').then(module => module.AgentDashboardModule)
      }
    ]
  },
  {
    path: 'admin',
    component: AdminComponent,
    data: { role: ROLES.ADMIN },
    children: [
      {
        path: '',
        redirectTo: 'index',
        pathMatch: 'full'
      },
      {
        path: 'index',
        loadChildren: () => import('./components/admin/admin-dashboard.module').then(module => module.AdminDashboardModule)
      }
    ]
  },
  {
    path: '',
    component: AuthComponent,
    children: [
      {
        path: 'auth',
        loadChildren: () => import('./components/authentication/authentication.module').then(module => module.AuthenticationModule)
      }
    ]
  }*/
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
