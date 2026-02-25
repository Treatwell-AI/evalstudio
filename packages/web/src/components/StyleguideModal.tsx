import { useRef } from "react";
import {
  useStyleguideImages,
  useUploadStyleguideImage,
  useDeleteStyleguideImage,
} from "../hooks/useStyleReferences";
import { projectImageUrl } from "../lib/api";
import { useProjectId } from "../hooks/useProjectId";

interface StyleguideModalProps {
  onGenerate: () => void;
  onClose: () => void;
  isGenerating: boolean;
}

export function StyleguideModal({ onGenerate, onClose, isGenerating }: StyleguideModalProps) {
  const projectId = useProjectId();
  const { data: imageIds = [], isLoading } = useStyleguideImages();
  const uploadMutation = useUploadStyleguideImage();
  const deleteMutation = useDeleteStyleguideImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await uploadMutation.mutateAsync({ imageBase64: base64, filename: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDelete = async (imageId: string) => {
    await deleteMutation.mutateAsync(imageId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal styleguide-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Generate Persona Image</h3>

        <div className="styleguide-section">
          <div className="styleguide-header">
            <div>
              <label>Style References</label>
              <p className="form-hint">
                Upload reference images to define the artistic style. Without references, a default cartoon style is used.
              </p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>

          {isLoading ? (
            <div className="loading">Loading...</div>
          ) : imageIds.length === 0 ? (
            <div className="styleguide-empty">
              No style references yet.
            </div>
          ) : (
            <div className="styleguide-grid">
              {imageIds.map((imageId) => (
                <div key={imageId} className="styleguide-item">
                  <img src={projectImageUrl(projectId, imageId)} alt="Style reference" />
                  <button
                    className="styleguide-delete"
                    onClick={() => handleDelete(imageId)}
                    disabled={deleteMutation.isPending}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
