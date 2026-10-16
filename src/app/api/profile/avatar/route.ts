import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Uploads (or clears) the caller's profile photo.
 *
 * `profiles` has no client UPDATE policy, so this runs with the service role.
 * Objects are stored under `avatars/<user id>/…` and the resulting public URL is
 * written to `profiles.avatar_url`. Existing avatars are removed first so a
 * user never accumulates orphaned files in the bucket.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Only JPEG, PNG or WebP images are accepted." },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 2 MB or smaller." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Clear whatever was there before, both in storage and on the profile.
  const { data: existing } = await admin.storage.from(BUCKET).list(user.id);
  const stale = (existing ?? []).map((object) => object.name);
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale.map((name) => `${user.id}/${name}`));
  }

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = urlData.publicUrl;

  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    // Do not leave an orphaned object behind if the profile write failed.
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit({
    actorId: user.id,
    action: "update_avatar",
    entity: "profiles",
    entityId: user.id,
    payload: { contentType: file.type, bytes: file.size },
    ip: clientIp(request),
  });

  return NextResponse.json({ avatar_url: avatarUrl });
}

/** Removes the caller's photo and falls back to their initials. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: existing } = await admin.storage.from(BUCKET).list(user.id);
  const stale = (existing ?? []).map((object) => `${user.id}/${object.name}`);
  if (stale.length > 0) {
    await admin.storage.from(BUCKET).remove(stale);
  }

  const { error } = await admin
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    actorId: user.id,
    action: "remove_avatar",
    entity: "profiles",
    entityId: user.id,
    ip: clientIp(request),
  });

  return NextResponse.json({ avatar_url: null });
}
