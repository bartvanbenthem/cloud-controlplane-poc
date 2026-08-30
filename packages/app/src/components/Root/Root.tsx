import React, { PropsWithChildren } from 'react';
import DnsIcon from '@material-ui/icons/Dns';
import ExtensionIcon from '@material-ui/icons/Extension';
import HomeIcon from '@material-ui/icons/Home';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import CloudQueueIcon from '@material-ui/icons/CloudQueue';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';
import {
  Sidebar,
  sidebarConfig,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarScrollWrapper,
  SidebarSpace,
  useSidebarOpenState,
  Link,
} from '@backstage/core-components';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { MyGroupsSidebarItem } from '@backstage/plugin-org';
import GroupIcon from '@material-ui/icons/People';
import { SidebarSearchModal } from '@backstage/plugin-search';

const SidebarLogo = () => {
  const { isOpen } = useSidebarOpenState();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', height: 3 }}>
      <Link to="/" underline="none" aria-label="Home">
        {isOpen ? <LogoFull /> : <LogoIcon />}
      </Link>
    </div>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      <SidebarLogo />
      <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
        <SidebarSearchModal />
      </SidebarGroup>
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        <SidebarItem icon={HomeIcon} to="catalog" text="Home" />
        <SidebarItem
          icon={CloudQueueIcon}
          to="catalog?filters%5Bkind%5D=component&filters%5Btype%5D=stackit-server"
          text="Servers"
        />
        <SidebarItem
          icon={DnsIcon}
          to="catalog?filters%5Bkind%5D=component&filters%5Btype%5D=stackit-ske-cluster"
          text="SKE Clusters"
        />
        <SidebarItem icon={ExtensionIcon} to="api-docs" text="APIs" />
        <MyGroupsSidebarItem
          singularTitle="My Team"
          pluralTitle="My Teams"
          icon={GroupIcon}
        />
        <SidebarDivider />
        <SidebarScrollWrapper>
          <SidebarItem
            icon={CreateComponentIcon}
            to="create"
            text="Provision Resource"
          />
        </SidebarScrollWrapper>
      </SidebarGroup>
      <SidebarSpace />
      <SidebarDivider />
    </Sidebar>
    {children}
  </SidebarPage>
);
