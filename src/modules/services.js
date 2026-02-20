function registerServiceHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT id, name, pricing_model AS pricingModel, rate, currency, description, is_active AS isActive, created_at AS createdAt
      FROM services
      ORDER BY id DESC
    `
  );
  const createStmt = db.prepare(
    `
      INSERT INTO services (name, pricing_model, rate, currency, description, is_active, created_at)
      VALUES (@name, @pricingModel, @rate, @currency, @description, @isActive, @createdAt)
    `
  );
  const updateStmt = db.prepare(
    `
      UPDATE services
      SET name = @name,
          pricing_model = @pricingModel,
          rate = @rate,
          currency = @currency,
          description = @description,
          is_active = @isActive
      WHERE id = @id
    `
  );
  const deleteStmt = db.prepare("DELETE FROM services WHERE id = ?");

  ipcMain.handle("services:list", () => listStmt.all());

  ipcMain.handle("services:create", (_, payload) => {
    const info = createStmt.run({
      name: payload.name,
      pricingModel: payload.pricingModel,
      rate: Number(payload.rate || 0),
      currency: payload.currency || "TOMAN",
      description: payload.description || "",
      isActive: payload.isActive === false ? 0 : 1,
      createdAt: new Date().toISOString()
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("services:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      name: payload.name,
      pricingModel: payload.pricingModel,
      rate: Number(payload.rate || 0),
      currency: payload.currency || "TOMAN",
      description: payload.description || "",
      isActive: payload.isActive === false ? 0 : 1
    });
    return { ok: true };
  });

  ipcMain.handle("services:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });
}

module.exports = {
  registerServiceHandlers
};
