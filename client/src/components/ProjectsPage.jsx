import DeleteBoardModal from './DeleteBoardModal';

export default function ProjectsPage({
  error,
  projects,
  newProjectName,
  setNewProjectName,
  newProjectDescription,
  setNewProjectDescription,
  createProject,
  projectSummaries,
  openProject,
  requestDeleteProject,
  projectPendingDelete,
  setProjectPendingDelete,
  deleteProject
}) {
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

      <DeleteBoardModal
        project={projectPendingDelete}
        onCancel={() => setProjectPendingDelete(null)}
        onConfirm={deleteProject}
      />
    </div>
  );
}
