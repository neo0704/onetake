import React from 'react';
import TabbedPage from '../../components/shared/TabbedPage';
// Adjust these three imports to match your existing page file names
import Quotations from './Quotations';
import Payments from './Payments';
import Payroll from './Payroll';

export default function Finance() {
  return (
    <TabbedPage tabs={[
      { key: 'quotations', label: 'Quotations', component: Quotations },
      { key: 'payments',   label: 'Payments',   component: Payments },
      { key: 'payroll',    label: 'Payroll',    component: Payroll },
    ]} />
  );
}