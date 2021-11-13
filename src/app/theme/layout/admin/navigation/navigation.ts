import {Injectable} from '@angular/core';

export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  function?: any;
  badge?: {
    title?: string;
    type?: string;
  };
  children?: Navigation[];
}

export interface Navigation extends NavigationItem {
  children?: NavigationItem[];
}

const NavigationItemsUser = [
  {
    id: 'navigation',
    title: 'Navigation',
    type: 'group',
    icon: 'feather icon-align-left',
    children: [
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        type: 'item',
        url: '/dashboard',
        classes: 'nav-item',
        icon: 'feather icon-home'
      },
      {
        id: 'nav-profile',
        title: 'Profile',
        type: 'item',
        url: '/profile',
        classes: 'nav-item',
        icon: 'feather icon-user'
      },
      {
        id: 'nav-exchange',
        title: 'Exchange',
        type: 'collapse',
        classes: 'nav-item',
        icon: 'feather icon-trending-up',
        children: [
          {
            id: 'nav-swap',
            title: 'Swap',
            type: 'item',
            url: '/swap',
            classes: 'nav-item',
            icon: 'feather icon-repeat',
          },
          {
            id: 'nav-add-liquidity',
            title: 'Add Liquidity',
            type: 'item',
            url: '/liquidity',
            classes: 'nav-item',
            icon: 'feather icon-briefcase',
          },
          {
            id: 'nav-remove-liquidity',
            title: 'Remove Liquidity',
            type: 'item',
            url: '/lpt',
            classes: 'nav-item',
            icon: 'feather icon-list',
          }
        ]
      },
      {
        id: 'nav-liquidity-farms',
        title: 'Liquidity Farms',
        type: 'item',
        url: '/farms',
        classes: 'nav-item',
        icon: 'feather icon-layers'
      },
      {
        id: 'nav-stake',
        title: 'Stake',
        type: 'item',
        url: '/stake',
        classes: 'nav-item',
        icon: 'feather icon-box'
      },
    ]
  }
];


@Injectable()
export class NavigationItem {
  public getUserNav() {
    return NavigationItemsUser;
  }
}
