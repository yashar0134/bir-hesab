function registerCashboxHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT id, entry_type AS entryType, amount, category, reference_type AS referenceType, reference_id AS referenceId, entry_date AS entryDate, description, created_at AS createdAt
      FROM cashbox
      ORDER BY id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO cashbox (entry_type, amount, category, reference_type, reference_id, entry_date, description, created_at)
      VALUES (@entryType, @amount, @category, @referenceType, @referenceId, @entryDate, @description, @createdAt)
    `
  );
  const updateStmt = db.prepare(
    `
      UPDATE cashbox
      SET entry_type = @entryType,
          amount = @amount,
          category = @category,
          reference_type = @referenceType,
          reference_id = @referenceId,
          entry_date = @entryDate,
          description = @description
      WHERE id = @id
    `
  );
  const deleteStmt = db.prepare("DELETE FROM cashbox WHERE id = ?");

  ipcMain.handle("cashbox:list", () => listStmt.all());

  ipcMain.handle("cashbox:create", (_, payload) => {
    const info = createStmt.run({
      entryType: payload.entryType || "in",
      amount: Number(payload.amount || 0),
      category: payload.category || "",
      referenceType: payload.referenceType || "",
      referenceId: payload.referenceId ? Number(payload.referenceId) : null,
      entryDate: payload.entryDate,
      description: payload.description || "",
      createdAt: new Date().toISOString()
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("cashbox:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      entryType: payload.entryType || "in",
      amount: Number(payload.amount || 0),
      category: payload.category || "",
      referenceType: payload.referenceType || "",
      referenceId: payload.referenceId ? Number(payload.referenceId) : null,
      entryDate: payload.entryDate,
      description: payload.description || ""
    });
    return { ok: true };
  });

  ipcMain.handle("cashbox:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });
}

module.exports = {
  registerCashboxHandlers
};
