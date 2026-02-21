import { useRef } from "react";
import {
  useStyleReferences,
  useUploadStyleReference,
  useDeleteStyleReference,
} from "../hooks/useStyleReferences";
import { projectImageUrl } from "../lib/api";
import { useProjectId } from "../hooks/useProjectId";

export function StyleReferenceManager() {
  const projectId = useProjectId();
  const { data: imageIds = [], isLoading } = useStyleReferences();
  const uploadRef = useUploadStyleReference();
  const deleteRef = useDeleteStyleReference();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await uploadRef.mutateAsync({ imageBase64: base64, filename: file.name });
    };
    reader.readAsDataURL(file);

    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDelete = async (imageId: string) => {
    if (confirm("Remove this style reference?")) {
      await deleteRef.mutateAsync(imageId);
    }
  };

  return (
    <div className="style-reference-section">
      <div className="style-reference-header">
        <div>
          <h3>Style References</h3>
          <p className="form-hint">
            Upload reference images to define the artistic style for generated persona portraits. All generated images will match this style.
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadRef.isPending}
        >
          {uploadRef.isPending ? "Uploading..." : "+ Add Reference"}
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
        <div className="loading">Loading style references...</div>
      ) : imageIds.length === 0 ? (
        <div className="style-reference-empty">
          No style references uploaded. Generated images will use a default cartoon style.
        </div>
      ) : (
        <div className="style-reference-grid">
          {imageIds.map((imageId) => (
            <div key={imageId} className="style-reference-item">
              <img src={projectImageUrl(projectId, imageId)} alt="Style reference" />
              <button
                className="style-reference-delete"
                onClick={() => handleDelete(imageId)}
                disabled={deleteRef.isPending}
                title="Remove reference"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
