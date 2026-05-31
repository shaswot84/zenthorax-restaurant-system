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
      return reply.status(400).send({ success: false, error: { code: 'NO_FILE' } });
    }

    const buf = await data.toBuffer();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.mimetype)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_TYPE' } });
    }
    if (buf.length > 5 * 1024 * 1024) {
      return reply.status(400).send({ success: false, error: { code: 'TOO_LARGE' } });
    }

    const imageId = randomUUID();
    const path = `${req.user!.id}/${imageId}.webp`;

    // Single resize + WebP conversion (fast)
    const webp = await sharp(buf)
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, webp, { contentType: 'image/webp', upsert: true });

    if (error) {
      return reply.status(500).send({ success: false, error: { code: 'UPLOAD_FAILED', message: error.message } });
    }

    const publicUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
    return reply.send({ success: true, data: { imageUrl: publicUrl } });
  });
}
