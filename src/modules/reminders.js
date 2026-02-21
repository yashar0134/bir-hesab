function sanitizeRepeatType(raw) {
  const value = String(raw || "none").toLowerCase();
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }
  return "none";
}

function registerReminderHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT
        r.id,
        r.title,
        r.description,
        r.reminder_date AS reminderDate,
        r.is_done AS isDone,
        r.repeat_type AS repeatType,
        r.repeat_until AS repeatUntil,
        r.project_id AS projectId,
        r.partner_id AS partnerId,
        p.title AS projectTitle,
        pa.full_name AS partnerName,
        r.created_at AS createdAt,
        r.updated_at AS updatedAt
      FROM reminders r
      LEFT JOIN projects p ON p.id = r.project_id
      LEFT JOIN partners pa ON pa.id = r.partner_id
      ORDER BY r.reminder_date DESC, r.id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO reminders (
        title,
        description,
        reminder_date,
        is_done,
        repeat_type,
        repeat_until,
        project_id,
        partner_id,
        created_at,
        updated_at
      )
      VALUES (
        @title,
        @description,
        @reminderDate,
        @isDone,
        @repeatType,
        @repeatUntil,
        @projectId,
        @partnerId,
        @createdAt,
        @updatedAt
      )
    `
  );

  const updateStmt = db.prepare(
    `
      UPDATE reminders
      SET title = @title,
          description = @description,
          reminder_date = @reminderDate,
          is_done = @isDone,
          repeat_type = @repeatType,
          repeat_until = @repeatUntil,
          project_id = @projectId,
          partner_id = @partnerId,
          updated_at = @updatedAt
      WHERE id = @id
    `
  );

  const toggleDoneStmt = db.prepare(
    `
      UPDATE reminders
      SET is_done = @isDone,
          updated_at = @updatedAt
      WHERE id = @id
    `
  );

  const deleteStmt = db.prepare("DELETE FROM reminders WHERE id = ?");

  const settlementsStmt = db.prepare(
    `
      SELECT
        st.id,
        st.settlement_type AS settlementType,
        st.amount,
        st.payment_method AS paymentMethod,
        st.description,
        st.settlement_date AS settlementDate,
        st.project_id AS projectId,
        p.title AS projectTitle,
        pa.full_name AS partnerName,
        st.related_id AS relatedId
      FROM settlements st
      LEFT JOIN projects p ON p.id = st.project_id
      LEFT JOIN partners pa ON pa.id = st.related_id
      ORDER BY st.settlement_date DESC, st.id DESC
    `
  );

  const projectsStmt = db.prepare(
    `
      SELECT id, title
      FROM projects
      ORDER BY id DESC
    `
  );

  const partnersStmt = db.prepare(
    `
      SELECT id, full_name AS fullName
      FROM partners
      ORDER BY id DESC
    `
  );

  ipcMain.handle("reminders:list", () => listStmt.all());

  ipcMain.handle("reminders:create", (_, payload) => {
    const now = new Date().toISOString();
    const info = createStmt.run({
      title: payload.title,
      description: payload.description || "",
      reminderDate: payload.reminderDate,
      isDone: payload.isDone ? 1 : 0,
      repeatType: sanitizeRepeatType(payload.repeatType),
      repeatUntil: payload.repeatUntil || "",
      projectId: payload.projectId ? Number(payload.projectId) : null,
      partnerId: payload.partnerId ? Number(payload.partnerId) : null,
      createdAt: now,
      updatedAt: now
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("reminders:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      title: payload.title,
      description: payload.description || "",
      reminderDate: payload.reminderDate,
      isDone: payload.isDone ? 1 : 0,
      repeatType: sanitizeRepeatType(payload.repeatType),
      repeatUntil: payload.repeatUntil || "",
      projectId: payload.projectId ? Number(payload.projectId) : null,
      partnerId: payload.partnerId ? Number(payload.partnerId) : null,
      updatedAt: new Date().toISOString()
    });
    return { ok: true };
  });

  ipcMain.handle("reminders:toggle-done", (_, payload) => {
    toggleDoneStmt.run({
      id: Number(payload.id),
      isDone: payload.isDone ? 1 : 0,
      updatedAt: new Date().toISOString()
    });
    return { ok: true };
  });

  ipcMain.handle("reminders:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });

  ipcMain.handle("reminders:calendar-data", () => {
    return {
      reminders: listStmt.all(),
      settlements: settlementsStmt.all(),
      projects: projectsStmt.all(),
      partners: partnersStmt.all()
    };
  });
}

module.exports = {
  registerReminderHandlers
};
