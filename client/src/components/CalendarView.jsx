export default function CalendarView({
  calendarData,
  dragOverDate,
  setDragOverDate,
  draggingTaskId,
  onDragOverDate,
  onDropToDate,
  onDragStart,
  onDragEnd,
  setSelectedTaskId,
  setCalendarMonth
}) {
  return (
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
  );
}
