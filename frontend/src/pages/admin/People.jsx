import React from 'react';
import TabbedPage from '../../components/shared/TabbedPage';
// Adjust these two paths/names to match your existing pages
import Freelancers from './Freelancers';
import Users from './Users';

export default function People() {
  return (
    <TabbedPage tabs={[
      { key: 'freelancers', label: 'Freelancers', component: Freelancers },
      { key: 'users',       label: 'Users',       component: Users },
    ]} />
  );
}