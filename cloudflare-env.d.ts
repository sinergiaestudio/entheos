declare namespace Cloudflare {
  interface Env {
    APP_OWNER_EMAIL?: string;
    INTERVALS_CLIENT_ID?: string;
    INTERVALS_CLIENT_SECRET?: string;
    ENTHEOS_INTEGRATION_KEY?: string;
    DB: D1Database;
    BUCKET: R2Bucket;
    ASSETS: Fetcher;
    IMAGES: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
        };
      };
    };
  }
}
