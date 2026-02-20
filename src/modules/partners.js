function registerPartnerHandlers(ipcMain, db) {
  const listStmt = db.prepare(
    `
      SELECT id, full_name AS fullName, role, phone, share_percent AS sharePercent,
             payment_model AS paymentModel, salary_period AS salaryPeriod, salary_amount AS salaryAmount,
             is_active AS isActive, created_at AS createdAt
      FROM partners
      ORDER BY id DESC
    `
  );

  const createStmt = db.prepare(
    `
      INSERT INTO partners (full_name, role, phone, share_percent, payment_model, salary_period, salary_amount, is_active, created_at)
      VALUES (@fullName, @role, @phone, @sharePercent, @paymentModel, @salaryPeriod, @salaryAmount, @isActive, @createdAt)
    `
  );

  const updateStmt = db.prepare(
    `
      UPDATE partners
      SET full_name = @fullName,
          role = @role,
          phone = @phone,
          share_percent = @sharePercent,
          payment_model = @paymentModel,
          salary_period = @salaryPeriod,
          salary_amount = @salaryAmount,
          is_active = @isActive
      WHERE id = @id
    `
  );

  const deleteStmt = db.prepare("DELETE FROM partners WHERE id = ?");
  const listTermsStmt = db.prepare(
    `
      SELECT t.id, t.partner_id AS partnerId, t.project_id AS projectId,
             p.full_name AS partnerName, pr.title AS projectTitle,
             t.payment_model AS paymentModel, t.percent_value AS percentValue,
             t.salary_amount AS salaryAmount, t.created_at AS createdAt
      FROM partner_project_terms t
      JOIN partners p ON p.id = t.partner_id
      JOIN projects pr ON pr.id = t.project_id
      ORDER BY t.id DESC
    `
  );
  const upsertTermStmt = db.prepare(
    `
      INSERT INTO partner_project_terms (
        partner_id, project_id, payment_model, percent_value, salary_amount, created_at, updated_at
      )
      VALUES (@partnerId, @projectId, @paymentModel, @percentValue, @salaryAmount, @createdAt, @updatedAt)
      ON CONFLICT(partner_id, project_id) DO UPDATE SET
        payment_model = excluded.payment_model,
        percent_value = excluded.percent_value,
        salary_amount = excluded.salary_amount,
        updated_at = excluded.updated_at
    `
  );
  const deleteTermStmt = db.prepare("DELETE FROM partner_project_terms WHERE id = ?");
  const payablesStmt = db.prepare(
    `
      SELECT
        t.id AS termId,
        t.partner_id AS partnerId,
        p.full_name AS partnerName,
        t.project_id AS projectId,
        pr.title AS projectTitle,
        t.payment_model AS paymentModel,
        t.percent_value AS percentValue,
        t.salary_amount AS salaryAmount,
        COALESCE(c.clientReceived, 0) AS clientReceived,
        CASE
          WHEN t.payment_model = 'percent' THEN (COALESCE(c.clientReceived, 0) * t.percent_value / 100.0)
          ELSE t.salary_amount
        END AS dueAmount,
        COALESCE(pp.partnerPaid, 0) AS partnerPaid,
        CASE
          WHEN t.payment_model = 'percent' THEN (COALESCE(c.clientReceived, 0) * t.percent_value / 100.0) - COALESCE(pp.partnerPaid, 0)
          ELSE t.salary_amount - COALESCE(pp.partnerPaid, 0)
        END AS remainingAmount
      FROM partner_project_terms t
      JOIN partners p ON p.id = t.partner_id
      JOIN projects pr ON pr.id = t.project_id
      LEFT JOIN (
        SELECT project_id, SUM(amount) AS clientReceived
        FROM settlements
        WHERE settlement_type = 'client'
        GROUP BY project_id
      ) c ON c.project_id = t.project_id
      LEFT JOIN (
        SELECT related_id AS partner_id, project_id, SUM(amount) AS partnerPaid
        FROM settlements
        WHERE settlement_type = 'partner'
        GROUP BY related_id, project_id
      ) pp ON pp.partner_id = t.partner_id AND pp.project_id = t.project_id
      ORDER BY remainingAmount DESC
    `
  );

  ipcMain.handle("partners:list", () => listStmt.all());

  ipcMain.handle("partners:create", (_, payload) => {
    const info = createStmt.run({
      fullName: payload.fullName,
      role: payload.role || "",
      phone: payload.phone || "",
      sharePercent: Number(payload.sharePercent || 0),
      paymentModel: payload.paymentModel || "percent",
      salaryPeriod: payload.salaryPeriod || "monthly",
      salaryAmount: Number(payload.salaryAmount || 0),
      isActive: payload.isActive === false ? 0 : 1,
      createdAt: new Date().toISOString()
    });
    return { id: info.lastInsertRowid };
  });

  ipcMain.handle("partners:update", (_, payload) => {
    updateStmt.run({
      id: Number(payload.id),
      fullName: payload.fullName,
      role: payload.role || "",
      phone: payload.phone || "",
      sharePercent: Number(payload.sharePercent || 0),
      paymentModel: payload.paymentModel || "percent",
      salaryPeriod: payload.salaryPeriod || "monthly",
      salaryAmount: Number(payload.salaryAmount || 0),
      isActive: payload.isActive === false ? 0 : 1
    });
    return { ok: true };
  });

  ipcMain.handle("partners:delete", (_, payload) => {
    deleteStmt.run(Number(payload.id));
    return { ok: true };
  });

  ipcMain.handle("partners:terms:list", () => listTermsStmt.all());

  ipcMain.handle("partners:terms:upsert", (_, payload) => {
    const now = new Date().toISOString();
    upsertTermStmt.run({
      partnerId: Number(payload.partnerId),
      projectId: Number(payload.projectId),
      paymentModel: payload.paymentModel || "percent",
      percentValue: Number(payload.percentValue || 0),
      salaryAmount: Number(payload.salaryAmount || 0),
      createdAt: now,
      updatedAt: now
    });
    return { ok: true };
  });

  ipcMain.handle("partners:terms:delete", (_, payload) => {
    deleteTermStmt.run(Number(payload.id));
    return { ok: true };
  });

  ipcMain.handle("partners:payables:list", () =>
    payablesStmt.all().map((row) => ({
      ...row,
      remainingAmount: Number(row.remainingAmount || 0)
    }))
  );
}

module.exports = {
  registerPartnerHandlers
};
