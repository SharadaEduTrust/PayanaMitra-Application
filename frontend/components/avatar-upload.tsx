"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export default function AvatarUpload({
  avatarUrl,
  firstName,
  lastName,
}: {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(avatarUrl);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(init: RequestInit, ok: string) {
    setStatus("");
    setError("");
    setLoading(true);

    const response = await fetch("/api/profile/avatar", init);
    const data = await response.json().catch(() => null);

    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not update your photo.");
      return;
    }

    setCurrent(data?.avatar_url ?? null);
    setStatus(ok);
    // The sidebar avatar and the page header are server-rendered.
    router.refresh();
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires a change.
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setError("Only JPEG, PNG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Images must be 2 MB or smaller.");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    await send({ method: "POST", body }, "Photo updated.");
  }

  async function remove() {
    await send({ method: "DELETE" }, "Photo removed.");
  }

  return (
    <div className="avatar-upload">
      <div className="avatar-preview">
        {current ? (
          // Supabase serves the bucket over plain img; next/image would add a
          // proxy hop for no benefit here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" />
        ) : (
          <span className="avatar-initials">
            {firstName.charAt(0)}
            {lastName.charAt(0)}
          </span>
        )}
      </div>

      <div className="avatar-actions">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={upload}
          className="visually-hidden"
          aria-label="Choose a profile photo"
        />
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => input.current?.click()}
          disabled={loading}
        >
          {loading ? "Uploading…" : current ? "Change photo" : "Upload photo"}
        </button>
        {current && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={remove}
            disabled={loading}
          >
            Remove
          </button>
        )}
        <p className="panel-note">
          JPEG, PNG or WebP, up to 2 MB. Your initials are shown until you add one.
        </p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}
    </div>
  );
}
