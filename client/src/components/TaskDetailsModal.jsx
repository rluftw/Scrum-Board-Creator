export default function TaskDetailsModal({ task, onClose, formatDate }) {
  if (!task) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{task.title}</h2>
        <p className="modal-meta">Status: {task.status} • Priority: {task.priority} • Due: {formatDate(task.due_date)}</p>
        <p className="modal-description">{task.description || 'No description provided.'}</p>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
