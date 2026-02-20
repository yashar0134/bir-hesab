function registerExpenseHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT id, scope, paid_by AS paidBy, category, amount, expense_date AS expenseDate, description, created_at AS createdAt
      FROM expenses
      ORDER BY id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO expenses (scope, paid_by, category, amount, expense_date, description, created_at)
      VALUES (@scope, @paidBy, @category, @amount, @expenseDate, @description, @createdAt)
    `
  );
  const updateStmt = db.prepare(
    `
      UPDATE expenses
      SET scope = @scope,
          paid_by = @paidBy,
          category = @category,
          amount = @amount,
          expense_date = @expenseDate,
          description = @description
      WHERE id = @id
    `
  );
  const deleteStmt = db.prepare("DELETE FROM expenses WHERE id = ?");

  ipcMain.handle("expenses:list", () => listStmt.all());

  ipcMain.handle("expenses:create", (_, payload) => {
    const info = createStmt.run({
      scope: payload.scope || "business",
      paidBy: payload.paidBy || "",
      category: payload.category || "",
      amount: Number(payload.amount || 0),
      expenseDate: payload.expenseDate,
      description: payload.description || "",
      createdAt: new Date().toISOString()
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("expenses:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      scope: payload.scope || "business",
      paidBy: payload.paidBy || "",
      category: payload.category || "",
      amount: Number(payload.amount || 0),
      expenseDate: payload.expenseDate,
      description: payload.description || ""
    });
    return { ok: true };
  });

  ipcMain.handle("expenses:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });
}

module.exports = {
  registerExpenseHandlers
};
