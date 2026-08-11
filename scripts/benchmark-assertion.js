function hasExceededRenderBudget(row) {
  const limit = row?.budget?.budget?.renderP95Ms;
  return Number.isFinite(row?.renderP95Ms) && Number.isFinite(limit) && row.renderP95Ms > limit;
}

export function selectBenchmarkAssertions(results) {
  const rows = Array.isArray(results) ? results : [];
  const assertedRows = rows.filter((row) => row?.requestedBackend === 'auto');
  const experienceDiagnostics = assertedRows.filter((row) => row?.budget?.passed === false);
  const renderWorkFailures = assertedRows.filter(hasExceededRenderBudget);
  const warnings = experienceDiagnostics.filter((row) => !renderWorkFailures.includes(row));
  const nonAutoDiagnostics = rows.filter((row) => row?.requestedBackend !== 'auto' && row?.budget?.passed === false);
  return Object.freeze({
    passed: renderWorkFailures.length === 0,
    assertedRows: Object.freeze(assertedRows),
    renderWorkFailures: Object.freeze(renderWorkFailures),
    experienceDiagnostics: Object.freeze(experienceDiagnostics),
    warnings: Object.freeze(warnings),
    nonAutoDiagnostics: Object.freeze(nonAutoDiagnostics),
  });
}
