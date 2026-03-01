export default function BoardView({
  columns,
  grouped,
  dragOverColumn,
  setDragOverColumn,
  draggingTaskId,
  onDragOverColumn,
  onDropToColumn,
  onDragStart,
  onDragEnd,
  formatDate,
  asDateOnly,
  setSelectedTaskId,
  patchTask,
  priorities,
  handleDueDateInputChange,
  removeTask
}) {
  return (
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
  );
}
