import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import type { StorageAdapter, UploadResult } from "./types";

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? "us-east-1";
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicUrl = process.env.S3_PUBLIC_URL;

    if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
      throw new Error(
        "S3 storage adapter is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL"
      );
    }

    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, "");
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: Boolean(endpoint),
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async upload(file: File, folder = "products"): Promise<UploadResult> {
    const ext = extensionFromMime(file.type);
    const key = `${folder}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: "public-read",
      })
    );

    return {
      url: `${this.publicUrl}/${key}`,
      key,
      contentType: file.type,
      size: file.size,
    };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}
