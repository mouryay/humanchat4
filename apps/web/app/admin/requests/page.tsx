import type { Metadata } from 'next';
import AdminRequestedPeopleTable from '../../../components/AdminRequestedPeopleTable';

export const metadata: Metadata = {
  title: 'Requested People · HumanChat Admin'
};

export default function RequestedPeopleAdminPage() {
  return (
    <main className="min-h-screen bg-midnight py-16">
      <AdminRequestedPeopleTable />
    </main>
  );
}
