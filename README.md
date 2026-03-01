# Scrum Board App

Interactive scrum board with:
- **React + Vite** frontend
- **Express API** backend
- **SQLite** persistence (`server/scrum.db`)

## Features
- Create task (title, description, status, priority)
- Move tasks between columns via status dropdown
- Update priority
- Delete tasks
- Data persists in SQLite

## Run

### 1) Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2) Start backend

```bash
cd server
npm run dev
```

Backend runs at: `http://localhost:4000`

### 3) Start frontend

```bash
cd client
npm run dev
```

Frontend runs at: `http://localhost:5173`

Vite proxies `/api` calls to the backend.

## API
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/health`
