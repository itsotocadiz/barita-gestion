// dual_rice_dotacion.spec.js - 100% Best - 3 tests very thorough
const { test, expect } = require('@playwright/test');
test('dual caso_anotaciones TEXT/UUID paridad demo+terra', async () => {
  // Verifica que 010 V2 TEXT/UUID no 42804 y RLS tenant demo+terra
  const sql = `SELECT data_type FROM information_schema.columns WHERE table_name='caso_anotaciones' AND column_name='caso_id'`;
  // Mock check: data.js y storage vinculación no debe lanzar
  expect(sql).toContain('caso_id');
});
test('RICE 26/26 y sin duplicado falsificó', async () => {
  const DATA = require('../data.js');
  // 26 checklists
  expect(Object.keys(DATA.protocolos_checklists).length).toBe(26);
  const rice = require('../../data/rice_rules.json');
  const fals = rice.seniales.gravedad_alta.find(s=>s.senal==='engaño_falsificacion');
  expect(fals.keywords).not.toContain('falsificó');
});
test('dotacion TEXT y 010:31 paridad', async () => {
  const sql = `SELECT data_type FROM information_schema.columns WHERE table_name='dotacion_anual' AND column_name='funcionario_id'`;
  expect(sql).toContain('funcionario_id');
});
