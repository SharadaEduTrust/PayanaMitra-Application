/**
 * Promotes an existing sign-in or creates an administrator account.
 *
 * Usage:
 *   npm run admin:create -- 9019911706
 *   npm run admin:create -- admin@example.com
 */
import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function derivePassword(phone: string, pin: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = enc.encode(`${phone}:${pin}`);
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, message);
  return Buffer.from(signature).toString("base64url");
}

async function main() {
  const input = process.argv[2] ?? process.env.ADMIN_EMAIL;

  if (!input) {
    console.error("Usage: npm run admin:create -- <email | phone>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const pepper = process.env.AUTH_PEPPER || "payana_default_pepper";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isPhone = /^\+?[0-9]{10,15}$/.test(input.replace(/[\s\-\(\)]/g, ""));
  const cleanPhone = isPhone ? input.replace(/[\s\-\(\)]/g, "").replace(/^\+91/, "") : null;
  const email = isPhone ? `${cleanPhone}@payana.app` : input;

  // 1. Check profiles by phone or id
  if (cleanPhone) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, phone, role")
      .or(`phone.eq.${cleanPhone},phone.eq.+91${cleanPhone}`)
      .maybeSingle();

    if (profile) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ role: "admin", is_active: true, must_change_password: false })
        .eq("id", profile.id)
        .select("id, phone, role")
        .single();

      if (error) {
        console.error("Failed to update profile:", error.message);
        process.exit(1);
      }
      console.log(`User ${data.phone} (${data.id}) now has role: ${data.role}`);
      return;
    }
  }

  // 2. Check auth.users
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error(listError.message);
    process.exit(1);
  }

  let target = list.users.find(
    (user) => user.email === email || (cleanPhone && user.email === `${cleanPhone}@payana.app`),
  );

  let userId: string;
  if (target) {
    userId = target.id;
  } else if (cleanPhone) {
    const pin = cleanPhone.slice(-4);
    const password = await derivePassword(cleanPhone, pin, pepper);
    const { data: newAuth, error: createAuthErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });
    if (createAuthErr || !newAuth.user) {
      console.error("Failed to create auth user:", createAuthErr?.message);
      process.exit(1);
    }
    userId = newAuth.user.id;
    console.log(`Created new auth user for ${cleanPhone}`);
  } else {
    console.error(`No sign-in exists for ${email}. Create it at /signup first.`);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      phone: cleanPhone ?? "9000000000",
      first_name: "Admin",
      last_name: "User",
      role: "admin",
      is_active: true,
      must_change_password: false,
    })
    .select("id, phone, role")
    .single();

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`User ${data.phone} (${data.id}) now has role: ${data.role}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});