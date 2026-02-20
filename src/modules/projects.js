function registerProjectHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT
        p.id,
        p.title,
        p.client_name AS clientName,
        p.status,
        p.start_date AS startDate,
        p.end_date AS endDate,
        p.notes,
        p.created_at AS createdAt,
        COALESCE(GROUP_CONCAT(ps.service_id), '') AS serviceIdsCsv,
        COALESCE(GROUP_CONCAT(s.name, ' | '), '') AS serviceNames
      FROM projects p
      LEFT JOIN project_services ps ON ps.project_id = p.id
      LEFT JOIN services s ON s.id = ps.service_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO projects (title, client_name, status, start_date, end_date, notes, created_at)
      VALUES (@title, @clientName, @status, @startDate, @endDate, @notes, @createdAt)
    `
  );

  const updateStmt = db.prepare(
    `
      UPDATE projects
      SET title = @title,
          client_name = @clientName,
          status = @status,
          start_date = @startDate,
          end_date = @endDate,
          notes = @notes
      WHERE id = @id
    `
  );

  const deleteStmt = db.prepare("DELETE FROM projects WHERE id = ?");
  const deleteProjectServicesStmt = db.prepare(
    "DELETE FROM project_services WHERE project_id = ?"
  );
  const insertProjectServiceStmt = db.prepare(
    "INSERT OR IGNORE INTO project_services (project_id, service_id, created_at) VALUES (?, ?, ?)"
  );

  ipcMain.handle("projects:list", () =>
    listStmt.all().map((row) => ({
      ...row,
      serviceIds: row.serviceIdsCsv
        ? row.serviceIdsCsv.split(",").map((x) => Number(x))
        : [],
      serviceNames: row.serviceNames || ""
    }))
  );

  ipcMain.handle("projects:create", (_, payload) => {
    const now = new Date().toISOString();
    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [];
    const tx = db.transaction(() => {
      const info = createStmt.run({
        title: payload.title,
        clientName: payload.clientName,
        status: payload.status || "open",
        startDate: payload.startDate,
        endDate: payload.endDate || "",
        notes: payload.notes || "",
        createdAt: now
      });
      const projectId = Number(info.lastInsertRowid);
      for (const serviceId of serviceIds) {
        insertProjectServiceStmt.run(projectId, serviceId, now);
      }
      return projectId;
    });
    const id = tx();
    return { id };
  });

  ipcMain.handle("projects:update", (_, payload) => {
    const projectId = Number(payload.id);
    const now = new Date().toISOString();
    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [];
    const tx = db.transaction(() => {
      updateStmt.run({
        id: projectId,
        title: payload.title,
        clientName: payload.clientName,
        status: payload.status || "open",
        startDate: payload.startDate,
        endDate: payload.endDate || "",
        notes: payload.notes || ""
      });
      deleteProjectServicesStmt.run(projectId);
      for (const serviceId of serviceIds) {
        insertProjectServiceStmt.run(projectId, serviceId, now);
      }
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle("projects:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });
}

module.exports = {
  registerProjectHandlers
};
