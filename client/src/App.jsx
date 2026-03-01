import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  page: 'scrum-board.page',
  selectedProjectId: 'scrum-board.selectedProjectId'
};

const columns = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' }
];

const priorities = ['low', 'medium', 'high'];

function asDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}

function weekLabel(start) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endFmt = end.toLocaleDateString(undefined, { month: sameMonth ? undefined : 'short', day: 'numeric' });
  return `${startFmt} - ${endFmt}`;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState('');
  const [dragOverWeekKey, setDragOverWeekKey] = useState('');
  const [dragOverDate, setDragOverDate] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [projectPendingDelete, setProjectPendingDelete] = useState(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem(STORAGE_KEYS.selectedProjectId) || '');
  const [page, setPage] = useState(() => localStorage.getItem(STORAGE_KEYS.page) || 'projects');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [view, setView] = useState('board');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [form, setForm] = useState({ title: '', description: '', status: 'backlog', priority: 'medium', due_date: '' });
  const [error, setError] = useState('');

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');
      setTasks(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    loadTasks();
    loadDeletedCount();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.page, page);
  }, [page]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem(STORAGE_KEYS.selectedProjectId, String(selectedProjectId));
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(selectedProjectId)) || null,
    [projects, selectedProjectId]
  );


  useEffect(() => {
    const baseTitle = 'Scrum Board';
    if (page === 'board' && selectedProject?.name) {
      document.title = `${selectedProject.name} · ${baseTitle}`;
      return;
    }
    document.title = baseTitle;
  }, [page, selectedProject]);

  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter((task) => String(task.project_id) === String(selectedProjectId));
  }, [tasks, selectedProjectId]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c.key, []]));
    for (const task of filteredTasks) {
      if (map[task.status]) map[task.status].push(task);
    }
    return map;
  }, [filteredTasks]);

  const selectedTask = useMemo(() => filteredTasks.find((t) => t.id === selectedTaskId) || null, [filteredTasks, selectedTaskId]);

  const projectSummaries = useMemo(() => {
    const summaries = Object.fromEntries(projects.map((project) => [String(project.id), {
      total: 0,
      done: 0,
      overdue: 0,
      dueSoon: 0
    }]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inThreeDays = addDays(today, 3);

    for (const task of tasks) {
      const key = String(task.project_id);
      const summary = summaries[key];
      if (!summary) continue;

      summary.total += 1;
      if (task.status === 'done') summary.done += 1;

      const due = task.due_date ? new Date(task.due_date) : null;
      if (due && !Number.isNaN(due.getTime())) {
        due.setHours(0, 0, 0, 0);
        if (due < today && task.status !== 'done') summary.overdue += 1;
        if (due >= today && due <= inThreeDays && task.status !== 'done') summary.dueSoon += 1;
      }
    }

    return summaries;
  }, [projects, tasks]);

  const currentWeekText = useMemo(() => {
    const start = startOfWeek(new Date());
    return weekLabel(start);
  }, []);

  const filteredDeletedTasks = useMemo(() => {
    if (!selectedProjectId) return deletedTasks;
    return deletedTasks.filter((task) => String(task.project_id) === String(selectedProjectId));
  }, [deletedTasks, selectedProjectId]);

  const weekBuckets = useMemo(() => {
    const now = new Date();
    const thisWeek = startOfWeek(now);

    const weeks = Array.from({ length: 6 }, (_, index) => {
      const offset = index - 1;
      const start = addDays(thisWeek, offset * 7);
      const end = addDays(start, 6);
      const items = filteredTasks
        .filter((task) => {
          if (!task.due_date) return false;
          const due = new Date(task.due_date);
          if (Number.isNaN(due.getTime())) return false;
          due.setHours(0, 0, 0, 0);
          return due >= start && due <= end;
        })
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

      return {
        key: start.toISOString(),
        title: offset === 0 ? `Current Week (${weekLabel(start)})` : weekLabel(start),
        items
      };
    });

    const unscheduled = filteredTasks.filter((task) => !asDateOnly(task.due_date));
    return { weeks, unscheduled };
  }, [filteredTasks]);

  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const start = startOfWeek(firstOfMonth);

    const taskMap = filteredTasks.reduce((acc, task) => {
      const key = asDateOnly(task.due_date);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});

    for (const key of Object.keys(taskMap)) {
      taskMap[key].sort((a, b) => (a.priority > b.priority ? -1 : 1));
    }

    const cells = Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);
      const key = asDateOnly(date);
      return {
        key,
        date,
        inMonth: date.getMonth() === month,
        tasks: taskMap[key] || []
      };
    });

    return { cells, monthLabel: firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }, [filteredTasks, calendarMonth]);

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load projects');
      setProjects(json.data);
      setSelectedProjectId((prev) => {
        if (prev && json.data.some((p) => String(p.id) === String(prev))) return prev;
        return json.data[0] ? String(json.data[0].id) : '';
      });
    } catch (e) {
      setError(e.message);
    }
  }

  function openProject(projectId) {
    setSelectedProjectId(String(projectId));
    setPage('board');
    setSelectedTaskId(null);
    setShowDeletedModal(false);
  }

  async function createProject(e) {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;

    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: newProjectDescription.trim() })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to create project');

      setProjects((prev) => {
        const exists = prev.some((p) => p.id === json.data.id);
        return exists ? prev : [...prev, json.data];
      });
      setNewProjectName('');
      setNewProjectDescription('');
      openProject(json.data.id);
    } catch (e) {
      setError(e.message);
    }
  }

  function requestDeleteProject(project) {
    if (!project) return;
    setProjectPendingDelete(project);
  }

  async function deleteProject(project) {
    if (!project) return;

    setError('');
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete project');

      const remainingProjects = projects.filter((p) => p.id !== project.id);
      const fallbackProjectId = remainingProjects[0] ? String(remainingProjects[0].id) : '';

      setProjects(remainingProjects);
      setTasks((prev) => prev.filter((task) => String(task.project_id) !== String(project.id)));
      setDeletedTasks((prev) => prev.filter((task) => String(task.project_id) !== String(project.id)));
      setSelectedTaskId(null);
      setSelectedProjectId((prev) => (String(prev) === String(project.id) ? fallbackProjectId : prev));
      setPage('projects');
      setProjectPendingDelete(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadDeletedCount() {
    try {
      const res = await fetch('/api/tasks/deleted');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load deleted tasks');
      setDeletedCount(json.data.length);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadDeletedTasks() {
    try {
      const res = await fetch('/api/tasks/deleted');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load deleted tasks');
      setDeletedTasks(json.data);
      setDeletedCount(json.data.length);
    } catch (e) {
      setError(e.message);
    }
  }

  async function openDeletedTasks() {
    await loadDeletedTasks();
    setShowDeletedModal(true);
  }

  async function restoreTask(id) {
    setError('');
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to restore task');
      setTasks((prev) => [json.data, ...prev]);
      setDeletedTasks((prev) => prev.filter((t) => t.id !== id));
      setDeletedCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setError(e.message);
    }
  }

  async function permanentlyDeleteTask(id) {
    setError('');
    const confirmed = window.confirm('Permanently delete this task? This cannot be undone.');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tasks/deleted/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to permanently delete task');
      setDeletedTasks((prev) => prev.filter((t) => t.id !== id));
      setDeletedCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setError(e.message);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    if (!form.title.trim() || !selectedProjectId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, due_date: form.due_date || null, project_id: Number(selectedProjectId) })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to create');
      setTasks((prev) => [json.data, ...prev]);
      setForm({ title: '', description: '', status: 'backlog', priority: 'medium', due_date: '' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(id, updates) {
    setError('');
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, ...updates })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update');
      setTasks((prev) => prev.map((t) => (t.id === id ? json.data : t)));
    } catch (e) {
      setError(e.message);
    }
  }

  function handleDueDateInputChange(taskId, event) {
    const nextValue = event.target.value;
    patchTask(taskId, { due_date: nextValue || null });

    if (!nextValue) {
      requestAnimationFrame(() => {
        event.target?.blur?.();
      });
    }
  }

  async function removeTask(id) {
    setError('');
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete');
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSelectedTaskId((prev) => (prev === id ? null : prev));
      setDeletedCount((prev) => prev + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  function onDragStart(e, taskId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
    setDraggingTaskId(taskId);
  }

  function onDragEnd() {
    setDraggingTaskId(null);
    setDragOverColumn('');
    setDragOverWeekKey('');
    setDragOverDate('');
  }

  function onDragOverColumn(e, columnKey) {
    e.preventDefault();
    if (dragOverColumn !== columnKey) setDragOverColumn(columnKey);
  }

  function getDraggedTask(e) {
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    if (!taskId || !Number.isInteger(taskId)) return null;
    return tasks.find((t) => t.id === taskId) || null;
  }

  async function onDropToColumn(e, columnKey) {
    e.preventDefault();
    setDragOverColumn('');

    const task = getDraggedTask(e);
    if (!task || task.status === columnKey) return;

    await patchTask(task.id, { status: columnKey });
  }

  function onDragOverWeek(e, weekKey) {
    e.preventDefault();
    if (dragOverWeekKey !== weekKey) setDragOverWeekKey(weekKey);
  }

  async function onDropToWeek(e, weekKey) {
    e.preventDefault();
    setDragOverWeekKey('');

    const task = getDraggedTask(e);
    if (!task) return;

    const nextDueDate = weekKey === 'unscheduled' ? null : asDateOnly(weekKey);
    if (asDateOnly(task.due_date) === nextDueDate) return;

    await patchTask(task.id, { due_date: nextDueDate });
  }

  function onDragOverDate(e, dateKey) {
    e.preventDefault();
    if (dragOverDate !== dateKey) setDragOverDate(dateKey);
  }

  async function onDropToDate(e, dateKey) {
    e.preventDefault();
    setDragOverDate('');

    const task = getDraggedTask(e);
    if (!task || asDateOnly(task.due_date) === dateKey) return;

    await patchTask(task.id, { due_date: dateKey });
  }

  if (page === 'projects') {
    return (
      <div className="page">
        <header className="header-row">
          <div>
            <h1>Boards</h1>
            <p>Select a board to continue.</p>
          </div>
        </header>

        <form className="project-create project-create-page" onSubmit={createProject}>
          <input
            placeholder="New board name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <input
            placeholder="Board description (optional)"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />
          <button type="submit">Add Board</button>
        </form>

        {error && <p className="error">{error}</p>}

        <main className="project-list">
          {projects.length === 0 ? <p className="empty">No boards yet. Create one to get started.</p> : null}
          {projects.map((project) => {
            const summary = projectSummaries[String(project.id)] || { total: 0, done: 0, overdue: 0, dueSoon: 0 };
            const active = Math.max(0, summary.total - summary.done);

            return (
              <article key={project.id} className="project-card">
                <strong>{project.name}</strong>
                {project.description ? <p>{project.description}</p> : null}
                <span>{summary.total} task{summary.total === 1 ? '' : 's'} • {active} active • {summary.done} done</span>
                <small>
                  {summary.overdue > 0 ? `${summary.overdue} overdue` : 'No overdue'}
                  {' • '}
                  {summary.dueSoon > 0 ? `${summary.dueSoon} due soon` : 'Nothing due soon'}
                </small>
                <div className="project-card-actions">
                  <button type="button" className="secondary project-open" onClick={() => openProject(project.id)}>
                    Open board
                  </button>
                  <button
                    type="button"
                    className="danger danger-inline project-delete"
                    title={`Delete board: ${project.name}`}
                    onClick={() => requestDeleteProject(project)}
                  >
                    Delete board
                  </button>
                </div>
              </article>
            );
          })}
        </main>

        {projectPendingDelete ? (
          <div className="modal-backdrop" onClick={() => setProjectPendingDelete(null)}>
            <section className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Delete Board</h2>
              <p className="modal-description">
                Delete <strong>{projectPendingDelete.name}</strong> and all tasks in this board? This cannot be undone.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setProjectPendingDelete(null)}>Cancel</button>
                <button className="danger danger-inline" onClick={() => deleteProject(projectPendingDelete)}>
                  Delete board
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="board-nav-row">
        <button className="secondary back-button" onClick={() => setPage('projects')}>← Boards</button>
      </div>
      <header className="header-row">
        <div>
          <h1>{selectedProject ? selectedProject.name : 'Scrum Board'}</h1>
          <p>{selectedProject?.description || 'No board description yet.'}</p>
          <p className="current-week">Current week: {currentWeekText}</p>
        </div>
      </header>

      <form className="create" onSubmit={createTask}>
        <input
          placeholder="Task title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
          {columns.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
          {priorities.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div className="create-field">
          <label htmlFor="new-task-due-date">Due date (optional)</label>
          <input
            id="new-task-due-date"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
        </div>
        <button disabled={saving || !selectedProjectId}>{saving ? 'Saving...' : 'Add Task'}</button>
        <button
          type="button"
          className="secondary"
          onClick={openDeletedTasks}
          disabled={deletedCount === 0}
          title={deletedCount === 0 ? 'No deleted tasks yet' : `View ${deletedCount} deleted task${deletedCount === 1 ? '' : 's'}`}
        >
          View Deleted Tasks
        </button>
      </form>

      <nav className="view-toggle" aria-label="View selector">
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Board</button>
        <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
        <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button>
      </nav>

      {error && <p className="error">{error}</p>}
      {loading ? <p>Loading...</p> : null}

      {view === 'board' ? (
        <main className="board">
          {columns.map((col) => (
            <section
              key={col.key}
              className={`column ${dragOverColumn === col.key ? 'column-drop-active' : ''}`}
              onDragOver={(e) => onDragOverColumn(e, col.key)}
              onDrop={(e) => onDropToColumn(e, col.key)}
              onDragLeave={() => setDragOverColumn((prev) => (prev === col.key ? '' : prev))}
            >
              <h2>{col.label}</h2>
              <div className="cards">
                {grouped[col.key]?.map((task) => (
                  <article
                    className={`card ${draggingTaskId === task.id ? 'card-dragging' : ''}`}
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, task.id)}
                    onDragEnd={onDragEnd}
                  >
                    <h3>{task.title}</h3>
                    {task.description ? <p>{task.description.slice(0, 90)}{task.description.length > 90 ? '…' : ''}</p> : null}

                    <p className="meta">Due: {formatDate(task.due_date)}</p>
                    <button className="secondary" onClick={() => setSelectedTaskId(task.id)}>Details</button>

                    <div className="row">
                      <label>Status</label>
                      <select value={task.status} onChange={(e) => patchTask(task.id, { status: e.target.value })}>
                        {columns.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="row">
                      <label>Priority</label>
                      <select value={task.priority} onChange={(e) => patchTask(task.id, { priority: e.target.value })}>
                        {priorities.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="row">
                      <label>Due</label>
                      <div className="due-input-row">
                        <input
                          type="date"
                          value={asDateOnly(task.due_date)}
                          onInput={(e) => handleDueDateInputChange(task.id, e)}
                        />
                        <button
                          type="button"
                          className="secondary due-clear"
                          onClick={() => patchTask(task.id, { due_date: null })}
                          disabled={!asDateOnly(task.due_date)}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <button className="danger" onClick={() => removeTask(task.id)}>Delete</button>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </main>
      ) : null}

      {view === 'week' ? (
        <main className="week-view">
          {weekBuckets.weeks.map((bucket) => (
            <section
              key={bucket.key}
              className={`week-column ${dragOverWeekKey === bucket.key ? 'drop-active' : ''}`}
              onDragOver={(e) => onDragOverWeek(e, bucket.key)}
              onDrop={(e) => onDropToWeek(e, bucket.key)}
              onDragLeave={() => setDragOverWeekKey((prev) => (prev === bucket.key ? '' : prev))}
            >
              <h2>{bucket.title}</h2>
              <div className="cards">
                {bucket.items.length === 0 ? <p className="empty">No tasks for this week. Drop a task here to schedule it.</p> : null}
                {bucket.items.map((task) => (
                  <article
                    className={`card ${draggingTaskId === task.id ? 'card-dragging' : ''}`}
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, task.id)}
                    onDragEnd={onDragEnd}
                  >
                    <h3>{task.title}</h3>
                    <p className="meta">{columns.find((c) => c.key === task.status)?.label || task.status} • {task.priority}</p>
                    <p className="meta">Due: {formatDate(task.due_date)}</p>
                    <button className="secondary" onClick={() => setSelectedTaskId(task.id)}>Details</button>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section
            className={`week-column ${dragOverWeekKey === 'unscheduled' ? 'drop-active' : ''}`}
            onDragOver={(e) => onDragOverWeek(e, 'unscheduled')}
            onDrop={(e) => onDropToWeek(e, 'unscheduled')}
            onDragLeave={() => setDragOverWeekKey((prev) => (prev === 'unscheduled' ? '' : prev))}
          >
            <h2>Unscheduled</h2>
            <div className="cards">
              {weekBuckets.unscheduled.length === 0 ? <p className="empty">Everything is scheduled. Drop here to clear due dates.</p> : null}
              {weekBuckets.unscheduled.map((task) => (
                <article
                  className={`card ${draggingTaskId === task.id ? 'card-dragging' : ''}`}
                  key={task.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, task.id)}
                  onDragEnd={onDragEnd}
                >
                  <h3>{task.title}</h3>
                  <p className="meta">{columns.find((c) => c.key === task.status)?.label || task.status} • {task.priority}</p>
                  <button className="secondary" onClick={() => setSelectedTaskId(task.id)}>Details</button>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : null}

      {view === 'calendar' ? (
        <main className="calendar-view">
          <div className="calendar-header">
            <button className="secondary" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>← Prev</button>
            <h2>{calendarData.monthLabel}</h2>
            <button className="secondary" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next →</button>
          </div>

          <div className="calendar-grid weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}
          </div>

          <div className="calendar-grid days">
            {calendarData.cells.map((cell) => (
              <article
                className={`calendar-cell ${cell.inMonth ? '' : 'calendar-cell-muted'} ${dragOverDate === cell.key ? 'drop-active' : ''}`}
                key={cell.key}
                onDragOver={(e) => onDragOverDate(e, cell.key)}
                onDrop={(e) => onDropToDate(e, cell.key)}
                onDragLeave={() => setDragOverDate((prev) => (prev === cell.key ? '' : prev))}
              >
                <div className="calendar-day-number">{cell.date.getDate()}</div>
                <div className="calendar-items">
                  {cell.tasks.slice(0, 3).map((task) => (
                    <button
                      key={task.id}
                      className={`calendar-pill ${draggingTaskId === task.id ? 'card-dragging' : ''}`}
                      onClick={() => setSelectedTaskId(task.id)}
                      title={task.title}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                      onDragEnd={onDragEnd}
                    >
                      {task.title}
                    </button>
                  ))}
                  {cell.tasks.length > 3 ? <small className="meta">+{cell.tasks.length - 3} more</small> : null}
                </div>
              </article>
            ))}
          </div>
        </main>
      ) : null}

      {projectPendingDelete ? (
        <div className="modal-backdrop" onClick={() => setProjectPendingDelete(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Board</h2>
            <p className="modal-description">
              Delete <strong>{projectPendingDelete.name}</strong> and all tasks in it? This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setProjectPendingDelete(null)}>Cancel</button>
              <button className="danger danger-inline" onClick={() => deleteProject(projectPendingDelete)}>
                Delete board
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="modal-backdrop" onClick={() => setSelectedTaskId(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedTask.title}</h2>
            <p className="modal-meta">Status: {selectedTask.status} • Priority: {selectedTask.priority} • Due: {formatDate(selectedTask.due_date)}</p>
            <p className="modal-description">{selectedTask.description || 'No description provided.'}</p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setSelectedTaskId(null)}>Close</button>
            </div>
          </section>
        </div>
      ) : null}

      {showDeletedModal ? (
        <div className="modal-backdrop" onClick={() => setShowDeletedModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Deleted Tasks</h2>
            <p className="modal-meta">Historical archive from this board.</p>
            <div className="deleted-list">
              {filteredDeletedTasks.length === 0 ? (
                <p className="modal-description">No deleted tasks for this board.</p>
              ) : (
                filteredDeletedTasks.map((task) => (
                  <article className="deleted-item" key={task.id}>
                    <strong>{task.title}</strong>
                    <p>{task.description || 'No description provided.'}</p>
                    <small>Status: {task.status} • Priority: {task.priority} • Due: {formatDate(task.due_date)} • Deleted: {new Date(task.deleted_at).toLocaleString()}</small>
                    <div className="deleted-actions">
                      <button className="secondary" onClick={() => restoreTask(task.id)}>Restore</button>
                      <button
                        className="danger danger-inline"
                        onClick={() => permanentlyDeleteTask(task.id)}
                        aria-label={`Permanently delete task: ${task.title}`}
                        title="Permanently delete this task"
                      >
                        Permanently delete task
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowDeletedModal(false)}>Close</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
