function registerReminderHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT
        id,
        title,
        description,
        reminder_date AS reminderDate,
        is_done AS isDone,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM reminders
      ORDER BY reminder_date DESC, id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO reminders (title, description, reminder_date, is_done, created_at, updated_at)
      VALUES (@title, @description, @reminderDate, @isDone, @createdAt, @updatedAt)
    `
  );

  const updateStmt = db.prepare(
    `
      UPDATE reminders
      SET title = @title,
          description = @description,
          reminder_date = @reminderDate,
          is_done = @isDone,
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
        p.title AS projectTitle
      FROM settlements st
      LEFT JOIN projects p ON p.id = st.project_id
      ORDER BY st.settlement_date DESC, st.id DESC
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
      settlements: settlementsStmt.all()
    };
  });
}

module.exports = {
  registerReminderHandlers
};
