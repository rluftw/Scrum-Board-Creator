import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const dbPath = path.join(__dirname, 'scrum.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('backlog','in_progress','blocked','review','done')),
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
  due_date TEXT,
  project_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deleted_tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_date TEXT,
  project_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NOT NULL
);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('tasks', 'due_date', 'TEXT');
ensureColumn('deleted_tasks', 'due_date', 'TEXT');
ensureColumn('tasks', 'project_id', 'INTEGER');
ensureColumn('deleted_tasks', 'project_id', 'INTEGER');
ensureColumn('projects', 'description', "TEXT NOT NULL DEFAULT ''");

const nowIso = () => new Date().toISOString();

const allowedStatus = new Set(['backlog', 'in_progress', 'blocked', 'review', 'done']);
const allowedPriority = new Set(['low', 'medium', 'high']);

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeProjectId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  return project ? id : null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/projects', (_req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY id ASC').all();
  res.json({ ok: true, data: rows });
});

app.post('/api/projects', (req, res) => {
  const name = (req.body?.name ?? '').toString().trim();
  const description = (req.body?.description ?? '').toString().trim();
  if (!name) return res.status(400).json({ ok: false, error: 'project name is required' });

  const existing = db.prepare('SELECT * FROM projects WHERE lower(name) = lower(?)').get(name);
  if (existing) return res.json({ ok: true, data: existing });

  const now = nowIso();
  const result = db.prepare('INSERT INTO projects (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)').run(name, description, now, now);
  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, data: created });
});

app.put('/api/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid project id' });
  }

  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'project not found' });

  const description = (req.body?.description ?? existing.description ?? '').toString().trim();
  const now = nowIso();

  db.prepare('UPDATE projects SET description = ?, updated_at = ? WHERE id = ?').run(description, now, id);
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json({ ok: true, data: updated });
});

app.delete('/api/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid project id' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ ok: false, error: 'project not found' });

  const deleteTasks = db.prepare('DELETE FROM tasks WHERE project_id = ?');
  const deleteDeletedTasks = db.prepare('DELETE FROM deleted_tasks WHERE project_id = ?');
  const deleteProject = db.prepare('DELETE FROM projects WHERE id = ?');

  const tx = db.transaction(() => {
    const deletedActive = deleteTasks.run(id);
    const deletedArchived = deleteDeletedTasks.run(id);
    deleteProject.run(id);
    return { deletedActive: deletedActive.changes, deletedArchived: deletedArchived.changes };
  });

  const result = tx();
  res.json({ ok: true, data: { deletedProjectId: id, ...result } });
});

app.get('/api/tasks', (_req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
  res.json({ ok: true, data: rows });
});

app.get('/api/tasks/deleted', (_req, res) => {
  const rows = db.prepare('SELECT * FROM deleted_tasks ORDER BY deleted_at DESC').all();
  res.json({ ok: true, data: rows });
});

app.delete('/api/tasks/deleted/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid task id' });
  }

  const existing = db.prepare('SELECT id FROM deleted_tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'deleted task not found' });

  db.prepare('DELETE FROM deleted_tasks WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/tasks/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid task id' });
  }

  const deletedTask = db.prepare('SELECT * FROM deleted_tasks WHERE id = ?').get(id);
  if (!deletedTask) return res.status(404).json({ ok: false, error: 'deleted task not found' });

  const projectId = normalizeProjectId(deletedTask.project_id);
  if (!projectId) {
    return res.status(400).json({ ok: false, error: 'cannot restore task because its project no longer exists' });
  }

  const insertActive = db.prepare(
    'INSERT OR REPLACE INTO tasks (id, title, description, status, priority, due_date, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const removeDeleted = db.prepare('DELETE FROM deleted_tasks WHERE id = ?');

  const tx = db.transaction(() => {
    insertActive.run(
      deletedTask.id,
      deletedTask.title,
      deletedTask.description,
      deletedTask.status,
      deletedTask.priority,
      normalizeDueDate(deletedTask.due_date),
      projectId,
      deletedTask.created_at,
      nowIso()
    );
    removeDeleted.run(id);
  });

  tx();
  const restored = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ ok: true, data: restored });
});

app.post('/api/tasks', (req, res) => {
  const { title, description = '', status = 'backlog', priority = 'medium', due_date = null, project_id = null } = req.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanDescription = typeof description === 'string' ? description.trim() : '';

  if (!cleanTitle) {
    return res.status(400).json({ ok: false, error: 'title is required' });
  }
  if (!allowedStatus.has(status)) {
    return res.status(400).json({ ok: false, error: 'invalid status' });
  }
  if (!allowedPriority.has(priority)) {
    return res.status(400).json({ ok: false, error: 'invalid priority' });
  }

  const normalizedProjectId = normalizeProjectId(project_id);
  if (!normalizedProjectId) {
    return res.status(400).json({ ok: false, error: 'invalid project' });
  }

  const now = nowIso();
  const result = db
    .prepare(
      'INSERT INTO tasks (title, description, status, priority, due_date, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(cleanTitle, cleanDescription, status, priority, normalizeDueDate(due_date), normalizedProjectId, now, now);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ok: true, data: task });
});

app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid task id' });
  }

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'task not found' });

  const body = req.body ?? {};
  const hasDueDate = Object.prototype.hasOwnProperty.call(body, 'due_date');

  const title = (body.title ?? existing.title)?.toString().trim();
  const description = (body.description ?? existing.description)?.toString().trim();
  const status = body.status ?? existing.status;
  const priority = body.priority ?? existing.priority;
  const dueDate = normalizeDueDate(hasDueDate ? body.due_date : existing.due_date);
  const projectId = normalizeProjectId(body.project_id ?? existing.project_id);

  if (!title) {
    return res.status(400).json({ ok: false, error: 'title is required' });
  }
  if (!allowedStatus.has(status)) {
    return res.status(400).json({ ok: false, error: 'invalid status' });
  }
  if (!allowedPriority.has(priority)) {
    return res.status(400).json({ ok: false, error: 'invalid priority' });
  }
  if (!projectId) {
    return res.status(400).json({ ok: false, error: 'invalid project' });
  }

  const now = nowIso();
  db.prepare('UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, project_id = ?, updated_at = ? WHERE id = ?').run(
    title,
    description,
    status,
    priority,
    dueDate,
    projectId,
    now,
    id
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ ok: true, data: task });
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid task id' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ ok: false, error: 'task not found' });

  const deletedAt = nowIso();
  const insertDeleted = db.prepare(
    'INSERT OR REPLACE INTO deleted_tasks (id, title, description, status, priority, due_date, project_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const removeActive = db.prepare('DELETE FROM tasks WHERE id = ?');

  const tx = db.transaction(() => {
    insertDeleted.run(task.id, task.title, task.description, task.status, task.priority, task.due_date, task.project_id, task.created_at, task.updated_at, deletedAt);
    removeActive.run(id);
  });

  tx();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Scrum API running on http://localhost:${PORT}`);
});
