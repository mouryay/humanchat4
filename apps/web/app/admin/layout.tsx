import { ReactNode } from 'react';
import AdminShell from '../../components/admin/AdminShell';

export const metadata = {
  title: 'HumanChat Admin',
  description: 'Manage hosts, sessions, and requests in HumanChat.'
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
