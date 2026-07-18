import VendorOpeningDetailsLayout from "@/components/UserDashboardPage/IT_VENDOR/Openings/VendorOpeningDetailsLayout";

export default async function VendorOpeningDetailsPage({ params }) {
  const { id } = await params;
  return <VendorOpeningDetailsLayout openingId={id} />;
}
