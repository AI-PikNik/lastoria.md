export interface UploadResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
}

export interface StorageAdapter {
  upload(file: File, folder?: string): Promise<UploadResult>;
  remove(key: string): Promise<void>;
}
