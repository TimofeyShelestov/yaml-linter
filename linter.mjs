import { createReadStream } from "fs";
import { createInterface } from "readline";
import * as regexes from "./regex.mjs";

const filePath = "test-file.yaml";

const readStream = createReadStream(filePath);
const rl = createInterface({ input: readStream });
let fileArr = [];
rl.on("line", (line) => {
  fileArr.push(line); // Process each line here
});

rl.on("close", () => {
  const indentTree = convertToIndentTree(fileArr);
  const errArray = [];

  // check for --- and ... directive (does no work)
  let hasDocumentStart = false;
  let hasDocumentEnd = false;

  for (let i = 0; i < fileArr.length; i++) {
    const line = fileArr[i].trim();

    if (line === "---") {
      if (i !== 0 && !hasDocumentStart) {
        errArray.push(
          `❌ Error: Line ${
            i + 1
          } - Misplaced '---'. It should only appear at the start of the file or to separate documents.`
        );
      }
      hasDocumentStart = true;
    } else if (line === "...") {
      if (i !== fileArr.length - 1) {
        errArray.push(
          `❌ Error: Line ${
            i + 1
          } - Misplaced '...'. It should only appear at the end of the file.`
        );
      }
      hasDocumentEnd = true;
    }
  }

  // If '...' appears but the file isn't finished properly
  if (hasDocumentEnd && fileArr[fileArr.length - 1].trim() !== "...") {
    errArray.push(`❌ Error: '...' should be the last line of the file.`);
  }

  // Main Check
  for (const [idx, element] of indentTree.entries()) {
    if (element.level % 2 !== 0) {
      errArray.push(
        `❌ Line ${
          idx + 2
        }: Incorrect indentation level. Indentation must be a multiple of 2.`
      );
    } else if (element.type == "list") {
      if (
        indentTree[idx - 1].type !== "key" &&
        indentTree[idx - 1].type !== "list"
      ) {
        errArray.push(
          `❌ Line ${
            idx + 2
          }: List item must be inside a valid list or under a parent key.`
        );
      }
    } else if (idx + 1 < indentTree.length && element.type == "key") {
      if (indentTree[idx + 1].type !== "list") {
        errArray.push(
          `❌ Line ${
            idx + 2
          }: Key does not have a child. A key must be followed by a nested value or a list.`
        );
      }
    }
  }

  if (errArray.length > 0) {
    printErrors(errArray);
  } else {
    console.log("Your YAML file has no errors!");
  }
});

function convertToIndentTree(fileArr) {
  const indentTree = [];

  for (const [idx, line] of fileArr.entries()) {
    const indentLevel = countLeadingSpaces(line);
    let key;
    let value;
    let type;

    if (
      regexes.tabAtTheBeginning.test(line) ||
      regexes.tabsInIndent.test(line)
    ) {
      console.warn(`Line ${idx + 2}: Tabs are not allowed in YAML`);
      return;
    }

    if (regexes.listItem.test(line)) {
      key = "-";
      value = line.trim().substring(2);
      type = "list";
    } else if (regexes.keyVal.test(line)) {
      [key, value] = line.split(/:\s*/, 2);
      key = key.trim();
      value = value.trim();
      type = "pair";
    } else if (regexes.keyNoVal.test(line)) {
      key = line.trim().replace(":", "");
      value = "";
      type = "key";
    } else {
      continue;
    }

    indentTree.push({ level: indentLevel, key, value, type });
  }

  return indentTree;
}

function countLeadingSpaces(line) {
  const match = line.match(/^ */); // Matches all spaces at the start
  return match ? match[0].length : 1;
}

function printErrors(errArray) {
  for (const err of errArray) {
    console.error(err);
  }
}
