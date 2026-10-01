import React from 'react';
import TabbedPage from '../../components/shared/TabbedPage';
// Adjust these two imports to match your existing page file names
import Equipment from './Equipment';
import EquipmentRequests from './EquipmentRequests';

export default function EquipmentManagement() {
  return (
    <TabbedPage tabs={[
      { key: 'equipment', label: 'Equipment', component: Equipment },
      { key: 'requests',  label: 'Requests',  component: EquipmentRequests },
    ]} />
  );
}