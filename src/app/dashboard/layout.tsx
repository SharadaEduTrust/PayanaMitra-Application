import Link from "next/link";
import Brand from "@/components/brand";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import DashboardNav from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (profile.must_change_password) redirect("/change-password");

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand size={38} tone="light" />
        <DashboardNav role={profile.role} />
        <div className="side-bottom">
          <Link className="side-user" href="/dashboard/profile">
            {profile.avatar_url ? (
              // Supabase serves the bucket over plain img; next/image would add
              // a proxy hop for no benefit here.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar-initials avatar-photo" src={profile.avatar_url} alt="" />
            ) : (
              <span className="avatar-initials">
                {profile.first_name.charAt(0)}
                {profile.last_name.charAt(0)}
              </span>
            )}
            <p>
              {profile.first_name} {profile.last_name}
              <span className="side-phone mono">{profile.phone}</span>
            </p>
          </Link>
        </div>
      </aside>
      <section className="main">{children}</section>
    </div>
  );
}
