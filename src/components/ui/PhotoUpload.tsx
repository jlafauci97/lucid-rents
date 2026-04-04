"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PhotoUploadProps {
  buildingId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const supabase = createClient();

export function PhotoUpload({
  buildingId,
  photos,
  onChange,
  maxPhotos = 5,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = photos.length < maxPhotos;

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      const remaining = maxPhotos - photos.length;
      if (fileArray.length > remaining) {
        setError(`You can only upload ${remaining} more photo${remaining === 1 ? "" : "s"}.`);
        return;
      }

      for (const file of fileArray) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError("Only JPG, PNG, and WebP images are accepted.");
          return;
        }
        if (file.size > MAX_SIZE) {
          setError("Each photo must be under 10MB.");
          return;
        }
      }

      setUploading(true);
      const newPaths: string[] = [];

      try {
        for (const file of fileArray) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${buildingId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("review-photos")
            .upload(path, file);

          if (uploadError) {
            setError(`Upload failed: ${uploadError.message}`);
            break;
          }

          newPaths.push(path);
        }

        if (newPaths.length > 0) {
          onChange([...photos, ...newPaths]);
        }
      } catch {
        setError("An unexpected error occurred during upload.");
      } finally {
        setUploading(false);
      }
    },
    [buildingId, maxPhotos, onChange, photos]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }

  function removePhoto(index: number) {
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated);
  }

  function getPublicUrl(path: string) {
    const { data } = supabase.storage
      .from("review-photos")
      .getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1A1F36]">
        Photos
        <span className="ml-1.5 text-[#A3ACBE] font-normal">
          ({photos.length}/{maxPhotos})
        </span>
      </label>

      {/* Thumbnail grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((path, i) => (
            <div
              key={path}
              className="relative group aspect-square rounded-lg overflow-hidden border border-[#E2E8F0]"
            >
              <img
                src={getPublicUrl(path)}
                alt={`Upload ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
            dragOver
              ? "border-[#6366F1] bg-[#6366F1]/5"
              : "border-[#E2E8F0] hover:border-[#94a3b8]"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-[#6366F1] animate-spin" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-[#A3ACBE]" />
              <span className="text-sm text-[#5E6687]">
                Drag & drop or click to upload
              </span>
              <span className="text-xs text-[#A3ACBE]">
                JPG, PNG, WebP &middot; Max 10MB
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && !canUpload && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] p-6 text-[#A3ACBE]">
          <ImageIcon className="h-5 w-5" />
          <span className="text-sm">No photos uploaded</span>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-[#ef4444]">{error}</p>}
    </div>
  );
}
