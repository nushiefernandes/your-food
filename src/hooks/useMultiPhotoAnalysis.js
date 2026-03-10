// NOTE: Hook tests need jsdom + @testing-library/react (not installed).
// vite.config.js uses environment:'node'. Add jsdom to enable hook tests.
import { useCallback, useEffect, useRef, useState } from "react";
import { resizeForAnalysis } from "../lib/imageUtils";
import { uploadPhoto, deletePhoto } from "../lib/storage";
import { analyzeDishPhotos, filterByConfidence } from "../lib/analysis";

const AI_FIELDS = new Set(["dish_name", "cuisine_type", "entry_type"]);

const IDLE = {
  status: "idle",
  suggestions: null,
  aiFields: new Set(),
  uploadResults: [],
  error: null,
};

export function useMultiPhotoAnalysis() {
  const [analysis, setAnalysis] = useState(IDLE);
  const uploadPathsRef = useRef(new Set());
  const claimedRef = useRef(false);
  const sessionRef = useRef(0);

  // On unmount: delete any unclaimed uploads to prevent orphans in storage
  useEffect(() => {
    return () => {
      if (!claimedRef.current) {
        uploadPathsRef.current.forEach((path) => deletePhoto(path));
      }
    };
  }, []);

  const analyzePhotos = useCallback(async (files, exifDataArray = []) => {
    const session = ++sessionRef.current;
    claimedRef.current = false;

    // Clean up uploads from previous session
    uploadPathsRef.current.forEach((path) => deletePhoto(path));
    uploadPathsRef.current = new Set();

    setAnalysis({ ...IDLE, status: "uploading" });

    try {
      // Phase 1: Resize and upload all photos in parallel
      // Each file is resized using its own EXIF orientation
      const uploadResults = await Promise.all(
        files.map(async (file, i) => {
          const resized = await resizeForAnalysis(
            file,
            exifDataArray[i]?.orientation
          );
          return uploadPhoto(resized);
        })
      );
      if (sessionRef.current !== session) return;

      const succeeded = uploadResults.filter((r) => !r.error && r.path);

      if (succeeded.length === 0) {
        setAnalysis((prev) =>
          sessionRef.current === session
            ? { ...IDLE, status: "error", error: "upload_failed" }
            : prev
        );
        return;
      }

      succeeded.forEach((r) => uploadPathsRef.current.add(r.path));

      setAnalysis((prev) =>
        sessionRef.current === session
          ? { ...IDLE, status: "analyzing", uploadResults: succeeded }
          : prev
      );

      // Phase 2: Single batched Gemini call with all uploaded paths
      const result = await analyzeDishPhotos(succeeded.map((r) => r.path));
      if (sessionRef.current !== session) return;

      if (result?.error) {
        setAnalysis((prev) =>
          sessionRef.current === session
            ? {
                ...IDLE,
                status: "error",
                error: result.error,
                uploadResults: succeeded,
              }
            : prev
        );
        return;
      }

      const allFiltered = result?.suggestions
        ? filterByConfidence(result.suggestions)
        : null;

      const filtered = allFiltered
        ? Object.fromEntries(
            Object.entries(allFiltered).filter(([k]) => AI_FIELDS.has(k))
          )
        : null;

      setAnalysis({
        status: "done",
        suggestions: filtered,
        aiFields: new Set(filtered ? Object.keys(filtered) : []),
        uploadResults: succeeded,
        error: null,
      });
    } catch (err) {
      if (sessionRef.current !== session) return;
      const code =
        err?.message === "file_too_large" ? "file_too_large" : "resize_failed";
      setAnalysis((prev) =>
        sessionRef.current === session
          ? { ...prev, status: "error", error: code }
          : prev
      );
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    sessionRef.current++;
    claimedRef.current = false;
    uploadPathsRef.current.forEach((path) => deletePhoto(path));
    uploadPathsRef.current = new Set();
    setAnalysis(IDLE);
  }, []);

  // Call after saving an entry to prevent cleanup from deleting the uploaded photos
  const claimUploads = useCallback(() => {
    claimedRef.current = true;
  }, []);

  return { analysis, analyzePhotos, clearAnalysis, claimUploads };
}
