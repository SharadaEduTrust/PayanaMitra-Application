import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function SurveyPage({ params }: Params) {
  const { id } = await params;
  redirect(`/dashboard/trips/${id}/feedback`);
}