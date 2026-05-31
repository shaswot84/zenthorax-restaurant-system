import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { createAuthMiddleware } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

interface UploadDI {
  env: Env;
}

export async function uploadRoutes(app: FastifyInstance, di: UploadDI) {
  const auth = createAuthMiddleware(di.env);
  const supabase = createClient(di.env.SUPABASE_URL, di.env.SUPABASE_SERVICE_ROLE_KEY);

  app.post('/api/upload/menu-image', { preHandler: auth }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded.' } });
    }

    const buf = await data.toBuffer();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.mimetype)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE', message: 'Only JPG, PNG, and WebP are allowed.' } });
    }
    if (buf.length > 5 * 1024 * 1024) {
      return reply.status(400).send({ success: false, error: { code: 'TOO_LARGE', message: 'Max file size is 5MB.' } });
    }

    const imageId = randomUUID();
    const basePath = `${req.user!.id}/${imageId}`;

    // Generate variants with sharp
    const [card, detail, thumb] = await Promise.all([
      sharp(buf).resize(400, 300, { fit: 'cover' }).webp({ quality: 80 }).toBuffer(),
      sharp(buf).resize(800, 600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(buf).resize(100, 100, { fit: 'cover' }).webp({ quality: 70 }).toBuffer(),
    ]);

    // Upload to Supabase Storage
    const bucket = 'menu-images';
    const [r1, r2, r3] = await Promise.all([
      supabase.storage.from(bucket).upload(`${basePath}/card.webp`, card, { contentType: 'image/webp', upsert: true }),
      supabase.storage.from(bucket).upload(`${basePath}/detail.webp`, detail, { contentType: 'image/webp', upsert: true }),
      supabase.storage.from(bucket).upload(`${basePath}/thumb.webp`, thumb, { contentType: 'image/webp', upsert: true }),
    ]);

    if (r1.error || r2.error || r3.error) {
      return reply.status(500).send({ success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload image.' } });
    }

    const cardUrl = supabase.storage.from(bucket).getPublicUrl(`${basePath}/card.webp`).data.publicUrl;

    return reply.send({ success: true, data: { imageUrl: cardUrl } });
  });
}
