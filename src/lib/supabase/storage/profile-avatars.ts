import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { isAllowedListingImageMimeType } from "@/lib/storage/listing-images";
import {
  PROFILE_AVATARS_BUCKET,
  createProfileAvatarObjectPath,
  detectProfileAvatarMimeType,
  extractProfileAvatarPathFromUrl,
  isProfileAvatarPathForUser,
  validateProfileAvatarFile,
} from "@/lib/storage/profile-avatar";

export async function uploadProfileAvatar(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    file: File;
  }
) {
  const issues = validateProfileAvatarFile(input.file);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  const sniffedMimeType = await detectProfileAvatarMimeType(input.file);
  if (!sniffedMimeType) {
    throw new Error("Unsupported profile photo signature. Allowed: JPEG, PNG, WEBP.");
  }

  if (
    input.file.type &&
    isAllowedListingImageMimeType(input.file.type) &&
    input.file.type !== sniffedMimeType
  ) {
    throw new Error("Profile photo MIME type does not match file contents.");
  }

  const storagePath = createProfileAvatarObjectPath({
    userId: input.userId,
    mimeType: sniffedMimeType,
  });

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: sniffedMimeType,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error("Profile photo upload failed.");
  }

  const { data } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function removeProfileAvatarByPath(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    storagePath: string;
  }
) {
  if (
    !isProfileAvatarPathForUser({
      path: input.storagePath,
      userId: input.userId,
    })
  ) {
    return {
      removed: false,
    };
  }

  const { error, data } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .remove([input.storagePath]);

  if (error) {
    throw new Error("Profile photo removal failed.");
  }

  return {
    removed: Boolean(data?.some((entry) => entry.name === input.storagePath)),
  };
}

export async function removeProfileAvatarByUrl(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    avatarUrl: string | null | undefined;
  }
) {
  const storagePath = extractProfileAvatarPathFromUrl(input.avatarUrl);
  if (!storagePath) {
    return {
      removed: false,
      storagePath: null,
    };
  }

  const result = await removeProfileAvatarByPath(supabase, {
    userId: input.userId,
    storagePath,
  });

  return {
    removed: result.removed,
    storagePath,
  };
}
