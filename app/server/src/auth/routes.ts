import type { Request, Response, Router } from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';

type UserRole = 'admin' | 'user';

interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  styleFocus: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

const USERS_FILE = path.resolve(process.cwd(), 'data', 'users.json');

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  styleFocus: z.string().optional(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUser(record: StoredUserRecord) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    styleFocus: record.styleFocus,
    role: record.role,
    createdAt: record.createdAt,
  };
}

async function ensureUsersFile(): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, '[]', 'utf8');
  }
}

async function readUsers(): Promise<StoredUserRecord[]> {
  await ensureUsersFile();
  const raw = await fs.readFile(USERS_FILE, 'utf8');
  try {
    return JSON.parse(raw) as StoredUserRecord[];
  } catch {
    return [];
  }
}

async function writeUsers(users: StoredUserRecord[]): Promise<void> {
  await ensureUsersFile();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function signToken(user: StoredUserRecord): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, config.authJwtSecret, { expiresIn: '7d' });
}

function decodeAuthToken(req: Request): AuthTokenPayload | null {
  const header = String(req.headers.authorization ?? '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    return jwt.verify(token, config.authJwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

async function ensureBootstrapAdmin(): Promise<void> {
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) {
    return;
  }

  const users = await readUsers();
  const adminEmail = normalizeEmail(config.bootstrapAdminEmail);
  const existing = users.find((user) => user.email === adminEmail);

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await writeUsers(users);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(config.bootstrapAdminPassword, 12);
  users.push({
    id: randomUUID(),
    name: config.bootstrapAdminName || 'Platform Admin',
    email: adminEmail,
    styleFocus: 'executive polish',
    role: 'admin',
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  await writeUsers(users);
}

export function registerAuthRoutes(router: Router): void {
  void ensureBootstrapAdmin();

  router.post('/api/auth/signup', async (req: Request, res: Response) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: 'Invalid signup payload.' });
      return;
    }

    const users = await readUsers();
    const email = normalizeEmail(parsed.data.email);
    const exists = users.some((user) => user.email === email);
    if (exists) {
      res.status(409).json({ ok: false, message: 'Email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const role: UserRole = users.length === 0 ? 'admin' : 'user';

    const record: StoredUserRecord = {
      id: randomUUID(),
      name: parsed.data.name.trim(),
      email,
      styleFocus: parsed.data.styleFocus?.trim() || 'polished minimal looks',
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(record);
    await writeUsers(users);

    res.status(201).json({ ok: true, user: sanitizeUser(record), token: signToken(record) });
  });

  router.post('/api/auth/signin', async (req: Request, res: Response) => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: 'Invalid signin payload.' });
      return;
    }

    const users = await readUsers();
    const email = normalizeEmail(parsed.data.email);
    const user = users.find((entry) => entry.email === email);

    if (!user) {
      res.status(401).json({ ok: false, message: 'Invalid credentials.' });
      return;
    }

    const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ ok: false, message: 'Invalid credentials.' });
      return;
    }

    res.json({ ok: true, user: sanitizeUser(user), token: signToken(user) });
  });

  router.get('/api/auth/me', async (req: Request, res: Response) => {
    const payload = decodeAuthToken(req);
    if (!payload) {
      res.status(401).json({ ok: false, message: 'Unauthorized.' });
      return;
    }

    const users = await readUsers();
    const user = users.find((entry) => entry.id === payload.sub);
    if (!user) {
      res.status(401).json({ ok: false, message: 'Unauthorized.' });
      return;
    }

    res.json({ ok: true, user: sanitizeUser(user) });
  });

  router.get('/api/admin/users', async (req: Request, res: Response) => {
    const payload = decodeAuthToken(req);
    if (!payload || payload.role !== 'admin') {
      res.status(403).json({ ok: false, message: 'Admin access required.' });
      return;
    }

    const users = await readUsers();
    res.json({ ok: true, users: users.map(sanitizeUser) });
  });
}
