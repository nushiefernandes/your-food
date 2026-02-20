import { useCallback, useEffect, useRef, useState } from 'react';

import { resizeForAnalysis } from '../lib/imageUtils';
import { uploadPhoto, deletePhoto } from '../lib/storage';
import { analyzeDishPhoto, filterByConfidence } from '../lib/analysis';

const AI_FIELDS = new Set(['dish_name', 'cuisine_type']);

const IDLE_STATE = {
  status: 'idle',
  suggestions: null,
  aiFields: new Set(),
  uploadResult: null,
  error: null,
};

export function usePhotoAnalysis() {
  const [analysis, setAnalysis] = useState(IDLE_STATE);

  const latestUploadPathRef = useRef(null);
  const latestStatusRef = useRef('idle');
  const abortRef = useRef(0);

  useEffect(() => {
    latestStatusRef.current = analysis.status;
    latestUploadPathRef.current = analysis.uploadResult?.path || null;
  }, [analysis.status, analysis.uploadResult]);

  useEffect(() => {
    return () => {
      const path = latestUploadPathRef.current;
      const status = latestStatusRef.current;
      if (path && status !== 'done') {
        deletePhoto(path);
      }
    };
  }, []);

  const analyzePhoto = useCallback(async (file) => {
    const requestId = abortRef.current + 1;
    abortRef.current = requestId;

    // Clean up previous upload if starting a new analysis (prevents orphan accumulation)
    const previousPath = latestUploadPathRef.current;
    if (previousPath) {
      deletePhoto(previousPath);
    }

    setAnalysis({
      status: 'uploading',
      suggestions: null,
      aiFields: new Set(),
      uploadResult: null,
      error: null,
    });

    try {
      const resizedFile = await resizeForAnalysis(file);
      if (abortRef.current !== requestId) return;

      const uploadResult = await uploadPhoto(resizedFile);
      if (abortRef.current !== requestId) return;

      if (uploadResult?.error || !uploadResult?.path) {
        setAnalysis((prev) => {
          if (abortRef.current !== requestId) return prev;
          return {
            status: 'error',
            suggestions: null,
            aiFields: new Set(),
            uploadResult: null,
            error: 'upload_failed',
          };
        });
        return;
      }

      const storedUploadResult = { url: uploadResult.url, path: uploadResult.path };

      setAnalysis((prev) => {
        if (abortRef.current !== requestId) return prev;
        return {
          status: 'analyzing',
          suggestions: null,
          aiFields: new Set(),
          uploadResult: storedUploadResult,
          error: null,
        };
      });

      const result = await analyzeDishPhoto(uploadResult.path);
      if (abortRef.current !== requestId) return;

      if (result?.error) {
        setAnalysis((prev) => {
          if (abortRef.current !== requestId) return prev;
          return {
            status: 'error',
            suggestions: null,
            aiFields: new Set(),
            uploadResult: storedUploadResult,
            error: result.error,
          };
        });
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

      const aiFields = new Set(filtered ? Object.keys(filtered) : []);

      setAnalysis((prev) => {
        if (abortRef.current !== requestId) return prev;
        return {
          status: 'done',
          suggestions: filtered,
          aiFields,
          uploadResult: storedUploadResult,
          error: null,
        };
      });
    } catch (err) {
      if (abortRef.current !== requestId) return;
      const errorCode = err?.message === 'heic_unsupported' ? 'heic_unsupported' : 'resize_failed';
      setAnalysis((prev) => {
        if (abortRef.current !== requestId) return prev;
        return {
          ...prev,
          status: 'error',
          error: errorCode,
        };
      });
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    const path = latestUploadPathRef.current;
    if (path) {
      deletePhoto(path);
    }

    abortRef.current += 1;
    setAnalysis(IDLE_STATE);
  }, []);

  return { analysis, analyzePhoto, clearAnalysis };
}
