export interface ImageUploadState {
  imagePreview: string | null;
  imageWasRemoved: boolean;
}

/**
 * A freshly chosen/uploaded image always clears the pending removal flag.
 * Without this, a Remove Image -> re-upload sequence in the same session keeps
 * treating the new image as removed at review time.
 */
export function applyImageUpload(imagePreview: string): ImageUploadState {
  return {
    imagePreview,
    imageWasRemoved: false,
  };
}

/**
 * Removing an image keeps the version-removal intent until a new file is chosen.
 */
export function applyImageRemoval(): ImageUploadState {
  return {
    imagePreview: null,
    imageWasRemoved: true,
  };
}

export interface ReviewImageState {
  imageWasRemoved: boolean;
  imagePreview: string | null;
  currentDraftImageUrl?: string | null;
}

export interface ResolvedReviewImage {
  imageRemoved: boolean;
  durableImageUrl: string | null;
}

/**
 * Resolves the image that the new version is reviewed with.
 * The explicitly removed flag wins; otherwise an existing draft image whose
 * preview has disappeared also counts as removed.
 */
export function resolveReviewImage(state: ReviewImageState): ResolvedReviewImage {
  const imageRemoved = Boolean(
    state.imageWasRemoved || (state.currentDraftImageUrl && !state.imagePreview)
  );

  return {
    imageRemoved,
    durableImageUrl: imageRemoved ? null : state.imagePreview || null,
  };
}
