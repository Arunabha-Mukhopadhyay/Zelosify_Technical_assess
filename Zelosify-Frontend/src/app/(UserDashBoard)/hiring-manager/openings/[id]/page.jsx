import HiringManagerOpeningDetailsLayout from '@/components/UserDashboardPage/HiringManager/Openings/HiringManagerOpeningDetailsLayout';

export default async function HiringManagerOpeningDetailsPage({ params }) {
  const { id } = await params;
  return <HiringManagerOpeningDetailsLayout openingId={id} />;
}
