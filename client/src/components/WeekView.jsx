export default function WeekView({
  weekBuckets,
  dragOverWeekKey,
  setDragOverWeekKey,
  draggingTaskId,
  onDragOverWeek,
  onDropToWeek,
  onDragStart,
  onDragEnd,
  setSelectedTaskId,
  columns,
  formatDate
}) {
  return (
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
  );
}
