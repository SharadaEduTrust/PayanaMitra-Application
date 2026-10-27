import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import FeedbackAdmin, {
  type AdminFeedbackItem,
  type AdminTripOption,
} from "@/components/feedback-admin";
import { extractFeedbackConfig } from "@/lib/feedback";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ trip_id?: string }>;
};

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  await requireProfile(["admin"]);
  const params = await searchParams;
  const initialTripId = params.trip_id;

  const admin = createAdminClient();

  const [{ data: feedbackRows }, { data: tripRows }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("feedback") as any)
      .select(`
        id,
        rating,
        comment,
        created_at,
        trip_id,
        user_id,
        trips (
          id,
          name,
          trip_code,
          destination,
          feedback_form_url,
          remarks
        ),
        profiles (
          id,
          first_name,
          last_name,
          phone,
          email,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false }),
    admin
      .from("trips")
      .select("id, name, trip_code, destination, feedback_form_url, remarks")
      .order("name", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedback: AdminFeedbackItem[] = (feedbackRows ?? []).map((row: any) => {
    const tripObj = Array.isArray(row.trips) ? row.trips[0] : row.trips;
    const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const fbConfig = tripObj ? extractFeedbackConfig(tripObj) : { url: null, windowDays: 7 };

    return {
      id: row.id,
      rating: Number(row.rating) || 0,
      comment: row.comment ?? null,
      created_at: row.created_at,
      trip_id: row.trip_id,
      user_id: row.user_id,
      trip: tripObj
        ? {
            id: tripObj.id,
            name: tripObj.name,
            trip_code: tripObj.trip_code,
            destination: tripObj.destination ?? null,
            feedback_form_url: fbConfig.url,
          }
        : null,
      profile: profileObj
        ? {
            id: profileObj.id,
            first_name: profileObj.first_name,
            last_name: profileObj.last_name,
            phone: profileObj.phone,
            email: profileObj.email ?? null,
            avatar_url: profileObj.avatar_url ?? null,
          }
        : null,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trips: AdminTripOption[] = (tripRows ?? []).map((t: any) => {
    const fbConfig = extractFeedbackConfig(t);
    return {
      id: t.id,
      name: t.name,
      trip_code: t.trip_code,
      destination: t.destination ?? null,
      feedback_form_url: fbConfig.url,
    };
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Guest Feedback</h1>
          <small>Review traveler ratings out of 10, written comments, and Google Form links.</small>
        </div>
      </header>
      <div className="admin-body">
        <FeedbackAdmin
          feedback={feedback}
          trips={trips}
          initialTripId={initialTripId}
        />
      </div>
    </>
  );
}
