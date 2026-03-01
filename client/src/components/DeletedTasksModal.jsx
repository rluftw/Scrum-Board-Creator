export default function DeletedTasksModal({
  open,
  onClose,
  tasks,
  formatDate,
  restoreTask,
  permanentlyDeleteTask
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Deleted Tasks</h2>
        <p className="modal-meta">Historical archive from this board.</p>
        <div className="deleted-list">
          {tasks.length === 0 ? (
            <p className="modal-description">No deleted tasks for this board.</p>
          ) : (
            tasks.map((task) => (
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
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
