function registerSettlementHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT
        st.id,
        st.settlement_type AS settlementType,
        st.related_id AS relatedId,
        st.project_id AS projectId,
        p.title AS projectTitle,
        st.amount,
        st.payment_method AS paymentMethod,
        st.description,
        st.settlement_date AS settlementDate,
        st.created_at AS createdAt
      FROM settlements st
      LEFT JOIN projects p ON p.id = st.project_id
      ORDER BY st.id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO settlements (settlement_type, related_id, project_id, amount, payment_method, description, settlement_date, created_at)
      VALUES (@settlementType, @relatedId, @projectId, @amount, @paymentMethod, @description, @settlementDate, @createdAt)
    `
  );
  const updateStmt = db.prepare(
    `
      UPDATE settlements
      SET settlement_type = @settlementType,
          related_id = @relatedId,
          project_id = @projectId,
          amount = @amount,
          payment_method = @paymentMethod,
          description = @description,
          settlement_date = @settlementDate
      WHERE id = @id
    `
  );
  const deleteStmt = db.prepare("DELETE FROM settlements WHERE id = ?");

  ipcMain.handle("settlements:list", () => listStmt.all());

  ipcMain.handle("settlements:create", (_, payload) => {
    const info = createStmt.run({
      settlementType: payload.settlementType,
      relatedId: payload.relatedId ? Number(payload.relatedId) : null,
      projectId: payload.projectId ? Number(payload.projectId) : null,
      amount: Number(payload.amount || 0),
      paymentMethod: payload.paymentMethod || "cash",
      description: payload.description || "",
      settlementDate: payload.settlementDate,
      createdAt: new Date().toISOString()
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("settlements:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      settlementType: payload.settlementType,
      relatedId: payload.relatedId ? Number(payload.relatedId) : null,
      projectId: payload.projectId ? Number(payload.projectId) : null,
      amount: Number(payload.amount || 0),
      paymentMethod: payload.paymentMethod || "cash",
      description: payload.description || "",
      settlementDate: payload.settlementDate
    });
    return { ok: true };
  });

  ipcMain.handle("settlements:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });
}

module.exports = {
  registerSettlementHandlers
};
