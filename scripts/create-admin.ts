/**
 * Promotes an existing sign-in to administrator.
 *
 * Usage:
 *   npm run admin:create -- admin@example.com
 *
 * The profile must already exist, so create the sign-in at /signup first.
 * `profiles` is protected by RLS, so the role change has to happen with the
 * service role from a server-side script.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;

  if (!email) {
    console.error("Usage: npm run admin:create -- admin@example.com");
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) {
    console.error(listError.message);
    process.exit(1);
  }

  const target = list.users.find((user) => user.email === email);
  if (!target) {
    console.error(`No sign-in exists for ${email}. Create it at /signup first.`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "admin", is_active: true, must_change_password: false })
    .eq("id", target.id)
    .select("id, role")
    .single();

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`${email} now has role: ${data.role}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});