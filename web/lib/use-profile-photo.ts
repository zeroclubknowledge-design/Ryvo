"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  MAX_PROFILE_PHOTO_BYTES,
  ownedAvatarPath,
  PROFILE_PHOTO_BUCKET,
  validateProfilePhoto,
} from "@/lib/profile-media";

/**
 * Profile photo pipeline: validate, square-crop to 640px, upload, then point
 * the account metadata at the new file and delete the previous one.
 *
 * Shared by the profile header (quick change) and the full edit page so both
 * paths behave identically. The file input itself stays with each caller so no
 * ref crosses the hook boundary.
 */
export function useProfilePhoto(user: User | null, onUser: (user: User) => void) {
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (!user || uploading) return;
    setUploading(true);
    setError("");
    setNotice("");
    let newPath = "";
    let committed = false;
    try {
      validateProfilePhoto(file);
      const image = await createImageBitmap(file);
      try {
        if (image.width < 64 || image.height < 64 || image.width * image.height > 40000000)
          throw Error("Choose a photo between 64 pixels and 40 megapixels.");
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 640;
        const context = canvas.getContext("2d");
        if (!context) throw Error("This browser couldn’t prepare the photo. Please try another browser.");
        const side = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 640, 640);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            result => (result ? resolve(result) : reject(Error("Unable to prepare this photo."))),
            "image/jpeg",
            .88,
          ),
        );
        if (blob.size > MAX_PROFILE_PHOTO_BYTES) throw Error("The photo is too large. Choose a smaller picture.");
        const db = supabase();
        newPath = `${user.id}/avatar-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await db.storage
          .from(PROFILE_PHOTO_BUCKET)
          .upload(newPath, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (uploadError)
          throw Error("Your photo couldn’t be uploaded. Check your connection or contact Ryvo if photo storage is not yet enabled.");
        const { data, error: saveError } = await db.auth.updateUser({ data: { avatar_path: newPath } });
        if (saveError || !data.user)
          throw Error("Your photo was uploaded but couldn’t be saved to your profile. Please try again.");
        committed = true;
        onUser(data.user);
        setNotice("Profile photo updated.");
        const previous = user.user_metadata.avatar_path;
        if (ownedAvatarPath(user.id, previous))
          void db.storage.from(PROFILE_PHOTO_BUCKET).remove([previous]).catch(() => {});
      } finally {
        image.close();
      }
    } catch (e) {
      if (newPath && !committed)
        void supabase().storage.from(PROFILE_PHOTO_BUCKET).remove([newPath]).catch(() => {});
      setError(e instanceof Error ? e.message : "Unable to update your photo.");
    } finally {
      setUploading(false);
    }
  }

  return { uploading, notice, error, setError, upload };
}
