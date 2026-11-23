import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import mailboxRoutes from '../src/routes/mailboxes';
import jwt from 'jsonwebtoken';
import { authenticateOfficerOrAdmin } from '../src/middleware/auth';
import authRoutes from '../src/routes/auth';
import { LEGAL_OFFICERS } from '../src/lib/legal-officers';

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mailbox-pagination-'));
  const url = `file:${path.join(dir, 'check.db')}`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', path.resolve(__dirname, '../../prisma/schema.prisma'), '--skip-generate'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
    for (let i = 0; i < 17; i++) {
      await prisma.customer.create({ data: { name: `Customer ${i}`, personalEmail: `person${i}@example.com`, mailboxAddress: `mail${i}@example.com`, passwordEnc: 'unused', status: i === 16 ? 'inactive' : 'active', createdAt: new Date('2026-01-01') } });
    }
    const app = express();
    app.use(express.json());
    app.use('/admin/mailboxes', authenticateOfficerOrAdmin, mailboxRoutes(prisma));
    app.use('/mailboxes', mailboxRoutes(prisma));
    const first = await request(app).get('/mailboxes?limit=15&page=1').expect(200);
    const second = await request(app).get('/mailboxes?limit=15&page=2').expect(200);
    assert.equal(first.body.data.length, 15);
    assert.equal(second.body.data.length, 2);
    assert.equal(new Set([...first.body.data, ...second.body.data].map(m => m.id)).size, 17);
    assert.equal(second.body.pagination.totalPages, 2);
    assert.equal(second.body.activeTotal, 16);
    assert.equal(second.body.inactiveTotal, 1);
    const found = await request(app).get('/mailboxes?limit=1&search=PERSON16').expect(200);
    assert.equal(found.body.pagination.total, 1);
    assert.equal(found.body.data[0].personalEmail, 'person16@example.com');
    assert.equal(found.body.activeTotal, 16);
    const bounded = await request(app).get('/mailboxes?limit=-1').expect(200);
    assert.equal(bounded.body.data.length, 1);
    const actor = await prisma.adminUser.create({ data: { name: 'Officer', email: 'officer@example.com', passwordHash: 'unused', role: 'officer' } });
    const token = jwt.sign({ id: actor.id, type: 'admin', role: 'officer' }, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    const id = first.body.data[0].id;
    const updateUrl = `/admin/mailboxes/${id}/category`;
    await request(app).patch(updateUrl).send({ serviceCategory: 'Pendaftaran Merek' }).expect(401);
    const customerToken = jwt.sign({ id, type: 'customer', role: 'customer' }, process.env.JWT_SECRET || 'dev-secret-change-in-production');
    await request(app).patch(updateUrl).set('Authorization', `Bearer ${customerToken}`).send({ serviceCategory: 'Pendaftaran Merek' }).expect(403);
    await request(app).patch(updateUrl).set('Authorization', `Bearer ${token}`).send({ serviceCategory: 'Pendaftaran Merek' }).expect(200);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).serviceCategory, 'Pendaftaran Merek');
    assert.equal((await prisma.auditLog.findFirstOrThrow({ where: { targetId: id, action: 'mailbox.category' } })).actorId, actor.id);
    const categoryOnly = await request(app).get('/mailboxes').query({ serviceCategory: 'Pendaftaran Merek', limit: 1 }).expect(200);
    assert.equal(categoryOnly.body.pagination.total, 1);
    assert.equal(categoryOnly.body.data[0].id, id);
    assert.equal(categoryOnly.body.activeTotal, 16);
    assert.equal(categoryOnly.body.inactiveTotal, 1);
    const selected = first.body.data[0];
    const combined = await request(app).get('/mailboxes').query({ serviceCategory: 'Pendaftaran Merek', status: selected.status, search: selected.personalEmail.toUpperCase() }).expect(200);
    assert.equal(combined.body.pagination.total, 1);
    assert.equal(combined.body.data[0].id, id);
    const noMatch = await request(app).get('/mailboxes').query({ serviceCategory: 'Pendaftaran Merek', status: selected.status === 'active' ? 'inactive' : 'active' }).expect(200);
    assert.equal(noMatch.body.pagination.total, 0);
    assert.equal(noMatch.body.data.length, 0);
    const otherCategory = await request(app).get('/mailboxes').query({ serviceCategory: 'Pendirian PT' }).expect(200);
    assert.equal(otherCategory.body.pagination.total, 16);
    assert.ok(otherCategory.body.data.every(m => m.id !== id));
    await request(app).get('/mailboxes').query({ serviceCategory: 'Invalid' }).expect(400);
    console.log('Combined category, status and search filters passed.');
    await request(app).patch(updateUrl).set('Authorization', `Bearer ${token}`).send({ serviceCategory: 'Invalid' }).expect(400);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).serviceCategory, 'Pendaftaran Merek');
    await request(app).patch('/admin/mailboxes/missing/category').set('Authorization', `Bearer ${token}`).send({ serviceCategory: 'Pendirian PT' }).expect(404);
    await request(app).patch(updateUrl).set('Authorization', `Bearer ${token}`).send({ serviceCategory: 'Pendirian PT' }).expect(200);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).serviceCategory, 'Pendirian PT');
    const loUrl = `/admin/mailboxes/${id}/acquisition-lo`;
    assert.equal(first.body.data[0].acquisitionLo, null);
    assert.deepEqual(first.body.legalOfficers, LEGAL_OFFICERS);
    await request(app).patch(loUrl).send({ acquisitionLo: LEGAL_OFFICERS[0] }).expect(401);
    await request(app).patch(loUrl).set('Authorization', `Bearer ${customerToken}`).send({ acquisitionLo: LEGAL_OFFICERS[0] }).expect(403);
    for (const name of LEGAL_OFFICERS) {
      await request(app).patch(loUrl).set('Authorization', `Bearer ${token}`).send({ acquisitionLo: name }).expect(200);
      assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).acquisitionLo, name);
    }
    await request(app).patch(loUrl).set('Authorization', `Bearer ${token}`).send({ acquisitionLo: 'Unknown LO' }).expect(400);
    await request(app).patch(loUrl).set('Authorization', `Bearer ${token}`).send({}).expect(400);
    const loResults = await request(app).get('/mailboxes').query({ acquisitionLo: LEGAL_OFFICERS[7], serviceCategory: 'Pendirian PT', status: selected.status, search: selected.personalEmail }).expect(200);
    assert.equal(loResults.body.pagination.total, 1);
    assert.equal(loResults.body.data[0].id, id);
    const unassigned = await request(app).get('/mailboxes?acquisitionLo=unassigned').expect(200);
    assert.equal(unassigned.body.pagination.total, 16);
    assert.ok(unassigned.body.data.every(m => m.acquisitionLo === null));
    assert.equal((await prisma.auditLog.findFirstOrThrow({ where: { targetId: id, action: 'mailbox.acquisition-lo' } })).actorId, actor.id);
    await request(app).get('/mailboxes?acquisitionLo=Unknown').expect(400);
    await request(app).patch(loUrl).set('Authorization', `Bearer ${token}`).send({ acquisitionLo: null }).expect(200);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id } })).acquisitionLo, null);

    // Offline registration: never provision a real mailbox or send email from this check.
    process.env.NODE_ENV = 'test';
    process.env.HOSTINGER_API_TOKEN = '';
    process.env.HOSTINGER_MAIL_API_KEY = '';
    app.use('/auth', authRoutes(prisma));
    const registration = { name: 'LO acquisition check', personalEmail: 'registration@example.com', localPart: 'lo-check', domain: 'clienteasylegal.com', acquisitionLo: LEGAL_OFFICERS[3] };
    await request(app).post('/auth/register').set('Authorization', `Bearer ${token}`).send({ ...registration, acquisitionLo: 'Unknown' }).expect(400);
    const registered = await request(app).post('/auth/register').set('Authorization', `Bearer ${token}`).send(registration).expect(201);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: registered.body.customerId } })).acquisitionLo, LEGAL_OFFICERS[3]);
    const unspecified = await request(app).post('/auth/register').set('Authorization', `Bearer ${token}`).send({ ...registration, personalEmail: 'unspecified@example.com', localPart: 'lo-unspecified', acquisitionLo: null }).expect(201);
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: unspecified.body.customerId } })).acquisitionLo, null);
    console.log('LO creation, editing, unassigned defaults, combined filtering and authorization passed.');
    console.log('Category editing, audit trail, validation and role restrictions passed.');
    console.log('Mailbox pagination, cross-page search, stable ordering and global totals passed.');
  } finally {
    await prisma.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
