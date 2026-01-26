"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onUploadSuccess: (url: string) => void;
  initialUrl?: string | null;
  onRemove: () => void;
  folder: string; // Folder name in Supabase Storage (e.g., 'cash_tickets')
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onUploadSuccess, initialUrl, onRemove, folder }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(initialUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  // Sync initialUrl changes
  React.useEffect(() => {
    setFileUrl(initialUrl || null);
  }, [initialUrl]);

  const uploadFile = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('Media') // Assuming 'Media' is your bucket name
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('Media')
        .getPublicUrl(filePath);

      setFileUrl(publicUrl);
      onUploadSuccess(publicUrl);
      showSuccess("Imagen subida exitosamente.");
    } catch (error: any) {
      showError('Error al subir imagen: ' + error.message);
      console.error("Supabase upload error:", error);
      setFileUrl(null);
      onUploadSuccess(''); // Clear URL on failure
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0]);
    }
  }, [folder, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleRemove = () => {
    // Note: We don't delete the file from storage here for simplicity and safety,
    // but we clear the URL from the form/state.
    setFileUrl(null);
    onRemove();
    showSuccess("Imagen eliminada del registro.");
  };

  if (fileUrl) {
    return (
      <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
        <div className="flex items-center gap-2 truncate">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="text-sm truncate">Archivo adjunto</span>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(fileUrl, '_blank')}
            className="h-7 text-xs"
          >
            Ver
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleRemove}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors",
        isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/50 hover:border-primary",
        isUploading && "opacity-60 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div className="flex items-center justify-center gap-2 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">Subiendo...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <Upload className="h-6 w-6 mb-1" />
          <p className="text-sm">Arrastra y suelta un ticket o haz clic para seleccionar.</p>
          <p className="text-xs">(Max 1 archivo: JPG, PNG, PDF)</p>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;