export default function DeleteBoardModal({ project, onCancel, onConfirm, bodyText = 'and all tasks in this board' }) {
  if (!project) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <section className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Delete Board</h2>
        <p className="modal-description">
          Delete <strong>{project.name}</strong> {bodyText}? This cannot be undone.
        </p>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button className="danger danger-inline" onClick={() => onConfirm(project)}>
            Delete board
          </button>
        </div>
      </section>
    </div>
  );
}
