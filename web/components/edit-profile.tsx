"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/collection-art";
import { BackLink } from "@/components/back-button";
import { PlayerAvatar } from "@/components/player-profile";
import { useProfilePhoto } from "@/lib/use-profile-photo";

type Draft = { name: string; username: string; bio: string };

/**
 * The full player editor. The profile header keeps a quick photo shortcut, but
 * everything that changes identity lives here on its own route.
 */
export function EditProfile({
  user,
  loading,
  onUser,
}: {
  user: User | null;
  loading: boolean;
  onUser: (user: User) => void;
}) {
  const router = useRouter();
  const photo = useProfilePhoto(user, onUser);
  const photoInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stored: Draft = {
    name: user?.user_metadata.name ?? "",
    username: user?.user_metadata.username ?? "",
    bio: user?.user_metadata.bio ?? "",
  };
  const values = draft ?? stored;
  const set = (key: keyof Draft, value: string) => setDraft({ ...values, [key]: value });

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    const name = values.name.trim();
    const username = values.username.trim().toLowerCase();
    const bio = values.bio.trim();
    if (name.length < 2 || name.length > 50) {
      setError("Enter a player name between 2 and 50 characters.");
      return;
    }
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      setError("Use 3–24 lowercase letters, numbers, dots or underscores for your username.");
      return;
    }
    if (bio.length > 180) {
      setError("Keep your bio within 180 characters.");
      return;
    }
    setSaving(true);
    try {
      const { data, error: saveError } = await supabase().auth.updateUser({
        data: { name, username, bio },
      });
      if (saveError || !data.user) throw Error("Your profile couldn’t be saved. Please try again.");
      onUser(data.user);
      router.push("/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-head">
        <BackLink href="/profile" ariaLabel="Back to your profile" />
        <p className="eyebrow">YOUR PLAYER FILE</p>
        <h1>
          Edit profile<span>.</span>
        </h1>
        <p>Your name, your handle and how you show up on every board.</p>
      </div>

      {loading ? (
        <div className="edit-profile-skeleton" role="status">
          <span />
          <span />
          <p>Loading your player file…</p>
        </div>
      ) : !user ? (
        <div className="player-profile-signin">
          <h2>Sign in to edit your profile.</h2>
          <p>Your player file belongs to your account. Sign in to change it.</p>
          <Link href="/signin?next=/profile/edit" className="primary">
            Sign in <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        <form className="edit-profile-form" onSubmit={save}>
          <section className="edit-profile-photo">
            <PlayerAvatar user={user} />
            <div>
              <h2>Profile photo</h2>
              <p>Cropped to a square. JPG, PNG or WebP, up to 5 MB.</p>
              <input
                ref={photoInput}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose a profile photo"
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void photo.upload(file);
                }}
              />
              <button
                type="button"
                className="secondary"
                disabled={photo.uploading || saving}
                onClick={() => photoInput.current?.click()}
              >
                {photo.uploading ? "Uploading…" : "Change photo"}
              </button>
            </div>
          </section>

          <label>
            Player name
            <input
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
              value={values.name}
              onChange={e => set("name", e.target.value)}
            />
          </label>
          <label>
            Username
            <input
              required
              pattern="[a-z0-9_.]{3,24}"
              minLength={3}
              maxLength={24}
              autoComplete="username"
              value={values.username}
              onChange={e => set("username", e.target.value.toLowerCase())}
            />
            <small>3–24 lowercase letters, numbers, dots or underscores.</small>
          </label>
          <label>
            About you
            <textarea maxLength={180} rows={4} value={values.bio} onChange={e => set("bio", e.target.value)} />
            <small>{values.bio.length}/180 characters</small>
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="edit-profile-actions">
            <button className="primary" disabled={saving || photo.uploading}>
              {saving ? "Saving…" : "Save changes"} <Icon name="arrow" />
            </button>
            <Link className="secondary" href="/profile">
              Cancel
            </Link>
          </div>
        </form>
      )}

      <div aria-live="polite">{photo.notice && <p className="player-photo-message">{photo.notice}</p>}</div>
      {photo.error && (
        <p className="error" role="alert">
          {photo.error}
        </p>
      )}
    </div>
  );
}
