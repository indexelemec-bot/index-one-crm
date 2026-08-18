const INDEX_ONE_WEBHOOK_URL = 'https://TU-DOMINIO/api/marketing/google-forms/webhook';
const INDEX_ONE_WEBHOOK_SECRET = 'PEGA_AQUI_EL_SECRETO';

function onFormSubmit(e) {
  const response = e && e.namedValues ? e.namedValues : {};
  const payload = {
    formName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheetName: e && e.range ? e.range.getSheet().getName() : '',
    row: e && e.range ? e.range.getRow() : '',
    namedValues: response
  };

  const result = UrlFetchApp.fetch(INDEX_ONE_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-index-form-secret': INDEX_ONE_WEBHOOK_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = result.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`INDEX ONE respondió ${code}: ${result.getContentText()}`);
  }
}
