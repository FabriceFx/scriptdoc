/**
 * Includes the contents of a file.
 * @param {string} filename The name of the file to include.
 * @return {string} The content of the file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
    .getContent();
}
